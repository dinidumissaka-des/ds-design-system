import { describe, expect, test, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Star } from "@rata/icons";
import { SideNav } from "./side-nav.js";

afterEach(cleanup);

const GROUPED = [
  {
    label: "Billing",
    items: [
      { label: "Invoices", href: "/invoices", current: true },
      { label: "Credit notes", href: "/credit-notes" },
    ],
  },
  { label: "Setup", items: [{ label: "Tax rates", href: "/tax" }] },
];

describe("SideNav", () => {
  test("is a named navigation landmark, and nothing more", () => {
    render(<SideNav label="Invoices" sections={GROUPED} />);
    expect(screen.getByRole("navigation", { name: "Invoices" })).toBeTruthy();
    // Unlike TopNav it claims no banner: where the rail sits is the page's call.
    expect(screen.queryByRole("banner")).toBeNull();
  });

  test("each section is a list named by its own label", () => {
    render(<SideNav sections={GROUPED} />);
    // A group announced with its name, without a heading — a nav cannot know
    // what heading level it sits under.
    expect(screen.getByRole("list", { name: "Billing" })).toBeTruthy();
    expect(screen.getByRole("list", { name: "Setup" })).toBeTruthy();
    expect(screen.queryByRole("heading")).toBeNull();
  });

  test("an unlabelled section is a plain list, not one pointing at nothing", () => {
    const { container } = render(
      <SideNav sections={[{ items: [{ label: "Profile", href: "/profile" }] }]} />
    );
    const list = screen.getByRole("list");
    expect(list.getAttribute("aria-labelledby")).toBeNull();
    expect(container.querySelector(".rata-side-nav-section-label")).toBeNull();
  });

  test("the current page is announced, not only tinted", () => {
    render(<SideNav sections={GROUPED} />);
    expect(screen.getByRole("link", { name: "Invoices" }).getAttribute("aria-current")).toBe(
      "page"
    );
    expect(
      screen.getByRole("link", { name: "Credit notes" }).getAttribute("aria-current")
    ).toBeNull();
  });

  test("every destination is a link, in order, across sections", () => {
    render(<SideNav sections={GROUPED} />);
    expect(screen.getAllByRole("link").map((l) => l.textContent)).toEqual([
      "Invoices",
      "Credit notes",
      "Tax rates",
    ]);
  });

  test("every link is its own tab stop — a nav is not a menubar", () => {
    render(<SideNav sections={GROUPED} />);
    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("tabindex")).toBeNull();
    }
  });

  test("two sections with the same label still get distinct list names", () => {
    // The ids are generated per section index, so a repeated label cannot make
    // two lists point at one element.
    render(
      <SideNav
        sections={[
          { label: "Group", items: [{ label: "A", href: "/a" }] },
          { label: "Group", items: [{ label: "B", href: "/b" }] },
        ]}
      />
    );
    const ids = screen.getAllByRole("list").map((l) => l.getAttribute("aria-labelledby"));
    expect(ids[0]).toBeTruthy();
    expect(ids[0]).not.toBe(ids[1]);
  });

  test("an item's icon is decorative — the label is the link text", () => {
    const { container } = render(
      <SideNav sections={[{ items: [{ label: "Starred", href: "/starred", icon: Star }] }]} />
    );
    expect(screen.getByRole("link", { name: "Starred" })).toBeTruthy();
    expect(container.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
  });

  test("passes the rest through, so the rail can be sized or identified", () => {
    render(<SideNav sections={GROUPED} id="rail" data-testid="r" />);
    const nav = screen.getByRole("navigation");
    expect(nav.id).toBe("rail");
    expect(nav.getAttribute("data-testid")).toBe("r");
  });
});
