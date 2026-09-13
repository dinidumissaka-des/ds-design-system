import { describe, expect, test, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Star } from "@rata/icons";
import { Button } from "./button.js";
import { TopNav } from "./top-nav.js";

afterEach(cleanup);

const ITEMS = [
  { label: "Invoices", href: "/invoices", current: true },
  { label: "Clients", href: "/clients" },
  { label: "Reports", href: "/reports" },
];

describe("TopNav", () => {
  test("is the page's banner, with a named nav landmark inside it", () => {
    render(<TopNav items={ITEMS} />);
    const banner = screen.getByRole("banner");
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(banner.contains(nav)).toBe(true);
    // The banner itself is unnamed: a page has one.
    expect(banner.getAttribute("aria-label")).toBeNull();
  });

  test("label renames the nav, for a page with a side nav too", () => {
    render(<TopNav items={ITEMS} label="Sections" />);
    expect(screen.getByRole("navigation", { name: "Sections" })).toBeTruthy();
  });

  test("destinations are a list of links, in order", () => {
    render(<TopNav items={ITEMS} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getAllByRole("link").map((l) => l.textContent)).toEqual([
      "Invoices",
      "Clients",
      "Reports",
    ]);
  });

  test("the current page is announced, not only coloured", () => {
    render(<TopNav items={ITEMS} />);
    expect(screen.getByRole("link", { name: "Invoices" }).getAttribute("aria-current")).toBe(
      "page"
    );
    for (const name of ["Clients", "Reports"]) {
      expect(screen.getByRole("link", { name }).getAttribute("aria-current")).toBeNull();
    }
  });

  test("nothing is current when nothing says it is", () => {
    render(<TopNav items={[{ label: "Clients", href: "/clients" }]} />);
    expect(screen.getByRole("link", { name: "Clients" }).getAttribute("aria-current")).toBeNull();
  });

  test("every link is its own tab stop — a nav is not a menubar", () => {
    render(<TopNav items={ITEMS} />);
    // Roving tabindex would promise arrow-key navigation this does not have.
    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("tabindex")).toBeNull();
    }
  });

  test("brand and actions sit OUTSIDE the nav landmark", () => {
    render(
      <TopNav
        items={ITEMS}
        brand={<a href="/">Ratā</a>}
        actions={<Button>New invoice</Button>}
      />
    );
    const nav = screen.getByRole("navigation");
    // A logo is not a destination even when it links home, and an account
    // menu is not one at all.
    expect(nav.contains(screen.getByRole("link", { name: "Ratā" }))).toBe(false);
    expect(nav.contains(screen.getByRole("button", { name: "New invoice" }))).toBe(false);
    // Both are still in the banner.
    const banner = screen.getByRole("banner");
    expect(banner.contains(screen.getByRole("button", { name: "New invoice" }))).toBe(true);
  });

  test("no brand or actions renders no empty slots", () => {
    const { container } = render(<TopNav items={ITEMS} />);
    expect(container.querySelector(".rata-top-nav-brand")).toBeNull();
    expect(container.querySelector(".rata-top-nav-actions")).toBeNull();
  });

  test("an item's icon is decorative — the label is the link text", () => {
    const { container } = render(
      <TopNav items={[{ label: "Starred", href: "/starred", icon: Star }]} />
    );
    expect(screen.getByRole("link", { name: "Starred" })).toBeTruthy();
    expect(container.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
  });

  test("passes the rest through, so the banner can be identified or made sticky", () => {
    render(<TopNav items={ITEMS} id="banner" data-testid="b" />);
    const banner = screen.getByRole("banner");
    expect(banner.id).toBe("banner");
    expect(banner.getAttribute("data-testid")).toBe("b");
  });
});
