import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { gatherCandidates, isAvailable, fetchPublishDate } from './src/youtube.js';
import { scoreCandidates, pickDiverse, present } from './src/rank.js';
import { buildLearningPath } from './src/learning-path.js';
import { architectView, ArchitectError } from './src/architect.js';
import { createAuth } from './src/auth.js';
import Anthropic from '@anthropic-ai/sdk';

// An optional .env file next to this one holds the sign-in credentials and ANTHROPIC_API_KEY.
// It is never served.
try {
  process.loadEnvFile(fileURLToPath(new URL('./.env', import.meta.url)));
} catch {
  // No .env file: the key, if any, comes from the real environment.
}

const PORT = Number(process.env.PORT) || 4310;
// Localhost only unless told otherwise; a deployment sets HOST=0.0.0.0.
const HOST = process.env.HOST || '127.0.0.1';
const LIMIT = 10;
const SPARES = 5; // extra picks to fall back on when a video turns out to be unavailable
const PAGE = fileURLToPath(new URL('./public/index.html', import.meta.url));
const LOGIN_PAGE = fileURLToPath(new URL('./public/login.html', import.meta.url));

// Without a key, Architect View reports "not configured" and everything else works as before.
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

// Recent searches, so Architect View reasons about the same list the user is looking at
// and a repeat request does not pay for a second model call.
const RECENT_LIMIT = 50;
const RECENT_TTL_MS = 15 * 60 * 1000;
const recent = new Map();
const topicKey = (topic) => topic.toLowerCase();

function remember(topic, data) {
  // Searching again usually returns the same ten videos; keep the view already paid for.
  const previous = recent.get(topicKey(topic));
  const sameList = previous && previous.data.results.map((r) => r.id).join() === data.results.map((r) => r.id).join();
  recent.delete(topicKey(topic));
  recent.set(topicKey(topic), { data, at: Date.now(), view: sameList ? previous.view : null });
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

const COOKIE = 'signal10_session';
const SIGN_IN_MESSAGES = {
  error: 'That username and password did not match. Try again.',
  locked: 'Too many failed attempts. Wait a minute, then try again.',
};

function sessionFrom(req) {
  const match = new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]*)`).exec(req.headers.cookie ?? '');
  return match?.[1];
}

// Secure is added when the request arrived over HTTPS through a proxy or load balancer.
function sessionCookie(req, value, maxAgeSeconds) {
  const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

function redirect(res, location, headers = {}) {
  res.writeHead(302, { location, 'cache-control': 'no-store', ...headers });
  res.end();
}

async function readForm(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 4096) return new URLSearchParams();
  }
  return new URLSearchParams(body);
}

// Every route except the sign-in page itself requires a valid session.
export function createApp({ auth }) {
  return createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');

    if (url.pathname === '/login') {
      if (req.method === 'POST') {
        const form = await readForm(req);
        const result = auth.signIn(form.get('username'), form.get('password'));
        if (!result.ok) return redirect(res, result.locked ? '/login?locked=1' : '/login?error=1');
        return redirect(res, '/', { 'set-cookie': sessionCookie(req, result.session, result.maxAgeSeconds) });
      }
      const message = url.searchParams.has('locked') ? SIGN_IN_MESSAGES.locked : url.searchParams.has('error') ? SIGN_IN_MESSAGES.error : '';
      const page = (await readFile(LOGIN_PAGE, 'utf8')).replace('<!--message-->', message);
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(page);
    }

    if (url.pathname === '/logout' && req.method === 'POST') {
      return redirect(res, '/login', { 'set-cookie': sessionCookie(req, '', 0) });
    }

    if (!auth.isSignedIn(sessionFrom(req))) {
      if (url.pathname.startsWith('/api/')) return sendJson(res, 401, { error: 'Sign in to use Signal10.' });
      return redirect(res, '/login');
    }

    if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed.' });

    if (url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
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
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let auth;
  try {
    auth = createAuth({ username: process.env.SIGNAL10_USERNAME, password: process.env.SIGNAL10_PASSWORD });
  } catch (err) {
    console.error(`${err.message}\nSet SIGNAL10_USERNAME and SIGNAL10_PASSWORD in .env or the environment.`);
    process.exit(1);
  }
  createApp({ auth }).listen(PORT, HOST, () => console.log(`Signal10 running at http://${HOST === '127.0.0.1' ? 'localhost' : HOST}:${PORT}`));
}
