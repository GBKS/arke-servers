# Ark servers

A small directory of public [Ark](https://ark-protocol.org) servers you can use with
[Arké](https://arke.cash), with observed uptime and the configuration each server
advertises. Live at [servers.arke.cash](https://servers.arke.cash).

## How it works

- `servers.json` is the curated list of servers (id, name, host, and an optional logo `color` and `logo` file in `public/logos/`). To add one, open a pull request.
- `scripts/probe.ts` runs every 10 minutes in GitHub Actions. For each server it calls,
  over gRPC-Web on port 443:
  - the standard gRPC health check (`grpc.health.v1.Health/Check`), which decides online/offline
  - `GetArkInfo`, `Handshake`, `GetOffboardFeeRate` and `NextRoundTime`, for display
  
  A failed check is retried once after a few seconds before counting as offline.
- Every check is appended to `data/history/YYYY-MM.jsonl`, and `data/status.json` is
  rebuilt with the current state, 24 h / 7 d / 30 d uptime, and the last-known server info.
  Both are committed, so the full history is public in this repo.
- The Nuxt site is statically generated from `data/status.json` and deployed to Netlify
  by the same workflow.

## Limitations

- Checks run from a single location (GitHub's runners). A network problem between
  GitHub and a server looks the same as the server being down.
- GitHub's scheduler can delay or skip runs, so the interval is approximate.
- Uptime is computed from the checks that actually ran. It says nothing about future
  availability, and online does not mean a server is safe to use.
- Fees, limits and terms are what the server reports about itself. They aren't verified.
- Round activity isn't tracked. The Ark API only streams live round events, with no history
  or timestamps, which doesn't fit a scheduled job.

## JSON

[`/servers.json`](https://servers.arke.cash/servers.json) has the same data as the page.
Its shape is defined in [`shared/types/status.ts`](shared/types/status.ts). Breaking
changes bump `version`.

## Development

```bash
npm install
npm run probe     # check all servers once and update data/
npm test
npm run dev       # http://localhost:3000
npm run generate  # static build in .output/public
```

## Deployment setup

1. Create a Netlify site without linking it to the repo (deploys come from GitHub Actions).
2. Add repo secrets `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID`.
3. Point `servers.arke.cash` at the site in Netlify.

## Credits

`protos/` contains protocol definitions from [Bark](https://gitlab.com/ark-bitcoin/bark)
(MIT). See [`protos/README.md`](protos/README.md).
