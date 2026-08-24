# Primitive Scales

Generation recipes and starting values. Read the relevant section at Gate 2, not the whole file.

**Contents:** [Color](#color) · [Spacing](#spacing) · [Radius](#radius) · [Typography](#typography) · [Shadow](#shadow) · [Motion](#motion) · [Size](#size) · [Z-index](#z-index)

Every scale below has a **generation rule**. Propose the rule before the values — the rule is the thing that has to be agreed, because it determines every future addition.

---

## Color

**Ask first:** Do they have a brand color to anchor to, and do they need dark mode? Dark mode changes how many neutral steps are needed (more, and spaced differently at the dark end).

**Generation rule.** Use OKLCH, not HSL. HSL lightness is not perceptual — `hsl(60 100% 50%)` and `hsl(240 100% 50%)` claim the same lightness and differ by roughly 5:1 in what the eye reads. That makes an HSL ramp unusable for contrast guarantees, which is the whole reason a ramp exists. In OKLCH, hold lightness steady across hues and they genuinely match.

Standard ramp: 11 steps, `50` (lightest) through `950` (darkest).

| Step | Lightness (L) | Typical role |
|---|---|---|
| 50 | 0.97 | Tinted page backgrounds |
| 100 | 0.94 | Subtle fills |
| 200 | 0.88 | Borders, dividers |
| 300 | 0.80 | Strong borders |
| 400 | 0.70 | Disabled text (below floor, deliberately) |
| 500 | 0.60 | Muted text on light |
| 600 | 0.52 | Primary interactive |
| 700 | 0.45 | Hover |
| 800 | 0.37 | Active, headings |
| 900 | 0.28 | Body text |
| 950 | 0.18 | Highest contrast |

Chroma peaks in the middle (400–600) and drops at both ends — pure hue at L 0.97 is invisible, at L 0.18 it's mud.

**Which ramps.** One neutral (the workhorse — most of the UI is neutral), one brand, and four status: success, warning, danger, info. Resist a second brand ramp until a semantic actually needs it.

**Neutrals aren't gray.** A neutral ramp carrying a small amount of the brand hue (chroma ~0.005–0.015) reads as intentional; a pure-gray ramp next to a saturated brand reads as unfinished. This is one of the highest-leverage decisions on the whole scale.

**Contrast anchors** — verify, don't assume. Against a `50`-level background, roughly: `600` clears 4.5:1 (body text and UI), `700` clears 7:1. Against white, `500` is usually borderline for body text — which is exactly why `--color-text-muted` should point at 500 and `--color-text-primary` at 900.

---

## Spacing

**Ask first:** Is this a dense product (tables, dashboards, data tools) or a spacious one (marketing, content, consumer)? It changes the base and the useful range, not just the top end.

**Generation rule.** 4px base, hybrid progression — linear where precision matters, geometric where it doesn't.

| Token | Value | Where it earns its place |
|---|---|---|
| `--space-0` | 0 | Explicit reset |
| `--space-1` | 4px | Icon-to-label |
| `--space-2` | 8px | Inside controls |
| `--space-3` | 12px | Related items |
| `--space-4` | 16px | Default gap |
| `--space-5` | 20px | Comfortable gap |
| `--space-6` | 24px | Card padding |
| `--space-8` | 32px | Group separation |
| `--space-10` | 40px | Between sections |
| `--space-12` | 48px | Major sections |
| `--space-16` | 64px | Page regions |
| `--space-20` | 80px | Hero padding |
| `--space-24` | 96px | Full-bleed sections |

Steps 7, 9, 11 etc. are deliberately absent past `--space-6`. Below 24px, 4px increments are discriminable and useful. Above it, they aren't — and offering both 28px and 32px means half the codebase picks one and half the other, with no rule to appeal to.

**Dense products:** stop around `--space-12`; anything larger is dead weight that someone will eventually use. **Spacious:** keep the full range.

**Not for:** component dimensions (control heights, icon sizes, container widths). Those are the size scale. Spacing expresses distance between things, not the things.

---

## Radius

**Ask first:** What's the brand posture — sharp/technical, soft/friendly, or fully rounded?

**Generation rule.** Small fixed set. Radius has fewer meaningful steps than any other scale, and a large radius scale is a reliable sign of an unconsidered one.

| Token | Sharp | Balanced | Soft |
|---|---|---|---|
| `--radius-none` | 0 | 0 | 0 |
| `--radius-sm` | 2px | 4px | 6px |
| `--radius-md` | 4px | 6px | 10px |
| `--radius-lg` | 6px | 10px | 16px |
| `--radius-xl` | 8px | 16px | 24px |
| `--radius-full` | 9999px | 9999px | 9999px |

**Nesting rule:** inner radius = outer radius − padding. A 16px card with 12px padding wants ~4px on inner elements. Concentric radii that ignore this look wrong in a way people notice but can't name.

---

## Typography

**Ask first:** Content-heavy (long-form reading) or interface-heavy (dense, functional)? Content-heavy wants a wider ratio and more steps at the large end; interface-heavy wants a tighter ratio and more steps in the middle.

**Size — generation rule.** Modular scale from a 16px base.

| Ratio | Name | Suits |
|---|---|---|
| 1.125 | Major second | Dense interfaces, data tools |
| 1.200 | Minor third | General-purpose (safe default) |
| 1.250 | Major third | Marketing, editorial |
| 1.333 | Perfect fourth | Bold editorial — expect gaps at the small end |

At 1.200 from 16px: 12 · 13 · 14 · 16 · 19 · 23 · 28 · 33 · 40 · 48. Round to whole pixels; a computed 19.2px renders inconsistently across browsers.

**Line height — inverse to size.** Large text needs proportionally less. Body 1.5–1.6; headings 1.1–1.25; small/UI 1.4. A single line-height value across all sizes is the most common type-scale mistake, and it's what makes big headings look loose and captions look cramped.

**Weight.** Ship the weights the font actually has. A `--font-weight-semibold: 600` on a family with only 400 and 700 gets synthesized by the browser, and synthesized weights look subtly broken.

**Tracking.** Negative at display sizes (−0.02em at 40px+), zero at body, slightly positive for small caps and uppercase labels.

---

## Shadow

**Ask first:** Is elevation used semantically here (dropdowns, modals, popovers layering over each other) or decoratively?

**Generation rule.** Layered shadows — two or three stacked, not one. A single large blur reads as fog; a tight shadow for contact plus a wide one for ambient occlusion reads as height.

```css
--shadow-sm: 0 1px 2px rgb(0 0 0 / 0.05);
--shadow-md: 0 1px 3px rgb(0 0 0 / 0.1), 0 1px 2px rgb(0 0 0 / 0.06);
--shadow-lg: 0 4px 6px rgb(0 0 0 / 0.07), 0 2px 4px rgb(0 0 0 / 0.06);
--shadow-xl: 0 10px 15px rgb(0 0 0 / 0.08), 0 4px 6px rgb(0 0 0 / 0.05);
--shadow-2xl: 0 20px 25px rgb(0 0 0 / 0.1), 0 8px 10px rgb(0 0 0 / 0.04);
```

**Dark mode:** shadows barely register on dark surfaces. Elevation there is expressed by *lightening the surface*, not by shadow. Plan the surface ramp to carry it, or dark mode loses its depth cues entirely.

Cap at 5 steps. More than 5 levels of elevation means the z-order is doing work the layout should be doing.

---

## Motion

**Generation rule.** Duration scales with distance travelled and size of the moving element.

| Token | Value | For |
|---|---|---|
| `--duration-instant` | 50ms | State color changes |
| `--duration-fast` | 150ms | Hover, small toggles |
| `--duration-normal` | 250ms | Dropdowns, tooltips |
| `--duration-slow` | 400ms | Modals, drawers |
| `--duration-slower` | 600ms | Page transitions |

| Token | Value | For |
|---|---|---|
| `--ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | Entering — fast start, settled end |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | Exiting |
| `--ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | Moving between two on-screen positions |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Playful overshoot — use sparingly |

Entering elements use ease-out and exiting use ease-in, not the reverse. It's the difference between an interface that feels responsive and one that feels sluggish, at identical durations.

Always ship a `prefers-reduced-motion` block that zeroes durations. This is an accessibility requirement, not a nicety.

---

## Size

Distinct from spacing. Sizing is for the dimensions of things; spacing is for the distance between them. Collapsing them is why `--space-10` ends up as a button height somewhere.

**Control heights** — the alignment backbone. Everything in a form row must share these.

```css
--size-control-sm: 32px;
--size-control-md: 40px;
--size-control-lg: 48px;
```

40px is the practical default; 44px is the iOS touch-target minimum and worth considering for mobile-first products.

**Icons:** 16 · 20 · 24 · 32 · 48. **Container widths:** prose 65ch, content 1024px, wide 1280px, full 1536px. **Breakpoints:** 640 · 768 · 1024 · 1280 · 1536.

---

## Z-index

**Generation rule.** Named layers with wide gaps, so anything can be inserted between two without renumbering.

```css
--z-base: 0;
--z-raised: 10;
--z-dropdown: 1000;
--z-sticky: 1100;
--z-overlay: 1300;
--z-modal: 1400;
--z-popover: 1500;
--z-toast: 1700;
--z-tooltip: 1800;
```

Tooltip sits above toast because a tooltip on a toast's dismiss button is a real case and the reverse never is. Any raw z-index in a component is a bug — it will eventually collide with something it can't see.
