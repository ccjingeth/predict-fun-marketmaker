#!/usr/bin/env python3
"""Dependency arbitrage solver using OR-Tools.

Reads JSON from stdin and prints JSON to stdout.
"""

from __future__ import annotations

import json
import sys
import time
from typing import Dict, List, Any, Tuple

try:
    from ortools.linear_solver import pywraplp
    from ortools.sat.python import cp_model
except Exception as exc:  # pragma: no cover
    print(json.dumps({"status": "error", "error": f"ortools import failed: {exc}"}))
    sys.exit(0)


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except Exception:
        return default


def _load_input() -> Dict[str, Any]:
    raw = sys.stdin.read().strip()
    if not raw:
        return {}
    return json.loads(raw)


def _add_constraints(model: cp_model.CpModel, x: Dict[str, cp_model.IntVar], constraints: Dict[str, Any]) -> None:
    for group in constraints.get("groups", []) or []:
        ids = group.get("conditionIds") or []
        if not ids:
            continue
        group_type = (group.get("type") or "").lower()
        if group_type == "one_of":
            model.Add(sum(x[i] for i in ids) == 1)
        elif group_type == "at_most":
            k = int(group.get("k", 1))
            model.Add(sum(x[i] for i in ids) <= k)
        elif group_type == "at_least":
            k = int(group.get("k", 1))
            model.Add(sum(x[i] for i in ids) >= k)

    for rel in constraints.get("relations", []) or []:
        rel_type = (rel.get("type") or "").lower()
        if rel_type == "implies":
            a = rel.get("if")
            b = rel.get("then")
            if a in x and b in x:
                model.Add(x[a] <= x[b])
        elif rel_type == "mutual_exclusive":
            a = rel.get("a")
            b = rel.get("b")
            if a in x and b in x:
                model.Add(x[a] + x[b] <= 1)


def _solve_outcome(cond_ids: List[str], constraints: Dict[str, Any], target: str, timeout: float) -> Dict[str, int] | None:
    model = cp_model.CpModel()
    x = {cid: model.NewBoolVar(cid) for cid in cond_ids}
    _add_constraints(model, x, constraints)

    expr = sum(x[cid] for cid in cond_ids)
    if target == "min":
        model.Minimize(expr)
    else:
        model.Maximize(expr)

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = timeout
    status = solver.Solve(model)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return None
    return {cid: int(solver.Value(x[cid])) for cid in cond_ids}


def _solve_worst_outcome(
    cond_ids: List[str],
    constraints: Dict[str, Any],
    token_positions: List[Dict[str, Any]],
    timeout: float,
    scale: int,
) -> Dict[str, int] | None:
    model = cp_model.CpModel()
    x = {cid: model.NewBoolVar(cid) for cid in cond_ids}
    _add_constraints(model, x, constraints)

    coeffs: Dict[str, float] = {cid: 0.0 for cid in cond_ids}

    for tok in token_positions:
        delta = tok["delta"]
        cid = tok["conditionId"]
        if cid not in coeffs:
            continue
        if tok["outcome"] == "YES":
            coeffs[cid] += delta
        else:
            coeffs[cid] -= delta

    objective_terms = []
    for cid, coeff in coeffs.items():
        if abs(coeff) < 1e-12:
            continue
        objective_terms.append(int(round(coeff * scale)) * x[cid])

    model.Minimize(sum(objective_terms))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = timeout
    status = solver.Solve(model)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return None

    return {cid: int(solver.Value(x[cid])) for cid in cond_ids}


def _evaluate_payoff(token_positions: List[Dict[str, Any]], outcome: Dict[str, int]) -> float:
    payoff = 0.0
    for tok in token_positions:
        cid = tok["conditionId"]
        delta = tok["delta"]
        if tok["outcome"] == "YES":
            payoff += delta * outcome.get(cid, 0)
        else:
            payoff += delta * (1 - outcome.get(cid, 0))
    return payoff


