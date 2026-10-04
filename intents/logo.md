# Feature: Signal10 logo on the page

## Intent

The site's name is plain text on both the sign-in screen and the main page. The owner supplied a logo (a 2172 x 724 transparent PNG: a red signal mark, "Signal10", and the line "YouTube has the knowledge. Signal10 has the path.") and wants it on the page, looking clean on a phone, a tablet and a PC, without being stretched or pushing the layout out of shape.

Two things about the supplied file would look wrong if it were dropped in as is. Its lettering is dark on a transparent background, so it disappears on the dark theme. And it carries wide transparent margins, so it would sit visibly indented and small.

## Inputs

- The owner's PNG, kept in the repository as `assets/logo-source.png`.

## Outputs

- `public/logo.webp`: the logo trimmed to its artwork and sized for sharp display on high-density screens.
- The logo in place of the text name on the sign-in screen and the main page.

## Success criteria

1. A signed-in request for `/logo.webp` returns the image as `image/webp` and lets the browser cache it. Without a session it is refused like every other route.
2. The sign-in screen shows the logo without a session and without any new unprotected route: the image is embedded in the page itself.
3. The main page shows the logo with the alternative text "Signal10", and its declared width and height match the image's real proportions, so it cannot be skewed and the page does not jump while it loads.
4. On both pages the logo scales down with the screen and keeps its proportions (`max-width: 100%`, `height: auto`), and sits on a light plate in the dark theme so the dark lettering stays readable.

## Constraints

- No new dependency. No route is added above the session check.
- The artwork is not redrawn or recoloured; it is only trimmed, resized and re-encoded.

## Evidence required

- `npm test` passes.
- The sign-in screen and main page viewed at phone, tablet and desktop widths, in light and dark themes, locally and on the deployed site.

## Stop condition

The logo is on both pages. A favicon, a separate dark-theme version of the artwork, and a vector redraw are later features.
