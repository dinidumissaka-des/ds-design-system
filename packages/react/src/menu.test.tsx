import { describe, expect, test, vi, afterEach, beforeAll } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Trash2 } from "@rata/icons";
import { Button } from "./button.js";
import { Menu, MenuItem, MenuSeparator } from "./menu.js";

/**
 * jsdom has no popover support at all — `showPopover` is undefined in jsdom 30
 * — and its UA stylesheet still carries the spec's
 * `[popover]:not(:popover-open) { display: none }` rule. Since `:popover-open`
 * can never match there, a popover element is hidden unconditionally and
 * therefore absent from the accessibility tree, which is what Testing Library
 * queries.
 *
 * So the shim has to do three things: implement the state machine, make
 * `:popover-open` answerable through `matches()` (the component reads it to
 * avoid double-toggling), and lift the UA rule's `display: none` so the list
 * is actually in the tree.
 *
 * What this does NOT pretend to have is a top layer. Nothing asserted below
 * depends on where the list is painted — it is all ARIA, focus and handler
 * behaviour — and the placement that the real top layer and CSS anchor
 * positioning provide is exactly the part a DOM test cannot speak to.
 */
beforeAll(() => {
  const open = new WeakSet<Element>();
  const proto = HTMLElement.prototype as unknown as {
    showPopover(): void;
    hidePopover(): void;
    matches(s: string): boolean;
  };
  const matches = proto.matches;
  const toggle = (el: HTMLElement, newState: "open" | "closed") =>
    el.dispatchEvent(Object.assign(new Event("toggle"), { newState }));

  proto.showPopover = function () {
    const el = this as unknown as HTMLElement;
    if (open.has(el)) return;
    open.add(el);
    // Lifts the UA sheet's unconditional display:none, since :popover-open
    // cannot match in jsdom and the rule therefore never stops applying.
    el.style.display = "block";
    toggle(el, "open");
  };
  proto.hidePopover = function () {
    const el = this as unknown as HTMLElement;
    if (!open.has(el)) return;
    open.delete(el);
    el.style.removeProperty("display");
    toggle(el, "closed");
  };
  proto.matches = function (selector: string) {
    if (selector === ":popover-open") return open.has(this as unknown as Element);
    return matches.call(this, selector);
  };
});

afterEach(cleanup);

const Fixture = (props: Record<string, unknown> = {}) => (
  <Menu trigger={<Button>Actions</Button>} {...props}>
    <MenuItem onSelect={props.onDuplicate as () => void}>Duplicate</MenuItem>
    <MenuItem onSelect={props.onDownload as () => void}>Download</MenuItem>
    <MenuSeparator />
    <MenuItem destructive icon={Trash2} onSelect={props.onDelete as () => void}>
      Delete
    </MenuItem>
  </Menu>
);

