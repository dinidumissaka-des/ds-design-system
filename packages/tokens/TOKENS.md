# Design Tokens

Generated CSS/JS/Tailwind output is built from `src/primitives/*.json` and
`src/semantics/*.json` (including `src/semantics/color/{light,dark}.json`)
by `build.mjs` — see
[STRUCTURE.md](../../STRUCTURE.md#the-design-tokens-skill-and-this-repos-actual-token-pipeline)
for how this maps onto the `.claude/skills/design-tokens/` skill's generic
model. This file is the reasoning layer: why each scale stops where it
does, and what every semantic token is for — so extending the system means
consulting this file, not guessing from the name.

## Model

Two layers. **Primitives** (`src/primitives/*.json`) are named by appearance
or measure and reference nothing — `color.accent.600`, `space.4`. **Semantics**
(`src/semantics/*.json`, including `color/{light,dark}.json` — the one
group needing two files, since it's the one thing that varies by theme)
are named by role and reference primitives only — `color.accent-role.bg`,
`space.control.gap`. Component CSS should reference semantics, not
primitives directly, the same way it already does for color.

## Primitives

### Color
**Generation rule:** One neutral ramp, one brand ramp (`accent`), and three
status ramps (`success`/`warning`/`danger` — no `info` family; add one if a
consumer ever needs it, not speculatively). Each is an 11-step 50→950 scale.
Plus a separate `color.data.*` namespace: a data-visualization palette (10
categorical swatches + 9 five-step ramps + 1 neutral), sourced from
[Astryx](https://astryx.atmeta.com/docs/tokens), light-mode values only —
primitives are theme-invariant here, so Astryx's dark alternates for
`data-gray` were dropped rather than copied in as a primitive.
**Range:** `50`→`950` for UI ramps; `1`→`5` for data ramps (fewer, more
separable steps — chart legibility, not UI-chrome contrast, is the concern).
**Not for:** role-specific meaning ("this is the button's hover color") —
that's the semantic `-role` tokens.

### Space
**Generation rule:** 4px base, linear 0–48px, with 2px/6px half-steps at the
bottom (`0-5`, `1-5`). Sourced from Astryx.
**Range:** `0`→`12` (48px). Stops there — nothing in this repo needs more;
the one prior >48px usage was remapped when this scale replaced the old one.
**Not for:** component dimensions (control height, icon size) — see Size.

### Radius
**Generation rule:** raw pixel values sourced from Astryx's role-named
tokens (`inner`/`element`/`container`/`chat`/`page`), re-keyed onto a
measure-named ascending scale so radius primitives stay named by measure,
not role (a primitive named `inner` or `chat` would already be a semantic
in disguise).
**Range:** `none`(0) → `2xl`(32px) → `full`(9999px).
**Not for:** encoding what the radius is applied to — see `radius.control`/
`radius.pill` in Semantics.

### Size
**Generation rule:** control-height triplet, sourced from Astryx.
**Range:** `control.sm`(28px) → `control.lg`(36px).
**Not for:** anything but control heights. No semantic wrapper exists for
these on purpose — `size.control.sm/md/lg` already maps 1:1 to `Button`'s
own `size` prop, so a `size.role.*` alias would add a name with zero
disambiguation value.

### Border
**Generation rule:** raw stroke-width scale, 1px increments, keyed by the
pixel value itself (`1`, `2`, `3`) — covers every stroke width currently
needed (a resting border, a focus ring, a focus ring's offset) without
manufacturing an unused step. Originally a single Astryx-sourced value
(`width: 1px`); expanded to a proper scale once `border`/`focus` moved to
Semantics and needed something to reference.
**Range:** `1`(1px) → `3`(3px).
**Not for:** color (`color.border.*`, semantic) or radius. Also not for
border *style* — `solid`/`dashed`/etc. are enumerated keywords with no
underlying scale, so `focus.ring-style` (Semantics) keeps a literal value
rather than pointing at a manufactured one-item "primitive."

### Opacity
**Generation rule:** raw percentage-as-decimal scale, keyed by the
percentage number — covers exactly the opacity levels currently used for
interaction feedback. New this session, to give `state.*` (Semantics)
something to reference once it moved out of Primitives.
**Range:** `8`(0.08) → `50`(0.5).
**Not for:** anything but opacity — this isn't a general 0–1 numeric scale,
it's specifically calibrated interaction-feedback levels.

### Font
**Generation rule:** sourced from [eBay Playbook](https://playbook.ebay.com/foundations/typography)'s
compiled core tokens (`evo-web`'s `packages/skin/src/tokens`, fetched from
the built CSS since the Sass source re-exports an external token module) —
replacing the prior Astryx-derived scale entirely, not merging with it.
Family is **Market Sans** — eBay's own typeface, shipped in exactly two
weights (Regular, Bold), which is why the weight scale is two steps, not
four: a `medium`/`semibold` token on a family with no matching cut gets
browser-synthesized and looks subtly broken (this repo's own rule, from the
`design-tokens` skill's Typography guidance — finally with a font where it
actually bites). We don't ship the Market Sans font files, so the family
value leads with the name and falls back to a system-font stack, same
treatment as Figtree before it. Line-height is **not** a unitless ratio
here — eBay's scale is absolute pixel line-heights, paired per size (each
step is a specific, designed pairing, not a formula); named the same way
eBay names them (`150`→`600`, not `tight`/`normal`/`relaxed`) so the
correspondence to their source stays traceable. Letter-spacing values are
also eBay's — but **not** their names: eBay names these tokens by role
(`display-1`, `signal-2`), which is exactly the primitive/semantic mixup
already caught once in this file for `radius` (Astryx's `inner`/`element`).
Re-keyed onto measure-tier names instead (`tightest`→`wider`), following
[SGDS](https://www.designsystem.tech.gov.sg/foundations/typography/letter-spacing-tokens)'s
convention for the same kind of scale; the role names live in Semantics now,
as `type.tracking.*`.
**Range:** size `smallest`(0.625rem/10px) → `giant-4`(4rem/64px), 10 steps;
weight `regular`(400) / `bold`(600) only; line-height `150`(12px) →
`600`(56px), plus a unitless `default`(1.4286) for generic body text not
tied to a specific size step; letter-spacing `tightest`(−0.92px) →
`wider`(0.7px), 6 steps.
**Not for:** which size/weight/line-height/tracking a given piece of UI
should use, or how they combine — see `type.*` in Semantics, which mirrors
eBay's own named composites (`display`/`title`/`subtitle`/`body`/`caption`/
`signal`) where this repo has a real matching use.

### Motion
**Generation rule:** min/default/max bands per speed tier (`fast`/`medium`/
`slow`), sourced from Astryx (`standard` easing too). `enter`/`exit` easings
were originally unsourced scaffold placeholders; replaced with
[Carbon](https://carbondesignsystem.com)'s real `entrance.productive` /
`exit.productive` curves once a credible source was found — Carbon
publishes separate "productive" (functional, quick) vs "expressive"
(branded, slower) easing families; `productive` fits this repo's current,
utilitarian motion better than guessing.
**Range:** `fast-min`(130ms) → `slow-max`(1300ms).
**Not for:** which tier a given transition should use — see `motion.interactive`/
`motion.overlay`/`motion.modal` in Semantics.

### Elevation
**Generation rule:** 3-step layered shadow scale, unchanged from the
original scaffold — Astryx's shadow tokens weren't extracted with enough
fidelity to adopt safely (see the fetch notes in this session's history).
**Range:** `sm`→`lg`.
**Not for:** nothing consumes this yet — reserved for a future Card/Popover/Dialog.

`State` and `Focus` are **not** primitive scales in this system — see the
Semantics section below. Both were briefly kept here on the reasoning that
they're shared, redesign-survivable values reused identically everywhere
(the same shape as Motion's `fast`/`medium`/`slow`), but reconsidered:
unlike a genuine scale (a range of raw options a component author chooses
*from*), each is a single, already-made *decision* about how this system
expresses interaction feedback and focus visibility — which is what a
semantic is, not a primitive. `Border` and `Opacity` above exist specifically
to give them primitives to point at now that they've moved.

## Semantics

### Background & Surface
(`src/semantics/color/{light,dark}.json` → `color.bg.*`)

#### `--color-bg-canvas`
→ `color.white` (light) / `color.neutral.950` (dark)
**Purpose:** The page itself — furthest-back layer.
**Use when:** `<body>` background.
**Don't use for:** A component's own surface — use `bg-surface`.
**Pairs with:** `fg-primary`, `fg-secondary`.

#### `--color-bg-surface`
→ `color.white` (light) / `color.neutral.900` (dark)
**Purpose:** Default surface for a component sitting above canvas.
**Use when:** Secondary button fill; future Card.
**Don't use for:** The page background — use `bg-canvas`. Identical to it in
light mode today; that's not a reason to merge them — dark mode diverges.
**Pairs with:** `border-default`, `fg-primary`.

#### `--color-bg-subtle`
→ `color.neutral.50` (light) / `color.neutral.900` (dark)
**Purpose:** Faint tint marking a region without a hard edge.
**Use when:** Not consumed by any component yet — reserved for a subdued
section background.
**Don't use for:** Interactive or disabled surfaces — it's a static layout
signal, not a state.
**Pairs with:** `fg-primary`, `fg-muted`.

#### `--color-bg-muted`
→ `color.neutral.100` (light) / `color.neutral.800` (dark)
**Purpose:** Background for an inert, non-interactive chip.
**Use when:** `.pg-status--future`/`--na`/`--deprecated` badge backgrounds.
**Don't use for:** Interactive surfaces — nothing here signals clickability.
**Pairs with:** `fg-secondary`, `fg-muted`.

### Text
(`color.fg.*`)

#### `--color-fg-primary`
→ `color.neutral.900` (light) / `color.neutral.50` (dark)
**Purpose:** Default body/heading text.
**Use when:** `body` color; secondary-button text.
**Don't use for:** Text on a filled accent/danger surface — use `fg-on-accent`.
**Pairs with:** `bg-canvas`, `bg-surface`.

#### `--color-fg-secondary`
→ `color.neutral.600` (light) / `color.neutral.300` (dark)
**Purpose:** De-emphasized but still substantive text.
**Use when:** `.pg-status--future` badge text.
**Don't use for:** The next tier down (helper/caption text) — that's `fg-muted`.
**Pairs with:** `bg-canvas`, `bg-muted`.

#### `--color-fg-muted`
→ `color.neutral.500` (light) / `color.neutral.400` (dark)
**Purpose:** Least-emphasized readable text.
**Use when:** Row labels, table headers, swatch captions.
**Don't use for:** Disabled text — this repo has no separate disabled-text
token (open gap); disabled state is currently expressed as opacity on the
whole control, not a text-color swap. Don't improvise `fg-muted` as a stand-in.
**Pairs with:** `bg-canvas`, `bg-surface`.

#### `--color-fg-on-accent`
→ `color.white` (both themes)
**Purpose:** Text/icon guaranteed legible on a filled accent or danger surface.
**Use when:** Primary/destructive button text.
**Don't use for:** Anything on `bg-surface`/`bg-canvas` — it's white in both
themes *because* it's only ever composited over a saturated fill, not
because it's a general "light text" token.
**Pairs with:** `accent-role.bg`, `danger-role.bg` only — not verified
against anything else.

### Border
(`color.border.*`, plus `color.focus-ring`)

#### `--color-border-default`
→ `color.neutral.200` (light) / `color.neutral.800` (dark)
**Purpose:** Resting-state border.
**Use when:** Swatch tiles, table row dividers.
**Don't use for:** An emphasized/hovered edge — use `border-strong`.
**Pairs with:** `bg-surface`, `bg-canvas`.

#### `--color-border-strong`
→ `color.neutral.300` (light) / `color.neutral.700` (dark)
**Purpose:** Emphasized border.
**Use when:** Secondary button (needs a visible edge — it has no fill).
**Don't use for:** The resting/default case — use `border-default`.
**Pairs with:** `bg-surface`.

#### `--color-focus-ring`
→ `color.accent.500` (light) / `color.accent.400` (dark)
**Purpose:** Focus-indicator color, paired with the primitive ring
width/offset/style (`focus.ring-*`).
**Use when:** `:focus-visible` outline on any focusable control.
**Don't use for:** A hover or active fill — focus must stay visually
distinct from hover, or keyboard users can't tell them apart.
**Pairs with:** `border-default`, `border-strong` — verified 3:1 against both.

### Interactive
(`color.accent-role.*`, `color.secondary-role.*`, `color.tertiary-role.*`, `color.danger-role.*`)

Two tokens that used to exist here — `accent-role.bg-hover`/`bg-active` and
`danger-role.bg-hover`/`bg-active` — were removed this session. They modeled
a color-swap hover/press mechanism this design system doesn't use (state
feedback is the state-layer opacity overlay instead, per README), and no
component ever consumed them. Carrying an undocumented, unwired token is
worse than not having one; if a belt-and-suspenders color cue is ever
wanted alongside the opacity overlay, re-add them deliberately then.

#### `--color-accent-role-bg`
→ `color.accent.600` (light) / `color.accent.500` (dark)
**Purpose:** Primary action fill.
**Use when:** `.ds-button--primary` background.
**Don't use for:** Secondary/tertiary actions — they have their own sets below.
**Pairs with:** `fg-on-accent`.

#### `--color-accent-role-fg`
→ `color.accent.600` (light) / `color.accent.400` (dark)
**Purpose:** Text/icon for a fill-less accent action.
**Use when:** `.ds-button--tertiary` color.
**Don't use for:** Text on a *filled* accent bg — use `fg-on-accent`.
**Pairs with:** `bg-canvas`, `bg-surface` — unfilled backgrounds only.

#### `--color-accent-role-subtle`
→ `color.accent.50` (light) / `color.accent.950` (dark)
**Purpose:** Faint accent-tinted fill.
**Use when:** Not consumed yet — candidate for a future selected-row or
active-nav-item background.
**Don't use for:** A badge needing to read as a strong signal — use the base
ramp step directly, not the lightest tint.
**Pairs with:** `accent-role.fg`.

#### `--color-secondary-role-bg` / `-fg` / `-border`
→ `color.white`/`neutral.900`/`neutral.300` (light) ·
`neutral.900`/`neutral.50`/`neutral.700` (dark)
**Purpose:** Secondary action's own semantic set — added this session so
`.ds-button--secondary` has a named role instead of reaching into generic
`bg-surface`/`fg-primary`/`border-strong` directly.
**Use when:** Any secondary/outlined action.
**Don't use for:** Primary or destructive actions.
**Pairs with:** each other (`bg` with `fg` with `border`).

#### `--color-tertiary-role-fg`
→ `color.accent.600` (light) / `color.accent.400` (dark)
**Purpose:** Fill-less tertiary action text — kept as its own token even
though it's identical to `accent-role.fg` today, so it can diverge later
without touching accent.
**Use when:** `.ds-button--tertiary` color (can migrate from `accent-role.fg`).
**Don't use for:** Anything with a fill.
**Pairs with:** `bg-canvas`, `bg-surface`.

#### `--color-danger-role-bg`
→ `color.danger.600` (light) / `color.danger.500` (dark)
**Purpose:** Fill for a destructive **action**.
**Use when:** `.ds-button--destructive` background.
**Don't use for:** An error/status **message** surface — action-danger and
status-danger must not share a token long-term even though identical today;
they have different jobs and will eventually need different treatments.
**Pairs with:** `fg-on-accent`.

#### `--color-danger-role-fg` / `-subtle`
→ `color.danger.700`/`color.danger.50` (light) · `color.danger.400`/`color.danger.950` (dark)
**Purpose:** Text/fill for a subtle danger surface — same shape as
success/warning's `fg`/`subtle`, kept symmetric even though nothing
consumes it yet (no tertiary-danger button or error banner exists).
**Use when:** Not consumed yet.
**Don't use for:** A solid danger surface — use `danger-role.bg`.
**Pairs with:** each other.

### Status
(`color.success-role.*`, `color.warning-role.*`)

#### `--color-success-role-bg` / `-fg` / `-subtle`
→ `success.600`/`700`/`50` (light) · `success.500`/`400`/`950` (dark)
**Purpose:** Positive/complete status signal. `fg` sits one ramp step darker
(light) or lighter (dark) than `bg`/`subtle`, for adequate contrast when
`fg` sits on top of `subtle`.
**Use when:** `.pg-status--latest` uses `fg` on `subtle`. `bg` (solid fill)
unconsumed today — no filled-success surface exists yet.
**Don't use for:** Text on a solid success fill — that wants `fg-on-accent`,
not `fg`.
**Pairs with:** each other.

#### `--color-warning-role-bg` / `-fg` / `-subtle`
Same shape and rules as success, for `.pg-status--in-progress`.

*(No `info` status family exists — nothing in this design system uses one
yet. Add it when a real consumer appears, not speculatively.)*

### Border width
(`src/semantics/border.json` → folds into `border.*` alongside the raw
`border.1`/`border.2`/`border.3` steps)

#### `border.default`
→ `{border.1}` (1px)
**Purpose:** The stroke width for a resting border.
**Use when:** Not consumed yet — `button.css`/`playground.css` still
hardcode `1px solid` literally rather than reaching for a token; wire this
in when those components are rebuilt.
**Don't use for:** A focus ring — see `focus.ring-width`, which is a
different role even though it happens to reference a different step of the
same primitive scale.
**Pairs with:** `color.border.default`, `color.border.strong`.

### State
(`src/semantics/state.json` → new `state.*` family — was primitive-only
until this session, now fully semantic; the flattened var names
(`--ds-state-hover-opacity` etc.) are unchanged, only their source moved)

#### `state.hover-opacity` / `state.press-opacity` / `state.disabled-opacity`
→ `{opacity.8}` / `{opacity.12}` / `{opacity.50}`
**Purpose:** The opacity levels the state-layer overlay uses to signal
hover, press, and disabled — this design system's one interaction-feedback
mechanism, applied uniformly (see README).
**Use when:** `.ds-state-layer` (hover/press), `.ds-button:disabled`/
`[aria-disabled="true"]` (disabled).
**Don't use for:** A per-variant color-swap hover — that mechanism was
deliberately removed (see `accent-role.bg-hover` in Decisions above); this
system expresses state through opacity only, not a second parallel channel.
**Pairs with:** —

### Focus
(`src/semantics/focus.json` → new `focus.*` family, same reasoning as
State; flattened var names unchanged)

#### `focus.ring-width` / `focus.ring-offset`
→ `{border.2}` (2px) / `{border.3}` (3px)
**Purpose:** Geometry of the focus indicator.
**Use when:** `:focus-visible` on any focusable control (`.ds-button`).
**Don't use for:** A resting border — see `border.default`, a different
step of the same primitive scale.
**Pairs with:** `color.focus-ring` (the color half of the same indicator,
which stays in the color semantic layer since it's theme-dependent).

#### `focus.ring-style`
→ `"solid"` (literal, not `{primitive}`)
**Purpose:** The focus ring's stroke style.
**Use when:** `:focus-visible` on any focusable control.
**Don't use for:** — this is a deliberate, narrow exception to "semantics
reference primitives only": `solid`/`dashed`/`dotted` are enumerated
keywords with no underlying raw scale, so a "primitive" that's just
`{"solid": "solid"}` would be ceremony, not real layering. If this system
ever needs to vary ring style by context, that's the moment to reconsider.
**Pairs with:** `focus.ring-width`, `focus.ring-offset`.

### Spacing
(`src/semantics/spacing.json` → folds into `space.*` alongside the raw
`space.0`..`space.12` steps)

Reorganized this session around four general-purpose roles (`gap`/`stack`/
`padding`/`section`), each — except `section`, which has exactly one real
use — a proper `xs`/`sm`/`md`/`lg` tier scale, rather than the previous mix
of one single-value token per specific use. `space.control.gap` (the one
prior single-value token this subsumed) was removed, not kept alongside:
it was identical to the new `gap.sm` (both `{space.2}`), and a token that
can't earn a `Don't use for` distinct from another token is a duplicate,
not a second name for the same thing.

#### `space.gap.xs` / `.sm` / `.md` / `.lg`
→ `{space.1}` / `{space.2}` / `{space.3}` / `{space.4}` (4px/8px/12px/16px)
**Purpose:** Space between adjacent items in a row, toolbar, or inline
group — tightest at `xs` (e.g. icon touching its label), loosest at `lg`
(e.g. cards in a grid).
**Use when:** `.ds-button`'s icon-to-label `gap` → `sm` (this token
subsumes the old `space.control.gap`, same value).
**Don't use for:** Vertical spacing between stacked, block-level items —
that's `space.stack.*`, a different axis even where the pixel values overlap.
**Pairs with:** —

#### `space.stack.xs` / `.sm` / `.md` / `.lg`
→ `{space.2}` / `{space.3}` / `{space.4}` / `{space.6}` (8px/12px/16px/24px)
**Purpose:** Vertical space between stacked, related block-level items.
**Use when:** `.pg-row`'s gap and margin-bottom → `sm` (12px, unchanged
value from before this reorganization).
**Don't use for:** Space between unrelated sections — use `space.section`.
Inline/row spacing — use `space.gap.*`.
**Pairs with:** —

#### `space.padding.xs` / `.sm` / `.md` / `.lg`
→ `{space.2}` / `{space.3}` / `{space.4}` / `{space.6}` (8px/12px/16px/24px)
**Purpose:** General-purpose internal padding for a container — a Card,
a Popover, any block that isn't a form control (which has its own
size-tied scale, see `space.control.padding-inline` below).
**Use when:** Not consumed by any component yet — no Card exists. Added
proactively alongside `gap`/`stack` for a consistent set, not because a
current component needs it.
**Don't use for:** A form control's own padding, which is driven by the
control's size tier, not a general padding judgment — see
`space.control.padding-inline.*`.
**Pairs with:** —

#### `space.control.padding-inline.sm` / `.md` / `.lg`
→ `{space.3}` / `{space.4}` / `{space.5}` (12px/16px/20px)
**Purpose:** Horizontal padding tied to a control's size tier — a
different dimension of meaning than `space.padding.*`: driven by which
size variant a component renders, not a standalone spacing judgment.
**Use when:** `.ds-button--sm/md/lg`.
**Don't use for:** Padding not driven by the sm/md/lg size system — use
`space.padding.*`.
**Pairs with:** `size.control.sm/md/lg` (the primitive it's sized against).

#### `space.section`
→ `{space.10}` (40px)
**Purpose:** Gap between major page sections.
**Use when:** `.pg-section` margin-bottom.
**Don't use for:** Gaps within a section — see `space.stack.*`.
**Pairs with:** —

#### `space.page.gutter`
→ `{space.6}` (24px)
**Purpose:** Horizontal page-edge padding — the one that must agree across
every route once there's more than one.
**Use when:** `.pg-shell` left/right padding.
**Don't use for:** Any padding not at the page edge.
**Pairs with:** —

#### `space.page.block-start` / `block-end`
→ `{space.8}` (32px) / `{space.12}` (48px)
**Purpose:** Vertical page-edge padding — asymmetric on purpose (more room
below the last section than above the header).
**Use when:** `.pg-shell` top/bottom padding.
**Don't use for:** Symmetric layouts — use one value for both if a future
page doesn't want the asymmetry.
**Pairs with:** —

*(Table-cell padding and the swatch-grid gap were deliberately left as
direct `space-*` primitive references — single-consumer, one-off values
with no cross-cutting rule that would break if they diverged from
something else. Semanticizing every spacing decision adds a name with no
information; see the skill's own caution on this.)*

#### `space.size.0` → `.12` (15 steps, incl. `0-5`/`1-5`)
→ each is a direct 1:1 alias of the identically-named `space.*` primitive
step — `space.size.4` → `{space.4}` (16px), etc.
**Purpose:** A bare passthrough onto the full primitive spacing scale, for
component CSS that needs *a* spacing value with no existing named role to
reach for — added on request, same shape as `type.size` above.
**Use when:** Not consumed by any component yet. **This is in real tension
with the "don't semanticize every step" note directly above it** — a
1:1-named alias adds no disambiguating information over the primitive it
points at, which is exactly the anti-pattern that note warns about. It
exists anyway as a deliberate, requested escape hatch: reach for a *named
role* (`space.control.gap`, `space.stack.sm`, `space.page.gutter`, …)
first, every time one fits — `space.size.*` is for the remainder, not a
replacement for naming things properly.
**Don't use for:** Anything a named role above already covers — check the
list before reaching for a bare number here.
**Pairs with:** —

### Radius
(`src/semantics/radius.json` → folds into `radius.*`)

Expanded this session to the full set of role names Astryx originally used
for these exact values (`inner`/`element`/`container`/`page`/`chat`) —
which is precisely why they were re-keyed onto a measure-named primitive
scale (`sm`/`md`/`lg`/`xl`/`2xl`) rather than imported as primitives
verbatim: role names belong in Semantics, and now they're here. No
primitive changed — every value below already existed in `radius.*`.
`radius.control` (prior name) was removed, not kept alongside `element`:
identical value (`{radius.md}`), and a token that can't earn a `Don't use
for` distinct from another is a duplicate.

#### `radius.inner`
→ `{radius.sm}` (8px)
**Purpose:** Radius for an element nested inside a larger rounded
container, sized to stay concentric with its parent (per the nesting rule:
inner radius ≈ outer radius − padding).
**Use when:** Not consumed yet — no nested-container pattern exists in
this repo.
**Don't use for:** A standalone control — see `radius.element`.
**Pairs with:** whatever outer `radius.container`/`radius.page` it nests inside.

#### `radius.element`
→ `{radius.md}` (12px)
**Purpose:** Corner radius for an interactive control (renamed from
`radius.control` — same value, Astryx's broader term).
**Use when:** `.ds-button`.
**Don't use for:** Static containers once they exist (Card etc.) — decide
then whether they share this or need `radius.container`.
**Pairs with:** —

#### `radius.container`
→ `{radius.lg}` (16px)
**Purpose:** Corner radius for a static content container.
**Use when:** Not consumed yet — no Card/Popover exists.
**Don't use for:** Interactive controls — use `radius.element`.
**Pairs with:** —

#### `radius.chat`
→ `{radius.xl}` (28px)
**Purpose:** Radius for a chat-bubble-shaped element.
**Use when:** Not consumed yet, and no chat-adjacent component is planned
— included for completeness with Astryx's source set, genuinely
speculative until one exists.
**Don't use for:** Anything that isn't a chat bubble — this is the most
narrowly-scoped role in the set, not a general "extra-rounded" option.
**Pairs with:** —

#### `radius.page`
→ `{radius.2xl}` (32px)
**Purpose:** Radius for a page-level or hero-scale rounded region.
**Use when:** Not consumed yet.
**Don't use for:** Ordinary containers — see `radius.container`.
**Pairs with:** —

#### `radius.pill`
→ `{radius.full}` (9999px)
**Purpose:** Fully-rounded shape.
**Use when:** `.pg-status` badges.
**Don't use for:** Anything not chip/badge-shaped. Astryx names this
value's primitive `full`; no separate semantic `radius.full` was added
here — it would repeat both the name and the value of the primitive with
zero disambiguating purpose, unlike `pill`, which actually names the role.
**Pairs with:** —

*(`.pg-swatch`'s `radius.sm` was deliberately left as a direct primitive
reference — a one-off decorative element, not a recurring role. `radius.none`
was not given a semantic alias for the same reason `radius.full`/`pill`
weren't duplicated — its primitive name already says everything a role
name would.)*

### Typography
(`src/semantics/typography.json` → new `type.*` family, distinct from the
`font.*` primitive family it's built from)

Rebuilt against [eBay Playbook's typography tokens](https://playbook.ebay.com/design-system/tokens/typography-tokens):
each group below now mirrors one of eBay's own named composites
(`display`/`title`/`subtitle`/`body`/`caption`/`signal`) wherever this repo
has a real, current use for it — same real-usage-grounded discipline as the
rest of this file, just checked against eBay's actual pairings (which size
goes with which line-height, which weight) instead of inventing our own.
eBay defines several composites this repo has no consumer for yet
(`display1-3`, `title1`/`title2`, `subtitle1`/`subtitle2`, `bodyBold`,
`captionBold`, `signal1`) — not added speculatively; add the one that's
needed when a real heading/caption/emphasis use appears, matching it to
eBay's pairing rather than improvising.

#### `type.control.size.sm/md/lg`, `type.control.line-height.sm/md/lg`, `type.control.weight`
→ size: `{font.size.body}`/`{font.size.body}`/`{font.size.large-1}` ·
line-height: `{font.line-height.250}`/`{font.line-height.250}`/`{font.line-height.350}` ·
weight: `{font.weight.bold}`
**Purpose:** Text style for button labels, per size tier — each size/line-height
pair matches eBay's own pairing (`body`↔`250`, `large-1`↔`350`), not an
independent choice.
**Use when:** All button sizes (`sm`/`md` share `body`-size text; `lg` steps
up to `large-1` — a real jump from the prior scale's ~17px, since eBay has
no step near there).
**Don't use for:** Headings — see `type.heading`. `size` was previously left
as a direct primitive reference per size tier ("the size tier is already
the semantic dimension"); reconsidered — *which* primitive step a given
button size maps to is itself a decision worth naming, especially now that
the mapping is a bigger, less obvious jump than before.
**Pairs with:** each other, per tier.

#### `type.heading.size` / `type.heading.weight` / `type.heading.line-height`
→ `{font.size.medium}` / `{font.weight.bold}` / `{font.line-height.300}`
**Purpose:** Section heading style — matches eBay's `title3` composite exactly.
**Use when:** `.pg-section h2`.
**Don't use for:** Body copy, or a more prominent page-level title — that's
`title1`/`title2` territory (`large-2`/`large-1`), not built here yet.
**Pairs with:** each other. `line-height` is new — previously unset,
relying on the browser default for `<h2>`.

#### `type.body.size` / `type.body.weight` / `type.body.line-height`
→ `{font.size.body}` / `{font.weight.regular}` / `{font.line-height.250}`
**Purpose:** Default running text — matches eBay's `body` composite exactly.
**Use when:** `.pg-table` cell text.
**Don't use for:** Labels/captions — use `type.label`. A bold inline emphasis
within body text would be eBay's `bodyBold` (not built — no consumer yet).
**Pairs with:** each other. `weight`/`line-height` are new — previously only
`size` was specified.

#### `type.label.size` / `.weight` / `.line-height` / `.letter-spacing` / `.text-transform`
→ `{font.size.smallest}` / `{font.weight.bold}` / `{font.line-height.150}` /
`{font.letter-spacing.wide}` / `"uppercase"` (literal)
**Purpose:** Small uppercase label text — matches eBay's `signal2` composite
exactly, not `caption` (which isn't uppercase/tracked). Row labels, table
headers, and status pills already applied `uppercase` +
`letter-spacing: 0.04em` by hand; `0.04em` at the *old* 12px size ≈ 0.48px,
strikingly close to eBay's real `signal-2` value (0.5px, now the `wide`
primitive step) — good evidence this repo's original ad hoc choice was
already reaching for the same thing eBay's token formalizes.
**Use when:** Row labels, table headers, status pill text.
**Don't use for:** Body copy. `text-transform` is a literal, not a
primitive reference — same narrow exception as `focus.ring-style`; no
underlying "text-case scale" exists to point at.
**Pairs with:** each other. Size moved `small`(12px)→`smallest`(10px) to
exactly match eBay's `signal2` — a deliberate value change from fully
adopting their composite rather than approximating it.

#### `type.tracking.display-1/2/3` / `.signal-1` / `.signal-2`
→ `{font.letter-spacing.tightest}` / `.tighter` / `.tight` / `.wider` / `.wide`
**Purpose:** eBay's original role names for these letter-spacing values,
restored as semantic aliases once the primitive itself was re-keyed onto
measure-tier names (see the Font primitive entry above).
**Use when:** Not consumed yet — mirrors eBay's `display1-3`/`signal1-2`
composites, none of which this repo has a consumer for beyond `type.label`
(which uses `signal-2`'s value directly via `wide`, not this alias — kept
independent so `type.label` doesn't chain semantic→semantic).
**Don't use for:** — pick the primitive tier directly (`font.letter-spacing.wide`)
for anything that isn't specifically standing in for one of eBay's named
composites; these five exist for traceability back to the source, not as
the default way to reach for tracking.
**Pairs with:** the matching `font.size`/`font.weight` step from the same
eBay composite (`display-1` pairs with `font.size.giant-3`, etc. — not
enforced by the token system, just eBay's own pairing).

#### `type.size.4xs` → `.5xl` (12 steps)
→ each points at the *nearest* `font.size.*` primitive: `4xs`/`3xs`/`2xs`/`xs`
→ `{font.size.smallest}` (all four — see Don't use for) · `sm` →
`{font.size.small}` · `base` → `{font.size.body}` · `lg` →
`{font.size.medium}` · `xl` → `{font.size.large-1}` · `2xl` →
`{font.size.large-2}` · `3xl` → `{font.size.giant-1}` · `4xl` →
`{font.size.giant-2}` · `5xl` → `{font.size.giant-3}`
**Purpose:** A bare, general-purpose 12-step named size scale, independent
of the composite styles above — for when something needs "a size" without
the full weight/line-height/tracking bundle a `type.control`/`heading`/
`body`/`label` composite implies.
**Use when:** Not consumed by any component yet. Added on request to
restore the granularity of the prior (Astryx-derived) `4xs`→`5xl` font-size
primitive scale, now expressed as semantic aliases onto eBay's real,
coarser primitive scale instead of as primitives themselves.
**Don't use for:** Assuming `4xs`, `3xs`, `2xs`, and `xs` render at four
different sizes — **they don't.** eBay's primitive scale has nothing
smaller than `font.size.smallest` (0.625rem/10px), so all four steps below
that floor collapse onto the same primitive and are visually identical.
This is a known, accepted consequence of mapping a 12-step scale onto a
10-step one, not a bug — if four genuinely distinct small sizes are ever
needed, that requires extending the `font.size` *primitive* scale first
(its own approval, per the usual discipline), not adjusting this file alone.
**Pairs with:** — this scale is deliberately separate from `type.control`/
`heading`/`body`/`label`'s composites; picking a bare size here means also
deciding weight/line-height/tracking yourself, which those composites do for you.

### Motion
(`src/semantics/motion.json` → folds into `motion.*` alongside `duration.*`/`easing.*`)

#### `motion.interactive.duration` / `motion.interactive.easing`
→ `{motion.duration.fast}` / `{motion.easing.standard}`
**Purpose:** Duration/easing for hover, press, and color-change feedback.
**Use when:** `.ds-state-layer`, `.ds-button` background/border transitions.
**Don't use for:** Anything that enters/exits the layout — see `overlay`/`modal` below.
**Pairs with:** each other.

#### `motion.overlay.duration` / `motion.overlay.easing`
→ `{motion.duration.medium}` / `{motion.easing.standard}`
**Purpose:** Duration/easing for a transient surface entering/exiting —
matches the primitive scale's own documented `medium` tier ("dropdowns,
tooltips").
**Use when:** Not consumed yet — no dropdown/tooltip/popover component exists.
**Don't use for:** Persistent interaction feedback — see `interactive`.
Something that blocks the whole page — see `modal`, one tier slower.
**Pairs with:** each other.

#### `motion.modal.duration` / `motion.modal.easing`
→ `{motion.duration.slow}` / `{motion.easing.standard}`
**Purpose:** Duration/easing for a page-blocking surface entering/exiting —
matches the primitive scale's own documented `slow` tier ("modals, drawers").
**Use when:** Not consumed yet — Dialog is `future` in the registry.
**Don't use for:** A lighter-weight transient surface — see `overlay`.
**Pairs with:** each other. All three groups currently share one easing
(`standard`) — Astryx published only that curve; this repo's primitive
scale also carries legacy `enter`/`exit` easings (unrelated to Astryx, kept
from the original scaffold) that `overlay`/`modal` could split onto once a
real enter-vs-exit distinction is needed, rather than guessing now.

## Decisions

| Decision | Rationale | Rejected alternative |
|---|---|---|
| Removed `accent-role`/`danger-role` `bg-hover`/`bg-active` | Redundant with the state-layer opacity mechanism; two never-wired tokens modeling a mechanism this system doesn't use | Wiring them into `button.css` as a second, color-swap hover cue alongside the opacity overlay |
| Light `danger-role.fg` raised `danger.600`→`danger.700` | Matches `success-role`/`warning-role`'s pattern (`fg` one step darker than `bg`, for contrast on the `subtle` fill); dark's `danger-role.fg` was already consistent | Leaving the original asymmetric value |
| No semantic wrapper for `size.control.*` | `sm`/`md`/`lg` already maps 1:1 to `Button`'s own `size` prop — an alias would add a name with zero disambiguation value | `size.role.button-sm` etc. |
| Built `space.page.*` despite only one page existing | Explicit ask to extend semantics beyond color now, ahead of a second page | Waiting for a second page to justify a page-edge consistency rule |
| Typography/spacing/radius/motion semantics fold into their primitive's existing flattened family (`space.*`, not a separate `space-role.*`) | Matches how color's `accent-role` already shares the `color.*` family with `color.accent`'s raw ramp — one convention, not two | A parallel `-role`/`-semantic` suffix convention for every family |
| Moved `state.*` and `focus.*` (minus color) from Primitives to Semantics | Each is a single already-made decision (how this system expresses feedback/focus), not a scale of raw options to choose from — the primitive/semantic test is "scale vs. decision," not just "shared across every consumer" | Leaving them primitive on the "shared, redesign-survivable value" reasoning alone |
| `border` primitive expanded from one value (`width: 1px`) to a 3-step scale (`1`/`2`/`3`px) | `state`/`focus` moving to Semantics meant `border-width` and `ring-offset` needed something to reference; one shared scale covers both without losing Astryx's exact 3px offset value or reusing the unrelated `space` scale | Rounding `ring-offset` onto the nearest existing `space` step (2px or 4px, losing precision); adding a one-off 3px step to `space` itself |
| New `opacity` primitive scale (`8`/`12`/`50`) | `state.*`'s three opacity values needed a primitive to reference once moved to Semantics | Leaving them as literals in the semantic layer (violates "semantics reference primitives only") |
| `focus.ring-style` kept as a literal (`"solid"`) even though it's now in the semantic layer | It's an enumerated keyword with no underlying scale — a one-item "primitive" (`{"solid":"solid"}`) would be ceremony, not real primitive/semantic layering | Manufacturing a trivial style-keyword primitive just to satisfy the rule mechanically |
| Font primitives fully replaced with eBay Playbook's (Astryx-derived scale discarded entirely, not merged) | Explicit ask to rebuild typography on eBay's real, verified values; eBay's own naming (`smallest`→`giant-4`, absolute-px line-heights) kept rather than force-fit onto the prior `4xs`→`5xl` shape, so the correspondence to the source stays traceable | Keeping Astryx's shape and only swapping in eBay's numbers under the old key names |
| Font weight scale cut to two steps (`regular`/`bold`) | Market Sans ships exactly Regular and Bold — a `medium`/`semibold` token gets browser-synthesized on this family and looks subtly broken, per this file's own Font primitive rule | Keeping a 4-step weight scale for consistency with the previous font's shape |
| `type.control`/`heading`/`body`/`label` rebuilt against eBay's named composites, not just re-pointed at new primitives | Each already corresponded to one of eBay's `title`/`body`/`signal` styles once looked at against their real pairings (size↔line-height↔weight); using their actual pairing is more correct than picking a plausible-looking line-height ourselves | Independently choosing a line-height per size, decoupled from eBay's tested pairings |
| `type.label` size moved `small`(12px)→`smallest`(10px) | Exact match to eBay's `signal2` composite, which this repo's uppercase-label pattern already approximated by hand (`0.04em` at the old 12px ≈ 0.48px ≈ eBay's real 0.5px) | Keeping 12px and only borrowing `signal2`'s weight/tracking, an inexact hybrid |
| `button.css`/`playground.css` left unretouched despite several now going inert (`font-weight-medium`, `font-line-height-tight`, `font-size-base/lg/sm` no longer exist) | Standing instruction: components are being rebuilt, don't retrofit them mid-token-work | Patching the direct primitive references now so the live playground keeps rendering styled text in the meantime |
| Added `type.size.4xs`→`5xl` as semantic aliases onto eBay's primitives, not as a restored primitive scale | Explicit choice: keeps one font-size primitive source of truth (eBay's), rather than two overlapping raw scales | Reinstating the old Astryx 12-step scale as a second `font.size` primitive alongside eBay's |
| `type.size`'s bottom four steps (`4xs`/`3xs`/`2xs`/`xs`) all collapse onto `font.size.smallest` | eBay's primitive scale has no step below 0.625rem — an honest consequence of mapping 12 named tiers onto a 10-step scale, documented rather than hidden | Extending `font.size` with smaller primitive steps just to keep 12 semantic sizes visually distinct, with no real consumer driving the need |
| Added `space.size.0`→`.12` as 1:1 primitive aliases, despite this file's own "don't semanticize every step" caution | Explicit, deliberate request for a passthrough escape hatch, documented as exactly that tension rather than pretending it doesn't exist | Declining to add it on the grounds that it contradicts existing guidance |
| Reorganized spacing semantics around `gap`/`stack`/`padding`/`section` as general-purpose roles, each a proper `xs`/`sm`/`md`/`lg` scale | Explicit request; replaces a mix of one single-value token per specific use with a small, consistent, reusable set | Keeping single-purpose tokens (`control.gap`, bare `stack.sm`) as the only vocabulary |
| Removed `space.control.gap`, folded into `space.gap.sm` | Identical value (`{space.2}`) to the new general `gap.sm` — a token that can't earn a `Don't use for` distinct from another is a duplicate | Keeping both as separate names for the same value |
| Added `space.padding.*` with no current consumer | Built proactively for a consistent `gap`/`stack`/`padding` set, not because a component needs it today — flagged as such, not hidden | Waiting for a Card/Popover to justify it, consistent with this file's usual "don't manufacture ahead of need" discipline |
| Added `radius.inner`/`element`/`container`/`chat`/`page`, no primitive change | Every value already existed in `radius.*` — this is exactly why Astryx's role names were re-keyed onto measure names at import time instead of used as primitives directly, so they'd be available to restore here later | Adding new primitive steps, which was unnecessary — the values were already present |
| Removed `radius.control`, folded into `radius.element` | Identical value (`{radius.md}`) to Astryx's broader-scoped name; same duplicate-token reasoning as `space.control.gap` → `gap.sm` | Keeping both names for the same value |
| No `radius.full` semantic added alongside `pill` | Would repeat both the primitive's name and value with no disambiguating role — `pill` already names the actual use; `none` skipped for the same reason | Adding both `full`/`none` semantic aliases for completeness with the source table |
| Included `radius.chat` despite zero plausible near-term use | Explicit request to add Astryx's full source set; flagged as the most speculative addition in the set rather than silently included | Omitting it as too speculative even under an explicit request |
| Added `motion.overlay`/`motion.modal`, no primitive change | Motion primitives already had the full min/default/max tier set from the earlier Astryx import; this just builds the semantic roles the primitive scale's own "for" documentation was already pointing at | Adding new primitive duration steps, which was unnecessary |
| `overlay`/`modal` both use `easing.standard` for now, not split into enter/exit | Astryx published only one easing curve; the `enter`/`exit` primitives that exist are unrelated leftovers from the original scaffold, not sourced from Astryx — splitting onto them now would be guessing which curve fits which direction with no real component to check it against | Assigning `enter`/`exit` to `overlay`/`modal` speculatively |
| Letter-spacing primitives re-keyed from eBay's role names (`display-1`, `signal-2`) to SGDS-style measure-tier names (`tightest`→`wider`) | Same primitive/semantic violation already caught and fixed once for `radius` — role names belong in Semantics, not Primitives; SGDS's real letter-spacing tokens use exactly this tier-naming convention, giving a credible pattern to follow rather than inventing one | Leaving eBay's role names on the primitive, inconsistent with how `radius` was already handled |
| `motion.easing.enter`/`exit` replaced with Carbon's real `entrance.productive`/`exit.productive` curves | The prior values were unsourced scaffold placeholders, not from Astryx; Carbon publishes real, credible entrance/exit curves (with a productive/expressive split) — using a real source beats carrying an unverified guess indefinitely | Leaving the scaffold placeholders in place since nothing consumes them yet |

## Audit against Carbon and SGDS

Cross-checked the whole primitive/semantic set against
[Carbon](https://carbondesignsystem.com) (IBM) and
[SGDS](https://www.designsystem.tech.gov.sg) (Singapore Government Design
System) — mature, real production systems with their own real token
sources fetched directly (not recalled from memory), same discipline as
the Astryx/eBay work. Two findings were concrete and low-risk enough to
fix immediately (above, in Decisions). The rest are real gaps worth
knowing about but **not implemented** — each is a real architecture
decision, not a token-value tweak, and belongs in its own pass:

- **SGDS's semantic spacing is 3 scoped families, not 1, and is
  responsive.** `layout-gap`/`component-gap`/`text-gap`, each 5-7 tiers,
  each with different values per breakpoint (mobile/tablet/desktop). This
  repo's `space.gap`/`stack`/`padding` has no breakpoint concept at all —
  every token resolves to one static value. Adding real breakpoint
  responsiveness would mean the build pipeline emitting values inside media
  queries (or `clamp()`), which `build.mjs` doesn't do today. A real change,
  not a token addition.
- **Carbon nests surfaces three levels deep** (`layer-01`/`02`/`03`, each
  with its own hover/active variants), where this repo has a flat
  `bg.canvas`/`bg.surface` pair. Worth revisiting once a component that
  actually nests (a Card containing another Card-like element) exists —
  building the nesting model ahead of a real case to design it against
  would be guessing.
- **Carbon splits motion into "productive" vs "expressive" personalities**
  (separate easing curves for each, doubling the easing surface) — this
  repo took the `productive` curves for `enter`/`exit` above but has no
  concept of an alternate "expressive" mode. Only worth building if this
  system ever wants two different motion personalities, which nothing
  suggests yet.
- **SGDS's spacing primitive scale runs to 128px** (13 steps) vs. this
  repo's 48px ceiling (15 steps, denser at the bottom via half-steps). Nothing
  in this repo currently needs spacing above 48px, but a future full-bleed
  hero section or large empty-state layout might — extending `space`'s top
  end would be a small, low-risk addition when that need appears, unlike
  the items above.

## Adding a token

1. Can an existing semantic cover it? → Use that one.
2. Is it a one-off? → Not a token. One-offs belong in the component (see
   table-cell padding / swatch-grid gap above).
3. Which primitive does it point at? → No primitive fits means extend the
   primitive scale *by its generation rule*, or accept the nearest step.
4. Can you write all four description fields? → No means it's a duplicate
   or a primitive in disguise.
5. Does the name survive a redesign? → No means rename it.
