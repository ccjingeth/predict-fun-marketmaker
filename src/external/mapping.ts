import fs from 'node:fs';
import path from 'node:path';
import type { PlatformMarket } from './types.js';
import { normalizeQuestion } from './match.js';

export interface CrossPlatformMappingEntry {
  label?: string;
  predictMarketId?: string;
  predictQuestion?: string;
  polymarketYesTokenId?: string;
  polymarketNoTokenId?: string;
  opinionYesTokenId?: string;
  opinionNoTokenId?: string;
}

export interface CrossPlatformMappingFile {
  entries: CrossPlatformMappingEntry[];
}

export class CrossPlatformMappingStore {
  private entries: CrossPlatformMappingEntry[] = [];
  private sourcePath?: string;
  private tokenIndex: Map<string, CrossPlatformMappingEntry[]> = new Map();
  private predictIdIndex: Map<string, CrossPlatformMappingEntry[]> = new Map();
  private predictQuestionIndex: Map<string, CrossPlatformMappingEntry[]> = new Map();

  constructor(mappingPath?: string) {
    if (mappingPath) {
      this.load(mappingPath);
    }
  }

  load(mappingPath: string): void {
    const resolved = path.isAbsolute(mappingPath)
      ? mappingPath
      : path.join(process.cwd(), mappingPath);

    this.sourcePath = resolved;

    if (!fs.existsSync(resolved)) {
      this.entries = [];
      this.rebuildIndex();
      return;
    }

    const raw = fs.readFileSync(resolved, 'utf8');
    if (!raw.trim()) {
      this.entries = [];
      this.rebuildIndex();
      return;
    }

    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      this.entries = parsed as CrossPlatformMappingEntry[];
    } else {
      this.entries = (parsed as CrossPlatformMappingFile).entries || [];
    }
    this.rebuildIndex();
  }

  resolveMatches(
    predictMarket: PlatformMarket,
    allMarkets: Map<string, PlatformMarket[]>
  ): PlatformMarket[] {
    const entry = this.findEntryForPredict(predictMarket);
    if (!entry) {
      return [];
    }

    const results: PlatformMarket[] = [];

    const polymarket = this.findByTokens(
      allMarkets.get('Polymarket') || [],
      entry.polymarketYesTokenId,
      entry.polymarketNoTokenId
    );
    if (polymarket) {
      results.push(polymarket);
    }

    const opinion = this.findByTokens(
      allMarkets.get('Opinion') || [],
      entry.opinionYesTokenId,
      entry.opinionNoTokenId
    );
    if (opinion) {
      results.push(opinion);
    }

    return results;
  }

  filterPredictMarketsByExternalTokens(
    platform: string,
    tokenIds: Set<string>,
    predictMarkets: PlatformMarket[]
  ): PlatformMarket[] {
    if (!tokenIds || tokenIds.size === 0) {
      return [];
    }
    const entries = new Set<CrossPlatformMappingEntry>();
    for (const tokenId of tokenIds) {
      const key = `${platform}:${tokenId}`;
      const mapped = this.tokenIndex.get(key);
      if (mapped) {
        mapped.forEach((entry) => entries.add(entry));
      }
    }
    if (entries.size === 0) {
      return [];
    }
    const allowedIds = new Set<string>();
    const allowedQuestions = new Set<string>();
    for (const entry of entries) {
      if (entry.predictMarketId) {
        allowedIds.add(entry.predictMarketId);
      }
      if (entry.predictQuestion) {
        allowedQuestions.add(normalizeQuestion(entry.predictQuestion));
      }
    }
    if (allowedIds.size === 0 && allowedQuestions.size === 0) {
      return [];
    }
    return predictMarkets.filter((market) => {
      if (allowedIds.size > 0) {
        if (market.marketId && allowedIds.has(market.marketId)) return true;
        const conditionId = market.metadata?.conditionId;
        const eventId = market.metadata?.eventId;
        if (conditionId && allowedIds.has(conditionId)) return true;
        if (eventId && allowedIds.has(eventId)) return true;
      }
      if (allowedQuestions.size > 0) {
        const normalized = normalizeQuestion(market.question || '');
        if (normalized && allowedQuestions.has(normalized)) return true;
      }
      return false;
    });
  }

  private findEntryForPredict(predictMarket: PlatformMarket): CrossPlatformMappingEntry | null {
    const ids = new Set<string>();
    if (predictMarket.marketId) ids.add(predictMarket.marketId);
    const conditionId = predictMarket.metadata?.conditionId;
    const eventId = predictMarket.metadata?.eventId;
    if (conditionId) ids.add(conditionId);
    if (eventId) ids.add(eventId);

    for (const entry of this.entries) {
      if (entry.predictMarketId && ids.has(entry.predictMarketId)) {
        return entry;
      }
    }

    const question = normalizeQuestion(predictMarket.question || '');
    if (!question) return null;

    for (const entry of this.entries) {
      if (entry.predictQuestion && normalizeQuestion(entry.predictQuestion) === question) {
        return entry;
      }
    }

    return null;
  }

  private findByTokens(
    markets: PlatformMarket[],
    yesTokenId?: string,
    noTokenId?: string
  ): PlatformMarket | null {
    if (!yesTokenId || !noTokenId) {
      return null;
    }

    return (
      markets.find(
        (m) =>
          m.yesTokenId === yesTokenId &&
          m.noTokenId === noTokenId
      ) || null
    );
  }

  private rebuildIndex(): void {
    this.tokenIndex.clear();
    this.predictIdIndex.clear();
    this.predictQuestionIndex.clear();
    for (const entry of this.entries) {
      if (entry.predictMarketId) {
        this.addIndex(this.predictIdIndex, entry.predictMarketId, entry);
      }
      if (entry.predictQuestion) {
        const normalized = normalizeQuestion(entry.predictQuestion);
        if (normalized) {
          this.addIndex(this.predictQuestionIndex, normalized, entry);
        }
      }
      this.addTokenIndex('Polymarket', entry.polymarketYesTokenId, entry);
      this.addTokenIndex('Polymarket', entry.polymarketNoTokenId, entry);
      this.addTokenIndex('Opinion', entry.opinionYesTokenId, entry);
      this.addTokenIndex('Opinion', entry.opinionNoTokenId, entry);
    }
  }

  private addIndex(
    index: Map<string, CrossPlatformMappingEntry[]>,
    key: string,
    entry: CrossPlatformMappingEntry
  ): void {
    if (!key) return;
    if (!index.has(key)) {
      index.set(key, []);
    }
    index.get(key)!.push(entry);
  }

  private addTokenIndex(
    platform: string,
    tokenId: string | undefined,
    entry: CrossPlatformMappingEntry
  ): void {
    if (!tokenId) return;
    this.addIndex(this.tokenIndex, `${platform}:${tokenId}`, entry);
  }
}
