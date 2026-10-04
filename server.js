import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { gatherCandidates, isAvailable, fetchPublishDate } from './src/youtube.js';
import { scoreCandidates, pickDiverse, present } from './src/rank.js';
import { buildLearningPath } from './src/learning-path.js';
import { architectView, ArchitectError } from './src/architect.js';
import Anthropic from '@anthropic-ai/sdk';

// An optional .env file next to this one can hold ANTHROPIC_API_KEY. It is never served.
try {
  process.loadEnvFile(fileURLToPath(new URL('./.env', import.meta.url)));
} catch {
  // No .env file: the key, if any, comes from the real environment.
}

const PORT = Number(process.env.PORT) || 4310;
const LIMIT = 10;
const SPARES = 5; // extra picks to fall back on when a video turns out to be unavailable
const PAGE = fileURLToPath(new URL('./public/index.html', import.meta.url));

// Without a key, Architect View reports "not configured" and everything else works as before.
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

// Recent searches, so Architect View reasons about the same list the user is looking at
// and a repeat request does not pay for a second model call.
const RECENT_LIMIT = 50;
const RECENT_TTL_MS = 15 * 60 * 1000;
const recent = new Map();
const topicKey = (topic) => topic.toLowerCase();

function remember(topic, data) {
  recent.delete(topicKey(topic));
  recent.set(topicKey(topic), { data, at: Date.now(), view: null });
  if (recent.size > RECENT_LIMIT) recent.delete(recent.keys().next().value);
  return data;
}

async function architect(topic) {
  let entry = recent.get(topicKey(topic));
  if (!entry || Date.now() - entry.at > RECENT_TTL_MS) {
    remember(topic, await top10(topic));
    entry = recent.get(topicKey(topic));
  }
  entry.view ??= await architectView(entry.data.topic, entry.data.results, { client: anthropic });
  return { topic: entry.data.topic, view: entry.view };
}

const ARCHITECT_STATUS = { not_configured: 503, refused: 422, failed: 502 };

export async function top10(topic) {
  const candidates = await gatherCandidates(topic);
  const scored = scoreCandidates(topic, candidates);
  const shortlist = pickDiverse(scored, LIMIT + SPARES);

  const availability = await Promise.all(shortlist.map((c) => isAvailable(c.id)));
  const picked = shortlist.filter((_, i) => availability[i]).slice(0, LIMIT);
  const dates = await Promise.all(picked.map((c) => fetchPublishDate(c.id)));

  const results = present(picked.map((c, i) => ({ ...c, publishedDate: dates[i] })));
  return {
    topic,
    candidatesFound: candidates.length,
    candidatesOnTopic: scored.length,
    results,
    learningPath: buildLearningPath(results),
  };
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed.' });

  if (url.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(await readFile(PAGE));
  }

  if (url.pathname === '/api/top10' || url.pathname === '/api/architect') {
    const topic = (url.searchParams.get('topic') ?? '').trim().replace(/\s+/g, ' ');
    if (topic.length < 2 || topic.length > 120) {
      return sendJson(res, 400, { error: 'Enter a topic between 2 and 120 characters.' });
    }
    try {
      if (url.pathname === '/api/top10') return sendJson(res, 200, remember(topic, await top10(topic)));
      return sendJson(res, 200, await architect(topic));
    } catch (err) {
      if (err instanceof ArchitectError) {
        return sendJson(res, ARCHITECT_STATUS[err.code], { error: err.message, code: err.code });
      }
      console.error(err);
      return sendJson(res, 502, { error: 'Could not reach YouTube just now. Try again in a moment.' });
    }
  }

  sendJson(res, 404, { error: 'Not found.' });
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(PORT, '127.0.0.1', () => console.log(`Signal10 running at http://localhost:${PORT}`));
}
