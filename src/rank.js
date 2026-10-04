// Signal10 ranking. Pure functions over candidate metadata: no network, no clock.

export const WEIGHTS = { relevance: 0.35, momentum: 0.25, depth: 0.15, recency: 0.15, authority: 0.1 };

const LABELS = {
  relevance: 'Strong topic match',
  momentum: 'Gaining views fast',
  depth: 'In-depth',
  recency: 'Fresh',
  authority: 'Established channel',
};

const MIN_SECONDS = 60; // anything shorter is a Short or a teaser
const MIN_TOPIC_COVERAGE = 0.5;
const DUPLICATE_TITLE_SIMILARITY = 0.75;
const MAX_PER_CHANNEL = 2;
const RECENCY_HALF_LIFE_DAYS = 365;
// How many score points a full topic match is worth over a partial one when ordering.
export const FULL_MATCH_MARGIN = 15;

const STOPWORDS = new Set([
  'a', 'an', 'the', 'of', 'to', 'for', 'with', 'and', 'or', 'in', 'on', 'at', 'by', 'from',
  'how', 'what', 'is', 'are', 'me', 'my', 'i', 'about', 'learn', 'learning',
]);

const stem = (word) => (word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word);

export function tokenize(text) {
  return (text ?? '').toLowerCase().split(/[^a-z0-9+#]+/).filter(Boolean).map(stem);
}

export function topicTokens(topic) {
  const all = [...new Set(tokenize(topic))];
  const meaningful = all.filter((t) => !STOPWORDS.has(t));
  return meaningful.length > 0 ? meaningful : all;
}

// Topic words the text does not mention, in the wording the user typed.
function missingTopicWords(topic, tokens, text) {
  const typed = new Map();
  for (const word of topic.split(/[^A-Za-z0-9+#]+/).filter(Boolean)) {
    const token = tokenize(word)[0];
    if (!typed.has(token)) typed.set(token, word);
  }
  const have = new Set(tokenize(text));
  return tokens.filter((t) => !have.has(t)).map((t) => typed.get(t));
}

const quoteList = (words) => {
  const quoted = words.map((w) => `“${w}”`);
  return quoted.length > 1 ? `${quoted.slice(0, -1).join(', ')} or ${quoted.at(-1)}` : quoted[0];
};

function coverage(wanted, text) {
  if (wanted.length === 0) return 0;
  const have = new Set(tokenize(text));
  return wanted.filter((t) => have.has(t)).length / wanted.length;
}

function titleSimilarity(a, b) {
  const x = new Set(tokenize(a));
  const y = new Set(tokenize(b));
  const shared = [...x].filter((t) => y.has(t)).length;
  const union = new Set([...x, ...y]).size;
  return union === 0 ? 0 : shared / union;
}

function depthScore(seconds) {
  const minutes = seconds / 60;
  if (minutes < 3) return 0.2;
  if (minutes < 8) return 0.55;
  if (minutes < 20) return 0.75;
  if (minutes <= 90) return 1;
  if (minutes <= 240) return 0.85;
  return 0.7;
}

// Share of the pool this value beats or ties, so one viral outlier cannot flatten the rest.
function percentile(value, sorted) {
  if (value == null || sorted.length === 0) return 0;
  return sorted.filter((v) => v <= value).length / sorted.length;
}

const viewsPerDay = (c) => (c.views == null || c.ageDays == null ? null : c.views / Math.max(c.ageDays, 1));

function compact(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return String(Math.round(n));
}

function reasonFor(c, tokens) {
  const { signals } = c;
  const minutes = Math.round(c.durationSeconds / 60);
  const length = minutes >= 120 ? `${(minutes / 60).toFixed(1).replace(/\.0$/, '')} hours` : `${minutes} minutes`;
  const posted = c.publishedText?.replace(/^(streamed|premiered)\s+/i, '');
  const phrases = {
    relevance:
      c.headCoverage === 1
        ? tokens.length > 1 ? 'it covers the whole topic' : 'it is squarely on topic'
        : c.headCoverage >= 0.5
          ? 'it covers most of the topic'
          : 'its description matches the topic',
    momentum:
      c.viewsPerDay == null
        ? null
        : `about ${compact(c.viewsPerDay)} views a day since it was posted${posted ? ` ${posted}` : ''}`,
    depth: minutes >= 20 ? `at ${length} it goes deep` : `a focused ${minutes}-minute watch`,
    recency: posted ? `posted ${posted}` : null,
    authority: c.verified
      ? 'from a verified channel'
      : c.channelCount > 1 ? `${c.channel} has ${c.channelCount} videos on this topic` : null,
  };
  const ordered = Object.keys(WEIGHTS)
    .filter((k) => phrases[k] && signals[k] >= 0.5)
    .sort((a, b) => WEIGHTS[b] * signals[b] - WEIGHTS[a] * signals[a]);
  // "posted 2 weeks ago" twice in one sentence reads badly; momentum already says it.
  const picked = ordered.filter((k) => !(k === 'recency' && ordered.includes('momentum'))).slice(0, 3);
  if (picked.length === 0) {
    return c.missingWords.length > 0
      ? `The title does not mention ${quoteList(c.missingWords)}, but it is one of the closer matches YouTube returned.`
      : 'One of the closer matches YouTube returned for this topic.';
  }
  const sentence = picked.map((k) => phrases[k]).join('; ');
  const partial = c.missingWords.length > 0 ? `The title does not mention ${quoteList(c.missingWords)}. ` : '';
  return `${partial}${sentence[0].toUpperCase()}${sentence.slice(1)}.`;
}

// Ties go to the full match, so a gap of exactly the margin still favours it.
const orderingScore = (c) => c.score + (c.missingWords.length === 0 ? FULL_MATCH_MARGIN + 0.5 : 0);

export function scoreCandidates(topic, candidates) {
  const tokens = topicTokens(topic);
  const usable = candidates.filter(
    (c) =>
      c.durationSeconds != null &&
      c.durationSeconds >= MIN_SECONDS &&
      coverage(tokens, `${c.title} ${c.snippet} ${c.channel}`) >= MIN_TOPIC_COVERAGE,
  );

  const paces = usable.map(viewsPerDay).filter((v) => v != null).sort((a, b) => a - b);
  const channelCounts = new Map();
  for (const c of usable) channelCounts.set(c.channel, (channelCounts.get(c.channel) ?? 0) + 1);

  return usable
    .map((c) => {
      // Title plus channel, so "AgentCore Runtime" from AWS Developers counts as "AWS AgentCore".
      const headCoverage = coverage(tokens, `${c.title} ${c.channel}`);
      const anyCoverage = coverage(tokens, `${c.title} ${c.snippet} ${c.channel}`);
      const missingWords = missingTopicWords(topic, tokens, `${c.title} ${c.channel}`);
      const channelCount = channelCounts.get(c.channel);
      const pace = viewsPerDay(c);
      const signals = {
        // Squared: a missing topic word usually means a different subject, not a partial match.
        relevance: 0.6 * headCoverage ** 2 + 0.15 * anyCoverage + 0.25 * (1 - (c.searchPosition ?? 1)),
        momentum: percentile(pace, paces),
        depth: depthScore(c.durationSeconds),
        recency: c.ageDays == null ? 0 : 0.5 ** (c.ageDays / RECENCY_HALF_LIFE_DAYS),
        authority: Math.min(1, (c.verified ? 0.7 : 0.3) + (channelCount > 1 ? 0.3 : 0)),
      };
      const score = Object.entries(WEIGHTS).reduce((sum, [k, w]) => sum + w * signals[k], 0);
      return { ...c, headCoverage, missingWords, channelCount, viewsPerDay: pace, signals, score: Math.round(score * 100) };
    })
    // A video missing a topic word is usually about a neighbouring subject, so full matches
    // get a head start. It is capped: a weak video that merely contains a generic topic word
    // should not displace a much stronger one.
    .sort((a, b) => orderingScore(b) - orderingScore(a) || b.score - a.score || (b.views ?? 0) - (a.views ?? 0))
    .map((c) => ({ ...c, tokens }));
}

// Walks the scored list best-first, skipping near-duplicate titles and capping each channel.
export function pickDiverse(scored, limit) {
  const picked = [];
  for (const c of scored) {
    if (picked.length >= limit) break;
    if (picked.filter((p) => p.channel === c.channel).length >= MAX_PER_CHANNEL) continue;
    if (picked.some((p) => titleSimilarity(p.title, c.title) >= DUPLICATE_TITLE_SIMILARITY)) continue;
    picked.push(c);
  }
  return picked;
}

// Final shape for the client: position, explanation, and where each video would sit if
// the same list were sorted by lifetime views alone.
export function present(picked) {
  const byViews = [...picked].sort((a, b) => (b.views ?? -1) - (a.views ?? -1));
  const keys = Object.keys(WEIGHTS);
  const mean = Object.fromEntries(
    keys.map((k) => [k, picked.reduce((sum, p) => sum + p.signals[k], 0) / Math.max(picked.length, 1)]),
  );
  return picked.map(({ tokens, snippet, searchPosition, headCoverage, channelCount, ...c }, index) => {
    const full = { ...c, headCoverage, channelCount };
    // The headline names what sets this video apart from the rest of the list.
    const lead = (k) => WEIGHTS[k] * (c.signals[k] - mean[k]);
    const strong = keys.filter((k) => c.signals[k] >= 0.8);
    const strongest = (strong.length > 0 ? strong : keys).sort((a, b) => lead(b) - lead(a))[0];
    return {
      ...c,
      rank: index + 1,
      rankByViews: byViews.findIndex((v) => v.id === c.id) + 1,
      headline: c.missingWords.length > 0 ? 'Partial match' : LABELS[strongest],
      reason: reasonFor(full, tokens),
    };
  });
}

export function rank(topic, candidates, limit = 10) {
  return present(pickDiverse(scoreCandidates(topic, candidates), limit));
}
