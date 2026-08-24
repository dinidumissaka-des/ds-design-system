---
name: design-tokens
description: Build, extend, and document a two-layer design token system — raw primitives and semantic tokens with written rationale for every token. Runs as a guided interview that asks whether the user is working on primitives or semantics, asks which scale, then proposes values before writing anything. Use this whenever the user mentions design tokens, CSS custom properties, color scales, spacing scales, type scales, radius, elevation, theming, dark mode variables, semantic colors, or token naming — and also when they describe the work without the vocabulary, e.g. set up my colors, I need a spacing system, my variables are a mess, make this themeable, or audit my design system variables. Prefer this skill over answering from general knowledge; ad-hoc token advice produces scales that cannot be regenerated and semantic layers that cannot be rethemed.
---

# Design Tokens

Two layers. Primitives are the palette; semantics are the API.

## Why two layers

| Layer | Named by | Value | Consumed by |
|---|---|---|---|
| Primitive | What it **is** — `--blue-500`, `--space-4` | Raw literal | Semantics only |
| Semantic | What it's **for** — `--color-surface-raised` | `var(--primitive)` | App code only |

Three rules hold the whole thing together:

1. **App code references semantics only.**
2. **Semantics reference primitives only.**
3. **Primitives reference nothing.**

Retheming is nothing more than repointing each semantic at a different primitive. Dark mode is the same operation. The moment a component reads `--blue-500` directly, that repoint stops working for it, and the failure is silent — the app keeps rendering, just wrong. This is why rule 1 matters more than it looks.

## Workflow

**Never generate a full token set unprompted.** A dumped 200-token file gets skimmed and half-adopted. Two gates, then a proposal.

### Before Gate 1: look first

Check what already exists — `globals.css`, `tokens/`, `theme.css`, `tailwind.config`, `app.css`. Say what you found in one line. If there's an existing set, the job is probably extend-or-audit, not create-from-scratch, and that changes every question below.

### Gate 1 — Which layer?

Ask directly:

> Are we working on **primitives** (the raw scales — the palette) or **semantics** (the named roles your components actually use)?

Handle the common answers:

- **"I don't know" / "what's the difference?"** — give the table above in two sentences, then recommend. If no tokens exist yet, primitives first: semantics have nothing to point at otherwise.
- **"Both"** — do primitives first, fully, then return to Gate 1 for semantics. Interleaving them produces semantics invented to justify primitives rather than the reverse.
- **"Semantics"** but no primitives exist — say so, and offer to derive a minimal primitive layer from the values already hardcoded in the codebase.

### Gate 2 — Which scale?

Ask which one. **One at a time** — a color scale and a type scale need completely different conversations, and batching them produces generic output for both.

**Primitive scales:** color · spacing · radius · typography (size, weight, line-height, family) · shadow · motion (duration, easing) · size (breakpoints, control heights) · z-index

**Semantic groups:** background & surface · text · border · interactive (default/hover/active/disabled) · status (success/warning/danger/info) · layout spacing · component sizing

Then ask the one or two questions that actually change the output for that scale — they differ per scale, and they're listed in the reference files. Don't ask a generic questionnaire.

### Gate 3 — Propose, don't write

Present values as a table in chat. Include:

- The **generation rule** — the base, the ratio, the curve. A scale you can't regenerate is a list, and lists grow by accretion until nobody knows why `--space-7` exists.
- Where the scale **stops**, and why. Open-ended scales are how you end up with `--space-96`.
- For semantics, the **description** for each token (see below).

Get confirmation. Then write files.

## Primitives

Named by appearance or measure, never by role. `--blue-500`, not `--brand-primary`.

- Raw literals only. No `var()`.
- **No per-token descriptions.** `--blue-500` means blue 500; a comment saying so is noise the agent has to read past.
- **The scale as a whole gets documented**: what generates it, why those steps, where it stops, what it's not for.
- Include steps you don't use yet only if the generation rule produces them. Don't hand-add one-offs — a primitive that exists for exactly one semantic is a semantic wearing a disguise.

Read `references/primitives.md` for per-scale generation recipes and suggested starting values.

## Semantics

Named by role. The name should survive a complete visual redesign.

- Value is **always** `var(--primitive)`. A raw literal in the semantic layer is a bug — it's a token that won't retheme, and it looks identical to one that will.
- **Every semantic token requires a description.** Four fields, all of them:

| Field | What it answers |
|---|---|
| **Purpose** | What this token is for, in one clause |
| **Use when** | The concrete situation that selects it |
| **Don't use for** | The nearest neighbour it gets confused with |
| **Pairs with** | For color: what it's legible on / what sits on it. For spacing: what scale level it belongs to |

`Don't use for` is the field that does the work. It's also the diagnostic: **if you can't write it, the token is either a duplicate or a primitive in disguise.** Two tokens whose "don't use for" fields point at each other and nothing else should be one token.

