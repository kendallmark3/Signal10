import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { gatherCandidates, isAvailable, fetchPublishDate } from './src/youtube.js';
import { scoreCandidates, pickDiverse, present } from './src/rank.js';

const PORT = Number(process.env.PORT) || 4310;
const LIMIT = 10;
const SPARES = 5; // extra picks to fall back on when a video turns out to be unavailable
const PAGE = fileURLToPath(new URL('./public/index.html', import.meta.url));

export async function top10(topic) {
  const candidates = await gatherCandidates(topic);
  const scored = scoreCandidates(topic, candidates);
  const shortlist = pickDiverse(scored, LIMIT + SPARES);

  const availability = await Promise.all(shortlist.map((c) => isAvailable(c.id)));
  const picked = shortlist.filter((_, i) => availability[i]).slice(0, LIMIT);
  const dates = await Promise.all(picked.map((c) => fetchPublishDate(c.id)));

  return {
    topic,
    candidatesFound: candidates.length,
    candidatesOnTopic: scored.length,
    results: present(picked.map((c, i) => ({ ...c, publishedDate: dates[i] }))),
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

  if (url.pathname === '/api/top10') {
    const topic = (url.searchParams.get('topic') ?? '').trim().replace(/\s+/g, ' ');
    if (topic.length < 2 || topic.length > 120) {
      return sendJson(res, 400, { error: 'Enter a topic between 2 and 120 characters.' });
    }
    try {
      return sendJson(res, 200, await top10(topic));
    } catch (err) {
      console.error(err);
      return sendJson(res, 502, { error: 'Could not reach YouTube just now. Try again in a moment.' });
    }
  }

  sendJson(res, 404, { error: 'Not found.' });
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(PORT, '127.0.0.1', () => console.log(`Signal10 running at http://localhost:${PORT}`));
}
