import { describe, expect, it, vi } from "vitest";
import { getButtonProps } from "./button.js";

const clickEvent = () => ({ preventDefault: vi.fn() });

describe("getButtonProps", () => {
  it("activates on click when enabled", () => {
    const onActivate = vi.fn();
    const props = getButtonProps({ onActivate });
    const event = clickEvent();
    props.onClick(event);
    expect(onActivate).toHaveBeenCalledOnce();
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(props["aria-disabled"]).toBeUndefined();
    expect(props["aria-busy"]).toBeUndefined();
  });

  it("blocks activation and exposes aria-disabled when disabled", () => {
    const onActivate = vi.fn();
    const props = getButtonProps({ disabled: true, onActivate });
    const event = clickEvent();
    props.onClick(event);
    expect(onActivate).not.toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(props["aria-disabled"]).toBe(true);
  });

  it("blocks activation and exposes aria-busy while loading", () => {
    const onActivate = vi.fn();
    const props = getButtonProps({ loading: true, onActivate });
    props.onClick(clickEvent());
    expect(onActivate).not.toHaveBeenCalled();
    expect(props["aria-busy"]).toBe(true);
    expect(props["data-loading"]).toBe("");
  });
});
