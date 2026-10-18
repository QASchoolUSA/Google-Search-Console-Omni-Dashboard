// Unit verification of GSC mathematical formulas & parity calculations

function computeImpressionWeightedPosition(
  rows: { clicks: number; impressions: number; position: number }[]
): number {
  const totalImpressions = rows.reduce((acc, r) => acc + r.impressions, 0);
  if (totalImpressions === 0) return 0.0;
  const weightedSum = rows.reduce((acc, r) => acc + (r.position * r.impressions), 0);
  return Number((weightedSum / totalImpressions).toFixed(1));
}

function computeOverallCtr(
  rows: { clicks: number; impressions: number }[]
): number {
  const totalClicks = rows.reduce((acc, r) => acc + r.clicks, 0);
  const totalImpressions = rows.reduce((acc, r) => acc + r.impressions, 0);
  if (totalImpressions === 0) return 0.0;
  return Number(((totalClicks / totalImpressions) * 100).toFixed(2));
}

// 1. Test Weighted Position vs Simple Average
const testData = [
  { clicks: 500, impressions: 10000, position: 2.1 }, // Heavy volume day, rank 2.1
  { clicks: 12, impressions: 200, position: 18.4 },   // Low volume day, rank 18.4
  { clicks: 3, impressions: 50, position: 42.0 },     // Low volume day, rank 42.0
];

const simpleAvg = (2.1 + 18.4 + 42.0) / 3; // 20.83 (unweighted)
const gscWeighted = computeImpressionWeightedPosition(testData); // 2.6 (exact GSC formula)
const overallCtr = computeOverallCtr(testData); // 5.02%

console.log(`[Test 1] Simple Avg Position (Skews wrong): ${simpleAvg.toFixed(1)}`);
console.log(`[Test 1] GSC Impression-Weighted Position (Official): ${gscWeighted}`);
console.log(`[Test 2] Overall CTR: ${overallCtr}%`);

if (gscWeighted < 3.0 && gscWeighted > 2.0) {
  console.log('✓ PASS: Weighted position correctly accounts for impression volume.');
} else {
  throw new Error('FAIL: Weighted position calculation incorrect.');
}

if (overallCtr === 5.02) {
  console.log('✓ PASS: Overall CTR correctly matches GSC specification.');
} else {
  throw new Error('FAIL: CTR calculation incorrect.');
}

console.log('All mathematical parity tests passed successfully!');
