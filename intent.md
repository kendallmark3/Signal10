Yes. This is exactly where I’d use Progressive Intent: get a real V1 running, learn from it, then every next improvement becomes a feature story that we can drive with TDD.

I’d call the project Signal10 for now.

The idea is simple enough to explain in one sentence:

Signal10 finds the 10 YouTube videos most worth watching for a topic—not merely the 10 most viewed.

And I would deliberately not put Anthropic, React, databases, or a specific ranking formula into V1. The first build should have freedom to discover the simplest solution.

Here’s the first intent I’d put in the repo.

Signal10

Intent

Build a simple application that helps a person learn about a subject without spending significant time searching YouTube.

The user enters a topic.

Signal10 returns the 10 YouTube videos most worth watching for that topic right now, ranked to favor useful, relevant content rather than simply the videos with the highest lifetime view counts.

The first version should be small, usable, and good enough to learn from.



Inputs

A topic or learning goal entered by the user.
Examples:

Claude Certified Architect Foundations
AWS AgentCore
Test-Driven Development with AI
Learn Python
Retirement investing
Mapbox development


Outputs

Display up to 10 recommended YouTube videos.

For each result, provide enough information for the user to decide whether it is worth watching, including:

title
thumbnail
channel
publication date
duration
view count when available
direct YouTube link
ranking position
short explanation of why this video made the list
Also show a simple overall indication of why the video ranks highly.



Success Criteria

Relevance

The returned videos should clearly relate to the user’s requested topic or learning goal.

Quality over raw popularity

A video should not rank highly merely because it has accumulated a large number of lifetime views.

The ranking should consider signals such as:

relevance to the requested topic
recency when recency matters
popularity relative to age
audience engagement when available
apparent depth or usefulness
credibility or authority signals
duplication or near-duplication with other results
The implementer may determine how these signals should be combined.

Discovery

The list should have a reasonable chance of surfacing a strong newer or less-established video when its current performance suggests it is unusually valuable.

Learning usefulness

The results should help a user begin learning the topic without needing to conduct multiple YouTube searches manually.

Explanation

Each recommendation should include a concise, understandable reason explaining why it was selected.

Usability

A user should be able to:

enter a topic,
request recommendations,
review the Top 10,
play a selected video in a modal without leaving the page,
open a selected video on YouTube.
Clicking a video's thumbnail or title opens the modal and starts playback. Closing the modal stops playback. The modal keeps a link to the video on YouTube.
The application should feel complete enough to use rather than like a technical demonstration.



Constraints / Boundaries

Recommendations must point to real YouTube videos.
Do not invent video metadata.
Exclude unavailable or unusable videos when they can be identified.
Avoid obvious duplicate results.
Do not require the user to have a YouTube account.
External AI services may be used when they materially improve the result, but they are not required.
API credentials and secrets must not be exposed to the client or committed to the repository.
Prefer the simplest implementation that satisfies this intent.
The implementer owns the technical architecture and implementation choices.


Required Evidence

The running application must demonstrate at least these searches:

Search 1

Claude Certified Architect Foundations

Search 2

AWS AgentCore

Search 3

A broadly popular learning topic selected by the implementer.

For each search:

results are returned,
the results clearly match the requested subject,
ten results are shown when enough suitable videos exist,
each result links to a real playable YouTube video,
a selected result plays in the modal,
each result contains an understandable reason for its ranking,
the ordering shows evidence that Signal10 is doing more than sorting solely by lifetime view count.
Document any important limitations discovered during the first implementation.



V1 Stop Condition

Status: V1 is complete as of 2026-10-03. The stop condition below was met; findings and limitations are recorded in README.md.

Stop when the core experience works:

Topic → Signal10 ranking → Top 10 → explanation → play in modal or open on YouTube

Do not add accounts, saved searches, playlists, personalization, certification plans, learning paths, subscriptions, notifications, social features, or other major capabilities in this version.

Those should emerge as later features based on what is learned from V1.

That last section is important because I can already see us getting carried away. 😄

There are tons of directions we could take this:

“Teach me Claude Foundations in 90 minutes.”
“Only show videos from the last 30 days.”
“Beginner / Intermediate / Expert.”
“Build me the best sequence, not merely the best ten.”
“I watched #1—what should I watch next?”
“Find disagreements among the Top 10.”
“Extract the common lessons from all ten.”
“Create an exam-study track.”

But none of that belongs in Intent #1.

I want the first run to answer just one question:

Can we type a learning subject and get back ten YouTube videos that we would genuinely rather watch than the first ten results from ordinary YouTube search?

Once that works, Feature #1 becomes our first real TDD story.

And I already know which feature I’d probably pick:

“Build me a learning path from the Top 10.”

That’s where this starts turning from YouTube search into something that really could compete with the experience of taking a course.

