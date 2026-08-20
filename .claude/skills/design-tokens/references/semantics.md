# Semantic Roles

Role catalogs and worked descriptions. Read the relevant section at Gate 2, not the whole file.

**Contents:** [Background & Surface](#background--surface) · [Text](#text) · [Border](#border) · [Interactive](#interactive) · [Status](#status) · [Spacing](#layout-spacing) · [Sizing](#component-sizing) · [Description craft](#writing-descriptions)

Every token below needs all four description fields. The catalogs give the roles; the descriptions have to be written against the actual codebase, naming real components.

---

## Background & Surface

The distinction that trips everyone: **background** is what the page is; **surface** is what sits on it.

| Token | Points at (light) | Points at (dark) |
|---|---|---|
| `--color-background` | `--neutral-50` | `--neutral-950` |
| `--color-surface-base` | `--white` | `--neutral-900` |
| `--color-surface-raised` | `--white` | `--neutral-800` |
| `--color-surface-sunken` | `--neutral-100` | `--neutral-950` |
| `--color-surface-overlay` | `--white` | `--neutral-800` |
| `--color-surface-inverse` | `--neutral-900` | `--neutral-50` |

Note that `surface-base` and `surface-raised` are the same value in light mode and different in dark. That's correct, not a mistake to collapse: in light mode elevation is carried by shadow, in dark mode by lightness. If you merge them because they look redundant on light, dark mode goes flat and there's no token left to fix it with.

**Worked example:**

> `--color-surface-sunken` → `--neutral-100` / dark `--neutral-950`
> **Purpose:** A recessed area that reads as *below* the page plane.
> **Use when:** Code blocks, inset form groups, the track of a progress bar, empty-state wells.
> **Don't use for:** Disabled backgrounds — use `--color-surface-disabled`. Sunken is a depth signal and stays fully interactive; disabled is a state signal. They render close together in light mode and diverge completely in dark.
> **Pairs with:** `--color-text-primary` and `--color-text-muted`. Do not place `--color-text-disabled` on it — the contrast fails.

---

## Text

| Token | Points at | Contrast target |
|---|---|---|
| `--color-text-primary` | `--neutral-900` | 12:1+ |
| `--color-text-secondary` | `--neutral-700` | 7:1 |
| `--color-text-muted` | `--neutral-500` | 4.5:1 |
| `--color-text-disabled` | `--neutral-400` | Below floor, deliberately |
| `--color-text-inverse` | `--white` | On inverse surfaces |
| `--color-text-link` | `--brand-600` | 4.5:1 |
| `--color-text-on-accent` | `--white` | On filled accent |

Four levels of de-emphasis is the maximum that stays discriminable. A fifth exists in the design file and nowhere in the code.

**The collision worth naming explicitly.** `muted` and `disabled` are the most-confused pair in any token system, because both render gray and both look plausible. The distinction is not visual, it's semantic: **muted text is meant to be read; disabled text is meant to be seen and not read.** That's why disabled sits below the contrast floor on purpose — it isn't an accessibility failure, it's the signal. Write this into both descriptions, pointing at each other.

**`text-on-accent` is not `text-inverse`.** They're often the same literal value, and they diverge the moment the brand color changes lightness. Keeping them separate costs one line now and saves a rebrand later.

---

## Border

| Token | Points at | For |
|---|---|---|
| `--color-border-subtle` | `--neutral-200` | Dividers, table rules |
| `--color-border-default` | `--neutral-300` | Cards, inputs at rest |
| `--color-border-strong` | `--neutral-400` | Emphasis, hovered inputs |
| `--color-border-focus` | `--brand-600` | Focus ring |
| `--color-border-danger` | `--danger-600` | Invalid input |

`--color-border-focus` is never optional and never merged into `--color-border-strong`. Focus is a keyboard-navigation affordance with a legal accessibility floor (3:1 against adjacent colors), and the day someone softens the "strong" border for aesthetic reasons, a merged token takes focus visibility down with it.

---

## Interactive

Interactive tokens come in **sets**, not individually. Every action variant needs the full state matrix, or a state will get hardcoded somewhere.

Per variant (primary, secondary, ghost, danger):

```
--color-action-<variant>-bg
--color-action-<variant>-bg-hover
--color-action-<variant>-bg-active
--color-action-<variant>-bg-disabled
--color-action-<variant>-fg
--color-action-<variant>-border
```

**Ratchet rule.** Hover moves one step darker on the primitive ramp, active two. `600 → 700 → 800`. Consistent direction across every variant is what makes the whole interface feel like one system rather than a set of components that happen to share a palette.

**Worked example:**

> `--color-action-primary-bg-hover` → `--brand-700`
> **Purpose:** Background of a primary action under pointer hover.
> **Use when:** `:hover` on primary buttons, and on any custom control presenting itself as the page's main action.
> **Don't use for:** Focus — focus is a ring via `--color-border-focus`, never a fill change. Keyboard users must be able to tell focus from hover, and a fill change makes them identical.
> **Pairs with:** `--color-action-primary-fg`, which is verified against both the rest and hover backgrounds.

---

## Status

Four families: `success` · `warning` · `danger` · `info`. Each needs four tokens, because status appears at four intensities:

```
--color-status-<name>-bg       → 100   (subtle fill — banners, badges)
--color-status-<name>-border   → 300
--color-status-<name>-fg       → 700   (text on the subtle fill)
--color-status-<name>-solid    → 600   (filled dot, solid badge, bold banner)
```

**Never carry meaning in color alone.** Every status token pairs with an icon or a text label. Roughly 1 in 12 men has some form of color vision deficiency, and red/green is the specific pair that fails. Write this constraint into the descriptions themselves, not just the docs — it's the one an agent generating a status component will otherwise skip.

**`danger` vs `--color-action-danger-*`.** Status danger communicates a state that exists ("this failed"). Action danger communicates a consequence of clicking ("this will delete"). They frequently share a primitive and must not share a token — a delete button and an error banner have different jobs and will eventually need different treatments.

---

## Layout Spacing

Semantic spacing is worth defining only where a *rule* exists that shouldn't be relitigated per screen.

| Token | Points at | For |
|---|---|---|
| `--space-inline-xs` | `--space-1` | Icon to adjacent label |
| `--space-inline-sm` | `--space-2` | Inside controls |
| `--space-stack-sm` | `--space-3` | Between related items in a list |
| `--space-stack-md` | `--space-4` | Between form fields |
| `--space-stack-lg` | `--space-6` | Between groups |
| `--space-section` | `--space-12` | Between page sections |
| `--space-page-gutter` | `--space-6` | Page edge padding |

**Don't semanticize every step.** Most spacing decisions are local judgment and belong in the component. If `--space-stack-md` and `--space-4` are used interchangeably with no rule distinguishing them, the semantic layer is adding a name and no information — and now there are two ways to say the same thing.

The ones that earn a token are the ones with a real rule behind them: `--space-page-gutter` exists because page edges must agree across every route, and that's a decision no individual component should be making.

---

## Component Sizing

```
--size-control-height-sm/md/lg    → control heights
--size-icon-sm/md/lg              → icon dimensions
--size-avatar-xs..xl              → avatar dimensions
--size-container-prose/content/wide
```

Control heights are the alignment backbone — an input, a button, and a select in the same row must resolve to the same token or the row visibly fails to align. This is the single most visible sizing bug and the easiest to prevent.

---

## Writing Descriptions

The bar: **could an agent choose correctly between two adjacent tokens using only the descriptions?** If both descriptions would justify the same pick, they haven't done their job.

### Purpose
One clause, functional. Not "a light gray background" — that's the value. What the token *means*.

### Use when
Concrete situations from the real codebase. Name actual components. "Timestamps in the activity feed, helper text under form inputs" beats "secondary information" — the first can be matched against a task, the second requires the agent to already know the answer.

### Don't use for
**Always name the alternative and say why it differs.** "Don't use for disabled state" is half a description. "Don't use for disabled state — use `--color-text-disabled`, which sits below the contrast floor deliberately; muted text is still meant to be read" resolves the choice.

Write these in pairs. If `--color-text-muted` excludes disabled, then `--color-text-disabled` should exclude muted, pointing back. Reciprocal exclusions are what make a set navigable rather than a list.

### Pairs with
For color, this is a legibility contract: which surfaces has this been verified against, and which has it not. "Not tested on `--color-surface-inverse`" is genuinely useful — it tells an agent to stop rather than guess, which is the failure mode that produces unreadable dark mode.

### The diagnostic
A token you can't write a `Don't use for` field for is one of three things: a duplicate of an existing token, a primitive that wandered into the semantic layer, or a one-off that belongs in a component. All three are worth catching before the token ships, because all three are much harder to remove later than to not add.
