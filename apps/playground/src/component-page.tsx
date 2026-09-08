// One page per component, rendered from docs/components/contracts.json — the
// machine-readable twin of docs/components/*.md, written by the same generator
// from the same assembled contract. Nothing on these pages is typed by hand
// here: a prop's name, type and default are parsed from
// packages/react/src/<name>.tsx, and what each prop is *for* comes from
// registry/components/<name>.json. If the two disagree the docs build fails,
// so a page that renders at all is a page whose halves agree.
//
// The live demos are the one thing this file adds, and they are deliberately
// the only hand-written part: a contract can say `loading` shows a spinner and
// refuses clicks, but only a real button can be clicked.
import { useState } from "react";
import type { ReactNode } from "react";
import { Button, ButtonGroup, Spinner } from "@ds/react";
import type { ButtonGroupOrientation, ButtonSize, ButtonVariant } from "@ds/react";
import { COMPONENT_TABS, componentPage, hrefFor } from "./routing.js";
import type { ComponentTab, Page } from "./routing.js";
import contractsJson from "../../../docs/components/contracts.json";

export interface ContractProp {
  name: string;
  type: string;
  /** String-literal members of the prop's union type, when it is one — resolved from source. */
  values?: string[];
  optional: boolean;
  default?: string | null;
  description?: string | null;
  declared: boolean;
  summary: string | null;
  use: string[];
  dont: string[];
  conflicts: string[];
  a11y: string | null;
}

export interface Contract {
  name: string;
  title: string;
  description: string;
  family: string;
  tier: string;
  status: Record<string, { state: string; version?: string } | undefined>;
  dependencies: string[];
  importPath: string;
  /** `documented` = implemented and cross-checked, `spec` = approved intent, `css-only` = no props API by design. */
  mode: "documented" | "spec" | "css-only";
  note: string | null;
  extends: string | null;
  props: ContractProp[];
  usage: Array<{ case: string; when?: string; example?: string; notes?: string }>;
  behavior: {
    primitive?: string;
    summary?: string;
    decisions?: Array<{ decision: string; why: string }>;
  } | null;
  tokens: Record<string, { summary?: string; tokens: Record<string, string> }>;
  example: string | null;
}

export const contracts = (contractsJson as unknown as Contract[])
  .slice()
  .sort((a, b) => a.family.localeCompare(b.family) || a.name.localeCompare(b.name));

export const contractsByName = new Map(contracts.map((c) => [c.name, c]));

export function StatusPill({ artifact }: { artifact?: { state: string; version?: string } }) {
  const state = artifact?.state ?? "tbd";
  return (
    <span className={`pg-status pg-status--${state}`}>
      {state}
      {artifact?.version ? ` · ${artifact.version}` : ""}
    </span>
  );
}

// ---- Live demos ----------------------------------------------------------
// Keyed by registry name, and only for components that actually exist. A
// component with no entry here renders its contract without a preview rather
// than a mocked-up one — a fake <Dialog> on this page would be exactly the
// invented API the registry exists to prevent.

const variants = ["primary", "secondary", "tertiary", "destructive"] as const;
const sizes = ["sm", "md", "lg"] as const;

