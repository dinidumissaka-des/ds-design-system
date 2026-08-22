// The checks a generated component is scored against.
//
// Every rule here is derived from the token build's own output — the palette
// list, the valid token names, and the forbidden color pairings all come from
// packages/tokens/dist. Adding a token or documenting a new contrast gap
// extends this checker automatically; there is no second list to maintain.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const TOKENS_CSS = path.join(root, "packages/tokens/dist/css/tokens.css");
const USAGE_JSON = path.join(root, "packages/tokens/dist/usage.json");

export function loadTokenModel() {
  for (const f of [TOKENS_CSS, USAGE_JSON]) {
    if (!existsSync(f)) {
      throw new Error(
        `Missing ${path.relative(root, f)} — run \`npm run build -w @ds/tokens\` first.`
      );
    }
  }

  readFileSync(TOKENS_CSS, "utf8"); // presence checked above; the index below is authoritative
  const usage = JSON.parse(readFileSync(USAGE_JSON, "utf8"));

  // The build emits an entry per leaf token — variable name → { path, layer }.
  // Classifying by name prefix would be wrong: `color.warning` (palette) is a
  // prefix of `color.warning-role.subtle` (semantic).
  const index = usage.index;
  const validVars = new Set(Object.keys(index));

  // Forbidden foreground/background combinations, keyed "fg|bg".
  const forbidden = new Map();
  for (const gap of usage.contrast.knownGaps) forbidden.set(`${gap.fg}|${gap.bg}`, gap);

  // A pairing that is verified in at least one theme is the sanctioned pattern
  // with a known limitation elsewhere — a warning, not a violation. A pairing
  // that is a gap everywhere is an error.
  const verified = new Set(usage.contrast.pairings.map((p) => `${p.fg}|${p.bg}`));

  return { index, validVars, forbidden, verified, usage };
}

const isPalette = (model, varName) => model.index[varName]?.layer === "palette";

// Properties where a raw dimension means the author skipped the space/size/radius
// scale. Border and outline widths are excluded: 1px hairlines are idiomatic here
// and the system's own components use them.
const SCALE_PROPS =
  /^(padding|margin|gap|row-gap|column-gap|inset|top|right|bottom|left|width|height|min-width|min-height|max-width|max-height|font-size|border-radius|line-height)(-(top|right|bottom|left|inline|block|inline-start|inline-end|block-start|block-end))?$/;

// Split a stylesheet into { selector, declarations } blocks. Good enough for the
// flat component CSS this system produces; nested at-rules are flattened out.
function parseBlocks(css) {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const blocks = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(withoutComments)) !== null) {
    const selector = m[1].trim().split("\n").pop().trim();
    if (!selector || selector.startsWith("@")) continue;
    const declarations = m[2]
      .split(";")
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => {
        const i = d.indexOf(":");
        return i === -1 ? null : { prop: d.slice(0, i).trim().toLowerCase(), value: d.slice(i + 1).trim() };
      })
      .filter(Boolean);
    blocks.push({ selector, declarations, index: m.index });
  }
  return blocks;
}

const lineOf = (text, index) => text.slice(0, index).split("\n").length;

/**
 * Score one source file. `source` is raw CSS or TSX text.
 * Returns { violations: [{rule, severity, message, line}], tokensUsed: Set }
 */
