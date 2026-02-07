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
      return;
    }

    const raw = fs.readFileSync(resolved, 'utf8');
    if (!raw.trim()) {
      this.entries = [];
      return;
    }

    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      this.entries = parsed as CrossPlatformMappingEntry[];
    } else {
      this.entries = (parsed as CrossPlatformMappingFile).entries || [];
    }
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
}
