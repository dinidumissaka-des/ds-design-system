# DS — Enterprise Design System (working name)

A token-first, multi-layer design system for web apps and websites. Benchmark: [eBay Playbook](https://playbook.ebay.com/design-system/components).

## Architecture

| Layer | Package | What it is | Distribution |
|---|---|---|---|
| Tokens | `@ds/tokens` | JSON source of truth → CSS variables, TypeScript, Tailwind preset, [usage docs](packages/tokens/TOKENS.md) | npm |
| CSS components | `@ds/css` | Framework-free, per-component versioned CSS (works with plain HTML) | npm |
| Primitives | `@ds/primitives` | Headless, accessible behavior (pure functions — portable beyond React) | npm |
| React components | `@ds/react` | Styled components: primitives behavior + CSS appearance | npm **and** CLI copy-paste |
| Registry | `registry/` | Per-component manifests: family, status matrix, files, tier (free/pro) | drives CLI + docs |
| CLI | `@ds/cli` | `ds list`, `ds add <component>` — copies source into consumer repos | npm |
| Playground | `apps/playground` | Live component gallery + status matrix | internal (docs site later) |

Key decisions:

- **CSS-first** (like eBay Skin): every component is usable without React; framework wrappers share one CSS layer, so adding Vue/Svelte later is cheap.
- **aria-disabled over disabled**: disabled controls stay focusable and screen-reader discoverable; activation is blocked in the behavior layer.
- **State layer as its own primitive**: uniform hover/press feedback across all interactive components.
- **Status matrix from registry metadata**: honest per-artifact lifecycle (latest / in-progress / future / deprecated / na), published on the docs site.
- **Open core**: tokens + primitives + base components free (MIT); composed blocks/templates and multi-brand theming are the paid tier (`tier: "pro"` in registry manifests).
- **Documented tokens are enforced tokens**: every token carries usage rules in `packages/tokens/src/usage.json`, and the build fails if a token is undocumented, if the docs name a token that does not exist, or if a documented contrast pairing stops holding.

## Using the tokens

[`packages/tokens/TOKENS.md`](packages/tokens/TOKENS.md) is the reference for every token — what it is for, what it is not for, what to use instead, verified contrast pairings, and token-by-token recipes for common components. It is generated, so it cannot drift from the values.

The same content ships in three machine-readable forms, so an editor or a coding agent gets the rules without leaving the code:

- `@ds/tokens/css` — each CSS variable annotated with its usage
- `@ds/tokens` types — usage rules as JSDoc, shown on hover and in completions
- `@ds/tokens/usage` — JSON with the rules, resolved values per theme, measured contrast ratios, and component recipes

Contributors and agents working in this repo should start with [`CLAUDE.md`](CLAUDE.md).

## Develop

```sh
npm install
npm run build      # tokens → css → primitives → react
npm run docs:check # fail if TOKENS.md is out of date with usage.json
npm test           # primitives unit tests
npm run dev        # playground at http://localhost:5173
```

Try the CLI:

```sh
node packages/cli/bin/ds.mjs list
node packages/cli/bin/ds.mjs add button --dir /tmp/demo
```

## Open items

- Product name + npm scope (placeholder: `@ds`)
- Own color palette (current scales are placeholders, not brand-differentiated). Retuning it should also close the dark-theme contrast gaps listed in [TOKENS.md](packages/tokens/TOKENS.md#known-gaps--do-not-use-these-combinations): white on the dark accent and danger fills falls below WCAG AA.
- Docs site with eBay-Playbook-grade guidance pages (Types / Anatomy / Placement / Behavior / A11y / Tokens / API)
- Figma variables export + component library
- Visual regression (Playwright) and axe a11y gates in CI
- Hosted registry + license auth for the pro tier
