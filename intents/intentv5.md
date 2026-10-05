I’d make Open Library the only new external API in V5. It is the cheapest and simplest fit: free public low-volume API, no paid subscription, and it can filter for publicly readable eBooks. Open Library specifically recommends its Search API for book discovery and supports ebook_access:public; its default rate limit is 1 request/second, which is more than enough for your personal use. 

I’d leave arXiv, Google Books, and other sources out for now. Progressive Intent: add one thing, run it, see whether it actually improves Signal10.

Here is the V5 intent I’d hand directly to Claude Code.

Signal10 V5 — Free Reading Resources

Intent

Extend Signal10’s existing learning experience so a user can discover useful free reading resources alongside the existing videos and AI-generated learning path.

Signal10 should remain simple:

Tell Signal10 what you want to learn. It finds the material and builds the path.

Do not redesign or over-engineer the existing application.



Inputs

The existing Signal10 topic/search input.

Example:

Agentic Workflows

Use the same topic already being used to discover videos and generate the learning path.



Required Output

Add a Reading section to the existing Signal10 results.

Use the Open Library Search API to find relevant books or eBooks related to the user’s topic.

Only prefer resources that Open Library identifies as publicly readable/free.

Return a maximum of approximately 5 useful reading resources.

For each resource display, when available:

Title
Author
Cover
Publication information
Resource type
Link to the legitimate Open Library reading/resource page
Do not show questionable third-party PDF download sites.



AI Integration

Signal10 already calls Anthropic to organize and improve the learning experience.

Do not create another Anthropic call solely for books.

Include the small amount of selected reading-resource metadata in the existing reasoning request where practical.

Allow Claude to use the reading resources when constructing the learning path.

The resulting path may mix resources naturally, for example:

Watch introductory video
Read introductory resource
Watch architecture explanation
Read deeper resource
Watch advanced implementation material
For recommended reading items, Claude may provide a short explanation of why the resource belongs at that point in the learning path.

Keep additional token usage minimal.



Constraints / Boundaries

New external resource API must be free.
Use Open Library for V5.
Do not add a paid API.
Do not require a new API key for Open Library.
Do not add advertising or monetization.
Do not add multiple book/research APIs in this version.
Do not replace or materially change the existing YouTube functionality.
Preserve the current Signal10 UI style and workflow.
Keep the feature lightweight.
Handle Open Library failures gracefully; video learning should still work.
Respect Open Library usage/rate guidance.
Avoid duplicate or obviously irrelevant reading results.
Never imply that a resource is free unless the returned availability supports that conclusion.
The implementer owns the technical solution and should use the simplest implementation that satisfies this intent.


Success Criteria

A user can search Signal10 for a learning topic and receive:

Existing YouTube discoveries
Existing AI recommendations
Existing learning path
A new set of relevant free/open reading resources
A learning path that can incorporate both watching and reading
Example:

Topic: Agentic Workflows

Signal10 might produce:

WATCH
Intro to Agentic Workflows

READ
Relevant publicly available book/resource

WATCH
Agent Orchestration Patterns

READ
More advanced resource

WATCH
Production Agent Architecture

The user should be able to open each reading recommendation from Signal10.



Evidence

Run Signal10 against at least three materially different topics, including one AI/software topic.

Demonstrate that:

Existing video search still works.
Reading resources are returned where appropriate.
Reading links resolve to legitimate Open Library resources.
Public/free availability is respected.
The learning path can mix video and reading recommendations.
Failure or zero results from Open Library does not break the existing experience.
Use the running application as evidence.



V5 Stop Condition

Stop when the reading-resource capability works cleanly and improves the learning path.

Do not add:

Google Books
arXiv
paid APIs
advertising
user accounts
saved libraries
recommendation history
additional AI agents
Those are future decisions based on evidence from V5.

One little architectural decision in there is important: Open Library supplies discovery; Claude supplies judgment. Open Library finds candidate books, while your existing Anthropic call decides whether any are actually worth inserting into the path.

So now Signal10 has essentially four things working together:

Discover → Watch → Read → Learn in sequence.

That feels like the point where I’d stop adding features for a while and actually use the hell out of it.