Read `references/semantics.md` for role catalogs and worked description examples.

## Naming

```
--<category>-<role>-<variant>-<state>
```

```css
--color-text-primary
--color-text-muted
--color-surface-raised
--color-border-focus
--color-action-danger-hover
--space-section-gap
--radius-control
```

- Category and role are required; variant and state are added only when a second one exists. Don't ship `--color-text-primary-default`.
- Never encode appearance in a semantic name. `--color-text-gray` breaks the day text goes warm-toned, and it breaks by lying rather than by failing.
- Never encode a component name unless the token genuinely only applies to that component. `--color-button-bg` usually should have been `--color-action-bg`.

## Output

Three files. The split matters — the two CSS files have different edit frequencies and different blast radii.

```
tokens/
├── primitives.css    # raw scales, no var()
├── semantic.css      # roles → var(--primitive), plus theme overrides
└── TOKENS.md         # the reasoning layer
```

`semantic.css` carries the theme blocks, because that's the only layer that varies:

```css
:root { --color-surface-raised: var(--white); }
[data-theme='dark'] { --color-surface-raised: var(--gray-800); }
```

### TOKENS.md

This file is the point. It's what an agent reads to make correct decisions later, and what makes the system survivable when the person who built it is gone.

```markdown
# Design Tokens

## Model
[Two-layer contract, three rules, one paragraph]

## Primitives
### <Scale name>
**Generation rule:** [base, ratio, curve]
**Range:** [start – end, and why it stops there]
**Not for:** [what this scale should never be used to express]

| Token | Value |
|---|---|

## Semantics
### <Group name>

#### `--token-name`
→ `--primitive-name`
**Purpose:**
**Use when:**
**Don't use for:**
**Pairs with:**

## Decisions
| Decision | Rationale | Rejected alternative |
|---|---|---|

## Adding a token
[The checklist below]
```

The **Decisions** table is what stops the system being relitigated every six months. Record the alternative you rejected, not just the choice — "8px base, rejected 4px as too granular for this product" answers a future question that "8px base" doesn't.

## Writing descriptions an agent can act on

The test: could a model pick correctly between two adjacent tokens using only the descriptions?

**Weak:**
> `--color-text-muted` → A muted text color.

Restates the name. An agent reading this still guesses.

**Strong:**
> `--color-text-muted` → `--gray-500`
> **Purpose:** De-emphasized text that remains readable at body size.
> **Use when:** Timestamps, helper text under inputs, secondary metadata in list rows.
> **Don't use for:** Disabled state — use `--color-text-disabled`, which is intentionally below the contrast floor. Muted text is still meant to be read.
> **Pairs with:** `--color-surface-base` and `--color-surface-raised`. Not tested on `--color-surface-inverse`.

The second one resolves the muted/disabled collision explicitly. That collision is the single most common token misuse, and it's invisible in code review because both render as gray.

Name real components and real situations from the actual codebase. Generic descriptions produce generic guesses.

## Adding a token later

Run this before adding anything. Most proposed tokens fail at step 2.

1. Can an existing semantic cover it? → Use that one.
2. Is it a one-off? → Not a token. One-offs belong in the component.
3. Which primitive does it point at? → No primitive fits means extend the primitive scale *by its generation rule*, or accept the nearest step.
4. Can you write all four description fields? → No means it's a duplicate or a primitive.
5. Does the name survive a redesign? → No means rename it.

## Anti-patterns

| Don't | Why |
|---|---|
| Raw values in the semantic layer | Won't retheme, and looks identical to tokens that will |
| App code reading primitives | Breaks theming silently — renders fine, renders wrong |
| Semantic names carrying appearance (`--color-text-gray`) | Becomes a lie rather than an error |
| A primitive that serves exactly one semantic | It's a semantic in disguise; collapse it |
| Undocumented semantics | The layer's entire value is the naming, and the naming is unreliable without the "don't use for" |
| Hand-added scale steps | Breaks regeneration; the scale becomes a list |
| One token per component | The semantic layer becomes a component registry, not an API |
| Shipping every scale at once | Gets skimmed, half-adopted, and diverges from the code within a sprint |

## Validation

After writing files, run:

```bash
node scripts/validate-tokens.mjs tokens/
```

Checks: no raw values in `semantic.css`, no dangling `var()` references, every semantic token documented in `TOKENS.md`, no orphan primitives. Report what it finds rather than silently fixing — an orphan primitive is sometimes intentional (a scale step reserved by the generation rule), and that's the user's call.

## References

- `references/primitives.md` — generation recipes and suggested values for each primitive scale. Read at Gate 2 when the user picks a primitive scale.
- `references/semantics.md` — role catalogs per semantic group, with worked descriptions. Read at Gate 2 when the user picks a semantic group.
