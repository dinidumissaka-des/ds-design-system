# Repo map

```
packages/
  tokens/       @ds/tokens — JSON source of truth: src/primitives/*.json (one file
                per scale), src/semantics/*.json (theme-invariant roles) + src/semantics/theme/
                {light,dark}.json (color + elevation roles, folded under one shared
                "theme" key — the group needing two files, since theme is the thing
                that varies by light/dark) → dist/css/tokens.css,
                dist/index.{js,d.ts}, dist/tailwind/preset.cjs. TOKENS.md documents
                every semantic token.
  css/          @ds/css — framework-free component CSS, built from packages/css/src/*.css
                → dist/index.css (concatenated) + dist/components/*.css (per-file)
  primitives/   @ds/primitives — headless behavior, pure functions, no DOM/React
  react/        @ds/react — styled components: primitives behavior + css appearance
                (source of truth the CLI copies from)
  cli/          @ds/cli — the `ds` binary
    bin/ds.mjs    entry point: list/add (distribution) + props/tokens/pages (agent lookup)
    lib/index.mjs shared logic behind both — reads registry + @ds/react src + tokens dist

registry/
  schema.json           the manifest shape (status states, files, tier)
  components/*.json     one manifest per component — name, family, status matrix,
                         dependencies, which files `ds add` copies where

apps/
  playground/           the one page in this repo today (Vite + React)
    src/app.tsx          component gallery + status matrix, driven by registry/*.json

scripts/
  generate-ui-context.mjs   writes .claude/ui-context.md from packages/cli/lib

.claude/
  ui-context.md         GENERATED — regenerate with `npm run ui:sync`
  launch.json           playground launch config
  skills/design-tokens/ authored: two-layer (primitive/semantic) token workflow —
                         Gate 1/2/3 interview, scale + role catalogs, a validator

CLAUDE.md               authored: pre-write ritual, anti-patterns, knowledge check
agent-workflow.md        the general workflow this repo's CLAUDE.md is a specific
                         instance of
```

## How a component becomes real

Order matters and each stage is a checkpoint — don't start the next one
until the current one is approved. This is a process rule, not something
the tooling enforces: nothing blocks you from skipping ahead, but skipping
ahead is exactly how a component ends up styled around behavior nobody
signed off on, or wired to tokens that get renamed once someone actually
looks at them.

0. `registry/components/<name>.json` — the manifest, even before any code
   exists (status: `future`). This is what `ds list` and the playground's
   status table read. No approval needed — it's a declaration of intent,
   not a decision.

1. **Primitives.** `packages/primitives/src/<name>.ts` — behavior only:
   states, keyboard/ARIA handling, the props API shape. Pure function, no
   DOM, no styling, no token references. This is the contract everything
   else builds on.
   → **Stop. Get this approved** — the behavior and the props API — before
   writing a line of CSS or React. Changing the primitive after the
   component is styled is expensive; changing it before is free.

