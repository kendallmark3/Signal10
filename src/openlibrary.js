// Finds free reading for a topic through Open Library's public Search API. No key or account.
// Like youtube.js, nothing here invents metadata: a field Open Library does not return stays null.
import { tokenize } from './rank.js';

const SEARCH = 'https://openlibrary.org/search.json';
const FIELDS = ['key', 'title', 'subtitle', 'author_name', 'first_publish_year', 'cover_i', 'ebook_access', 'language'];
const FETCH_LIMIT = 25; // the search matches loosely, so most of what comes back is filtered out
const MAX_READING = 5;
const TIMEOUT_MS = 4000; // a slow Open Library must not hold up the videos
// Open Library asks callers to say who they are.
const USER_AGENT = 'Signal10/0.1 (https://repogenic.com)';

// The only kinds of availability shown, in the order they are listed. A book Open Library
// marks no_ebook or printdisabled cannot be read by most people and is never offered.
const ACCESS = {
  public: 'Free to read online',
  borrowable: 'Free to borrow with an Open Library account',
};
const ACCESS_ORDER = Object.keys(ACCESS);

// Words of a topic that a book title need not contain. Shorter than the video ranking's
// list on purpose: there "learning" is filler, but here it is half of "machine learning",
// and without it the search's loose matches (The Time Machine) get through.
const FILLER = new Set(['a', 'an', 'the', 'of', 'to', 'for', 'with', 'and', 'or', 'in', 'on', 'at', 'by', 'from', 'how', 'what', 'is', 'are', 'me', 'my', 'i', 'about', 'learn']);

function wantedWords(topic) {
  const all = [...new Set(tokenize(topic))];
  const meaningful = all.filter((word) => !FILLER.has(word));
  return meaningful.length > 0 ? meaningful : all;
}

export function searchUrl(topic) {
  const params = new URLSearchParams({
    q: `${topic} ebook_access:[borrowable TO *]`,
    fields: FIELDS.join(','),
    limit: String(FETCH_LIMIT),
  });
  return `${SEARCH}?${params}`;
}

const clean = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);

function toReading(doc) {
  // The key becomes a link, so it has to be exactly an Open Library work id.
  if (!/^\/works\/OL\d+W$/.test(doc?.key ?? '') || !clean(doc.title) || !(doc.ebook_access in ACCESS)) return null;
  const authors = (Array.isArray(doc.author_name) ? doc.author_name : []).map(clean).filter(Boolean).slice(0, 2).join(', ');
  return {
    title: clean(doc.title),
    subtitle: clean(doc.subtitle),
    authors: authors || null,
    year: Number.isInteger(doc.first_publish_year) ? doc.first_publish_year : null,
    type: 'eBook',
    access: doc.ebook_access,
    accessLabel: ACCESS[doc.ebook_access],
    url: `https://openlibrary.org${doc.key}`,
    cover: Number.isInteger(doc.cover_i) ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
  };
}

// Open Library does not say a book is in English when it lists no language at all, so only
// a book that lists languages without English is dropped.
const inEnglish = (doc) => !Array.isArray(doc.language) || doc.language.includes('eng');

// Filters a search reply down to at most five books worth showing: readable for free, in
// English, with every word of the topic in the title or subtitle, each listed once.
export function selectReading(topic, docs) {
  const wanted = wantedWords(topic);
  const seen = new Set();
  const kept = [];
  for (const doc of docs) {
    const book = inEnglish(doc ?? {}) ? toReading(doc) : null;
    if (!book) continue;
    const words = new Set(tokenize(`${book.title} ${book.subtitle ?? ''}`));
    if (!wanted.every((word) => words.has(word))) continue;
    const identity = `${tokenize(book.title).join(' ')}|${(book.authors ?? '').toLowerCase()}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    kept.push(book);
  }
  return kept
    .sort((a, b) => ACCESS_ORDER.indexOf(a.access) - ACCESS_ORDER.indexOf(b.access))
    .slice(0, MAX_READING)
    .map((book, index) => ({ number: index + 1, ...book }));
}

// Reading is an addition to the videos, so any failure here is an empty list, never an error.
export async function findReading(topic, { fetch: request = fetch } = {}) {
  try {
    const res = await request(searchUrl(topic), { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.docs) ? selectReading(topic, data.docs) : [];
  } catch {
    return [];
  }
}