const DEMOS: Record<string, () => ReactNode> = {
  button: () => (
    <>
      {sizes.map((size) => (
        <div className="pg-row" key={size}>
          <span className="pg-row-label">{size}</span>
          {variants.map((variant) => (
            <Button key={variant} variant={variant} size={size}>
              {variant.charAt(0).toUpperCase() + variant.slice(1)}
            </Button>
          ))}
        </div>
      ))}
      <div className="pg-row">
        <span className="pg-row-label">states</span>
        <Button disabled>Disabled</Button>
        <Button loading>Saving…</Button>
        <Button variant="secondary" iconOnly aria-label="Settings">
          ⚙
        </Button>
      </div>
    </>
  ),
  spinner: () => (
    <>
      <div className="pg-row">
        <span className="pg-row-label">alone</span>
        <Spinner label="Loading" />
      </div>
      <div className="pg-row">
        <span className="pg-row-label">in a button</span>
        <Button loading>Saving…</Button>
      </div>
    </>
  ),
  "button-group": () => (
    <>
      <div className="pg-row">
        <span className="pg-row-label">spaced</span>
        <ButtonGroup label="Form actions">
          <Button variant="secondary">Cancel</Button>
          <Button>Save changes</Button>
        </ButtonGroup>
      </div>
      <div className="pg-row">
        <span className="pg-row-label">attached</span>
        <ButtonGroup label="Pagination" attached>
          <Button variant="secondary" iconOnly aria-label="Previous page">
            ‹
          </Button>
          <Button variant="secondary" iconOnly aria-label="Next page">
            ›
          </Button>
        </ButtonGroup>
      </div>
      <div className="pg-row">
        <span className="pg-row-label">vertical</span>
        <ButtonGroup label="Layer actions" orientation="vertical" attached>
          <Button variant="secondary">Bring forward</Button>
          <Button variant="secondary">Send backward</Button>
        </ButtonGroup>
      </div>
    </>
  ),
  // CSS-only: the class composed onto a host element, which is the whole API.
  "state-layer": () => (
    <div className="pg-row">
      <span className="pg-row-label">hover / press</span>
      <button type="button" className="pg-demo-surface ds-state-layer">
        Composed onto any element
      </button>
    </div>
  ),
};

// ---- Interactive props ---------------------------------------------------
// The controls below are generated from the contract, not listed here: a union
// prop becomes a select over the members parsed out of its type alias, a
// boolean becomes a checkbox, a string becomes a text box. Add a prop to a
// component and its control appears on the next docs build — there is no
// second list of props in this file to forget to update.
//
// What is hand-written is only how each component renders with a bag of props,
// which no contract can supply.

type DemoState = Record<string, string | boolean>;

interface Interactive {
  /** Contract prop names the controls may drive, in the order they are shown. */
  controls: string[];
  /** Editable children, for components that take them. Not a prop, so not in the contract. */
  slot?: { label: string; initial: string };
  render: (state: DemoState) => ReactNode;
  /**
   * Props the snippet must show that no control drives — the obligations a
   * contract puts on the caller, like the `aria-label` `iconOnly` requires.
   */
  implied?: (state: DemoState) => Record<string, string>;
}

const iconLabel = (state: DemoState) => String(state.children || "Settings");

const INTERACTIVE: Record<string, Interactive> = {
  button: {
    controls: ["variant", "size", "disabled", "loading", "iconOnly"],
    slot: { label: "Children", initial: "Save changes" },
    implied: (state): Record<string, string> =>
      state.iconOnly ? { "aria-label": iconLabel(state) } : {},
    render: (state) => (
      <Button
        variant={state.variant as ButtonVariant}
        size={state.size as ButtonSize}
        disabled={Boolean(state.disabled)}
        loading={Boolean(state.loading)}
        iconOnly={Boolean(state.iconOnly)}
        aria-label={state.iconOnly ? iconLabel(state) : undefined}
      >
        {state.iconOnly ? "⚙" : String(state.children)}
      </Button>
    ),
  },
  "button-group": {
    controls: ["label", "orientation", "attached"],
    render: (state) => (
      <ButtonGroup
        label={String(state.label || "Form actions")}
        orientation={state.orientation as ButtonGroupOrientation}
        attached={Boolean(state.attached)}
      >
        <Button variant="secondary">Cancel</Button>
        <Button variant="secondary">Save draft</Button>
        <Button>Publish</Button>
      </ButtonGroup>
    ),
  },
  spinner: {
    controls: ["label"],
    render: (state) => <Spinner label={state.label ? String(state.label) : undefined} />,
  },
};

/** A contract default is source text (`"primary"`, `true`) — this is the value it means. */
function initialValue(prop: ContractProp): string | boolean {
  const raw = prop.default;
  if (raw === undefined || raw === null) return prop.type === "boolean" ? false : "";
  if (raw === "true") return true;
  if (raw === "false") return false;
  return raw.replace(/^"|"$/g, "");
}

