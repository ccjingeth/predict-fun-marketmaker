import type { Market } from '../types.js';

export interface YesNoPair {
  key: string;
  yes: Market;
  no: Market;
}

function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .replace(/\b(yes|no|true|false)\b/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferOutcome(market: Market): 'YES' | 'NO' | null {
  const rawOutcome = String(market.outcome || '').toUpperCase();
  if (rawOutcome.includes('YES')) return 'YES';
  if (rawOutcome.includes('NO')) return 'NO';

  const q = market.question.toLowerCase();
  if (/\b(yes|true)\b/.test(q)) return 'YES';
  if (/\b(no|false)\b/.test(q)) return 'NO';

  return null;
}

function getGroupKey(market: Market): string {
  return market.condition_id || market.event_id || normalizeQuestion(market.question);
}

export function buildYesNoPairs(markets: Market[]): YesNoPair[] {
  const map = new Map<string, { key: string; yes?: Market; no?: Market }>();

  for (const market of markets) {
    const key = getGroupKey(market);
    if (!key) {
      continue;
    }

    const outcome = inferOutcome(market);
    if (!outcome) {
      continue;
    }

    const pair = map.get(key) || { key };
    if (outcome === 'YES') {
      pair.yes = market;
    } else {
      pair.no = market;
    }

    map.set(key, pair);
  }

  return Array.from(map.values())
    .filter((p): p is { key: string; yes: Market; no: Market } => Boolean(p.yes && p.no))
    .map((p) => ({ key: p.key, yes: p.yes, no: p.no }));
}
