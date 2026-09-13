import type { HTMLAttributes, ReactNode } from "react";
import { Icon } from "@rata/icons";
import type { LucideIcon } from "@rata/icons";
import { cx } from "./cx.js";

export interface TopNavItem {
  label: string;
  href: string;
  /**
   * Whether this is the page you are on.
   *
   * Stated rather than matched from a path, because only the caller knows
   * whether /invoices/123 counts as being on /invoices. A `currentHref` prop
   * would have to guess between exact and prefix matching and would be
   * silently wrong for someone either way.
   */
  current?: boolean;
  icon?: LucideIcon;
}

export interface TopNavProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  /** The primary destinations, in the order they are read. */
  items: TopNavItem[];
  /** Accessible name for the navigation landmark. */
  label?: string;
  /** The product's mark, at the start of the bar. */
  brand?: ReactNode;
  /** Controls at the end of the bar — search, account, notifications. */
  actions?: ReactNode;
  className?: string;
}

/**
 * The page's banner: a brand, the primary navigation, and room for actions.
 *
 * IT RENDERS THE `<header>`, which makes it the banner landmark. A top nav is
 * that bar — brand, navigation and actions together — and pretending otherwise
 * would mean emitting a bare `<nav>` with a logo and an account menu inside
 * it, neither of which is navigation. The consequence is a real constraint
 * rather than a detail: one per page, and not nested inside a `<header>` you
 * already have.
 *
 * Inside it, only the destinations are in the `<nav>`. `brand` and `actions`
 * sit outside that landmark deliberately — a logo is not a destination even
 * when it links home, and an account menu is not one at all. Anything in
 * `items` is announced as part of a list of places and rendered as a link, so
 * an action put there would be announced as a place and navigate nowhere.
 *
 * No primitive: there is no keyboard interaction to own. Each link is its own
 * tab stop, which is what navigation should be — roving tabindex belongs to a
 * menubar, and using it here would promise arrow-key behaviour a nav does not
 * have.
 */
export function TopNav({
  items,
  label = "Main",
  brand,
  actions,
  className,
  ...rest
}: TopNavProps) {
  return (
    <header {...rest} className={cx("rata-top-nav", className)}>
      {brand !== undefined && brand !== null && (
        <div className="rata-top-nav-brand">{brand}</div>
      )}

      {/* Named, because a page with a side nav as well has two navigation
          landmarks and they are indistinguishable in a landmark list
          otherwise. The banner itself is unnamed: a page has one. */}
      <nav className="rata-top-nav-nav" aria-label={label}>
        <ul className="rata-top-nav-list">
          {items.map((item) => (
            <li className="rata-top-nav-item" key={item.href}>
              <a
                className="rata-top-nav-link rata-state-layer rata-state-layer--flush"
                href={item.href}
                // Both the marker in the CSS and this attribute, so the
                // current page is never carried by colour alone.
                aria-current={item.current ? "page" : undefined}
              >
                {item.icon && <Icon icon={item.icon} />}
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {actions !== undefined && actions !== null && (
        <div className="rata-top-nav-actions">{actions}</div>
      )}
    </header>
  );
}
