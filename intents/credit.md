# Feature: Developer credit

## Intent

Nothing on the site says who built it. The owner wants a line at the bottom, "Developed by Mark Kendall at repogenic.com", that links to repogenic.com.

## Inputs

- The wording above and the address `https://repogenic.com`.

## Outputs

- A small credit line at the bottom of the main page and of the sign-in screen.

## Success criteria

1. The main page and the sign-in screen each carry the line "Developed by Mark Kendall at repogenic.com", with "repogenic.com" a link to `https://repogenic.com`.
2. The link opens in a new tab without giving the opened page a handle on Signal10 (`target="_blank"` with `rel="noopener"`).
3. On the main page the credit sits outside the results footer, whose text the page rewrites after each search, so it is always visible.

## Constraints

- Static markup only. No new route, script or dependency.

## Evidence required

- `npm test` passes.
- Both pages viewed at phone and desktop widths, in light and dark themes.

## Stop condition

The credit line is on both pages. An about page or further links are later features.
