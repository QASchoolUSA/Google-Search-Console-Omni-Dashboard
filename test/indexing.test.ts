// Indexed-pages trend math & snapshot date selection tests

import {
  INDEX_TREND_WINDOWS,
  buildSiteIndexStats,
  calcChange,
  selectSnapshotDatesToFetch,
  shiftDate,
  windowStart
} from '../functions/utils/indexing';

// 1. Window start for 28-day rolling window
const start = windowStart('2026-10-15', 28);
if (start !== '2026-09-18') {
  throw new Error(`FAIL: windowStart expected 2026-09-18, got ${start}`);
}
console.log('✓ PASS: 28-day window start is correct');

// 2. shiftDate
if (shiftDate('2026-10-15', -7) !== '2026-10-08') {
  throw new Error('FAIL: shiftDate -7 incorrect');
}
if (shiftDate('2026-10-15', 3) !== '2026-10-18') {
  throw new Error('FAIL: shiftDate +3 incorrect');
}
console.log('✓ PASS: shiftDate handles positive and negative deltas');

// 3. calcChange
const c1 = calcChange(110, 100);
if (c1.change !== 10 || c1.changePct !== 10) {
  throw new Error(`FAIL: calcChange 110 vs 100 → ${JSON.stringify(c1)}`);
}
const c2 = calcChange(50, 0);
if (c2.changePct !== 100) {
  throw new Error('FAIL: calcChange from zero should be 100%');
}
const c3 = calcChange(100, null);
if (c3.change !== null || c3.changePct !== null) {
  throw new Error('FAIL: calcChange with null previous should be null');
}
console.log('✓ PASS: calcChange percent math');

// 4. buildSiteIndexStats with trend windows
const snaps = [
  { date: '2026-08-16', page_count: 800 },  // ~60d before Oct 15
  { date: '2026-09-15', page_count: 900 },  // ~30d
  { date: '2026-10-01', page_count: 950 },  // ~14d
  { date: '2026-10-08', page_count: 980 },  // ~7d
  { date: '2026-10-12', page_count: 990 },  // ~3d
  { date: '2026-10-15', page_count: 1000 }
];
const stats = buildSiteIndexStats(snaps, 28, 1200);
if (stats.currentCount !== 1000 || stats.asOfDate !== '2026-10-15') {
  throw new Error('FAIL: latest snapshot not selected');
}
if (stats.totalPages !== 1200) {
  throw new Error(`FAIL: expected totalPages 1200, got ${stats.totalPages}`);
}
if (stats.indexRatio !== 83.3) {
  throw new Error(`FAIL: expected indexRatio 83.3, got ${stats.indexRatio}`);
}
if (stats.trends.length !== INDEX_TREND_WINDOWS.length) {
  throw new Error('FAIL: expected all trend windows');
}
const t7 = stats.trends.find((t) => t.days === 7);
if (!t7 || t7.previousCount !== 980 || t7.change !== 20) {
  throw new Error(`FAIL: 7d trend incorrect: ${JSON.stringify(t7)}`);
}
const t3 = stats.trends.find((t) => t.days === 3);
if (!t3 || t3.previousCount !== 990) {
  throw new Error(`FAIL: 3d trend incorrect: ${JSON.stringify(t3)}`);
}
console.log('✓ PASS: buildSiteIndexStats computes 3/7/14/30/60d trends');

// 5. Empty snapshots
const empty = buildSiteIndexStats([]);
if (empty.currentCount !== 0 || empty.asOfDate !== null) {
  throw new Error('FAIL: empty stats should be zeroed');
}
console.log('✓ PASS: empty snapshots handled');

// 6. selectSnapshotDatesToFetch prioritizes anchors + recent
const existing = new Set(['2026-10-10', '2026-10-01']);
const toFetch = selectSnapshotDatesToFetch('2026-10-15', existing, 60, 12);
if (!toFetch.includes('2026-10-15')) {
  throw new Error('FAIL: must include latest date');
}
if (!toFetch.includes('2026-10-08')) {
  throw new Error('FAIL: must include 7d trend anchor when missing');
}
if (toFetch.length > 12) {
  throw new Error('FAIL: must respect maxFetches');
}
console.log('✓ PASS: selectSnapshotDatesToFetch prioritizes trend anchors');

// 7. Total pages math & floor guarantee
const statsWithoutFallback = buildSiteIndexStats([{ date: '2026-10-15', page_count: 50 }], 28);
if (statsWithoutFallback.totalPages !== 50 || statsWithoutFallback.indexRatio !== 100) {
  throw new Error(`FAIL: fallback to currentCount expected 50 and 100%, got ${statsWithoutFallback.totalPages}, ${statsWithoutFallback.indexRatio}`);
}

const statsWithSnapshotTotal = buildSiteIndexStats([{ date: '2026-10-15', page_count: 80, total_pages: 100 }], 28);
if (statsWithSnapshotTotal.totalPages !== 100 || statsWithSnapshotTotal.indexRatio !== 80) {
  throw new Error(`FAIL: snapshot total expected 100 and 80%, got ${statsWithSnapshotTotal.totalPages}, ${statsWithSnapshotTotal.indexRatio}`);
}
console.log('✓ PASS: totalPages and indexRatio calculations verified');

console.log('\nAll indexing tests passed.');
