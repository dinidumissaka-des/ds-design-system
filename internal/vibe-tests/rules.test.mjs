// Tests for the checker. A scoring tool that is wrong is worse than no tool:
// it makes bad code look fine, or teaches contributors to ignore it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTokenModel, evaluateSource, scoreCandidate } from "./rules.mjs";

const model = loadTokenModel();
const rules = (css) => evaluateSource(css, model).violations.map((v) => v.rule);
const find = (css, rule) => evaluateSource(css, model).violations.find((v) => v.rule === rule);

test("flags a palette token used in a component", () => {
  assert.ok(rules(".a { color: var(--ds-color-neutral-900); }").includes("palette-token"));
});

test("does not mistake a theme role token for a palette token", () => {
  // Regression: prefix matching under the old single "color" family could
  // confuse a palette ramp with a same-named role. theme.* and color.* are
  // now separate top-level families, but keep the guard.
  for (const token of [
    "--ds-theme-warning-role-subtle",
    "--ds-theme-warning-role-fg",
    "--ds-theme-accent-role-bg",
    "--ds-theme-danger-role-fg",
    "--ds-theme-success-role-subtle",
  ]) {
    assert.ok(
      !rules(`.a { color: var(${token}); }`).includes("palette-token"),
      `${token} must not be treated as a palette token`
    );
  }
});

test("flags an unknown token separately from a palette one", () => {
  const r = rules(".a { color: var(--ds-color-does-not-exist); }");
  assert.ok(r.includes("unknown-token"));
  assert.ok(!r.includes("palette-token"));
});

test("a pairing that fails in every theme is an error", () => {
  // The success fill is a non-text indicator in both schemes: its own label
  // token is white, and white on it lands in the low 3s. Warning used to be
  // the example here, but it now carries a dark label token that passes —
  // the gap moved rather than disappearing.
  const v = find(
    ".toast { background: var(--ds-theme-success-role-bg); color: var(--ds-theme-success-role-on); }",
    "forbidden-pairing"
  );
  assert.ok(v, "expected the white-on-success-fill pairing to be caught");
  assert.equal(v.severity, "error");
});

test("each role's own label token clears AA on its fill", () => {
  // Regression guard for the bug the theme engine surfaced: reusing
  // theme.fg.on-accent for status fills put dark text on a dark red button
  // in the dark scheme, because on-accent inverts with the accent and the
  // status fills do not.
  for (const role of ["danger", "warning"]) {
    const css = `.b { background: var(--ds-theme-${role}-role-bg); color: var(--ds-theme-${role}-role-on); }`;
    assert.equal(find(css, "forbidden-pairing"), undefined, `${role} label must clear AA`);
  }
});

test("a pairing verified in one theme is a warning, not an error", () => {
  // Graded severity: a combination that is sanctioned in one theme and short in
  // another is the palette's fault, not the component's. Built on a synthetic
  // model so the branch stays covered no matter what the real ramps measure.
  const synthetic = {
    index: {
      "ds-fg": { path: "fg", layer: "semantic" },
      "ds-bg": { path: "bg", layer: "semantic" },
      "ds-bg2": { path: "bg2", layer: "semantic" },
    },
    validVars: new Set(["ds-fg", "ds-bg", "ds-bg2"]),
    forbidden: new Map([
      ["fg|bg", { below: "AA-text", themes: ["dark"], measured: { dark: 3.68 }, workaround: "" }],
      ["fg|bg2", { below: "AA-text", themes: ["light", "dark"], measured: { light: 2.1 }, workaround: "" }],
    ]),
    verified: new Set(["fg|bg"]),
  };
  const severityFor = (bg) =>
    evaluateSource(`.a { background: var(--ds-${bg}); color: var(--ds-fg); }`, synthetic)
      .violations.find((v) => v.rule === "forbidden-pairing")?.severity;

  assert.equal(severityFor("bg"), "warn", "verified somewhere → warning");
  assert.equal(severityFor("bg2"), "error", "short everywhere → error");
});

test("the primary and destructive button pairings are clean in both themes", () => {
  // The dark accent-role.bg and danger-role.bg were retuned to step 600 (from
  // 500) so white text clears AA in both themes; this guards against them
  // drifting back.
  for (const bg of ["accent", "danger"]) {
    const css = `.button { background: var(--ds-theme-${bg}-role-bg); color: var(--ds-theme-fg-on-accent); }`;
    assert.equal(find(css, "forbidden-pairing"), undefined, `${bg} fill must clear AA in both themes`);
  }
});

