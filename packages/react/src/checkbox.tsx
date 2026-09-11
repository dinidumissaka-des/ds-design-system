import { forwardRef, useEffect, useId, useRef, useState } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { getCheckboxProps } from "@ds/primitives";
import { cx } from "./cx.js";

export interface CheckboxProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "disabled" | "required" | "id" | "checked" | "defaultChecked" | "onChange" | "type"
  > {
  /** The checkbox's label. Always required. */
  label: ReactNode;
  /** Whether the box is checked. Makes the component controlled. */
  checked?: boolean;
  /** Starting state for an uncontrolled checkbox. Conflicts with `checked`. */
  defaultChecked?: boolean;
  /** Called with the state the box should move to, not the one it is leaving. */
  onCheckedChange?: (checked: boolean, event: { preventDefault(): void }) => void;
  /** A parent summarising children that disagree. Outranks `checked`. */
  indeterminate?: boolean;
  /** Helper text under the label. */
  description?: ReactNode;
  /** Stable id for the input. Defaults to a generated one. */
  id?: string;
  /** Blocks activation while keeping the box focusable and announced. */
  disabled?: boolean;
  /** Marks the checkbox as required. */
  required?: boolean;
  className?: string;
}

/**
 * A single on/off choice, with a third appearance for a parent summarising its
 * children.
 *
 * The native input is laid over the drawn box at zero opacity rather than
 * hidden: `display: none` would take it out of the tab order and the
 * accessibility tree along with the pixels. It stays a real form control; the
 * box is only paint, which is why the box is `aria-hidden`.
 *
 * `indeterminate` is assigned to the element as a DOM property, because HTML
 * has no such attribute — it cannot be written in JSX, and that is the whole
 * reason this is a component rather than a styled input.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  {
    label,
    checked,
    defaultChecked,
    onCheckedChange,
    indeterminate = false,
    description,
    id,
    disabled,
    required,
    className,
    "aria-describedby": describedBy,
    ...rest
  },
  ref
) {
  const generated = useId();
  const fieldId = id ?? generated;

  // Controlled is the honest default, as everywhere else in this system.
  // `defaultChecked` is the uncontrolled escape hatch and the contract makes
  // passing both a conflict, so `checked` simply wins.
  const isControlled = checked !== undefined;
  const [uncontrolled, setUncontrolled] = useState(defaultChecked ?? false);
  const current = isControlled ? checked : uncontrolled;

  const field = getCheckboxProps({
    id: fieldId,
    checked: current,
    indeterminate,
    disabled,
    required,
    hasDescription: description !== undefined && description !== "",
    describedBy,
    onCheckedChange: (next, event) => {
      if (!isControlled) setUncontrolled(next);
      onCheckedChange?.(next, event);
    },
  });

  // The one thing JSX cannot express. Kept in an effect so it is re-applied
  // whenever the value changes, not only on mount.
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = field.indeterminate;
  }, [field.indeterminate]);

  return (
    <div className={cx("ds-checkbox", className)} {...field.root}>
      <span className="ds-checkbox-control">
        <input
          {...rest}
          {...field.input}
          className="ds-checkbox-input"
          ref={(node) => {
            inputRef.current = node;
            if (typeof ref === "function") ref(node);
            else if (ref) ref.current = node;
          }}
        />
        {/* Paint only: the input beside it carries every semantic. */}
        <span className="ds-checkbox-box" aria-hidden="true">
          {indeterminate ? <IndeterminateMark /> : current ? <CheckMark /> : null}
        </span>
      </span>

      <span className="ds-checkbox-text">
        <label className="ds-checkbox-label" {...field.label}>
          {label}
          {required && (
            <span className="ds-checkbox-required" aria-hidden="true">
              {" *"}
            </span>
          )}
        </label>
        {description !== undefined && description !== "" && (
          <span className="ds-checkbox-description" {...field.description}>
            {description}
          </span>
        )}
      </span>
    </div>
  );
});

/** Inline rather than from @ds/icons: @ds/react must not depend on the icon set. */
function CheckMark() {
  return (
    <svg className="ds-checkbox-mark" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3.5 8.5l3 3 6-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A bar, not a tick: the state is "partly checked", and the shape says so. */
function IndeterminateMark() {
  return (
    <svg className="ds-checkbox-mark" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 8h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
