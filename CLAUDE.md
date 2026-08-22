# Working in this repo

A token-first design system. See `README.md` for the architecture.

## Building UI or a component: use the tokens exactly

**Read [`packages/tokens/TOKENS.md`](packages/tokens/TOKENS.md) before styling anything.** It documents every
token — what it is for, what it is *not* for, what to use instead, which
foreground/background pairs are contrast-verified, and token-by-token recipes for
common components. It is generated from `packages/tokens/src/usage.json`, so it is
never out of date with the token values.

The same documentation is available in three other forms:

| Where | What you get |
|---|---|
| `packages/tokens/dist/css/tokens.css` | Every CSS variable with its usage as a comment |
| `packages/tokens/dist/index.d.ts` | Usage rules as JSDoc — visible on hover and in completions |
| `packages/tokens/dist/usage.json` | The same data, machine-readable, with measured contrast ratios |

### The rules that matter most

1. **Never use a palette token in a component.** `--ds-color-neutral-*`, `--ds-color-accent-*`,
   `--ds-color-success-*`, `--ds-color-warning-*`, `--ds-color-danger-*`, `--ds-color-white`,
   `--ds-color-black` are identical in both themes, so a component that uses one is
   broken in the other. Use the semantic tokens: `--ds-color-bg-*`, `--ds-color-fg-*`,
   `--ds-color-border-*`, `--ds-color-*-role-*`, `--ds-color-focus-ring`.
2. **Never hard-code a value.** No hex colors, no pixel spacing, no `500` font weights,
   no `ease-in-out`. Every one of those has a token. If nothing fits, add a token —
   don't inline a value.
3. **`color.fg.on-accent` goes on `accent-role.bg` and `danger-role.bg` only.** It is white
   in both themes. It fails contrast on `success-role.bg` and `warning-role.bg`, and it
   disappears on any neutral background.
4. **Success and warning messages use the role's `subtle` background with its `fg` text.**
   The saturated `bg` of those roles is for non-text indicators (status dots, bars) only.
5. **Hover and press come from the `.ds-state-layer` class**, not from swapping background
   colors. The `*-role.bg-hover` / `bg-active` tokens exist only for components that
   cannot compose that class.
6. **Focus is `color.focus-ring` with `focus.ring-width` and `focus.ring-offset`, on
   `:focus-visible`.** Never remove the ring; never set the offset to `0` on a filled
   accent control.
7. **Disabled uses `aria-disabled`, not the `disabled` attribute** — the control stays
   focusable and screen-reader discoverable, and activation is blocked in
   `@ds/primitives`. Style it with `state.disabled-opacity`.

## Editing tokens

Token values live in `packages/tokens/src/base.json` and `packages/tokens/src/themes/*.json`.
Usage documentation lives in `packages/tokens/src/usage.json`. All generated output —
including `TOKENS.md` — comes from `npm run build -w @ds/tokens`; never edit it by hand.

The build fails if:

- a token has no entry in `usage.json` (every semantic token needs its own entry);
- `usage.json` names a token that does not exist;
- a documented contrast pairing no longer meets its stated WCAG level;
- a documented known gap has been fixed and the entry is now stale.

So adding a token means documenting it, and changing a color means the contrast claims
get re-verified. `npm run docs:check` verifies `TOKENS.md` is current without rewriting it;
CI runs it on every PR.

## Commands

```sh
npm run build        # tokens → css → primitives → react
npm run docs:check   # fail if TOKENS.md is out of date with usage.json
npm test             # primitives unit tests
npm run dev          # playground at http://localhost:5173
```
