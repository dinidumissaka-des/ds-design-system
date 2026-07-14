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

function StatusPill({ artifact }: { artifact?: { state: string; version?: string } }) {
  const state = artifact?.state ?? "tbd";
  return (
    <span className={`pg-status pg-status--${state}`}>
      {state}
      {artifact?.version ? ` · ${artifact.version}` : ""}
    </span>
  );
}

export function App() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <div className="pg-shell">
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

      <section className="pg-section">
        <h2>Button — variants × sizes</h2>
        {sizes.map((size) => (
          <div className="pg-row" key={size}>
            <span className="pg-row-label">{size}</span>
            {variants.map((variant) => (
              <Button key={variant} variant={variant} size={size}>
                {variant[0].toUpperCase() + variant.slice(1)}
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
        <h2>Accent scale (from @ds/tokens)</h2>
        <div className="pg-swatches">
          {Object.entries(tokens.color.accent).map(([step, hex]) => (
            <div key={step}>
              <div className="pg-swatch" style={{ background: hex }} />
              <div className="pg-swatch-name">
                {step} · {hex}
              </div>
            </div>
          ))}
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
    </div>
  );
}
