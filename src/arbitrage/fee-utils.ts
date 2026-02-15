/**
 * Fee helpers
 *
 * Notes:
 * - Polymarket fee-enabled markets use a fee-curve model:
 *   fee = C × feeRate × (p × (1 - p))^exponent
 *   (We approximate per-share fee as feeRate × (p × (1 - p))^exponent.)
 * - For other platforms or unknown fee models, we fall back to linear fee = price * feeRate.
 */

export interface FeeCurveConfig {
  feeRateBps: number;
  curveRate: number;
  curveExponent: number;
}

export function clampPrice(price: number): number {
  if (!Number.isFinite(price)) return 0;
  return Math.min(1, Math.max(0, price));
}

export function calcLinearFee(price: number, feeRateBps: number): number {
  if (!Number.isFinite(price) || !Number.isFinite(feeRateBps)) return 0;
  return price * (feeRateBps / 10000);
}

export function calcCurveFee(price: number, feeRateBps: number, curveRate: number, curveExponent: number): number {
  if (!Number.isFinite(price) || !Number.isFinite(feeRateBps)) return 0;
  if (!Number.isFinite(curveRate) || !Number.isFinite(curveExponent)) return 0;
  if (feeRateBps <= 0 || curveRate <= 0 || curveExponent <= 0) return 0;

  const p = clampPrice(price);
  const baseMultiplier = feeRateBps / 1000;
  const curve = curveRate * Math.pow(p * (1 - p), curveExponent);
  return baseMultiplier * curve;
}

export function calcFeeCost(
  price: number,
  feeRateBps: number,
  curveRate?: number,
  curveExponent?: number
): number {
  if (curveRate !== undefined && curveExponent !== undefined) {
    return calcCurveFee(price, feeRateBps, curveRate, curveExponent);
  }
  return calcLinearFee(price, feeRateBps);
}