def _solve_portfolio(
    outcomes: List[Dict[str, int]],
    tokens: List[Dict[str, Any]],
    settings: Dict[str, Any],
) -> Tuple[float, List[Dict[str, Any]], float] | None:
    solver = pywraplp.Solver.CreateSolver("CBC")
    if solver is None:
        return None

    max_legs = int(settings.get("maxLegs", 0) or 0)
    max_notional = _safe_float(settings.get("maxNotional", 0.0))
    allow_sells = bool(settings.get("allowSells", True))

    vars_buy = []
    vars_sell = []
    vars_use = []

    for idx, tok in enumerate(tokens):
        ask_size = _safe_float(tok.get("askSize", 0.0))
        bid_size = _safe_float(tok.get("bidSize", 0.0))
        if _safe_float(tok.get("ask", 0.0)) <= 0:
            ask_size = 0.0
        if _safe_float(tok.get("bid", 0.0)) <= 0:
            bid_size = 0.0
        if not allow_sells:
            bid_size = 0.0

        buy_var = solver.NumVar(0.0, ask_size, f"buy_{idx}")
        sell_var = solver.NumVar(0.0, bid_size, f"sell_{idx}")
        vars_buy.append(buy_var)
        vars_sell.append(sell_var)

        if max_legs > 0:
            use_var = solver.IntVar(0.0, 1.0, f"use_{idx}")
            vars_use.append(use_var)
            solver.Add(buy_var <= ask_size * use_var)
            solver.Add(sell_var <= bid_size * use_var)

    if max_legs > 0:
        solver.Add(sum(vars_use) <= max_legs)

    fee_bps_default = _safe_float(settings.get("feeBps", 0.0))
    slip_bps = _safe_float(settings.get("slippageBps", 0.0)) / 10000.0
    curve_rate = _safe_float(settings.get("feeCurveRate", 0.0))
    curve_exp = _safe_float(settings.get("feeCurveExponent", 0.0))

    def _calc_fee(price: float, fee_bps: float) -> float:
        if price <= 0 or fee_bps <= 0:
            return 0.0
        if curve_rate > 0 and curve_exp > 0:
            base_multiplier = fee_bps / 1000.0
            p = max(0.0, min(1.0, price))
            curve = curve_rate * ((p * (1 - p)) ** curve_exp)
            return p * base_multiplier * curve
        return price * (fee_bps / 10000.0)

    cost_terms = []
    notional_terms = []
    for tok, buy_var, sell_var in zip(tokens, vars_buy, vars_sell):
        fee_bps = max(_safe_float(tok.get("feeBps", 0.0)), fee_bps_default)
        ask = _safe_float(tok.get("ask", 0.0))
        bid = _safe_float(tok.get("bid", 0.0))
        buy_cost = ask + _calc_fee(ask, fee_bps) + ask * slip_bps
        sell_rev = bid - _calc_fee(bid, fee_bps) - bid * slip_bps
        cost_terms.append(buy_var * buy_cost)
        cost_terms.append(sell_var * (-sell_rev))
        if ask > 0:
            notional_terms.append(buy_var * ask)

    cost_expr = sum(cost_terms) if cost_terms else 0.0

    if max_notional > 0 and notional_terms:
        solver.Add(sum(notional_terms) <= max_notional)

    profit_var = solver.NumVar(-1e6, 1e6, "profit")

    for outcome in outcomes:
        payoff_terms = []
        for tok, buy_var, sell_var in zip(tokens, vars_buy, vars_sell):
            cid = tok["conditionId"]
            yes = outcome.get(cid, 0)
            coeff = yes if tok["outcome"] == "YES" else 1 - yes
            if coeff == 0:
                continue
            payoff_terms.append((buy_var - sell_var) * coeff)
        payoff_expr = sum(payoff_terms) if payoff_terms else 0.0
        solver.Add(payoff_expr - cost_expr >= profit_var)

    solver.Maximize(profit_var)

    status = solver.Solve()
    if status not in (pywraplp.Solver.OPTIMAL, pywraplp.Solver.FEASIBLE):
        return None

    profit = profit_var.solution_value()

    positions = []
    for tok, buy_var, sell_var in zip(tokens, vars_buy, vars_sell):
        buy_val = buy_var.solution_value()
        sell_val = sell_var.solution_value()
        if buy_val <= 1e-9 and sell_val <= 1e-9:
            continue
        positions.append({
            "tokenId": tok["tokenId"],
            "conditionId": tok["conditionId"],
            "outcome": tok["outcome"],
            "buy": buy_val,
            "sell": sell_val,
            "ask": _safe_float(tok.get("ask", 0.0)),
            "bid": _safe_float(tok.get("bid", 0.0)),
            "feeBps": _safe_float(tok.get("feeBps", 0.0)),
            "delta": buy_val - sell_val,
            "label": tok.get("label") or tok.get("question"),
        })

    cost_value = cost_expr.solution_value() if hasattr(cost_expr, "solution_value") else float(cost_expr)
    return profit, positions, cost_value