export function evaluateSource(source, model, { filename = "input" } = {}) {
  const violations = [];
  const tokensUsed = new Set();

  // `/* ds-allow: rule-name, other-rule — why */` records a deliberate exception
  // in the file itself, so the reason travels with the code.
  const allowed = new Set(
    [...source.matchAll(/\/\*\s*ds-allow:\s*([a-z-,\s]+?)(?:—|--|\*\/)/g)].flatMap((m) =>
      m[1].split(",").map((r) => r.trim()).filter(Boolean)
    )
  );

  const add = (rule, severity, message, index) => {
    if (allowed.has(rule)) return;
    violations.push({ rule, severity, message, line: lineOf(source, index ?? 0), file: filename });
  };

  // --- token references -------------------------------------------------
  for (const m of source.matchAll(/var\(\s*--(ds-[a-z0-9-]+)\s*[,)]/g)) {
    const name = m[1];
    tokensUsed.add(name);
    if (!model.validVars.has(name)) {
      add("unknown-token", "error", `--${name} is not a token in this system.`, m.index);
    } else if (isPalette(model, name)) {
      add(
        "palette-token",
        "error",
        `--${name} is a palette token; it is identical in both themes, so this breaks in dark mode. Use a semantic token.`,
        m.index
      );
    }
  }

  // --- hardcoded values -------------------------------------------------
  const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of codeOnly.matchAll(/#[0-9a-fA-F]{3,8}\b|\brgba?\([^)]*\)|\bhsla?\([^)]*\)/g)) {
    // Shadows legitimately carry rgb() inside the elevation tokens themselves,
    // but a component should reference the token, not restate the color.
    add("hardcoded-color", "error", `Hardcoded color \`${m[0]}\` — every color has a token.`, m.index);
  }

  const blocks = parseBlocks(source);
  for (const block of blocks) {
    for (const { prop, value } of block.declarations) {
      if (SCALE_PROPS.test(prop)) {
        for (const dim of value.matchAll(/(?<![\w-])(\d*\.?\d+)(px|rem)\b/g)) {
          if (prop === "line-height" && dim[2] !== "px") continue;
          add(
            "hardcoded-dimension",
            "error",
            `\`${prop}: ${value}\` — use a scale token (space.*, size.control.*, radius.*, font.size.*).`,
            block.index
          );
          break;
        }
      }
      if (prop === "font-weight" && /^\d+$/.test(value)) {
        add("hardcoded-font-weight", "error", `\`font-weight: ${value}\` — use a font.weight.* token.`, block.index);
      }
      if (/^(transition|animation)(-(duration|timing-function))?$/.test(prop)) {
        if (/\b\d+m?s\b/.test(value) && !value.includes("var(--ds-motion-duration")) {
          add("hardcoded-motion", "error", `\`${prop}: ${value}\` — use a motion.duration.* token.`, block.index);
        }
        if (/\b(ease|ease-in|ease-out|ease-in-out)\b|cubic-bezier\(/.test(value) && !value.includes("var(--ds-motion-easing")) {
          add("hardcoded-motion", "error", `\`${prop}: ${value}\` — use a motion.easing.* token.`, block.index);
        }
      }
    }

    // --- forbidden foreground/background pairing ------------------------
    const decl = (names) =>
      block.declarations.filter((d) => names.includes(d.prop)).map((d) => d.value).pop();
    const fgVar = (decl(["color"]) ?? "").match(/var\(\s*--(ds-[a-z0-9-]+)/)?.[1];
    const bgVar = (decl(["background", "background-color"]) ?? "").match(/var\(\s*--(ds-[a-z0-9-]+)/)?.[1];
    if (fgVar && bgVar) {
      const fgPath = model.index[fgVar]?.path;
      const bgPath = model.index[bgVar]?.path;
      const key = `${fgPath}|${bgPath}`;
      const gap = fgPath && bgPath && model.forbidden.get(key);
      if (gap) {
        const alsoVerified = model.verified.has(key);
        add(
          "forbidden-pairing",
          alsoVerified ? "warn" : "error",
          `\`${fgPath}\` on \`${bgPath}\` falls short of ${gap.below} (${Object.entries(gap.measured)
            .map(([t, r]) => `${t} ${r}:1`)
            .join(", ")})` +
            (alsoVerified ? ` in the ${gap.themes.join("/")} theme only.` : ".") +
            (gap.workaround ? ` ${gap.workaround}` : ""),
          block.index
        );
      }
    }

    // --- state and focus handling ---------------------------------------
    if (/:hover\b/.test(block.selector) && !block.selector.includes(".ds-state-layer")) {
      const touchesBg = block.declarations.some(
        (d) => (d.prop === "background" || d.prop === "background-color") && d.value.includes("var(--ds-color")
      );
      if (touchesBg) {
        add(
          "hand-rolled-hover",
          "warn",
          `\`${block.selector}\` swaps a background for hover. Compose the .ds-state-layer class instead.`,
          block.index
        );
      }
    }
    // `aria-disabled` uses a hyphen, so a bare `:disabled` match is unambiguous.
    if (/:disabled\b|\[disabled\]/.test(block.selector)) {
      add(
        "native-disabled-styling",
        "warn",
        `\`${block.selector}\` targets the native disabled attribute. This system styles [aria-disabled="true"] so the control stays focusable.`,
        block.index
      );
    }
    for (const { prop, value } of block.declarations) {
      if (prop === "outline" && /^(none|0)\b/.test(value)) {
        add("focus-removed", "error", `\`outline: ${value}\` removes the focus ring.`, block.index);
      }
    }
  }

  // A focusable control must draw a focus ring. Hover rules alone are not enough:
  // a composable overlay primitive (.ds-state-layer) has them and is never focused.
  const looksInteractive =
    /cursor:\s*pointer|\bbutton\b|\binput\b|\bselect\b|\btextarea\b|role="(button|link|menuitem|tab)"/.test(
      source
    );
  const hasFocusRing = source.includes("--ds-color-focus-ring");
  if (looksInteractive && !hasFocusRing) {
    add(
      "missing-focus-ring",
      "error",
      "Interactive component with no :focus-visible ring using --ds-color-focus-ring.",
      0
    );
  } else if (hasFocusRing && !/:focus-visible/.test(source)) {
    add("focus-not-visible-scoped", "warn", "Focus ring is not scoped to :focus-visible.", 0);
  }

  return { violations, tokensUsed };
}

/** Score a candidate against one prompt's expectations. */
export function scoreCandidate(source, prompt, model, opts = {}) {
  const { violations, tokensUsed } = evaluateSource(source, model, opts);
  const missing = (prompt.mustUse ?? []).filter((tokenPath) => {
    const varName = `ds-${tokenPath.replaceAll(".", "-")}`;
    return !tokensUsed.has(varName);
  });
  for (const tokenPath of missing) {
    violations.push({
      rule: "missing-required-token",
      severity: "error",
      message: `Expected \`${tokenPath}\` — the documented answer for this component.`,
      line: 0,
      file: opts.filename ?? "input",
    });
  }
  const errors = violations.filter((v) => v.severity === "error");
  return {
    id: prompt.id,
    pass: errors.length === 0,
    errors: errors.length,
    warnings: violations.length - errors.length,
    violations,
    tokensUsed: [...tokensUsed],
  };
}