test("accepts the documented success and warning notice recipe", () => {
  const css = `.n { background: var(--ds-theme-success-role-subtle); color: var(--ds-theme-success-role-fg); }`;
  assert.deepEqual(rules(css), []);
});

test("flags hardcoded colors, dimensions, weights, and motion", () => {
  assert.ok(rules(".a { color: #ff0000; }").includes("hardcoded-color"));
  assert.ok(rules(".a { padding: 16px; }").includes("hardcoded-dimension"));
  assert.ok(rules(".a { font-weight: 500; }").includes("hardcoded-font-weight"));
  assert.ok(rules(".a { transition: all 0.2s ease-in-out; }").includes("hardcoded-motion"));
});

test("allows font-relative sizing", () => {
  // Regression: the spinner is deliberately 1em so it scales with its container.
  assert.ok(!rules(".spinner { width: 1em; height: 1em; }").includes("hardcoded-dimension"));
});

test("accepts scale tokens in place of raw values", () => {
  const css = `.a {
    padding: var(--ds-space-4);
    font-weight: var(--ds-font-weight-bold);
    transition: opacity var(--ds-motion-duration-fast) var(--ds-motion-easing-standard);
  }`;
  assert.deepEqual(rules(css), []);
});

test("requires a focus ring on a focusable control", () => {
  assert.ok(rules(".btn { cursor: pointer; }").includes("missing-focus-ring"));
  const ok = `.btn { cursor: pointer; }
    .btn:focus-visible { outline: var(--ds-focus-ring-width) solid var(--ds-theme-focus-ring); }`;
  assert.ok(!rules(ok).includes("missing-focus-ring"));
});

test("does not demand a focus ring from a non-focusable overlay primitive", () => {
  // Regression: .ds-state-layer has :hover/:active rules but is never focused.
  const stateLayer = `.ds-state-layer::after { opacity: 0; pointer-events: none; }
    .ds-state-layer:hover::after { opacity: var(--ds-state-hover-opacity); }
    .ds-state-layer:active::after { opacity: var(--ds-state-press-opacity); }`;
  assert.ok(!rules(stateLayer).includes("missing-focus-ring"));
});

test("flags a removed focus ring", () => {
  assert.ok(rules(".btn:focus { outline: none; }").includes("focus-removed"));
});

test("warns on hand-rolled hover and native disabled styling", () => {
  assert.ok(
    rules(".btn:hover { background: var(--ds-theme-accent-role-subtle); }").includes("hand-rolled-hover")
  );
  assert.ok(rules(".btn:disabled { opacity: 0.5; }").includes("native-disabled-styling"));
  assert.ok(
    !rules('.btn[aria-disabled="true"] { opacity: var(--ds-state-disabled-opacity); }').includes(
      "native-disabled-styling"
    )
  );
});

test("ds-allow records a deliberate exception", () => {
  const css = `/* ds-allow: hardcoded-motion — the spin cycle has no token */
    .spinner { animation: spin 0.8s linear infinite; }`;
  assert.ok(!rules(css).includes("hardcoded-motion"));
});

test("ds-allow covers only the block it precedes", () => {
  // A file-wide exemption would quietly cover violations added later.
  const css = `/* ds-allow: hardcoded-dimension — app layout constant */
    .shell { width: 960px; }
    .later { padding: 13px; }`;
  const v = evaluateSource(css, model).violations.filter((x) => x.rule === "hardcoded-dimension");
  assert.equal(v.length, 1, "the second block must still be reported");
  assert.match(v[0].message, /13px/);
});

test("layout constraints are not scale violations", () => {
  assert.deepEqual(rules(".shell { max-width: 960px; }"), []);
  assert.ok(rules(".swatch { height: 48px; }").includes("hardcoded-dimension"));
});

test("scoring reports a missing required token", () => {
  const prompt = { id: "x", mustUse: ["theme.warning-role.subtle"] };
  const bad = scoreCandidate(".n { color: var(--ds-theme-fg-primary); }", prompt, model);
  assert.equal(bad.pass, false);
  assert.ok(bad.violations.some((v) => v.rule === "missing-required-token"));

  const good = scoreCandidate(
    ".n { background: var(--ds-theme-warning-role-subtle); color: var(--ds-theme-warning-role-fg); }",
    prompt,
    model
  );
  assert.equal(good.pass, true);
});
