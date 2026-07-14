/**
 * Headless button behavior.
 *
 * Pure function (no framework hooks) so it is trivially testable and portable
 * to non-React wrappers later. Uses aria-disabled rather than the native
 * disabled attribute: the control stays focusable and discoverable by screen
 * readers, while activation is blocked in the click guard.
 */
export interface ButtonOptions {
  disabled?: boolean;
  loading?: boolean;
  onActivate?: (event: { preventDefault(): void }) => void;
}

export interface ButtonProps {
  type: "button";
  "aria-disabled": true | undefined;
  "aria-busy": true | undefined;
  "data-loading": "" | undefined;
  onClick: (event: { preventDefault(): void }) => void;
}

export function getButtonProps(options: ButtonOptions = {}): ButtonProps {
  const { disabled = false, loading = false, onActivate } = options;
  const inert = disabled || loading;

  return {
    type: "button",
    "aria-disabled": inert || undefined,
    "aria-busy": loading || undefined,
    "data-loading": loading ? "" : undefined,
    onClick: (event) => {
      if (inert) {
        event.preventDefault();
        return;
      }
      onActivate?.(event);
    },
  };
}
