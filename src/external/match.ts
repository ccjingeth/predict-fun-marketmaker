import type { PlatformMarket } from './types.js';

export function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .replace(/\b(yes|no|true|false|will|be|is|are|the|a|an)\b/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function similarityScore(a: string, b: string): number {
  const s1 = normalizeQuestion(a);
  const s2 = normalizeQuestion(b);
  if (!s1 || !s2) return 0;

  const words1 = new Set(s1.split(' '));
  const words2 = new Set(s2.split(' '));
  const intersection = new Set([...words1].filter((x) => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

export function findBestMatch(
  question: string,
  candidates: PlatformMarket[],
  minSimilarity: number
): { match: PlatformMarket | null; score: number } {
  let best: PlatformMarket | null = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    const score = similarityScore(question, candidate.question);
    if (score >= minSimilarity && score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return { match: best, score: bestScore };
}
