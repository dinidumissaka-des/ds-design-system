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
| CLI | `@ds/cli` | `ds list`, `ds add <component>` — copies source into consumer repos | npm |
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
npm run build      # tokens → css → primitives → react
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
- Own color palette (current scales are placeholders, not brand-differentiated)
- Docs site with eBay-Playbook-grade guidance pages (Types / Anatomy / Placement / Behavior / A11y / Tokens / API)
- Figma variables export + component library
- Visual regression (Playwright) and axe a11y gates in CI
- Hosted registry + license auth for the pro tier
