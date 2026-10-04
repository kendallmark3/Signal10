# Feature: One-command deploy to AWS

## Intent

Signal10 runs only on the owner's laptop. Putting it on AWS today would mean choosing a service, building an image, creating roles and copying three secrets by hand, and doing most of that again for every change.

Make deployment one command, `npm run deploy:aws`, run with the owner's `mkendall` AWS profile. The first run creates everything; later runs update it in place.

App Runner was the first choice and is not open to this account (`SubscriptionRequiredException`, checked 2026-10-04). The deploy targets AWS Lambda behind a Function URL, using the AWS Lambda Web Adapter layer so `server.js` runs unchanged. That needs no Docker, gives an HTTPS URL, and costs nothing while idle.

## Inputs

- The `mkendall` AWS CLI profile and its region (`us-east-2`).
- `SIGNAL10_USERNAME`, `SIGNAL10_PASSWORD` and `ANTHROPIC_API_KEY` from `.env` or the environment.
- The app as it is: `server.js`, `src/`, `public/`, `node_modules/`.

## Outputs

- `npm run deploy:aws`, which prints the site's HTTPS URL when it finishes.
- A Lambda function `signal10`, its execution role `signal10-lambda`, and a public Function URL. The site's own sign-in is what protects it.

## Success criteria

Tested in `test/deploy.test.js` against the script's pure functions; no test calls AWS.

1. The deployed environment carries the sign-in credentials and the API key, and the deploy refuses to proceed, naming the missing variable, when the username or the password is absent. The API key is optional, as it is locally.
2. The bundle contains what the server needs to run and nothing else: never `.env`, `.git`, the tests, the intents or the plugin copy.
3. No secret value appears in any AWS CLI argument; the environment reaches AWS through a file reference.
4. The first deploy creates the function and later deploys update its code and configuration, and both go through the `mkendall` profile unless `AWS_PROFILE` says otherwise.
5. `npm run deploy:aws` is wired to the script, and `run.sh`, the Lambda entry point, starts `server.js`.

## Constraints

- No new npm dependency. The script uses the AWS CLI and `zip`, which are already on the machine.
- `server.js` and `src/` do not change. Every route stays behind the sign-in.
- Secrets stay out of the repository, out of the bundle's files, and out of command lines.

## Evidence required

- `npm test` passes.
- A real deploy with the `mkendall` profile, then against the printed URL: the page redirects to sign-in without a session, a sign-in sets a `Secure` cookie, and the three V1 searches (`Claude Certified Architect Foundations`, `AWS AgentCore`, `Python for beginners`) return ten results each. Architect View is requested once.
- A second deploy, to show the update path works.

## Stop condition

The site is reachable at its Function URL and can be redeployed with one command. A custom domain, CI-triggered deploys, moving secrets to Secrets Manager, and a shared store for the sign-in lockout counter are later features.
