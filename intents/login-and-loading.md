# Feature: Sign-in screen and Architect View loading state

## Intent

Signal10 is about to be deployed to AWS. Architect View spends money on the owner's Anthropic API key every time it runs, so the site must not be usable by anyone who finds the URL.

Put the whole site behind a simple sign-in screen with one username and one password that only the owner knows and can change. If the owner chooses to share them, that person can get in; nobody else can.

Separately, Architect View takes around 15 seconds to arrive and currently gives little sign that anything is happening. Show a clear status and a spinner while it is being retrieved.

## Inputs

- A username and a password supplied to the server environment, alongside the Anthropic API key.
- The existing Architect View request.

## Outputs

- A sign-in page. Until the visitor signs in, no page content and no API response is served.
- A way to sign out.
- A visible loading state in Architect View from the moment it is requested until the view or an error appears.

## Success criteria

Sign-in logic (`src/auth.js`, unit tested):

1. The correct username and password together are accepted. A wrong username, a wrong password, or an empty value is rejected.
2. Signing in issues a session that is accepted on later requests, for seven days.
3. A session that has been altered, is malformed, or has expired is rejected.
4. Changing the password invalidates every session issued under the old one.
5. The session value does not contain the username or the password.
6. After five failed sign-ins in a row, sign-in is refused for 60 seconds, even with the correct password. A successful sign-in resets the count.
7. The server cannot be created without both a username and a password, so it can never run unprotected by accident.

Site protection (`server.js`, tested over HTTP against a local server):

8. Without a session, a request for the page is redirected to the sign-in page, and requests to `/api/top10` and `/api/architect` get a 401 with no data.
9. The sign-in page itself is reachable without a session.
10. A correct sign-in sets an HttpOnly session cookie and redirects to the page, which then loads.
11. A wrong sign-in sets no cookie and returns to the sign-in page with an error.
12. Signing out clears the cookie, and the page is protected again.

Loading state (checked live in the browser):

13. From the click on Architect View until the result arrives, the panel shows a spinner and a status line, with the seconds elapsed.
14. The spinner is removed when the view or an error is shown, and when the user switches to another view.
15. If the session has expired when the page calls the API, the page sends the user to the sign-in screen instead of showing a broken state.

## Constraints

- One username and one password, set in the server environment (`SIGNAL10_USERNAME`, `SIGNAL10_PASSWORD`). No user accounts, sign-up, password reset, roles, or database.
- No new dependencies.
- The Anthropic API key stays server-side, as before.
- Top 10, learning path, Architect View and the video modal behave as before once signed in.
- The server can listen on an address other than localhost for deployment (`HOST`), and still defaults to localhost.

## Evidence required

- Tests for criteria 1 to 12, committed failing before the implementation.
- Live in the browser: visiting the site shows the sign-in screen; a wrong password is refused; the right one reaches the app; Architect View shows the spinner and then the view; signing out returns to the sign-in screen.

## Stop condition

Stop when the criteria pass and the live check is done. Deploying to AWS, HTTPS setup, and multiple users are not part of this feature.