function initialState(contract: Contract, spec: Interactive): DemoState {
  const state: DemoState = {};
  for (const name of spec.controls) {
    const prop = contract.props.find((p) => p.name === name);
    if (prop) state[name] = initialValue(prop);
  }
  if (spec.slot) state.children = spec.slot.initial;
  return state;
}

/** The JSX for what is currently on screen: props that differ from their default, and nothing else. */
function snippet(contract: Contract, spec: Interactive, state: DemoState): string {
  const tag = contract.title.replace(/[^A-Za-z]/g, "");
  const attrs: string[] = [];

  for (const name of spec.controls) {
    const prop = contract.props.find((p) => p.name === name);
    if (!prop) continue;
    const value = state[name];
    if (value === initialValue(prop)) continue; // it is the default — writing it adds noise, not information
    if (typeof value === "boolean") {
      if (value) attrs.push(name);
    } else if (value !== "") {
      attrs.push(`${name}="${value}"`);
    }
  }

  for (const [name, value] of Object.entries(spec.implied?.(state) ?? {})) {
    attrs.push(`${name}="${value}"`);
  }

  const open = `<${tag}${attrs.length ? " " + attrs.join(" ") : ""}`;
  if (!spec.slot) return `${open} />`;
  const children = state.iconOnly ? "⚙" : String(state.children);
  return `${open}>${children}</${tag}>`;
}

/**
 * Conflicts the contract declares, checked against what is currently set. The
 * component will not stop you — `loading` and `disabled` both compile — so
 * saying it here is the only place the rule shows up while you are exploring.
 */
function activeConflicts(contract: Contract, state: DemoState): string[] {
  const warnings: string[] = [];
  for (const prop of contract.props) {
    if (!state[prop.name]) continue;
    for (const other of prop.conflicts) {
      if (state[other] && prop.name < other) warnings.push(`${prop.name} and ${other}`);
    }
  }
  return warnings;
}

/**
 * The control for one prop. Its accessible name is the prop name, which the row
 * already shows in its first column — a second visible copy beside the input
 * would be the same word twice, so this labels without repeating.
 */
