Yes — both changes are straightforward, and they fit Signal10 well.

For the typo handling, I would keep it lean and local. We do not need to call Claude just because somebody typed merchandizing instead of merchandising. We can use lightweight fuzzy matching/spell normalization in the browser, and only suggest a correction when confidence is high. The user should still be able to search exactly what they typed.

Here’s the next progressive intent I’d give Claude Code.

Intent: Search Memory + Typo Assistance

Outcome

Make Signal10 faster to reuse by remembering the user’s five most recent searches and helping with obvious search-term misspellings.

Keep the existing Signal10 learning-path behavior intact.

Inputs

The search phrase entered by the user.
The user’s previously saved searches in browser-local storage.
The existing Signal10 search and learning-path flow.
Outputs

Recent Searches

Show the user’s five most recent unique searches in the interface.

Each recent search should:

Be clickable.
Re-run that search without requiring retyping.
Persist after closing and reopening the browser.
Move back to the top when reused.
When a sixth unique search is added, remove the oldest.

Do not save blank searches.

Typo Assistance

Before executing a search, detect obvious or minor spelling mistakes when reasonably confident about the intended term.

Example:

visual merchandizing manager

may suggest:

visual merchandising manager

The interface should unobtrusively show something similar to:

Did you mean: visual merchandising manager?

The suggested phrase should be clickable.

Do not silently replace the user’s search.

If confidence is low, make no suggestion and search the original phrase normally.

Prefer a lightweight local/browser-side solution. Do not introduce an LLM/API call solely for spelling correction unless the existing implementation makes that clearly simpler.

Success Criteria

Search for five different topics.
Refresh or reopen Signal10.
The same five searches remain available.
Clicking one immediately reruns that search.
Enter a sixth unique search and verify the oldest disappears.
Reuse an older search and verify it moves to the most-recent position.
Enter a mildly misspelled phrase such as visual merchandizing manager.
Signal10 offers a reasonable correction when confidence is high.
The original phrase can still be searched unchanged.
Existing search, learning-path generation, and video functionality continue to work.
Constraints / Boundaries

Store recent searches locally in the browser.
Maximum history: 5 unique searches.
No login, database, or backend persistence is required.
Do not significantly enlarge or clutter the existing Signal10 interface.
Preserve the current visual design.
Keep implementation simple.
The implementer owns the technical solution.
I particularly like this because Recent Searches becomes personalized automatically. Instead of us trying to predict that you want Mapbox, AgentCore, Claude Architect, Visual Merchandising, etc., Signal10 gradually turns itself into your own learning launchpad based on what you actually investigate.

And I would not remove your existing starter topics yet. I’d have something like Recent Searches sitting beside or immediately below them. After using Signal10 a while, we may discover that the recent-search row makes the hard-coded examples mostly unnecessary.