def main() -> None:
    data = _load_input()
    if not data:
        print(json.dumps({"status": "error", "error": "empty input"}))
        return

    conditions = data.get("conditions") or []
    tokens = data.get("tokens") or []
    constraints = {
        "groups": data.get("groups") or [],
        "relations": data.get("relations") or [],
    }
    settings = data.get("settings") or {}

    cond_ids = [c.get("id") for c in conditions if c.get("id")]
    if len(cond_ids) == 0:
        print(json.dumps({"status": "ok", "opportunities": []}))
        return

    min_profit = _safe_float(settings.get("minProfit", 0.0))
    min_depth = _safe_float(settings.get("minDepth", 0.0))
    min_depth_usd = _safe_float(settings.get("minDepthUsd", 0.0))
    allow_sells = bool(settings.get("allowSells", True))

    filtered_tokens = []
    for tok in tokens:
        ask = _safe_float(tok.get("ask", 0.0))
        bid = _safe_float(tok.get("bid", 0.0))
        ask_size = _safe_float(tok.get("askSize", 0.0))
        bid_size = _safe_float(tok.get("bidSize", 0.0))
        if ask_size < min_depth:
            ask_size = 0.0
        if bid_size < min_depth or not allow_sells:
            bid_size = 0.0
        if min_depth_usd > 0:
            if ask * ask_size < min_depth_usd:
                ask_size = 0.0
            if bid * bid_size < min_depth_usd:
                bid_size = 0.0
        tok["askSize"] = ask_size
        tok["bidSize"] = bid_size
        if ask > 0 or bid > 0:
            filtered_tokens.append(tok)

    if not filtered_tokens:
        print(json.dumps({"status": "ok", "opportunities": []}))
        return

    oracle_timeout = _safe_float(settings.get("oracleTimeout", 2.0))
    max_iter = int(settings.get("maxIter", 12))
    tol = _safe_float(settings.get("tolerance", 1e-5))
    scale = int(settings.get("scale", 1000000))

    outcomes: List[Dict[str, int]] = []
    for target in ("min", "max"):
        outcome = _solve_outcome(cond_ids, constraints, target, oracle_timeout)
        if outcome and outcome not in outcomes:
            outcomes.append(outcome)

    if not outcomes:
        print(json.dumps({"status": "error", "error": "no feasible outcome"}))
        return

    best_profit = -1e9
    best_positions: List[Dict[str, Any]] = []
    best_cost = 0.0
    best_outcomes = outcomes[:]

    start = time.time()
    for _ in range(max_iter):
        solved = _solve_portfolio(outcomes, filtered_tokens, settings)
        if not solved:
            break
        profit, positions, cost_value = solved
        if profit > best_profit:
            best_profit = profit
            best_positions = positions
            best_cost = cost_value
            best_outcomes = outcomes[:]

        worst = _solve_worst_outcome(cond_ids, constraints, positions, oracle_timeout, scale)
        if worst is None:
            break
        worst_payoff = _evaluate_payoff(positions, worst)
        worst_profit = worst_payoff - cost_value
        if worst_profit + tol >= profit:
            break
        if worst not in outcomes:
            outcomes.append(worst)

    if best_profit < min_profit:
        print(json.dumps({"status": "ok", "opportunities": []}))
        return

    legs = []
    for pos in best_positions:
        if pos["buy"] > 1e-8:
            legs.append({
                "tokenId": pos["tokenId"],
                "side": "BUY",
                "price": pos["ask"],
                "shares": pos["buy"],
                "label": pos.get("label"),
            })
        if pos["sell"] > 1e-8:
            legs.append({
                "tokenId": pos["tokenId"],
                "side": "SELL",
                "price": pos["bid"],
                "shares": pos["sell"],
                "label": pos.get("label"),
            })

    result = {
        "status": "ok",
        "runtimeMs": int((time.time() - start) * 1000),
        "guaranteedProfit": best_profit,
        "cost": best_cost,
        "legs": legs,
        "outcomes": best_outcomes,
    }

    print(json.dumps({"status": "ok", "opportunities": [result]}))


if __name__ == "__main__":
    main()
