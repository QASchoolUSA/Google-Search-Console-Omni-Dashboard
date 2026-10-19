import { classifyQueryAiIntent, calculateCitationLikelihood, computeGenAiMetrics } from '../functions/utils/genai';

console.log('[GenAI Test 1] Testing Intent Classification...');
const howTo = classifyQueryAiIntent('how to build cloudflare workers with vite');
const comparative = classifyQueryAiIntent('react vs solidjs performance comparison');
const informational = classifyQueryAiIntent('what is google search console api');
const conversational = classifyQueryAiIntent('why does my database have slow read latency on mac');
const standard = classifyQueryAiIntent('nike shoes');

if (howTo !== 'how_to') throw new Error(`Expected how_to, got ${howTo}`);
if (comparative !== 'comparative') throw new Error(`Expected comparative, got ${comparative}`);
if (informational !== 'informational') throw new Error(`Expected informational, got ${informational}`);
if (conversational !== 'informational' && conversational !== 'conversational') {
  // 'why does...' can be informational or conversational
  throw new Error(`Expected informational/conversational, got ${conversational}`);
}
if (standard !== 'standard') throw new Error(`Expected standard, got ${standard}`);

console.log('✓ PASS: Query intents properly classified.');

console.log('[GenAI Test 2] Testing Citation Likelihood...');
if (calculateCitationLikelihood(2.1) !== 'prime') throw new Error('Expected prime citation');
if (calculateCitationLikelihood(6.5) !== 'high') throw new Error('Expected high citation');
if (calculateCitationLikelihood(14.0) !== 'opportunity') throw new Error('Expected opportunity citation');
if (calculateCitationLikelihood(35.0) !== 'low') throw new Error('Expected low citation');

console.log('✓ PASS: Citation likelihood thresholds accurate.');

console.log('[GenAI Test 3] Testing Metrics Computation...');
const sampleQueries = [
  { query: 'how to configure cloudflare d1', clicks: 120, impressions: 2400, ctr: 5.0, position: 2.2 },
  { query: 'solidjs vs react state management', clicks: 80, impressions: 1600, ctr: 5.0, position: 4.5 },
  { query: 'dashboard login', clicks: 500, impressions: 5000, ctr: 10.0, position: 1.1 }
];

const metrics = computeGenAiMetrics(sampleQueries, 700, 9000);
console.log(`[GenAI Test 3] AI Clicks: ${metrics.aiClicks}, AI Impressions: ${metrics.aiImpressions}, AI Share: ${metrics.aiShareOfImpressions}%`);

if (metrics.aiClicks !== 200) throw new Error(`Expected 200 AI clicks, got ${metrics.aiClicks}`);
if (metrics.aiImpressions !== 4000) throw new Error(`Expected 4000 AI impressions, got ${metrics.aiImpressions}`);
if (metrics.readinessScore <= 0 || metrics.readinessScore > 100) throw new Error('Invalid readiness score');

console.log('✓ PASS: GenAI metrics calculation verified.\nAll GenAI tests passed successfully!');
