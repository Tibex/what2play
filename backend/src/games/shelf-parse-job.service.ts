import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { GamesService } from './games.service';
import { ShelfParseGateway } from './shelf-parse.gateway';
import type { ShelfParseProgressPayload } from './shelf-parse.types';

type ShelfMediaType = 'image/jpeg' | 'image/png' | 'image/webp';

type JobRecord = {
  userId: string;
  buffer: Buffer;
  mediaType: ShelfMediaType;
  createdAt: number;
  status: 'queued' | 'running' | 'done' | 'error';
  lastProgress?: ShelfParseProgressPayload;
  completePayload?: unknown;
  errorMessage?: string;
};

@Injectable()
export class ShelfParseJobService {
  private readonly logger = new Logger(ShelfParseJobService.name);
  private readonly jobs = new Map<string, JobRecord>();

  constructor(
    private readonly gamesService: GamesService,
    @Inject(forwardRef(() => ShelfParseGateway))
    private readonly gateway: ShelfParseGateway,
  ) {
    const sweep = setInterval(() => this.sweepStaleJobs(), 60_000);
    sweep.unref();
  }

  snapshotForReplay(
    jobId: string,
    userId: string,
  ): {
    lastProgress?: ShelfParseProgressPayload;
    completePayload?: unknown;
    errorMessage?: string | null;
  } | null {
    const job = this.jobs.get(jobId);
    if (!job || job.userId !== userId) return null;
    return {
      lastProgress: job.lastProgress,
      completePayload: job.status === 'done' ? job.completePayload : undefined,
      errorMessage: job.status === 'error' ? (job.errorMessage ?? null) : null,
    };
  }

  createJob(userId: string, buffer: Buffer, mediaType: ShelfMediaType): string {
    const jobId = randomUUID();
    this.jobs.set(jobId, {
      userId,
      buffer,
      mediaType,
      createdAt: Date.now(),
      status: 'queued',
    });
    queueMicrotask(() => {
      void this.runJob(jobId);
    });
    return jobId;
  }

  private pushProgress(
    jobId: string,
    job: JobRecord,
    p: ShelfParseProgressPayload,
  ) {
    job.lastProgress = p;
    this.gateway.emitProgress(jobId, p);
  }

  private async runJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;
    if (job.status !== 'queued') return;
    job.status = 'running';
    try {
      const result = await this.gamesService.parseShelfPhoto(
        job.userId,
        job.buffer,
        job.mediaType,
        (p) => this.pushProgress(jobId, job, p),
      );
      job.buffer = Buffer.alloc(0);
      job.status = 'done';
      job.completePayload = result;
      this.gateway.emitComplete(jobId, result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Shelf parse failed';
      this.logger.warn(`Shelf parse job ${jobId} failed: ${message}`);
      job.buffer = Buffer.alloc(0);
      job.status = 'error';
      job.errorMessage = message;
      this.gateway.emitError(jobId, message);
    } finally {
      const t = setTimeout(() => this.jobs.delete(jobId), 120_000);
      t.unref();
    }
  }

  private sweepStaleJobs(): void {
    const now = Date.now();
    const maxAge = 15 * 60_000;
    for (const [id, job] of this.jobs) {
      if (now - job.createdAt > maxAge) {
        this.logger.warn(`Removing stale shelf-parse job ${id}`);
        this.jobs.delete(id);
      }
    }
  }
}
