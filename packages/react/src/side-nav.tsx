import { useId } from "react";
import type { HTMLAttributes } from "react";
import { Icon } from "@rata/icons";
import type { LucideIcon } from "@rata/icons";
import { cx } from "./cx.js";

export interface SideNavItem {
  label: string;
  href: string;
  /**
   * Whether this is the page you are on. Stated rather than matched from a
   * path, for the reason `TopNav` states it: only the caller knows whether
   * /invoices/123 counts as being on /invoices.
   */
  current?: boolean;
  icon?: LucideIcon;
}

export interface SideNavSection {
  /** Names the group. Omitted for a flat nav — see the component's note. */
  label?: string;
  items: SideNavItem[];
}

export interface SideNavProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  /** The destinations, grouped. One unlabelled section is a flat nav. */
  sections: SideNavSection[];
  /** Accessible name for the navigation landmark. */
  label?: string;
  className?: string;
}

/**
 * A vertical navigation rail, grouped into named sections.
 *
 * SECTIONS ARE THE ONLY SHAPE, even for a flat list. A side nav exists
 * because there are enough destinations to group; a flat one is the special
 * case. Offering both `items` and `sections` would mean two mutually
 * exclusive props and a rule about which wins — so a flat nav is one
 * unlabelled section, which costs a pair of braces and removes the ambiguity.
 *
 * A SECTION'S LABEL NAMES ITS LIST rather than being a heading. Same reasoning
 * as Notice's title: a nav cannot know what heading level it sits under, and a
 * wrong one breaks heading navigation for the whole page. The label is a plain
 * element with an id and the list points at it with `aria-labelledby`, so the
 * group is announced with its name while the document outline is untouched.
 *
 * Unlike `TopNav` this claims no page-level landmark beyond the nav itself.
 * Where the rail sits, how wide it is, and whether it sticks are the page's
 * decisions, which is also why it draws no background of its own.
 *
 * No primitive: every link is its own tab stop, which is what navigation
 * should be.
 */
export function SideNav({
  sections,
  label = "Sections",
  className,
  ...rest
}: SideNavProps) {
  const base = useId();

  return (
    <nav {...rest} aria-label={label} className={cx("rata-side-nav", className)}>
      {sections.map((section, index) => {
        const labelId = section.label ? `${base}-${index}` : undefined;
        return (
          <div className="rata-side-nav-section" key={section.label ?? `section-${index}`}>
            {section.label && (
              <div className="rata-side-nav-section-label" id={labelId}>
                {section.label}
              </div>
            )}
            {/* Labelled by the element above when there is one, so the group is
                announced with its name — and a plain list when there is not,
                rather than a list pointing at nothing. */}
            <ul className="rata-side-nav-list" aria-labelledby={labelId}>
              {section.items.map((item) => (
                <li key={item.href}>
                  <a
                    className="rata-side-nav-link rata-state-layer rata-state-layer--flush"
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
          </div>
        );
      })}
    </nav>
  );
}
