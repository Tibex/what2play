import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { BggService } from '../bgg/bgg.service';
import { inspect } from 'node:util';

function parseLimitArg(): number {
  const arg = process.argv.find((token) => token.startsWith('--limit='));
  if (!arg) return 500;
  const parsed = Number.parseInt(arg.split('=')[1] || '', 10);
  if (Number.isNaN(parsed) || parsed <= 0) return 500;
  return parsed;
}

function parseForceArg(): boolean {
  return process.argv.includes('--force');
}

function parseStatusArg(): boolean {
  return process.argv.includes('--status');
}

async function run(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const bggService = app.get(BggService);
    if (parseStatusArg()) {
      const status = await bggService.shouldRunTopCatalogImportNow();
      process.stdout.write(`${JSON.stringify(status)}\n`);
      return;
    }

    const limit = parseLimitArg();
    const force = parseForceArg();
    const result = await bggService.runTopRankedImportWithCooldown({
      limit,
      force,
      trigger: 'manual',
    });
    // Keep output machine-readable for CI logs.
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.stack || error.message
        : inspect(error, { depth: 4, breakLength: 120 });
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void (async () => {
  await run();
})();