2. **Semantics.** Decide which semantic tokens each state of the component
   maps to — theme roles (`theme.*-role.*` and `theme.elevation.*` in
   `semantics/theme/*.json`) *and* theme-invariant roles (`space.*`/`radius.*`/
   `type.*`/`motion.*` in `semantics/*.json`, per
   [TOKENS.md](packages/tokens/TOKENS.md)). Go
   state by state, not as one batch — each mapping is its own decision
   (e.g. "disabled → `--ds-state-disabled-opacity`", "primary background →
   `--ds-theme-accent-role-bg`", "control padding → `--ds-space-control-padding-inline-md`"),
   and each gets approved on its own before moving to the next. Prefer an
   existing token — check `npm run ui -- tokens` first; only add a new one
   if nothing already fits, and that addition is its own approval too — run
   the **design-tokens** skill (`.claude/skills/design-tokens/`) for that:
   it's the Gate 1/2/3 interview for proposing a new semantic token with
   its four description fields (Purpose / Use when / Don't use for / Pairs
   with), documented in `packages/tokens/TOKENS.md`, rather than dropping a
   new key into a JSON file ad hoc.
   → **Stop. Every mapping approved** before any CSS is written — CSS is
   just these decisions rendered as rules, so writing it first means
   guessing at approvals that haven't happened yet.

3. **Component.** Only now: `packages/css/src/<name>.css`, using only the
   token mappings approved in step 2 — add it to `ORDER` in
   `packages/css/build.mjs` if load order matters relative to another
   component — and `packages/react/src/<name>.tsx`, wiring the approved
   primitive's behavior to the approved CSS's `ds-<name>` classes. Its
   exported `<Name>Props` interface and the function's default-parameter
   values are exactly what `npm run ui -- props <name>` reads — no separate
   doc to keep in sync.

4. Flip the manifest's `status.css`/`status.react` to `latest`, add `files`
   entries so `ds add <name>` can copy it, run `npm run build` (regenerates
   `.claude/ui-context.md` as its last step).

## What doesn't exist yet

Per `registry/components/`: `dialog` and `text-field` have manifests but no
files. There is no `card`, `table`, or `list` component — CLAUDE.md's layout
guidance references these categories generically; until they're built here,
compose plain `<section>`s rather than inventing one.

## The design-tokens skill and this repo's actual token pipeline

`.claude/skills/design-tokens/` is written stack-agnostic, and its examples
assume a project starting from nothing: `tokens/primitives.css` +
`tokens/semantic.css` (linked at runtime via `var()`) + `tokens/TOKENS.md`.
This repo doesn't look like that, and the gap is worth knowing before
reaching for the skill's `scripts/validate-tokens.mjs` directly:

- **Source is JSON, not CSS files.** `packages/tokens/src/primitives/*.json`
  (one file per scale — `color.json`, `space.json`, `radius.json`,
  `elevation.json`, …) and `src/semantics/*.json` (roles — `spacing.json`,
  `radius.json`, `typography.json`, `motion.json`, `border.json`,
  `focus.json`, `state.json`, plus `theme/{light,dark}.json` for the one
  group — color and elevation together — that branches by theme) already
  *are* the two-layer split, referencing primitives via
  `"{color.accent.600}"`-style strings that resolve across files the same
  as within one — `packages/tokens/build.mjs` is the resolver.
- **The built CSS has no `var()` chain.** `build.mjs` resolves every
  reference to a literal before writing `dist/css/tokens.css`, so both
  primitive and semantic custom properties land as raw values (e.g.
  `--ds-theme-accent-role-bg: #2563eb`) — retheming happens by rebuilding
  from JSON, not by cascade override. The skill's validator checks for
  literal values it would call a bug; run it against this repo's *source*
  JSON structure conceptually, not against `dist/css/tokens.css` literally.
- **`packages/tokens/TOKENS.md`** is this repo's equivalent of the skill's
  `tokens/TOKENS.md` — every primitive scale's generation rule/range/not-for,
  and all four description fields for every semantic token, kept there
  rather than at the skill's assumed path.

## Primitive provenance

`packages/tokens/src/primitives/{space,radius,size,motion,font,border,focus}.json`'s
scales, plus a new `color.json`'s `data.*` namespace (data-visualization
palette — categorical swatches + 5-step
blue/shamrock/orange/pink/purple/red/teal/yellow/gray ramps), were sourced
from [Astryx](https://astryx.atmeta.com/docs/tokens). The existing
`color.json`'s `neutral/accent/success/warning/danger` ramps and everything in
`semantics/color/{light,dark}.json` were deliberately left untouched — Astryx's
color tokens are mostly semantic-shaped (light/dark role pairs), which
belongs in the semantic layer with its own approval gate, not dropped into
the primitive layer. Notable adaptations made while porting the values over (not
straight copies): font sizes are now `rem`-based (was `px`) since that's
what Astryx publishes; token names were kept where the value matched an
existing key even if Astryx named it differently (e.g. their `--size-*`
tier values landed under our existing `size.control.sm/md/lg` keys, not a
new name); Astryx's role-named radius tokens (`inner`/`element`/`chat`/…)
were re-keyed onto our measure-named scale (`sm`/`md`/`lg`/`xl`/`2xl`) to
keep radius primitives named by measure, not role, per the design-tokens
skill's naming rule; data-viz primitives only carry their light-mode value
(Astryx's dark-mode alternates for `data-gray` would violate "primitives
reference nothing / are theme-invariant" if copied in as-is).

`semantics/color/{light,dark}.json` *was* touched in a later pass, once semantics
for the non-color scales were built out too: `accent-role`/`danger-role`'s
`bg-hover`/`bg-active` were removed (dead — modeled a color-swap hover
mechanism this system doesn't use), and `secondary-role`/`tertiary-role`
were added so `.ds-button--secondary`/`--tertiary` have their own semantic
sets instead of reaching into generic `bg`/`border`/`fg` tokens.

**Primitives are now exactly seven scales** — `color`, `space`, `radius`,
`size`, `motion`, `font`, `elevation` — plus a small `opacity` scale added
to support the change below. `state.json` and `focus.json` moved out of
`primitives/` entirely and into `semantics/`: each held a single
already-made decision (how this system signals interaction feedback / focus
visibility), not a scale of raw options — the primitive/semantic test is
"scale vs. decision," not just "shared across every consumer" (which was
the reasoning that had kept them primitive up to that point).
`primitives/border.json` was expanded from one Astryx value (`1px`) into a
3-step stroke-width scale (`1`/`2`/`3`px) specifically so `border.default`
(semantic) and `focus.ring-width`/`ring-offset` (now semantic) have
something to point at without losing Astryx's exact 3px offset value.

**`src/themes/{light,dark}.json` moved to `src/semantics/color/{light,dark}.json`**
in a later pass still — color is a semantic group like any other
(`spacing.json`, `border.json`, …), just the one that needs two files
instead of one because it's the one thing that varies by theme; keeping it
in a separate top-level `themes/` directory implied it was structurally
different from the rest of Semantics, which it isn't. Confirmed
byte-identical `dist/css/tokens.css` output before/after — pure
reorganization, `build.mjs` just reads two paths instead of one.

**`src/semantics/color/{light,dark}.json` was later renamed again, to
`src/semantics/theme/{light,dark}.json`**, once a second semantic group
(`elevation`) needed to branch by light/dark too. The rationale above for
dropping the separate `themes/` directory — "color doesn't need special
treatment, it's a semantic group like any other" — stops holding once
there are *two* semantic groups that vary by theme instead of one: at that
point "theme" is the real shared property they have in common, and naming
the branching file/folder/CSS-var-prefix after just one of its two
occupants (`color`) is the thing that's now structurally misleading, not
the thing that fixes it. `color`'s existing roles (`bg`/`fg`/`border`/
`*-role`/`focus-ring`) moved into the file unchanged, nested one level
deeper under a new shared `"theme"` JSON key instead of `"color"`; a new
`elevation` block (`raised`/`overlay`/`modal`, pointing at the
`elevation.sm`/`md`/`lg` primitive steps — extended with `sm-strong`/
`md-strong`/`lg-strong` for dark, since a light-mode shadow opacity barely
reads against a dark canvas) sits alongside it. Emitted CSS custom
properties moved with it: `--ds-color-bg-canvas` → `--ds-theme-bg-canvas`,
etc.; primitive color (`--ds-color-accent-600`, `--ds-color-neutral-*`, …)
is untouched — only the semantic layer's prefix changed, not the raw
palette. `packages/css/src/button.css` and `apps/playground/src/{app.tsx,
playground.css}` (the only two consumers at the time) were updated to
match; the elevation primitive itself had existed since the earlier
primitive-provenance pass but was unused until this one gave it a semantic
consumer.

**The elevation primitive's guessed dark (`-strong`) values were replaced
with real ones in the very next pass**, once Astryx's actual shadow tokens
were fetched — the original primitive-provenance note above says Astryx's
shadow tokens "weren't extracted with enough fidelity to adopt safely,"
which was true of the doc page's rendered markdown (swatch previews only,
no printed values) but not of its raw HTML: the page renders each swatch
with an inline `style="box-shadow:…"` attribute, which a direct `curl` +
grep pulled out cleanly. Real data turned out richer than the scaffold in
two ways. First, `--shadow-low`/`-med`/`-high` are genuine light/dark pairs
(via CSS `light-dark()`), so `elevation.sm`/`md`/`lg` were renamed to
`elevation.low`/`med`/`high` to match Astryx's own names, and their
`-strong` (dark) counterparts got Astryx's real opacity values instead of
an invented multiplier — asymmetrically, for `high`: its second shadow
alone jumps to 0.3 in dark vs. 0.1 in light, kept exactly as sourced.
Second, Astryx also publishes `--shadow-inset-hover`/`-selected`/`-success`/
`-warning`/`-error` — a related but distinct concept (2px inset rings for
input/selection state, not surface elevation) — which became a new `ring`
primitive (`neutral`/`neutral-strong`/`accent`/`success`/`warning`/`danger`,
re-keyed off Astryx's role-flavored names the same way `radius` and
letter-spacing were re-keyed earlier) wired into the *existing*
`accent-role`/`success-role`/`warning-role`/`danger-role` semantic groups as
a new `ring` field each, rather than a parallel `ring-role.*` family. The
one deliberate omission: `ring.neutral`/`neutral-strong` (their hover ring)
was fetched and kept as real primitive data but **not** wired to any
semantic token — this system already has a standing, explicit decision that
hover feedback is opacity-only (see the removed `bg-hover`/`bg-active`
tokens, above), and a ring-based hover cue would reintroduce exactly the
second feedback channel that decision removed. `packages/tokens/TOKENS.md`
documents the full fetch method and every new token's four description
fields; nothing outside `@ds/tokens` needed touching beyond the same two
consumers as before, since the semantic *names* (`theme.elevation.raised`/
`overlay`/`modal`) didn't change — only what they resolve to.

**`primitives/font.json` was later fully replaced again**, this time
sourced from [eBay Playbook](https://playbook.ebay.com/foundations/typography)'s
real compiled tokens (found via its `evo-web`/Skin open-source repo, not
the marketing page — the page itself doesn't publish numeric values) —
superseding the earlier Astryx-derived font scale entirely, not merging
with it. `semantics/typography.json` was rebuilt alongside it to mirror
eBay's own named composites (`title`/`body`/`signal`) where this repo has a
real matching use. This is the one primitive/semantics update so far with
real fallout in unretouched component CSS — see README's Open items.

Full reasoning for every primitive and semantic token is in
[TOKENS.md](packages/tokens/TOKENS.md).
