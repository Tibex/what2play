import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

export interface AiRerankContext {
  playerCount: number;
  durationMinutes?: number | null;
  preferredComplexity?: number | null;
  preferredDuration?: number | null;
}

interface GameSummary {
  id: string;
  title: string;
  bggRating: string | null;
  playingTime: number | null;
  complexity: string | null;
  players: string;
}

interface AiRankEntry {
  id: string;
  rank: number;
  reason: string;
}

type RerankCandidate = {
  game: {
    id: string;
    title: string;
    bggRating?: unknown;
    playingTime?: number | null;
    weight?: unknown;
    minPlayers?: number;
    maxPlayers?: number;
  };
  score: number;
  explanation: Record<string, string>;
};

const SYSTEM_PROMPT = `You are an expert board game night curator. Re-rank a list of board game candidates for the best group experience.

Prioritise in this order:
1. Player count fit — game officially supports this exact group size
2. Duration fit — playtime comfortably within available time
3. Complexity fit — matches the group's preferred weight
4. BGG rating — community quality signal
5. Variety of mechanics across the final list
6. Approachability for mixed skill levels

Output ONLY a JSON array — no markdown fences, no prose.
Format: [{"id":"<id>","rank":1,"reason":"<≤12 words>"},...]

Rules:
- Include EVERY game from the input, ranked 1 to N (1 = best)
- Do NOT invent ids; use the exact id strings provided
- Keep reasons concise and specific`;

@Injectable()
export class AiRecommendationService {
  private readonly logger = new Logger(AiRecommendationService.name);
  private readonly client: Anthropic | null;
  private readonly enabled: boolean;
  private static readonly TIMEOUT_MS = 8_000;
  private static readonly MAX_CANDIDATES = 20;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    this.enabled =
      this.configService.get<string>('AI_RECOMMENDATIONS_ENABLED') === 'true';
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
  }

  /**
   * Re-rank scored candidates using Claude Haiku.
   *
   * Returns the original array unchanged when AI is disabled, not configured,
   * times out, or returns invalid data. On success, each candidate gets an
   * `ai_reason` key injected into its explanation map.
   */
  async rerankCandidates<T extends RerankCandidate>(
    candidates: T[],
    context: AiRerankContext,
  ): Promise<T[]> {
    if (!this.enabled || !this.client || candidates.length === 0) {
      return candidates;
    }

    const top = candidates.slice(0, AiRecommendationService.MAX_CANDIDATES);
    const complexityLabel = this.complexityLabel(context.preferredComplexity);

    const gameList: GameSummary[] = top.map((c) => ({
      id: c.game.id,
      title: c.game.title,
      bggRating:
        c.game.bggRating != null
          ? Number(c.game.bggRating).toFixed(1)
          : null,
      playingTime: c.game.playingTime ?? null,
      complexity:
        c.game.weight != null ? Number(c.game.weight).toFixed(1) : null,
      players: `${c.game.minPlayers ?? '?'}-${c.game.maxPlayers ?? '?'}`,
    }));

    const userPromptLines = [
      'Group context:',
      `- Players: ${context.playerCount}`,
      `- Available time: ${context.durationMinutes ?? 'unknown'} min`,
      `- Complexity preference: ${complexityLabel}`,
    ];
    if (context.preferredDuration) {
      userPromptLines.push(
        `- Preferred game length: ~${context.preferredDuration} min`,
      );
    }
    userPromptLines.push('', `Candidates (${gameList.length}):`, JSON.stringify(gameList));
    const userPrompt = userPromptLines.join('\n');

    try {
      const response = await Promise.race([
        this.client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
        }),
        new Promise<never>((_, reject) => {
          const t = setTimeout(
            () => reject(new Error('AI rerank timeout')),
            AiRecommendationService.TIMEOUT_MS,
          );
          t.unref();
        }),
      ]);

      const text =
        response.content[0]?.type === 'text'
          ? response.content[0].text.trim()
          : '';

      const rankings: AiRankEntry[] = JSON.parse(text);

      const inputIds = new Set(top.map((c) => c.game.id));
      const valid = rankings.filter(
        (r) =>
          typeof r.id === 'string' &&
          typeof r.rank === 'number' &&
          inputIds.has(r.id),
      );

      if (valid.length < 2) {
        return candidates;
      }

      valid.sort((a, b) => a.rank - b.rank);
      const reasonMap = new Map(valid.map((r) => [r.id, r.reason]));
      const rankedIds = new Set(valid.map((r) => r.id));

      const tail = candidates.slice(AiRecommendationService.MAX_CANDIDATES);
      const missing = top.filter((c) => !rankedIds.has(c.game.id));

      const reranked = valid
        .map((r) => {
          const candidate = top.find((c) => c.game.id === r.id);
          if (!candidate) return null;
          const reason = reasonMap.get(r.id);
          if (!reason) return candidate as T;
          return {
            ...candidate,
            explanation: { ...candidate.explanation, ai_reason: reason },
          } as T;
        })
        .filter((c): c is T => c !== null);

      return [...reranked, ...missing, ...tail];
    } catch (err) {
      this.logger.warn(
        `AI rerank failed, using deterministic order: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return candidates;
    }
  }

  private complexityLabel(weight?: number | null): string {
    if (weight == null) return 'medium';
    if (weight < 2.2) return 'light';
    if (weight < 3.2) return 'medium';
    return 'heavy';
  }
}
