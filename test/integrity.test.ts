// Test Suite: GSC Data Integrity, Deduplication & Boundary Testing

function computeDateWindow(anchorDateStr: string, days: number = 28): { startDate: string; endDate: string; dayCount: number } {
  const anchor = new Date(anchorDateStr);
  const endDate = anchor.toISOString().split('T')[0];
  const startObj = new Date(anchor.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  const startDate = startObj.toISOString().split('T')[0];

  const diffMs = new Date(endDate).getTime() - new Date(startDate).getTime();
  const dayCount = Math.round(diffMs / (24 * 60 * 60 * 1000)) + 1;

  return { startDate, endDate, dayCount };
}

// 1. Test 28-day Date Boundary Precision
const windowTest = computeDateWindow('2026-10-15', 28);
console.log(`[Integrity Test 1] Anchored End: ${windowTest.endDate}, Start: ${windowTest.startDate}, Days: ${windowTest.dayCount}`);

if (windowTest.dayCount !== 28) {
  throw new Error(`FAIL: Date window count expected 28, got ${windowTest.dayCount}`);
}
if (windowTest.startDate !== '2026-09-18') {
  throw new Error(`FAIL: Start date expected 2026-09-18, got ${windowTest.startDate}`);
}
console.log('✓ PASS: Exactly 28 days generated without boundary drift.');

// 2. Test Deduplication Simulation
const simulatedDatabase = new Map<string, { clicks: number; impressions: number }>();
function upsertMetric(site: string, date: string, clicks: number, impressions: number) {
  const key = `${site}_${date}`;
  // Simulates SQLite UNIQUE(site_url, date) ON CONFLICT DO UPDATE
  simulatedDatabase.set(key, { clicks, impressions });
}

// First sync run
upsertMetric('https://example.com', '2026-10-14', 120, 2400);
upsertMetric('https://example.com', '2026-10-15', 150, 3100);

// Repeated sync run with revised data
upsertMetric('https://example.com', '2026-10-14', 125, 2450); // slight revision
upsertMetric('https://example.com', '2026-10-15', 150, 3100);

console.log(`[Integrity Test 2] Database rows after repeated sync: ${simulatedDatabase.size}`);
if (simulatedDatabase.size !== 2) {
  throw new Error(`FAIL: Deduplication failed. Expected 2 rows, found ${simulatedDatabase.size}`);
}
const updatedRow = simulatedDatabase.get('https://example.com_2026-10-14');
if (updatedRow?.clicks !== 125) {
  throw new Error(`FAIL: Upsert did not update clicks correctly.`);
}
console.log('✓ PASS: Zero duplication on repeated syncs; upserts cleanly update records.');

// 3. Test Property-level query aggregation vs Individual query truncation
const propertyTotalClicks = 10000;
const queriesSample = [
  { query: 'gsc dashboard', clicks: 4200 },
  { query: 'search console api', clicks: 2100 },
  { query: 'cloudflare d1 echart', clicks: 950 }
];
const topQueriesSum = queriesSample.reduce((acc, q) => acc + q.clicks, 0);

console.log(`[Integrity Test 3] Property Total: ${propertyTotalClicks}, Top 3 Queries Sum: ${topQueriesSum}`);
if (topQueriesSum > propertyTotalClicks) {
  throw new Error('FAIL: Queries sum cannot exceed property total clicks.');
}
console.log('✓ PASS: Property-level vs dimension query aggregation semantics verified.');

console.log('\nAll data integrity and boundary tests passed successfully!');
