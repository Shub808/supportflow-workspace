# ADR 0004 — Dependency budget

**Status:** accepted · **Date:** 2026-10-15

## Decision

Runtime dependencies, in full:

| Package | Why |
|---|---|
| `next`, `react`, `react-dom` | The framework. |
| `zod` | Runtime validation at every untrusted boundary — the query string and every Server Action payload — with the types inferred from the same schema. |
| `@fontsource-variable/*` | Self-hosted font files (ADR 0005). |

That is the whole list. Notably absent:

- **A database client or ORM.** `node:sqlite` is built in (ADR 0001).
- **An authentication library.** The demo session is 80 lines of
  `node:crypto`: HMAC-sign, constant-time verify, re-read the role from the
  database. A library here would obscure the one mechanism worth showing.
- **A state manager.** Server Components hold the data; `useOptimistic` and
  `useActionState` hold the two pieces of client state that exist.
- **A data-fetching library.** There is no client-side fetching.
- **A component library.** `components/ui/primitives.tsx` is ~150 lines and
  the design system is part of what the project is meant to demonstrate.
- **`clsx` + `tailwind-merge`.** `lib/cn.ts` is ten lines; the variant maps
  here never emit conflicting utilities for the same property.
- **A Markdown renderer.** Message bodies are rendered as plain text inside a
  `white-space: pre-wrap` block. Customer-supplied content is the obvious XSS
  vector in a support tool, so nothing in this codebase parses or injects
  markup, and `dangerouslySetInnerHTML` appears only for the theme bootstrap
  script and the generated token stylesheet — both of which are
  developer-authored constants, never user input.

## Consequences

Small bundle, few upgrades, and no abstraction between the code and the
behaviour a reviewer is assessing. The cost is that the session, the
permission table and the UI primitives had to be written — and tested — rather
than installed.
