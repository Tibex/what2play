import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TRACKER_PATH = path.join(ROOT, 'docs', 'seo-query-rank-tracker.csv');
const DOCS_DIR = path.join(ROOT, 'docs');

const REQUIRED_TRACKER_COLUMNS = [
  'date',
  'query',
  'target_page',
  'bucket',
  'avg_position',
  'clicks',
  'impressions',
  'ctr',
  'top_20_status',
  'notes',
];

const ACTION_RULES = [
  {
    match: (row) => `${row.bucket}`.toLowerCase() === 'easy',
    actionType: 'title/meta',
    action: 'Refresh title/meta for stronger intent match and CTR.',
  },
  {
    match: (row) =>
      normalizeQuery(row.query).includes('how to') ||
      normalizeQuery(row.query).includes('checklist'),
    actionType: 'content depth/FAQ',
    action: 'Expand practical steps and add FAQ to capture informational intent.',
  },
  {
    match: (row) =>
      normalizeQuery(row.query).includes('poll') ||
      normalizeQuery(row.query).includes('availability'),
    actionType: 'internal links',
    action: 'Add internal links from planner/resources pages and poll-focused anchors.',
  },
  {
    match: (row) =>
      row.target_page === '/faq' ||
      normalizeQuery(row.query).includes('stats') ||
      normalizeQuery(row.query).includes('picked') ||
      normalizeQuery(row.query).includes('rating'),
    actionType: 'content depth/FAQ',
    action: 'Add examples, data callouts, and FAQ entries addressing this query.',
  },
  {
    match: (row) => `${row.bucket}`.toLowerCase() === 'hard',
    actionType: 'intro intent',
    action: 'Rewrite intro to tightly match query intent and user job-to-be-done.',
  },
];

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
  if (cleaned === '') return Number.NaN;
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

function ensureRequiredColumns(headers, requiredColumns, label) {
  const missing = requiredColumns.filter((name) => !headers.includes(name));
  if (missing.length > 0) {
    throw new Error(`Missing required ${label} columns: ${missing.join(', ')}`);
  }
}

function ensureNumericRange(value, min, max, label, query) {
  if (Number.isFinite(value) && (value < min || value > max)) {
    throw new Error(`Invalid ${label} for query "${query}": ${value} (expected ${min}-${max}).`);
  }
}

