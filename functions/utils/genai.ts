import { GenAiIntentType, GenAiQueryMetric, GenerativeAiMetrics, QueryMetric } from '../types';

export function classifyQueryAiIntent(query: string): GenAiIntentType {
  const q = query.toLowerCase().trim();
  const words = q.split(/\s+/).filter(Boolean);

  // 1. Procedural / How-To
  if (
    /^(how to|how do|how can|how does|steps to|guide to|tutorial on|ways to|guide:|tips for)\b/.test(q) ||
    /\b(how to|step by step|troubleshooting|setup guide|install guide)\b/.test(q)
  ) {
    return 'how_to';
  }

  // 2. Comparative & Evaluative
  if (
    /^(best|top|which is better|difference between|compare)\b/.test(q) ||
    /\b(vs|versus|alternative|alternatives|comparison|review|reviews|pros and cons)\b/.test(q)
  ) {
    return 'comparative';
  }

  // 3. Informational & Explanatory
  if (
    /^(what is|what are|what does|why is|why are|why does|who is|who are|where is|when was|when did|is it|can i|can you|does)\b/.test(q) ||
    /\b(meaning|definition|explained|overview|purpose of|example of)\b/.test(q)
  ) {
    return 'informational';
  }

  // 4. Conversational Long-Tail Queries (>= 4 words or question mark)
  if (words.length >= 4 || /\?$/.test(q)) {
    return 'conversational';
  }

  return 'standard';
}

export function calculateCitationLikelihood(position: number): 'prime' | 'high' | 'opportunity' | 'low' {
  if (position <= 3.5) return 'prime';
  if (position <= 10.0) return 'high';
  if (position <= 20.0) return 'opportunity';
  return 'low';
}

export function computeGenAiMetrics(
  queries: QueryMetric[],
  totalClicks: number,
  totalImpressions: number
): GenerativeAiMetrics {
  const classifiedQueries: GenAiQueryMetric[] = queries.map(q => {
    const aiIntent = classifyQueryAiIntent(q.query);
    const citationLikelihood = calculateCitationLikelihood(q.position);
    return {
      ...q,
      aiIntent,
      citationLikelihood
    };
  });

  const aiQueries = classifiedQueries.filter(q => q.aiIntent !== 'standard');

  const aiClicks = aiQueries.reduce((acc, q) => acc + q.clicks, 0);
  const aiImpressions = aiQueries.reduce((acc, q) => acc + q.impressions, 0);
  const aiCtr = aiImpressions > 0 ? Number(((aiClicks / aiImpressions) * 100).toFixed(2)) : 0;

  // Impression-weighted average position for AI queries
  const aiWeightedPosSum = aiQueries.reduce((acc, q) => acc + q.position * q.impressions, 0);
  const aiAvgPosition = aiImpressions > 0 ? Number((aiWeightedPosSum / aiImpressions).toFixed(1)) : 0;

  const aiShareOfClicks = totalClicks > 0 ? Number(((aiClicks / totalClicks) * 100).toFixed(1)) : 0;
  const aiShareOfImpressions = totalImpressions > 0 ? Number(((aiImpressions / totalImpressions) * 100).toFixed(1)) : 0;

  // Intent breakdown
  const intentBuckets: Record<GenAiIntentType, { clicks: number; impressions: number; count: number; label: string }> = {
    how_to: { clicks: 0, impressions: 0, count: 0, label: 'Procedural / How-To' },
    informational: { clicks: 0, impressions: 0, count: 0, label: 'Informational & Q&A' },
    comparative: { clicks: 0, impressions: 0, count: 0, label: 'Comparative & Decision' },
    conversational: { clicks: 0, impressions: 0, count: 0, label: 'Conversational Long-Tail' },
    standard: { clicks: 0, impressions: 0, count: 0, label: 'Standard Search' }
  };

  for (const q of classifiedQueries) {
    const bucket = intentBuckets[q.aiIntent];
    if (bucket) {
      bucket.clicks += q.clicks;
      bucket.impressions += q.impressions;
      bucket.count += 1;
    }
  }

  const intentBreakdown = (['informational', 'how_to', 'comparative', 'conversational'] as GenAiIntentType[])
    .map(intent => ({
      intent,
      label: intentBuckets[intent].label,
      clicks: intentBuckets[intent].clicks,
      impressions: intentBuckets[intent].impressions,
      queryCount: intentBuckets[intent].count
    }))
    .filter(b => b.queryCount > 0 || b.impressions > 0);

  // Composite AI Readiness Score:
  const primeCount = aiQueries.filter(q => q.citationLikelihood === 'prime').length;
  const highCount = aiQueries.filter(q => q.citationLikelihood === 'high').length;
  const oppCount = aiQueries.filter(q => q.citationLikelihood === 'opportunity').length;
  const totalAiQCount = aiQueries.length;

  let readinessScore = 0;
  if (totalAiQCount > 0) {
    const primeWeight = (primeCount / totalAiQCount) * 55;
    const highWeight = (highCount / totalAiQCount) * 30;
    const oppWeight = (oppCount / totalAiQCount) * 15;
    readinessScore = Math.min(100, Math.round(primeWeight + highWeight + oppWeight + Math.min(15, totalAiQCount)));
  }

  // Top AI queries sorted by clicks desc, then impressions desc
  const topAiQueries = [...aiQueries]
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
    .slice(0, 50);

  return {
    aiClicks,
    aiImpressions,
    aiCtr,
    aiAvgPosition,
    aiShareOfClicks,
    aiShareOfImpressions,
    readinessScore,
    intentBreakdown,
    topAiQueries
  };
}
