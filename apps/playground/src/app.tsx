import { useEffect, useState } from "react";
import { Button } from "@ds/react";
import { tokens } from "@ds/tokens";

interface RegistryEntry {
  name: string;
  title: string;
  family: string;
  status: Record<string, { state: string; version?: string } | undefined>;
  tier?: string;
}

const registry = Object.values(
  import.meta.glob<{ default: RegistryEntry }>("../../../registry/components/*.json", {
    eager: true,
  })
)
  .map((m) => m.default)
  .sort((a, b) => a.family.localeCompare(b.family) || a.name.localeCompare(b.name));

const variants = ["primary", "secondary", "tertiary", "destructive"] as const;
const sizes = ["sm", "md", "lg"] as const;

// One page per category, primitives and semantics merged into one flowing
// view (no sub-split). All token categories nest under one "Foundation"
// group; "Components" is the one non-token page, kept as a flat sibling.
// The old standalone "Foundations" category (elevation/border/opacity/
// size.control/state/focus — the miscellaneous primitives with no family of
// their own) is renamed "Misc" here specifically to avoid colliding with
// the new parent group's name.
type Page = "color" | "spacing" | "radius" | "typography" | "motion" | "misc" | "components";

interface NavLeaf {
  id: Page;
  label: string;
}

interface NavItem {
  id: string;
  label: string;
  children?: NavLeaf[];
  page?: Page; // set only on flat, directly-navigable items (no children)
}

const NAV: NavItem[] = [
  {
    id: "foundation",
    label: "Foundation",
    children: [
      { id: "color", label: "Color" },
      { id: "spacing", label: "Spacing" },
      { id: "radius", label: "Radius" },
      { id: "typography", label: "Typography" },
      { id: "motion", label: "Motion" },
      { id: "misc", label: "Misc" },
    ],
  },
  { id: "components", label: "Components", page: "components" },
];

function StatusPill({ artifact }: { artifact?: { state: string; version?: string } }) {
  const state = artifact?.state ?? "tbd";
  return (
    <span className={`pg-status pg-status--${state}`}>
      {state}
      {artifact?.version ? ` · ${artifact.version}` : ""}
    </span>
  );
}

// ---- Token preview helpers ---------------------------------------------
// Everything below reads straight from the built `tokens` object (light-theme
// values, static) except color semantics, which render via var(--ds-color-*)
// so they stay theme-reactive when the toggle above is used.

