import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TRACKER_PATH = path.join(ROOT, 'docs', 'seo-query-rank-tracker.csv');

function parseArgs(argv) {
  const args = { exportPath: '', date: '' };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--export') {
      args.exportPath = argv[i + 1] ?? '';
      i += 1;
    } else if (token === '--date') {
      args.date = argv[i + 1] ?? '';
      i += 1;
    }
  }
  return args;
}

function splitCsvLine(line) {
  const out = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out;
}

function parseCsv(content) {
  const lines = content.replaceAll('\r\n', '\n').split('\n').filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = (cells[idx] ?? '').trim();
    });
    return row;
  });
  return { headers, rows };
}

function csvEscape(value) {
  const str = `${value ?? ''}`;
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replaceAll('"', '""')}"`;
  }
  return str;
}

function toNumber(value) {
  if (value == null) return Number.NaN;
  const cleaned = `${value}`.replaceAll(/[%,$\s]/g, '');
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : Number.NaN;
}

function normalizeQuery(query) {
  return `${query ?? ''}`.trim().toLowerCase();
}

function findColumn(headers, includesAny) {
  const lowered = headers.map((h) => h.toLowerCase());
  const idx = lowered.findIndex((h) => includesAny.some((needle) => h.includes(needle)));
  return idx >= 0 ? headers[idx] : '';
}

function fmtPosition(position) {
  return Number.isFinite(position) ? position.toFixed(1) : '';
}

function fmtCtr(rawCtr) {
  if (!Number.isFinite(rawCtr)) return '';
  return `${rawCtr.toFixed(2)}%`;
}

function ensureFileExists(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }
}

function buildFeatureSegment(rows, matcher) {
  const segmentRows = rows.filter(matcher);
  const top20 = segmentRows.filter((r) => r.top_20_status === 'yes');
  const outside = segmentRows.filter((r) => r.top_20_status === 'no');
  const unknown = segmentRows.filter((r) => r.top_20_status === 'unknown');
  const avgKnownPosition = outside
    .concat(top20)
    .map((r) => toNumber(r.avg_position))
    .filter((n) => Number.isFinite(n));
  const avgPosition =
    avgKnownPosition.length > 0
      ? (avgKnownPosition.reduce((sum, n) => sum + n, 0) / avgKnownPosition.length).toFixed(1)
      : 'n/a';

  return {
    total: segmentRows.length,
    top20: top20.length,
    outside: outside.length,
    unknown: unknown.length,
    avgPosition,
  };
}

