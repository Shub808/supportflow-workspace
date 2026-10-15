# ADR 0005 — Fonts are self-hosted from npm

**Status:** accepted · **Date:** 2026-10-15

## Context

`next/font/google` fetches font CSS and binaries from `fonts.googleapis.com`
at **build time**, which makes the build depend on a third-party host being
reachable. On a CI runner behind an egress allow-list — which is where this
project was first built — it is not, and `next build` fails with
`next/font: Failed to fetch Inter from Google Fonts`.

## Decision

Install the fonts as npm packages (`@fontsource-variable/inter`,
`@fontsource-variable/jetbrains-mono`) and import them in the root layout, with
a system stack behind them in the `--font-sans` / `--font-mono` tokens.

## Consequences

- The build depends only on the npm registry, which CI already needs.
- The deployed app makes no third-party request for fonts.
- Both faces are variable, so one file per family covers every weight used.
- Font versions are pinned in `package-lock.json`, so rendering is
  reproducible.
- The trade-off is a larger `node_modules` and no shared CDN cache — which
  modern browsers partition per-site anyway.