function ColorRamp({ title, ramp }: { title: string; ramp: Record<string, string> }) {
  return (
    <div>
      <div className="pg-ramp-title">{title}</div>
      <div className="pg-swatches">
        {Object.entries(ramp).map(([step, hex]) => (
          <div key={step}>
            <div className="pg-swatch" style={{ background: hex }} />
            <div className="pg-swatch-name">
              {step} · {hex}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SemanticSwatches({
  title,
  keys,
  cssVarPrefix,
}: {
  title: string;
  keys: string[];
  cssVarPrefix: string;
}) {
  return (
    <div>
      <div className="pg-ramp-title">{title}</div>
      <div className="pg-swatches">
        {keys.map((key) => (
          <div key={key}>
            <div className="pg-swatch" style={{ background: `var(--ds-color-${cssVarPrefix}-${key})` }} />
            <div className="pg-swatch-name">{key}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SpaceBars({ title, items }: { title: string; items: Array<[string, string]> }) {
  const max = Math.max(...items.map(([, v]) => parseFloat(v)));
  return (
    <div>
      <div className="pg-ramp-title">{title}</div>
      {items.map(([name, value]) => (
        <div className="pg-bar-row" key={name}>
          <span className="pg-bar-label">{name}</span>
          <span className="pg-bar-track">
            <span className="pg-bar" style={{ width: `${(parseFloat(value) / max) * 100}%` }} />
          </span>
          <span className="pg-bar-value">{value}</span>
        </div>
      ))}
    </div>
  );
}

function RadiusPreviews({ title, items }: { title: string; items: Array<[string, string]> }) {
  return (
    <div>
      <div className="pg-ramp-title">{title}</div>
      <div className="pg-radii">
        {items.map(([name, value]) => (
          <div className="pg-radius-item" key={name}>
            <div className="pg-radius-preview" style={{ borderRadius: value }} />
            <div className="pg-swatch-name">
              {name} · {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TypeSamples({ title, items }: { title: string; items: Array<[string, string]> }) {
  return (
    <div>
      <div className="pg-ramp-title">{title}</div>
      {items.map(([name, size]) => (
        <div className="pg-type-sample-row" key={name}>
          <span className="pg-bar-label">{name}</span>
          <span className="pg-bar-value">{size}</span>
          <span className="pg-type-sample-text" style={{ fontSize: size }}>
            The quick brown fox jumps over the lazy dog
          </span>
        </div>
      ))}
    </div>
  );
}

function MotionTrack({ name, duration, easing }: { name: string; duration: string; easing: string }) {
  return (
    <div className="pg-motion-item">
      <span className="pg-bar-label">{name}</span>
      <div className="pg-motion-track">
        <div
          className="pg-motion-chip"
          style={{ transitionDuration: duration, transitionTimingFunction: easing }}
        />
      </div>
      <span className="pg-bar-value">{duration}</span>
    </div>
  );
}

// space.json's raw steps live alongside its semantic sub-objects (gap/stack/
// padding/section/control/page/size) under the same top-level key — pulled
// out explicitly here rather than walked generically, since the mixed shape
// isn't safely iterable with Object.entries().
const spacePrimitives: Array<[string, string]> = [
  ["0", tokens.space["0"]],
  ["0-5", tokens.space["0-5"]],
  ["1", tokens.space["1"]],
  ["1-5", tokens.space["1-5"]],
  ["2", tokens.space["2"]],
  ["3", tokens.space["3"]],
  ["4", tokens.space["4"]],
  ["5", tokens.space["5"]],
  ["6", tokens.space["6"]],
  ["7", tokens.space["7"]],
  ["8", tokens.space["8"]],
  ["9", tokens.space["9"]],
  ["10", tokens.space["10"]],
  ["11", tokens.space["11"]],
  ["12", tokens.space["12"]],
];

// radius.json's primitive + semantic entries all end up as flat sibling
// strings on tokens.radius (no nested sub-objects) — merged into one list,
// same treatment as everything else on this page now.
const radiusNames = ["none", "sm", "md", "lg", "xl", "2xl", "full", "inner", "element", "container", "chat", "page", "pill"] as const;

export function App() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [page, setPage] = useState<Page>("color");
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["foundation"]));
  const [search, setSearch] = useState("");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function toggleGroup(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const query = search.trim().toLowerCase();
  const filteredNav = query
    ? NAV.flatMap((item) => {
        if (item.children) {
          const groupMatches = item.label.toLowerCase().includes(query);
          const childMatches = item.children.filter((c) => c.label.toLowerCase().includes(query));
          if (!groupMatches && childMatches.length === 0) return [];
          return [{ ...item, children: groupMatches ? item.children : childMatches }];
        }
        return item.label.toLowerCase().includes(query) ? [item] : [];
      })
    : NAV;

  return (
    <div className="pg-app">
      <header className="pg-header">
        <h1>DS Playground</h1>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        >
          {theme === "light" ? "Dark theme" : "Light theme"}
        </Button>
      </header>

      <div className="pg-layout">
        <nav className="pg-sidebar">
          <div className="pg-search">
            <span className="pg-search-icon" aria-hidden="true">
              ⌕
            </span>
            <input
              type="text"
              placeholder="Search…"
              className="pg-search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="pg-nav-list">
            {filteredNav.map((item) => {
              const hasChildren = !!item.children?.length;
              const isOpen = query.length > 0 || expanded.has(item.id);
              return (
                <div key={item.id}>
                  <button
                    className={`pg-nav-item${!hasChildren && page === item.page ? " is-active" : ""}`}
                    onClick={() => (hasChildren ? toggleGroup(item.id) : setPage(item.page!))}
                  >
                    <span>{item.label}</span>
                    {hasChildren && (
                      <span className={`pg-nav-chevron${isOpen ? " is-open" : ""}`} aria-hidden="true">
                        ⌄
                      </span>
                    )}
                  </button>
                  {hasChildren && isOpen && (
                    <div className="pg-nav-children">
                      {item.children!.map((leaf) => (
                        <button
                          key={leaf.id}
                          className={`pg-nav-item pg-nav-item--child${page === leaf.id ? " is-active" : ""}`}
                          onClick={() => setPage(leaf.id)}
                        >
                          {leaf.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {filteredNav.length === 0 && <p className="pg-note">No matches.</p>}
          </div>
        </nav>

        <main className="pg-main">
          {page === "color" && (
            <section className="pg-section">
              <h2>Color</h2>
              <div className="pg-ramp-group">
                <ColorRamp title="neutral" ramp={tokens.color.neutral} />
                <ColorRamp title="accent" ramp={tokens.color.accent} />
                <ColorRamp title="success" ramp={tokens.color.success} />
                <ColorRamp title="warning" ramp={tokens.color.warning} />
                <ColorRamp title="danger" ramp={tokens.color.danger} />
                <ColorRamp title="data.categorical" ramp={tokens.color.data.categorical} />
                <ColorRamp title="data.blue" ramp={tokens.color.data.blue} />
                <ColorRamp title="data.shamrock" ramp={tokens.color.data.shamrock} />
                <ColorRamp title="data.orange" ramp={tokens.color.data.orange} />
                <ColorRamp title="data.pink" ramp={tokens.color.data.pink} />
                <ColorRamp title="data.purple" ramp={tokens.color.data.purple} />
                <ColorRamp title="data.red" ramp={tokens.color.data.red} />
                <ColorRamp title="data.teal" ramp={tokens.color.data.teal} />
                <ColorRamp title="data.yellow" ramp={tokens.color.data.yellow} />
                <ColorRamp title="data.gray" ramp={tokens.color.data.gray} />
                <SemanticSwatches title="bg" keys={Object.keys(tokens.color.bg)} cssVarPrefix="bg" />
                <SemanticSwatches title="fg" keys={Object.keys(tokens.color.fg)} cssVarPrefix="fg" />
                <SemanticSwatches
                  title="border"
                  keys={Object.keys(tokens.color.border)}
                  cssVarPrefix="border"
                />
                <SemanticSwatches
                  title="accent-role"
                  keys={Object.keys(tokens.color["accent-role"])}
                  cssVarPrefix="accent-role"
                />
                <SemanticSwatches
                  title="secondary-role"
                  keys={Object.keys(tokens.color["secondary-role"])}
                  cssVarPrefix="secondary-role"
                />
                <SemanticSwatches
                  title="tertiary-role"
                  keys={Object.keys(tokens.color["tertiary-role"])}
                  cssVarPrefix="tertiary-role"
                />
                <SemanticSwatches
                  title="success-role"
                  keys={Object.keys(tokens.color["success-role"])}
                  cssVarPrefix="success-role"
                />
                <SemanticSwatches
                  title="warning-role"
                  keys={Object.keys(tokens.color["warning-role"])}
                  cssVarPrefix="warning-role"
                />
                <SemanticSwatches
                  title="danger-role"
                  keys={Object.keys(tokens.color["danger-role"])}
                  cssVarPrefix="danger-role"
                />
                <div>
                  <div className="pg-ramp-title">focus-ring</div>
                  <div className="pg-swatches">
                    <div>
                      <div className="pg-swatch" style={{ background: "var(--ds-color-focus-ring)" }} />
                      <div className="pg-swatch-name">focus-ring</div>
                    </div>
                  </div>
                </div>
              </div>
              <p className="pg-note">theme-reactive semantics — try the toggle above</p>
            </section>
          )}

          {page === "spacing" && (
            <section className="pg-section">
              <h2>Spacing</h2>
              <div className="pg-bars-group">
                <SpaceBars title="space" items={spacePrimitives} />
                <SpaceBars title="space.gap" items={Object.entries(tokens.space.gap)} />
                <SpaceBars title="space.stack" items={Object.entries(tokens.space.stack)} />
                <SpaceBars title="space.padding" items={Object.entries(tokens.space.padding)} />
                <SpaceBars
                  title="space.control.padding-inline"
                  items={Object.entries(tokens.space.control["padding-inline"])}
                />
                <SpaceBars title="space.page" items={Object.entries(tokens.space.page)} />
              </div>
              <p className="pg-note">space.section (single value) = {tokens.space.section}</p>
            </section>
          )}

          {page === "radius" && (
            <section className="pg-section">
              <h2>Radius</h2>
              <RadiusPreviews title="radius" items={radiusNames.map((name) => [name, tokens.radius[name]])} />
            </section>
          )}

          {page === "typography" && (
            <section className="pg-section">
              <h2>Typography</h2>
              <TypeSamples
                title="size"
                items={[...Object.entries(tokens.font.size), ...Object.entries(tokens.type.size)]}
              />
              <table className="pg-table">
                <thead>
                  <tr>
                    <th>font.weight</th>
                    <th>font.line-height</th>
                    <th>font.letter-spacing</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      {Object.entries(tokens.font.weight)
                        .map(([n, v]) => `${n}: ${v}`)
                        .join(" · ")}
                    </td>
                    <td>
                      {Object.entries(tokens.font["line-height"])
                        .map(([n, v]) => `${n}: ${v}`)
                        .join(" · ")}
                    </td>
                    <td>
                      {Object.entries(tokens.font["letter-spacing"])
                        .map(([n, v]) => `${n}: ${v}`)
                        .join(" · ")}
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className="pg-type-sample-row">
                <span className="pg-bar-label">type.heading</span>
                <span
                  className="pg-type-sample-text"
                  style={{
                    fontSize: tokens.type.heading.size,
                    fontWeight: tokens.type.heading.weight,
                    lineHeight: tokens.type.heading["line-height"],
                  }}
                >
                  The quick brown fox jumps over the lazy dog
                </span>
              </div>
              <div className="pg-type-sample-row">
                <span className="pg-bar-label">type.body</span>
                <span
                  className="pg-type-sample-text"
                  style={{
                    fontSize: tokens.type.body.size,
                    fontWeight: tokens.type.body.weight,
                    lineHeight: tokens.type.body["line-height"],
                  }}
                >
                  The quick brown fox jumps over the lazy dog
                </span>
              </div>
              <div className="pg-type-sample-row">
                <span className="pg-bar-label">type.label</span>
                <span
                  className="pg-type-sample-text"
                  style={{
                    fontSize: tokens.type.label.size,
                    fontWeight: tokens.type.label.weight,
                    lineHeight: tokens.type.label["line-height"],
                    letterSpacing: tokens.type.label["letter-spacing"],
                    textTransform: tokens.type.label["text-transform"] as "uppercase",
                  }}
                >
                  The quick brown fox jumps over the lazy dog
                </span>
              </div>
              <table className="pg-table">
                <thead>
                  <tr>
                    <th>type.tracking</th>
                    <th>value</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(tokens.type.tracking).map(([name, value]) => (
                    <tr key={name}>
                      <td>{name}</td>
                      <td style={{ letterSpacing: value }}>{value} — tracked text</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {page === "motion" && (
            <section className="pg-section">
              <h2>Motion</h2>
              <div className="pg-motion-group">
                {Object.entries(tokens.motion.duration).map(([name, value]) => (
                  <MotionTrack
                    key={name}
                    name={name}
                    duration={value}
                    easing={tokens.motion.easing.standard}
                  />
                ))}
                <MotionTrack
                  name="interactive"
                  duration={tokens.motion.interactive.duration}
                  easing={tokens.motion.interactive.easing}
                />
                <MotionTrack
                  name="overlay"
                  duration={tokens.motion.overlay.duration}
                  easing={tokens.motion.overlay.easing}
                />
                <MotionTrack
                  name="modal"
                  duration={tokens.motion.modal.duration}
                  easing={tokens.motion.modal.easing}
                />
              </div>
              <p className="pg-note">hover each track</p>
            </section>
          )}

          {page === "misc" && (
            <section className="pg-section">
              <h2>Misc</h2>
              <div className="pg-elevation-row">
                {Object.entries(tokens.elevation).map(([name, value]) => (
                  <div key={name} className="pg-elevation-item">
                    <div className="pg-elevation-preview" style={{ boxShadow: value }} />
                    <div className="pg-swatch-name">{name}</div>
                  </div>
                ))}
              </div>
              <table className="pg-table">
                <thead>
                  <tr>
                    <th>Token</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>border (1 / 2 / 3)</td>
                    <td>
                      {tokens.border["1"]} / {tokens.border["2"]} / {tokens.border["3"]}
                    </td>
                  </tr>
                  <tr>
                    <td>border.default</td>
                    <td>{tokens.border.default}</td>
                  </tr>
                  <tr>
                    <td>opacity (8 / 12 / 50)</td>
                    <td>
                      {tokens.opacity["8"]} / {tokens.opacity["12"]} / {tokens.opacity["50"]}
                    </td>
                  </tr>
                  <tr>
                    <td>state (hover / press / disabled)</td>
                    <td>
                      {tokens.state["hover-opacity"]} / {tokens.state["press-opacity"]} /{" "}
                      {tokens.state["disabled-opacity"]}
                    </td>
                  </tr>
                  <tr>
                    <td>focus (ring-width / offset / style)</td>
                    <td>
                      {tokens.focus["ring-width"]} / {tokens.focus["ring-offset"]} /{" "}
                      {tokens.focus["ring-style"]}
                    </td>
                  </tr>
                  <tr>
                    <td>size.control (sm / md / lg)</td>
                    <td>
                      {tokens.size.control.sm} / {tokens.size.control.md} / {tokens.size.control.lg}
                    </td>
                  </tr>
                </tbody>
              </table>
            </section>
          )}

          {page === "components" && (
            <>
              <section className="pg-section">
                <h2>Button — variants × sizes</h2>
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
              </section>

              <section className="pg-section">
                <h2>Component status</h2>
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
                    {registry.map((entry) => (
                      <tr key={entry.name}>
                        <td>{entry.title}</td>
                        <td>{entry.family}</td>
                        <td>
                          <StatusPill artifact={entry.status.css} />
                        </td>
                        <td>
                          <StatusPill artifact={entry.status.react} />
                        </td>
                        <td>
                          <StatusPill artifact={entry.status.figma} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
