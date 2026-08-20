# DS — Enterprise Design System (working name)

A token-first, multi-layer design system for web apps and websites. Benchmark: [eBay Playbook](https://playbook.ebay.com/design-system/components).

## Architecture

| Layer | Package | What it is | Distribution |
|---|---|---|---|
| Tokens | `@ds/tokens` | JSON source of truth → CSS variables, TypeScript, Tailwind preset | npm |
| CSS components | `@ds/css` | Framework-free, per-component versioned CSS (works with plain HTML) | npm |
| Primitives | `@ds/primitives` | Headless, accessible behavior (pure functions — portable beyond React) | npm |
| React components | `@ds/react` | Styled components: primitives behavior + CSS appearance | npm **and** CLI copy-paste |
| Registry | `registry/` | Per-component manifests: family, status matrix, files, tier (free/pro) | drives CLI + docs |
| CLI | `@ds/cli` | `ds list`, `ds add <component>` — copies source into consumer repos; `ds props/tokens/pages` — agent lookup, read straight from source | npm |
| Playground | `apps/playground` | Live component gallery + status matrix | internal (docs site later) |

Key decisions:

- **CSS-first** (like eBay Skin): every component is usable without React; framework wrappers share one CSS layer, so adding Vue/Svelte later is cheap.
- **aria-disabled over disabled**: disabled controls stay focusable and screen-reader discoverable; activation is blocked in the behavior layer.
- **State layer as its own primitive**: uniform hover/press feedback across all interactive components.
- **Status matrix from registry metadata**: honest per-artifact lifecycle (latest / in-progress / future / deprecated / na), published on the docs site.
- **Open core**: tokens + primitives + base components free (MIT); composed blocks/templates and multi-brand theming are the paid tier (`tier: "pro"` in registry manifests).

## Develop

```sh
npm install
npm run build      # tokens → css → primitives → react → ui:sync
npm test           # primitives unit tests
npm run dev        # playground at http://localhost:5173
```

Try the CLI (distribution):

```sh
npm run ui -- list
node packages/cli/bin/ds.mjs add button --dir /tmp/demo
```

## Agent-ready workflow

This repo is built so an agent looks up its component API instead of
recalling it from memory — see [CLAUDE.md](CLAUDE.md) for the rules and
[agent-workflow.md](agent-workflow.md) for the general workflow behind them.

```sh
npm run ui -- props button --example   # props, types, defaults + a real usage snippet
npm run ui -- tokens color             # --ds-* custom properties, filtered
npm run ui -- pages                    # existing page shells in this repo
```

`.claude/ui-context.md` is the same lookups as one generated file
(`npm run ui:sync`, which `npm run build` also runs last) — read it when you
want the whole surface at once instead of querying one component at a time.

Adding a component follows a gated order — primitive behavior approved,
then each token mapping approved state by state, only then CSS/React — see
[STRUCTURE.md](STRUCTURE.md#how-a-component-becomes-real). Proposing a new
token itself goes through the `design-tokens` skill
(`.claude/skills/design-tokens/`), not an ad hoc edit to the theme JSON.

**This context is monorepo-local, not distributed yet.** `npm install
@ds/react` carries prop names/types/JSDoc via the `.d.ts` output (real, if
partial, context — confirmed by checking `packages/react/dist/button.d.ts`).
`ds add <name>` carries none of it: it copies raw source only, no manifest,
no context file, and `ds props/tokens/pages` don't work once installed
outside this monorepo (their path resolution assumes they're still sitting
at `packages/cli/bin/`). See Open items below.

## Open items

- Product name + npm scope (placeholder: `@ds`)
- Own color palette (current scales are placeholders, not brand-differentiated)
- Docs site with eBay-Playbook-grade guidance pages (Types / Anatomy / Placement / Behavior / A11y / Tokens / API)
- Figma variables export + component library
- Visual regression (Playwright) and axe a11y gates in CI
- Hosted registry + license auth for the pro tier
- Container components (`Card`, `Table`, `List`) — layout guidance in CLAUDE.md
  references these categories generically; none exist in the registry yet
- CSS cascade layers (`@layer`) — component CSS currently relies on the
  manual `ORDER` array in `packages/css/build.mjs` rather than a layer boundary
- Existing component CSS (`button.css`, `playground.css`) still reaches into
  primitives directly rather than the semantic layer built out in
  `packages/tokens/TOKENS.md` — intentionally left alone since these
  components are getting rebuilt. **This is now a real visual regression in
  the live playground, not just a style violation**: the font primitive
  scale was rebuilt on eBay's real values, and `--ds-font-weight-medium`,
  `--ds-font-line-height-tight`, `--ds-font-size-base/lg/sm` no longer
  exist under those names — text in the running playground/button is
  rendering at browser-default size/weight/line-height until this is
  rebuilt against `type.*` semantics, not primitives
- Agent-lookup context doesn't travel past this monorepo — `ds add` copies
  raw source with no manifest/context, and `ds props/tokens/pages` don't
  work from an installed `@ds/cli` (path resolution assumes it's still
  inside `packages/cli/`). Two directions worth weighing later: teach
  `ds add` to drop a per-component context file alongside the source, or
  bundle the registry + a props snapshot into the published CLI so the
  live commands work post-install too
