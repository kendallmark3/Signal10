# Feature: Free reading resources (V5)

Source: [intentv5.md](intentv5.md), the owner's pasted note. This file is the contract drawn from it.

## Intent

Signal10 finds videos and nothing else. For many topics a good book is the better way in or the natural next step after a video, and the owner wants Signal10 to find free reading for the same topic and let the existing Claude call place it in the path: watch, read, watch.

Add a Reading section fed by the Open Library Search API, and let Architect View, the one place Signal10 already calls Claude, mix reading steps into its sequence.

## Inputs

- The topic already being searched.
- Open Library's Search API (`openlibrary.org/search.json`): free, no key, one request per search.
- The existing Architect View request.

## What a look at real data showed (2026-10-05)

- Books Open Library marks **publicly readable** are rare for current technical topics: none for `Agentic Workflows` or `Kubernetes`, one for `Python for beginners` (Automate the Boring Stuff with Python), and for `Retirement investing` mostly 1990s Senate hearings.
- Books marked **borrowable** (read free by borrowing with a free Open Library account) are far more useful: `Retirement investing` and `machine learning` each return hundreds.
- The search matches loosely. `machine learning` returns H. G. Wells's *The Time Machine*; `Python for beginners` returns a Solr guide and a book in Chinese.
- Modern books (Kubernetes in Action, Hands-On Machine Learning) are catalogued with no readable copy.

## Decisions

- **"Free" has two kinds, each labelled for what it is.** Public books are shown first as "Free to read online". Borrowable books follow as "Free to borrow with an Open Library account". The source note says to *prefer* publicly readable resources and never to imply a resource is free unless its availability supports it; borrowing is free, and the label says an account is needed. Books with no readable copy, or readable only by print-disabled patrons, are never shown.
- **Open Library discovers, Signal10 filters, Claude judges.** Signal10 drops books whose title does not contain every word of the topic, which removes the loose matches above. Claude then decides whether any remaining book belongs in the path, and may use none.
- **The mixed path lives in Architect View.** "Build Learning Path" is ordered from title cues without a model and does not change. Architect View's sequence becomes steps that are each a video to watch or a book to read.

## Outputs

- A Reading section under the video results: up to five books, each with title, author, first publication year, cover, how it can be read, and a link to its Open Library page. When nothing qualifies, one line says so.
- Architect View steps marked Watch or Read, with Claude's one-sentence reason for each.

## Success criteria

Open Library (`src/openlibrary.js`, pure functions and a fetch that is passed in):

1. One keyless request is built for the topic, asking only for readable books and only for the fields used.
2. Only publicly readable and borrowable books are kept, public first, each labelled by its own availability. A book with no readable copy is never shown.
3. A book is kept only if its title or subtitle contains every word of the topic, and only if it is available in English.
4. The same title by the same author appears once, and at most five books are returned.
5. Each book carries its title, authors, first publication year, cover and Open Library link from the reply. A field Open Library did not return stays empty, and a book without a well-formed Open Library key is dropped.
6. When Open Library fails, times out or returns something unreadable, the answer is an empty list and no error. The request identifies Signal10 in its User-Agent, as Open Library asks.

Architect View (`src/architect.js`):

7. When there are books, the existing request also carries each book's number, title, author, year and availability, and nothing else about it. When there are none, the request is exactly what it was before.
8. A step in the reply may be a video to watch or a book to read. A reading step is resolved from Signal10's own reading list by number, so the reply cannot introduce a book, a title or a link; unknown numbers and repeats are dropped, and the order of the steps is kept.

Page:

9. The page has a Reading section that stays hidden until a search has run.

## Constraints

- Open Library is the only new external source. No key, no paid API, no second model call, no new dependency.
- YouTube search, ranking, the title-cue learning path and playback do not change. A slow or failed Open Library request must not fail or noticeably delay a video search.
- Book titles and author names are untrusted text: rendered with `textContent`, and sent to the model as data.
- Never render a book title or link taken from the model's reply.

## Evidence required

- `npm test` passes.
- The running app searched for three materially different topics, one of them AI or software: video results still arrive; reading appears where it exists and is absent where it does not; each reading link opens a real Open Library page; each label matches the book's availability on that page; Architect View is requested and its sequence can mix Watch and Read steps.
- A search with Open Library unreachable still returns its videos.

## Stop condition

Reading works and Architect View can place it. Google Books, arXiv, paid APIs, saved libraries, and reading in the title-cue learning path are later decisions.