function main() {
  const { exportPath, date } = parseArgs(process.argv);
  if (!exportPath) {
    console.error('Usage: npm run seo:rank-report -- --export <gsc-export.csv> [--date YYYY-MM-DD]');
    process.exit(1);
  }

  const runDate = date || new Date().toISOString().slice(0, 10);
  const exportAbsPath = path.isAbsolute(exportPath) ? exportPath : path.join(ROOT, exportPath);
  ensureFileExists(TRACKER_PATH);
  ensureFileExists(exportAbsPath);

  const trackerRaw = fs.readFileSync(TRACKER_PATH, 'utf8');
  const tracker = parseCsv(trackerRaw);
  if (tracker.headers.length === 0) {
    throw new Error('Tracker CSV is empty.');
  }

  const exportRaw = fs.readFileSync(exportAbsPath, 'utf8');
  const gsc = parseCsv(exportRaw);
  if (gsc.headers.length === 0) {
    throw new Error('Search Console export CSV is empty.');
  }

  const queryCol = findColumn(gsc.headers, ['query', 'queries']);
  const clicksCol = findColumn(gsc.headers, ['click']);
  const impressionsCol = findColumn(gsc.headers, ['impression']);
  const ctrCol = findColumn(gsc.headers, ['ctr']);
  const positionCol = findColumn(gsc.headers, ['position']);

  if (!queryCol || !positionCol) {
    throw new Error('Could not find required columns in export (query + position).');
  }

  const gscByQuery = new Map();
  for (const row of gsc.rows) {
    const key = normalizeQuery(row[queryCol]);
    if (!key) continue;
    gscByQuery.set(key, {
      clicks: clicksCol ? toNumber(row[clicksCol]) : Number.NaN,
      impressions: impressionsCol ? toNumber(row[impressionsCol]) : Number.NaN,
      ctrRaw: ctrCol ? toNumber(row[ctrCol]) : Number.NaN,
      position: toNumber(row[positionCol]),
    });
  }

  const baseRowsByQuery = new Map();
  for (const row of tracker.rows) {
    const key = normalizeQuery(row.query);
    if (!key) continue;
    if (!baseRowsByQuery.has(key)) {
      baseRowsByQuery.set(key, row);
    }
  }

  const targets = [...baseRowsByQuery.entries()].map(([normalized, row]) => ({
    normalized,
    query: row.query,
    target_page: row.target_page,
    bucket: row.bucket,
  }));

  const newRows = targets.map((target) => {
    const metrics = gscByQuery.get(target.normalized);
    const position = metrics?.position;
    let status = 'unknown';
    if (Number.isFinite(position)) {
      status = position <= 20 ? 'yes' : 'no';
    }

    return {
      date: runDate,
      query: target.query,
      target_page: target.target_page,
      bucket: target.bucket,
      avg_position: fmtPosition(position),
      clicks: Number.isFinite(metrics?.clicks) ? String(metrics.clicks) : '',
      impressions: Number.isFinite(metrics?.impressions) ? String(metrics.impressions) : '',
      ctr: fmtCtr(metrics?.ctrRaw),
      top_20_status: status,
      notes: '',
    };
  });

  const filteredExisting = tracker.rows.filter((row) => row.date !== runDate);
  const mergedRows = [...filteredExisting, ...newRows];

  const header = tracker.headers;
  const lines = [
    header.join(','),
    ...mergedRows.map((row) => header.map((h) => csvEscape(row[h] ?? '')).join(',')),
  ];
  fs.writeFileSync(TRACKER_PATH, `${lines.join('\n')}\n`, 'utf8');

  const top20 = newRows.filter((r) => r.top_20_status === 'yes');
  const unknown = newRows.filter((r) => r.top_20_status === 'unknown');
  const outside = newRows
    .filter((r) => r.top_20_status === 'no')
    .sort((a, b) => toNumber(a.avg_position) - toNumber(b.avg_position));
  const nearWins = outside.filter((r) => {
    const p = toNumber(r.avg_position);
    return Number.isFinite(p) && p > 20 && p <= 30;
  });
  const highImpressionOutside = outside
    .filter((r) => Number.isFinite(toNumber(r.impressions)))
    .sort((a, b) => toNumber(b.impressions) - toNumber(a.impressions))
    .slice(0, 5);

  const reportPath = path.join(ROOT, 'docs', `seo-weekly-report-${runDate}.md`);
  const sortedTop20 = top20.toSorted((a, b) => toNumber(a.avg_position) - toNumber(b.avg_position));
  const pollingSegment = buildFeatureSegment(
    newRows,
    (row) =>
      normalizeQuery(row.query).includes('poll') ||
      normalizeQuery(row.query).includes('availability'),
  );
  const collectionInsightsSegment = buildFeatureSegment(
    newRows,
    (row) =>
      row.target_page === '/faq' ||
      normalizeQuery(row.query).includes('picked') ||
      normalizeQuery(row.query).includes('rating') ||
      normalizeQuery(row.query).includes('collection stats'),
  );

  const report = [
    `## SEO Top-20 Weekly Report (${runDate})`,
    '',
    `- Queries in top 20: ${top20.length} / ${newRows.length}`,
    `- Queries outside top 20: ${outside.length}`,
    `- Queries not found in export: ${unknown.length}`,
    `- Near wins (positions 20-30): ${nearWins.length}`,
    '',
    '### New/Current Top-20 Queries',
    ...(
      sortedTop20.length
        ? sortedTop20.map((r) => `- ${r.query} (${r.avg_position})`)
        : ['- none']
    ),
    '',
    '### Near Wins (20-30)',
    ...(
      nearWins.length
        ? nearWins.map((r) => `- ${r.query} (${r.avg_position})`)
        : ['- none']
    ),
    '',
    '### High-Impression Queries Still Outside Top 20',
    ...(
      highImpressionOutside.length
        ? highImpressionOutside.map(
            (r) => `- ${r.query} (pos ${r.avg_position}, impressions ${r.impressions})`,
          )
        : ['- none']
    ),
    '',
    '### Feature Segment Snapshot',
    `- Availability polling queries: ${pollingSegment.top20}/${pollingSegment.total} in top 20, ${pollingSegment.outside} outside, ${pollingSegment.unknown} unknown, avg known position ${pollingSegment.avgPosition}`,
    `- Collection insight queries: ${collectionInsightsSegment.top20}/${collectionInsightsSegment.total} in top 20, ${collectionInsightsSegment.outside} outside, ${collectionInsightsSegment.unknown} unknown, avg known position ${collectionInsightsSegment.avgPosition}`,
    '',
  ].join('\n');

  fs.writeFileSync(reportPath, `${report}\n`, 'utf8');

  console.log(`Updated tracker: ${path.relative(ROOT, TRACKER_PATH)}`);
  console.log(`Generated report: ${path.relative(ROOT, reportPath)}`);
  console.log(`Top-20 queries: ${top20.length}/${newRows.length}`);
}

main();
