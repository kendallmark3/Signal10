// Reads real video metadata from YouTube's public web endpoints. No API key or account.
// Nothing here synthesizes metadata: a field YouTube does not return stays null.

const CONTEXT = { client: { clientName: 'WEB', clientVersion: '2.20250101.00.00', hl: 'en', gl: 'US' } };
const TIMEOUT_MS = 8000;

// Search filter tokens ("sp" values) used by youtube.com.
export const FILTERS = {
  videos: 'EgIQAQ==',
  thisYear: 'EgQIBRAB',
  thisMonth: 'EgQIBBAB',
};

const UNIT_DAYS = { second: 1 / 86400, minute: 1 / 1440, hour: 1 / 24, day: 1, week: 7, month: 30.4, year: 365 };

export function parseAgeDays(text) {
  const m = /(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/i.exec(text ?? '');
  return m ? Number(m[1]) * UNIT_DAYS[m[2].toLowerCase()] : null;
}

export function parseViews(text) {
  const m = /([\d.,]+)\s*([KMB])?\s+views?/i.exec(text ?? '');
  if (!m) return null;
  const scale = { K: 1e3, M: 1e6, B: 1e9 }[m[2]?.toUpperCase()] ?? 1;
  const n = scale === 1 ? Number(m[1].replace(/[.,]/g, '')) : Number(m[1].replace(/,/g, '')) * scale;
  return Number.isFinite(n) ? Math.round(n) : null;
}

export function parseDurationSeconds(text) {
  if (!/^\d+(:\d{1,2}){1,2}$/.test(text ?? '')) return null;
  return text.split(':').reduce((total, part) => total * 60 + Number(part), 0);
}

function collectVideoRenderers(node, out = []) {
  if (!node || typeof node !== 'object') return out;
  if (node.videoRenderer) out.push(node.videoRenderer);
  for (const value of Object.values(node)) collectVideoRenderers(value, out);
  return out;
}

export function toCandidate(r) {
  const snippet = (r.detailedMetadataSnippets ?? [])
    .map((s) => (s.snippetText?.runs ?? []).map((run) => run.text).join(''))
    .join(' ');
  return {
    id: r.videoId,
    title: (r.title?.runs ?? []).map((run) => run.text).join('') || r.title?.simpleText || '',
    channel: r.ownerText?.runs?.[0]?.text ?? '',
    verified: (r.ownerBadges ?? []).some((b) => /VERIFIED/.test(b.metadataBadgeRenderer?.style ?? '')),
    publishedText: r.publishedTimeText?.simpleText ?? null,
    ageDays: parseAgeDays(r.publishedTimeText?.simpleText),
    durationText: r.lengthText?.simpleText ?? null,
    durationSeconds: parseDurationSeconds(r.lengthText?.simpleText),
    views: parseViews(r.viewCountText?.simpleText),
    snippet,
    url: `https://www.youtube.com/watch?v=${r.videoId}`,
    thumbnail: `https://i.ytimg.com/vi/${r.videoId}/mqdefault.jpg`,
  };
}

async function innertube(endpoint, body) {
  const res = await fetch(`https://www.youtube.com/youtubei/v1/${endpoint}?prettyPrint=false`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ context: CONTEXT, ...body }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`YouTube ${endpoint} returned ${res.status}`);
  return res.json();
}

export async function searchVideos(query, filter = FILTERS.videos) {
  const data = await innertube('search', { query, params: filter });
  return collectVideoRenderers(data).filter((r) => r.videoId).map(toCandidate);
}

// Runs the topic through several searches so newer videos get into the pool, not only
// the all-time results. Each candidate keeps its best position across the searches.
export async function gatherCandidates(topic) {
  const searches = await Promise.allSettled(Object.values(FILTERS).map((f) => searchVideos(topic, f)));
  const ok = searches.filter((s) => s.status === 'fulfilled');
  if (ok.length === 0) throw new Error(`YouTube search failed: ${searches[0].reason?.message ?? 'unknown error'}`);

  const byId = new Map();
  for (const { value: list } of ok) {
    list.forEach((candidate, index) => {
      const position = index / Math.max(list.length, 1);
      const seen = byId.get(candidate.id);
      if (!seen) byId.set(candidate.id, { ...candidate, searchPosition: position });
      else seen.searchPosition = Math.min(seen.searchPosition, position);
    });
  }
  return [...byId.values()];
}

// oEmbed answers 404 for deleted videos and 403 for private ones. 401 means embedding
// is disabled, which still plays on youtube.com, so only 403/404 count as unavailable.
export async function isAvailable(id) {
  try {
    const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    return res.status !== 403 && res.status !== 404;
  } catch {
    return true; // a network hiccup is not evidence the video is gone
  }
}

// Exact publish date, when YouTube returns it. Search results only carry "3 weeks ago".
export async function fetchPublishDate(id) {
  try {
    const data = await innertube('player', { videoId: id });
    const iso = data.microformat?.playerMicroformatRenderer?.publishDate;
    return iso ? iso.slice(0, 10) : null;
  } catch {
    return null;
  }
}