function Control({
  prop,
  value,
  onChange,
}: {
  prop: ContractProp;
  value: string | boolean;
  onChange: (value: string | boolean) => void;
}) {
  if (prop.values?.length) {
    return (
      <select
        className="pg-control-input"
        aria-label={prop.name}
        value={String(value)}
        onChange={(event) => onChange(event.target.value)}
      >
        {prop.values.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  if (prop.type === "boolean") {
    return (
      <input
        type="checkbox"
        className="pg-control-checkbox"
        aria-label={prop.name}
        checked={Boolean(value)}
        onChange={(event) => onChange(event.target.checked)}
      />
    );
  }

  return (
    <input
      type="text"
      className="pg-control-input"
      aria-label={prop.name}
      placeholder="value"
      value={String(value)}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

/**
 * The preview stage: the component as currently configured, with its JSX one
 * click away. The code is folded by default because the thing being documented
 * is the component, not the snippet — but it is one toggle away because the
 * snippet is what you actually leave with.
 */
function PropsStage({
  contract,
  spec,
  state,
}: {
  contract: Contract;
  spec: Interactive;
  state: DemoState;
}) {
  const [showCode, setShowCode] = useState(false);
  const conflicts = activeConflicts(contract, state);

  return (
    <div className="pg-stage">
      <div className="pg-stage-canvas">
        <button
          type="button"
          className="pg-stage-code-toggle ds-state-layer"
          aria-expanded={showCode}
          aria-label={showCode ? "Hide JSX" : "Show JSX"}
          onClick={() => setShowCode((open) => !open)}
        >
          &lt;/&gt;
        </button>
        {spec.render(state)}
      </div>

      {showCode && <pre className="pg-code pg-stage-code">{snippet(contract, spec, state)}</pre>}

      {conflicts.length > 0 && (
        <p className="pg-callout pg-callout--conflict">
          <strong>Conflicting props:</strong> {conflicts.join("; ")}. The contract says never to pass
          both — the component compiles either way, which is why it is worth saying here.
        </p>
      )}
    </div>
  );
}

/** A union type, listed the way you would choose from it rather than the way it is declared. */
function TypeSignature({ prop }: { prop: ContractProp }) {
  const defaultValue = prop.default?.replace(/^"|"$/g, "");
  if (!prop.values?.length) return <code className="pg-prop-type">{prop.type}</code>;
  return (
    <code className="pg-prop-type">
      {prop.values.map((value) => (
        <span className="pg-prop-type-line" key={value}>
          | &apos;{value}&apos;
          {value === defaultValue && <span className="pg-prop-default"> (default)</span>}
        </span>
      ))}
    </code>
  );
}

/**
 * One prop: what it is called, what it accepts, what it is for, and — when the
 * component is implemented — the control that sets it on the preview above.
 * The three used to be a table, a set of cards and a separate playground; they
 * are one row because they are one question.
 */
function PropRow({
  prop,
  value,
  onChange,
}: {
  prop: ContractProp;
  value?: string | boolean;
  onChange?: (value: string | boolean) => void;
}) {
  const guidance = prop.use.length + prop.dont.length + prop.conflicts.length > 0;

  return (
    <div className="pg-prop-row">
      <div className="pg-prop-name">
        <code>{prop.name}</code>
      </div>

      <div className="pg-prop-detail">
        <TypeSignature prop={prop} />
        {(prop.summary || prop.description) && (
          <p className="pg-prop-summary">{prop.summary ?? prop.description}</p>
        )}
        {prop.description && prop.summary && prop.description !== prop.summary && (
          <p className="pg-note">Source doc: {prop.description}</p>
        )}

        {guidance && (
          <details className="pg-prop-guidance">
            <summary>When to use it, and when not to</summary>
            {prop.use.length > 0 && (
              <section className="pg-doc-block">
                <h4>Use when</h4>
                <ul>
                  {prop.use.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            )}
            {prop.dont.length > 0 && (
              <section className="pg-doc-block pg-doc-block--dont">
                <h4>Don&rsquo;t use for</h4>
                <ul>
                  {prop.dont.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            )}
            {prop.conflicts.length > 0 && (
              <p className="pg-note">
                Conflicts with{" "}
                {prop.conflicts.map((other, i) => (
                  <span key={other}>
                    {i > 0 ? ", " : ""}
                    <code>{other}</code>
                  </span>
                ))}{" "}
                — never pass both.
              </p>
            )}
          </details>
        )}

        {prop.a11y && (
          <p className="pg-note">Carries an accessibility obligation — see the Accessibility tab.</p>
        )}
      </div>

      <div className="pg-prop-control">
        {onChange && <Control prop={prop} value={value ?? ""} onChange={onChange} />}
      </div>
    </div>
  );
}

function PropSignature({ prop }: { prop: ContractProp }) {
  const def = prop.default !== undefined && prop.default !== null ? ` = ${prop.default}` : "";
  return (
    <code className="pg-prop-signature">
      {prop.name}
      {prop.optional ? "?" : ""}: {prop.type}
      {def}
    </code>
  );
}

/**
 * The mode banner. `spec` and `css-only` are not degraded states — they are
 * two of the three legitimate answers to "what is this component", and saying
 * which one applies is what stops someone importing a `<Dialog>` that has no
 * code behind it.
 */
function ModeNote({ contract }: { contract: Contract }) {
  if (contract.mode === "documented") {
    return (
      <pre className="pg-code">{`import { ${contract.title.replace(/[^A-Za-z]/g, "")} } from "${contract.importPath}";`}</pre>
    );
  }
  if (contract.mode === "css-only") {
    return (
      <p className="pg-callout">
        <strong>CSS-only.</strong> There is no React component to import — this is a class composed
        onto other components&rsquo; own.
      </p>
    );
  }
  return (
    <p className="pg-callout pg-callout--spec">
      <strong>Not implemented yet.</strong> This page is the <em>approved intent</em> — the props
      API signed off at gate 1 of the build order, before any React exists. Don&rsquo;t import it;
      there is nothing to import.
    </p>
  );
}

/**
 * One component, three tabs, three addresses:
 *
 *   /components/button                      what it is and how it looks
 *   /components/button?tab=properties       every prop and what each is for
 *   /components/button?tab=accessibility    what it obliges the caller to do
 *
 * The tabs are `<a href>`s rather than an ARIA tab widget, because they change
 * the URL: they are navigation, and rendering navigation as a tablist takes
 * away middle-click, cmd-click and "copy link address" in exchange for nothing.
 *
 * The split is by question, not by field. Accessibility is not a footnote at
 * the bottom of the props table here — `iconOnly` without an `aria-label` and
 * a natively-`disabled` control are the two failures this system is built to
 * prevent, so what a prop obliges you to do gets a page, not a line.
 */
function ComponentTabs({
  contract,
  tab,
  onNavigate,
}: {
  contract: Contract;
  tab: ComponentTab;
  onNavigate: (page: Page, tab: ComponentTab) => void;
}) {
  return (
    <nav className="pg-tabs" aria-label={`${contract.title} sections`}>
      {COMPONENT_TABS.map((item) => (
        <a
          key={item.id}
          className={`pg-tab${item.id === tab ? " is-active" : ""}`}
          href={hrefFor(componentPage(contract.name), item.id)}
          aria-current={item.id === tab ? "page" : undefined}
          onClick={(event) => {
            // Let the browser handle the modified clicks it handles better:
            // new tab, new window, download, and any non-primary button.
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
              return;
            }
            event.preventDefault();
            onNavigate(componentPage(contract.name), item.id);
          }}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}

function OverviewTab({ contract }: { contract: Contract }) {
  const demo = DEMOS[contract.name];

  return (
    <>
      <section className="pg-section">
        <ModeNote contract={contract} />
      </section>

      {demo && (
        <section className="pg-section">
          <h3>Examples</h3>
          {demo()}
        </section>
      )}

      {!demo && contract.mode === "spec" && (
        <section className="pg-section">
          <h3>Live</h3>
          <p className="pg-note">
            Nothing to render — this page is the spec, not a description of shipped code.
          </p>
        </section>
      )}

      {contract.usage.length > 0 && (
        <section className="pg-section">
          <h3>Use cases</h3>
          {contract.usage.map((item) => (
            <div className="pg-usage" key={item.case}>
              <div className="pg-ramp-title">{item.case}</div>
              {item.when && <p>{item.when}</p>}
              {item.example && <pre className="pg-code">{item.example}</pre>}
              {item.notes && <p className="pg-note">{item.notes}</p>}
            </div>
          ))}
        </section>
      )}

      {contract.example && (
        <section className="pg-section">
          <h3>Real usage in this repo</h3>
          <p className="pg-note">
            Extracted from <code>apps/</code> — a snippet someone actually shipped, not a synthesized
            one.
          </p>
          <pre className="pg-code">{contract.example}</pre>
        </section>
      )}

      {Object.keys(contract.tokens).length > 0 && (
        <section className="pg-section">
          <h3>Token recipe</h3>
          <p className="pg-note">
            The exact token for every property — including for components not built yet, where the
            recipe is the spec.
          </p>
          {Object.entries(contract.tokens).map(([variant, recipe]) => (
            <div className="pg-recipe" key={variant}>
              <div className="pg-ramp-title">{variant}</div>
              {recipe.summary && <p className="pg-note">{recipe.summary}</p>}
              <table className="pg-table">
                <thead>
                  <tr>
                    <th>Property</th>
                    <th>Token</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(recipe.tokens ?? {}).map(([property, token]) => (
                    <tr key={property}>
                      <td>{property}</td>
                      <td>
                        <code>{token}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </section>
      )}
    </>
  );
}

function PropertiesTab({ contract }: { contract: Contract }) {
  const spec = INTERACTIVE[contract.name];
  const [state, setState] = useState<DemoState>(() =>
    spec ? initialState(contract, spec) : {}
  );

  if (contract.mode === "css-only") {
    return (
      <section className="pg-section">
        <p className="pg-callout">
          <strong>No props API by design.</strong> {contract.title} is a class you compose onto
          another component&rsquo;s own — see the Overview tab for how.
        </p>
      </section>
    );
  }

  if (contract.props.length === 0) {
    return (
      <section className="pg-section">
        <p className="pg-callout pg-callout--spec">
          <strong>No props approved yet.</strong> {contract.title} has a token recipe but no props
          API — gate 1 of the build order hasn&rsquo;t been passed, so there is nothing to look up
          and nothing to invent.
        </p>
      </section>
    );
  }

  const set = (name: string) => (value: string | boolean) =>
    setState((prev) => ({ ...prev, [name]: value }));
  const controllable = (prop: ContractProp) => spec?.controls.includes(prop.name) ?? false;

  const required = contract.props.filter((prop) => !prop.optional);
  const optional = contract.props.filter((prop) => prop.optional);

  const rows = (props: ContractProp[]) =>
    props.map((prop) => (
      <PropRow
        key={prop.name}
        prop={prop}
        value={state[prop.name]}
        onChange={controllable(prop) ? set(prop.name) : undefined}
      />
    ));

  return (
    <>
      {spec && (
        <section className="pg-section">
          <PropsStage contract={contract} spec={spec} state={state} />
        </section>
      )}

      <section className="pg-section">
        <h3>Props</h3>
        <p className="pg-note">
          Names, types and defaults are read from{" "}
          <code>packages/react/src/{contract.name}.tsx</code>; what each one is for is written in{" "}
          <code>registry/components/{contract.name}.json</code>. The build fails if the two
          disagree.
          {contract.extends && (
            <>
              {" "}
              Extends <code>{contract.extends}</code>.
            </>
          )}
        </p>

        {/* With no implementation behind it there is nothing for a control to
            drive, so the row drops to two columns rather than reserving a
            column of empty boxes. */}
        <div className={`pg-props${spec ? "" : " pg-props--static"}`}>
          {required.length > 0 && (
            <>
              <div className="pg-props-group">Required</div>
              {rows(required)}
            </>
          )}

          {optional.length > 0 && (
            <>
              <div className="pg-props-group">Optional</div>
              {rows(optional)}
            </>
          )}

          {spec?.slot && (
            <>
              <div className="pg-props-group">Inherited</div>
              <div className="pg-prop-row">
                <div className="pg-prop-name">
                  <code>children</code>
                </div>
                <div className="pg-prop-detail">
                  <code className="pg-prop-type">ReactNode</code>
                  <p className="pg-prop-summary">
                    The button&rsquo;s visible label. Comes from the extended element props, not from{" "}
                    {contract.title}&rsquo;s own interface, which is why it has no contract entry of
                    its own.
                  </p>
                </div>
                <div className="pg-prop-control">
                  <input
                    type="text"
                    className="pg-control-input"
                    aria-label="children"
                    placeholder="value"
                    value={String(state.children ?? "")}
                    onChange={(event) => set("children")(event.target.value)}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
}

function AccessibilityTab({ contract }: { contract: Contract }) {
  const obligations = contract.props.filter((prop) => prop.a11y);
  const decisions = contract.behavior?.decisions ?? [];
  const nothing = obligations.length === 0 && decisions.length === 0 && !contract.behavior;

  return (
    <>
      {nothing && (
        <section className="pg-section">
          <p className="pg-callout pg-callout--spec">
            <strong>Nothing documented yet.</strong> {contract.title} has no behavior contract and no
            per-prop accessibility notes — which for an unbuilt component means the obligations
            haven&rsquo;t been decided, not that there are none.
          </p>
        </section>
      )}

      {obligations.length > 0 && (
        <section className="pg-section">
          <h3>What each prop obliges you to do</h3>
          <p className="pg-note">
            None of this is recoverable from a type signature — which is exactly why it is written
            down: <code>iconOnly</code> compiles without an <code>aria-label</code>.
          </p>
          {obligations.map((prop) => (
            <div className="pg-prop" key={prop.name}>
              <div className="pg-prop-head">
                <h4>{prop.name}</h4>
                <PropSignature prop={prop} />
              </div>
              <p className="pg-prop-summary">{prop.a11y}</p>
            </div>
          ))}
        </section>
      )}

      {contract.behavior && (
        <section className="pg-section">
          <h3>Behavior</h3>
          <p className="pg-note">
            Behavior lives on this tab because in this system the primitive is where the
            accessibility contract is enforced — activation guarding and disabled/busy semantics,
            independent of React and of any styling.
          </p>
          {contract.behavior.summary && <p>{contract.behavior.summary}</p>}
          {contract.behavior.primitive && (
            <p className="pg-note">
              Headless contract: <code>{contract.behavior.primitive}</code> in{" "}
              <code>packages/primitives/src/{contract.name}.ts</code> — importable from{" "}
              <code>@ds/primitives</code> without the React wrapper or any CSS.
            </p>
          )}
          {decisions.map((decision) => (
            <div className="pg-doc-block" key={decision.decision}>
              <h4>{decision.decision}</h4>
              <p>{decision.why}</p>
            </div>
          ))}
        </section>
      )}

      <section className="pg-section">
        <h3>System-wide, and not optional</h3>
        <ul className="pg-rules">
          <li>
            Focus is <code>theme.focus-ring</code> at <code>focus.ring-width</code> with{" "}
            <code>focus.ring-offset</code>, on <code>:focus-visible</code>. Never removed, and never
            offset <code>0</code> on a filled accent control.
          </li>
          <li>
            Disabled controls stay focusable and announced: <code>aria-disabled</code> plus a click
            guard in the primitive, never the native <code>disabled</code> attribute.
          </li>
          <li>
            Colour alone never carries a state — a status ring is always paired with a message.
          </li>
        </ul>
      </section>
    </>
  );
}

export function ComponentPage({
  contract,
  tab,
  onNavigate,
}: {
  contract: Contract;
  tab: ComponentTab;
  onNavigate: (page: Page, tab: ComponentTab) => void;
}) {
  return (
    <>
      <section className="pg-section pg-section--head">
        <div className="pg-component-head">
          <h2>{contract.title}</h2>
          <div className="pg-component-status">
            <StatusPill artifact={contract.status.css} />
            <StatusPill artifact={contract.status.react} />
            <StatusPill artifact={contract.status.figma} />
          </div>
        </div>
        <p className="pg-component-description">{contract.description}</p>
        <p className="pg-note">
          <code>{contract.name}</code> · {contract.family} · {contract.tier} tier
          {contract.dependencies.length > 0 && <> · depends on {contract.dependencies.join(", ")}</>}
        </p>
        <ComponentTabs contract={contract} tab={tab} onNavigate={onNavigate} />
      </section>

      {tab === "overview" && <OverviewTab contract={contract} />}
      {tab === "properties" && <PropertiesTab contract={contract} />}
      {tab === "accessibility" && <AccessibilityTab contract={contract} />}
    </>
  );
}

/** The index page: every component, its family, and where each artifact stands. */
export function ComponentIndex({ onOpen }: { onOpen: (name: string) => void }) {
  return (
    <section className="pg-section">
      <h2>Components</h2>
      <p className="pg-note">
        Every component in the registry, built or not. Open one for its contract — what each prop is
        for, what it conflicts with, and the token recipe behind it.
      </p>
      <table className="pg-table">
        <thead>
          <tr>
            <th>Component</th>
            <th>Family</th>
            <th>CSS</th>
            <th>React</th>
            <th>Figma</th>
          </tr>
        </thead>
        <tbody>
          {contracts.map((contract) => (
            <tr key={contract.name}>
              <td>
                <button type="button" className="pg-link" onClick={() => onOpen(contract.name)}>
                  {contract.title}
                </button>
              </td>
              <td>{contract.family}</td>
              <td>
                <StatusPill artifact={contract.status.css} />
              </td>
              <td>
                <StatusPill artifact={contract.status.react} />
              </td>
              <td>
                <StatusPill artifact={contract.status.figma} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