describe("Menu", () => {
  test("the trigger declares the menu it owns and whether it is showing", async () => {
    render(<Fixture />);
    const trigger = screen.getByRole("button", { name: "Actions" });
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    await userEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(trigger.getAttribute("aria-controls")).toBe(
      screen.getByRole("menu").id
    );
  });

  test("the menu is named by its trigger, and its rows are menuitems", async () => {
    render(<Fixture />);
    await userEvent.click(screen.getByRole("button", { name: "Actions" }));
    expect(screen.getByRole("menu", { name: "Actions" })).toBeTruthy();
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent)).toEqual([
      "Duplicate",
      "Download",
      "Delete",
    ]);
  });

  test("label names the list instead, for a trigger that names only itself", async () => {
    render(<Fixture label="Row actions" />);
    await userEvent.click(screen.getByRole("button"));
    const menu = screen.getByRole("menu", { name: "Row actions" });
    // Never both — two names on one node is a 4.1.2 problem, not a fallback.
    expect(menu.getAttribute("aria-labelledby")).toBeNull();
  });

  test("opening moves real focus to the first row", async () => {
    render(<Fixture />);
    await userEvent.click(screen.getByRole("button", { name: "Actions" }));
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Duplicate" }));
  });

  test("ArrowUp on the trigger opens at the last row", async () => {
    render(<Fixture />);
    screen.getByRole("button", { name: "Actions" }).focus();
    await userEvent.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Delete" }));
  });

  test("arrow keys move real focus, wrapping, and skip the separator", async () => {
    render(<Fixture />);
    await userEvent.click(screen.getByRole("button", { name: "Actions" }));
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Download" }));
    // Past the separator, which is not a row and cannot hold focus.
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Delete" }));
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Duplicate" }));
  });

  test("typeahead jumps to a row by its first letter", async () => {
    render(<Fixture />);
    await userEvent.click(screen.getByRole("button", { name: "Actions" }));
    await userEvent.keyboard("de");
    // Single-character cycling: "d" walks the d-rows, then "e" finds none and
    // leaves focus alone. Documented, not a buffered prefix search.
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Download" }));
  });

  test("exactly one row is the tab stop", async () => {
    render(<Fixture />);
    await userEvent.click(screen.getByRole("button", { name: "Actions" }));
    expect(screen.getAllByRole("menuitem").map((i) => i.tabIndex)).toEqual([0, -1, -1]);
  });

  test("selecting returns focus to the trigger BEFORE the handler runs", async () => {
    // Recorded rather than asserted in place: an assertion that throws inside
    // a React event handler escapes as an unhandled error and leaves the test
    // reporting green. This exact test passed while its in-handler assertion
    // was failing, which is how the effect-ordering bug got found at all.
    let focusedWhenHandlerRan: Element | null = null;
    const onDownload = vi.fn(() => {
      focusedWhenHandlerRan = document.activeElement;
    });
    render(<Fixture onDownload={onDownload} />);
    const trigger = screen.getByRole("button", { name: "Actions" });
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole("menuitem", { name: "Download" }));

    expect(onDownload).toHaveBeenCalledOnce();
    // The ordering is load-bearing: a handler that opens a dialog and focuses
    // it must not have focus stolen back by the menu finishing its teardown.
    expect(focusedWhenHandlerRan).toBe(trigger);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  test("a handler that moves focus keeps it — the menu does not take it back", async () => {
    render(
      <>
        <Menu trigger={<Button>Actions</Button>}>
          <MenuItem onSelect={() => screen.getByRole("button", { name: "Elsewhere" }).focus()}>
            Duplicate
          </MenuItem>
        </Menu>
        <button type="button">Elsewhere</button>
      </>
    );
    await userEvent.click(screen.getByRole("button", { name: "Actions" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Duplicate" }));
    // This is what the synchronous restore buys: the handler gets the last word.
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Elsewhere" }));
  });

  test("Escape closes and hands focus back to the trigger", async () => {
    render(<Fixture />);
    const trigger = screen.getByRole("button", { name: "Actions" });
    await userEvent.click(trigger);
    await userEvent.keyboard("{Escape}");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
  });

  test("Tab closes without trapping focus — that is a dialog's job", async () => {
    render(
      <>
        <Fixture />
        <button type="button">After</button>
      </>
    );
    const trigger = screen.getByRole("button", { name: "Actions" });
    await userEvent.click(trigger);
    await userEvent.keyboard("{Tab}");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    // Focus was not yanked back to the trigger: the reader was leaving.
    expect(document.activeElement).not.toBe(trigger);
  });

  test("a disabled row is reachable and announced, but refuses to act", async () => {
    const onSelect = vi.fn();
    render(
      <Menu trigger={<Button>Actions</Button>}>
        <MenuItem>Duplicate</MenuItem>
        <MenuItem disabled onSelect={onSelect}>
          Delete
        </MenuItem>
      </Menu>
    );
    await userEvent.click(screen.getByRole("button", { name: "Actions" }));
    const del = screen.getByRole("menuitem", { name: "Delete" });
    expect(del.getAttribute("aria-disabled")).toBe("true");
    expect(del).toHaveProperty("disabled", false);

    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(del);

    await userEvent.click(del);
    expect(onSelect).not.toHaveBeenCalled();
    // And it did not close, because nothing happened.
    expect(screen.getByRole("menu")).toBeTruthy();
  });

  test("a menu whose first row is disabled opens onto the first usable one", async () => {
    render(
      <Menu trigger={<Button>Actions</Button>}>
        <MenuItem disabled>Duplicate</MenuItem>
        <MenuItem>Download</MenuItem>
      </Menu>
    );
    await userEvent.click(screen.getByRole("button", { name: "Actions" }));
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Download" }));
  });

  test("controlled: the caller owns open, and is told when it should change", async () => {
    const onOpenChange = vi.fn();
    render(<Fixture open={false} onOpenChange={onOpenChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Actions" }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    // Still closed, because the caller did not change it.
    expect(screen.getByRole("button", { name: "Actions" }).getAttribute("aria-expanded")).toBe(
      "false"
    );
  });

  test("the separator is a separator, not a row", async () => {
    render(<Fixture />);
    await userEvent.click(screen.getByRole("button", { name: "Actions" }));
    expect(screen.getByRole("separator")).toBeTruthy();
  });

  test("MenuItem throws outside a Menu rather than rendering a dead button", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<MenuItem>Orphan</MenuItem>)).toThrow(/must be rendered inside a <Menu>/);
    spy.mockRestore();
  });

  test("a row whose children are not a string needs a value, and says so", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(
        <Menu trigger={<Button>Actions</Button>}>
          <MenuItem>
            <span>Complex</span>
          </MenuItem>
        </Menu>
      )
    ).toThrow(/needs a `value`/);
    spy.mockRestore();
  });
});