function normalizeCtrPercent(rawValue, originalCell = '') {
  const numeric = toNumber(rawValue);
  if (!Number.isFinite(numeric)) return Number.NaN;
  if (`${originalCell}`.includes('%')) return numeric;
  if (numeric >= 0 && numeric <= 1) return numeric * 100;
  return numeric;
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

function calcPriorityScore(row) {
  const position = toNumber(row.avg_position);
  const impressions = toNumber(row.impressions);
  const ctr = toNumber(`${row.ctr}`.replace('%', ''));
  if (!Number.isFinite(position) || !Number.isFinite(impressions)) return 0;

  let positionWeight = 0;
  if (position > 20 && position <= 30) positionWeight = 35;
  else if (position > 30 && position <= 40) positionWeight = 25;
  else if (position > 10 && position <= 20) positionWeight = 15;
  else if (position > 40) positionWeight = 10;

  const impressionWeight = Math.min(40, Math.log10(Math.max(1, impressions)) * 12);
  const ctrWeight = Number.isFinite(ctr) ? Math.max(0, 25 - Math.min(25, ctr * 4)) : 12;

  return Math.round((positionWeight + impressionWeight + ctrWeight) * 10) / 10;
}

function recommendationForRow(row) {
  const matchedRule = ACTION_RULES.find((rule) => rule.match(row));
  if (matchedRule) {
    return { actionType: matchedRule.actionType, action: matchedRule.action };
  }
  return {
    actionType: 'title/meta',
    action: 'Improve title/meta and intro copy; validate query appears in filtered GSC export.',
  };
}

function buildOpportunityRows(rows) {
  return rows
    .filter((row) => row.top_20_status === 'no' || row.top_20_status === 'unknown')
    .map((row) => {
      const recommendation = recommendationForRow(row);
      return {
        ...row,
        priority_score: calcPriorityScore(row),
        action_type: recommendation.actionType,
        recommended_action: recommendation.action,
      };
    })
    .sort((a, b) => b.priority_score - a.priority_score);
}

function getPreviousActionPlanPath(runDate) {
  ensureFileExists(DOCS_DIR);
  const files = fs
    .readdirSync(DOCS_DIR)
    .filter((name) => /^seo-action-plan-\d{4}-\d{2}-\d{2}\.md$/.test(name))
    .map((name) => ({
      name,
      date: name.replace('seo-action-plan-', '').replace('.md', ''),
    }))
    .filter((item) => item.date < runDate)
    .sort((a, b) => b.date.localeCompare(a.date));

  return files.length > 0 ? path.join(DOCS_DIR, files[0].name) : '';
}

function extractCarryOverQueries(previousActionPlanPath) {
  if (!previousActionPlanPath || !fs.existsSync(previousActionPlanPath)) return [];
  const content = fs.readFileSync(previousActionPlanPath, 'utf8');
  const lines = content.split('\n');
  const items = [];
  for (const line of lines) {
    const match = line.match(/^- \[ \] (.+?) - /);
    if (match?.[1]) {
      items.push(match[1].trim().toLowerCase());
    }
  }
  return items;
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
  ensureRequiredColumns(tracker.headers, REQUIRED_TRACKER_COLUMNS, 'tracker');

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
    const ctrPercent = ctrCol ? normalizeCtrPercent(row[ctrCol], row[ctrCol]) : Number.NaN;
    ensureNumericRange(ctrPercent, 0, 100, 'CTR', row[queryCol]);
    gscByQuery.set(key, {
      clicks: clicksCol ? toNumber(row[clicksCol]) : Number.NaN,
      impressions: impressionsCol ? toNumber(row[impressionsCol]) : Number.NaN,
      ctrRaw: ctrPercent,
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
  const coverageCount = newRows.length - unknown.length;
  const coveragePct = ((coverageCount / Math.max(1, newRows.length)) * 100).toFixed(1);
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
  const actionPlanPath = path.join(ROOT, 'docs', `seo-action-plan-${runDate}.md`);
  const sortedTop20 = top20.toSorted((a, b) => toNumber(a.avg_position) - toNumber(b.avg_position));
  const opportunities = buildOpportunityRows(newRows).slice(0, 10);
  const fastWins = opportunities.filter((row) => row.action_type === 'title/meta' || row.action_type === 'internal links').slice(0, 3);
  const deeperTasks = opportunities.filter((row) => row.action_type === 'content depth/FAQ' || row.action_type === 'intro intent').slice(0, 3);
  const previousActionPlanPath = getPreviousActionPlanPath(runDate);
  const previousQueries = extractCarryOverQueries(previousActionPlanPath);
  const carryOverItems = opportunities.filter((row) => previousQueries.includes(normalizeQuery(row.query))).slice(0, 3);
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
    `- Query coverage in export: ${coverageCount}/${newRows.length} (${coveragePct}%)`,
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
    '### Top SEO Opportunities This Week',
    ...(
      opportunities.length
        ? opportunities.map(
            (r) =>
              `- ${r.query} (score ${r.priority_score}, pos ${r.avg_position || 'n/a'}, imp ${r.impressions || 'n/a'}, ctr ${r.ctr || 'n/a'}, page ${r.target_page || 'n/a'}, action ${r.action_type})`,
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

  const actionPlan = [
    `## SEO Action Plan (${runDate})`,
    '',
    '### Top Priorities (This Week)',
    ...(
      opportunities.slice(0, 7).length
        ? opportunities.slice(0, 7).map(
            (r) =>
              `- [ ] ${r.query} - ${r.target_page || 'n/a'} - ${r.action_type} - ${r.recommended_action} (pos ${r.avg_position || 'n/a'}, imp ${r.impressions || 'n/a'}, ctr ${r.ctr || 'n/a'}, score ${r.priority_score})`,
          )
        : ['- [ ] none']
    ),
    '',
    '### Fast Wins',
    ...(
      fastWins.length
        ? fastWins.map(
            (r) =>
              `- ${r.query} - ${r.action_type} on ${r.target_page || 'n/a'} (score ${r.priority_score})`,
          )
        : ['- none']
    ),
    '',
    '### Deeper Content Tasks',
    ...(
      deeperTasks.length
        ? deeperTasks.map(
            (r) =>
              `- ${r.query} - ${r.action_type} on ${r.target_page || 'n/a'} (score ${r.priority_score})`,
          )
        : ['- none']
    ),
    '',
    '### Carry-Over from Last Week',
    ...(
      carryOverItems.length
        ? carryOverItems.map(
            (r) =>
              `- ${r.query} - still outside top 20 (pos ${r.avg_position || 'n/a'}, score ${r.priority_score})`,
          )
        : ['- none']
    ),
    '',
    '### Next 7 Days KPI Check',
    `- Coverage: ${coverageCount}/${newRows.length} tracked queries present in export (${coveragePct}%).`,
    `- Top 20 count baseline: ${top20.length}/${newRows.length}.`,
    `- Near wins baseline: ${nearWins.length}.`,
    '',
  ].join('\n');

  fs.writeFileSync(actionPlanPath, `${actionPlan}\n`, 'utf8');

  console.log(`Updated tracker: ${path.relative(ROOT, TRACKER_PATH)}`);
  console.log(`Generated report: ${path.relative(ROOT, reportPath)}`);
  console.log(`Generated action plan: ${path.relative(ROOT, actionPlanPath)}`);
  console.log(`Top-20 queries: ${top20.length}/${newRows.length}`);
  console.log(`Coverage: ${coverageCount}/${newRows.length} (${coveragePct}%)`);
}

main();
