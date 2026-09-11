/**
 * The accent switcher — this system's five accent options.
 *
 * Each option is a real brand theme under `packages/themes/<slug>/`, stating
 * one accent seed and inheriting everything else from base. Selecting one sets
 * `data-rata-theme` on the document, which is the whole switch: the theme's
 * stylesheet re-declares every colour token the new accent generates, so every
 * component re-tones at once without re-rendering anything.
 *
 * Note what this file does NOT contain: any colour. The swatches carry
 * `data-rata-theme` themselves, so each one resolves
 * `--rata-theme-accent-role-bg` through its own theme's scope — the swatch shows
 * the real generated fill rather than a hex someone re-typed here, and it
 * cannot drift from the theme it stands for.
 *
 * The names below are the only thing hand-listed. There is no themes registry
 * to read them from; if you add a sixth package, add it here too.
 */

export type Scheme = "light" | "dark";

export interface AccentOption {
  slug: string;
  title: string;
  /** Why this option exists — shown as the control's title text. */
  note: string;
}

export const ACCENTS: AccentOption[] = [
  {
    slug: "pine",
    title: "Pine",
    note: "#1F7A5B — deep green. The brand's primary, and the base theme's own seed, so this option overrides nothing.",
  },
  {
    slug: "lime",
    title: "Lime",
    note: "#9FE870 — bright lime. Too light for a button fill, so the fill generates dark (#1D6D00) and the lime itself shows up as the tint.",
  },
  {
    slug: "rust",
    title: "Rust",
    note: "#C22D05 — burnt orange-red, greys warmed to match. Sits near the danger role, so primary and destructive read alike.",
  },
  {
    slug: "ink",
    title: "Ink",
    note: "#15151B — near-black, below the palette's chroma floor, so it lifts to a blue-violet accent rather than a black one.",
  },
  {
    slug: "cobalt",
    title: "Cobalt",
    note: "#3854FF — vivid blue, the most saturated of the five.",
  },
];

export const DEFAULT_ACCENT = "pine";

export function AccentSwitcher({
  value,
  scheme,
  onChange,
}: {
  value: string;
  scheme: Scheme;
  onChange: (slug: string) => void;
}) {
  return (
    <fieldset className="pg-accent">
      {/* A fieldset of radios rather than a row of buttons: picking one of five
          mutually exclusive options is what a radiogroup *is*, and native
          radios bring arrow-key navigation with them. */}
      <legend className="pg-visually-hidden">Accent colour</legend>

      {ACCENTS.map((accent) => (
        <label key={accent.slug} className="pg-accent-option" title={accent.note}>
          <input
            type="radio"
            name="pg-accent"
            className="pg-visually-hidden"
            value={accent.slug}
            checked={value === accent.slug}
            onChange={() => onChange(accent.slug)}
          />
          {/* Both attributes, because a theme's dark half is scoped
              [data-rata-theme="x"][data-theme="dark"] — one compound selector, so
              the swatch needs both to show the right value in dark mode. */}
          <span
            className="pg-accent-swatch"
            data-rata-theme={accent.slug}
            data-theme={scheme}
            aria-hidden="true"
          />
          <span className="pg-accent-name">{accent.title}</span>
        </label>
      ))}
    </fieldset>
  );
}
