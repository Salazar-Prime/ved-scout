"use client";

import { type ReactNode } from "react";

/* ------------------------------------------------------------------ */
/*  Public types                                                       */
/* ------------------------------------------------------------------ */

export interface ListItem {
  id: string;
  /** Primary text shown on the left */
  title: string;
  /** Optional secondary line below the title */
  subtitle?: string;
  /** Optional icon / avatar rendered before the text */
  leading?: ReactNode;
  /** Optional element rendered on the right (badge, button, etc.) */
  trailing?: ReactNode;
  /** Fires when the row is clicked */
  onClick?: () => void;
}

export interface ScrollableListProps {
  /** Items to render */
  items: ListItem[];
  /** Shown when `items` is empty */
  emptyMessage?: string;
  /** Optional header rendered above the list (sticky) */
  header?: ReactNode;
  /** Optional footer rendered below the list (sticky) */
  footer?: ReactNode;
  /** Extra Tailwind classes on the outermost wrapper */
  className?: string;
  /** Completely override how each row is rendered */
  renderItem?: (item: ListItem, index: number) => ReactNode;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ScrollableList({
  items,
  emptyMessage = "Nothing to show",
  header,
  footer,
  className = "",
  renderItem,
}: ScrollableListProps) {
  return (
    <div className={`flex flex-col h-full overflow-hidden ${className}`}>
      {/* ---- sticky header ---- */}
      {header && (
        <div className="shrink-0 px-3 py-2 border-b border-zinc-800">
          {header}
        </div>
      )}

      {/* ---- scrollable body ---- */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
        {items.length === 0 ? (
          <div className="flex items-center justify-center h-full text-zinc-500 text-sm py-8">
            {emptyMessage}
          </div>
        ) : (
          <ul className="divide-y divide-zinc-800/60">
            {items.map((item, index) => (
              <li key={item.id}>
                {renderItem ? (
                  renderItem(item, index)
                ) : (
                  <DefaultRow item={item} />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ---- sticky footer ---- */}
      {footer && (
        <div className="shrink-0 px-3 py-2 border-t border-zinc-800">
          {footer}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Default row renderer                                               */
/* ------------------------------------------------------------------ */

function DefaultRow({ item }: { item: ListItem }) {
  const Wrapper = item.onClick ? "button" : "div";

  return (
    <Wrapper
      {...(item.onClick ? { onClick: item.onClick } : {})}
      className={`flex items-center gap-3 w-full px-3 py-2.5 text-left transition-colors ${
        item.onClick
          ? "hover:bg-zinc-800/60 active:bg-zinc-800 cursor-pointer"
          : ""
      }`}
    >
      {/* leading icon / avatar */}
      {item.leading && (
        <span className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-800 text-zinc-400">
          {item.leading}
        </span>
      )}

      {/* text block */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-200 truncate">
          {item.title}
        </p>
        {item.subtitle && (
          <p className="text-xs text-zinc-500 truncate mt-0.5">
            {item.subtitle}
          </p>
        )}
      </div>

      {/* trailing element */}
      {item.trailing && (
        <span className="shrink-0 text-zinc-400">{item.trailing}</span>
      )}
    </Wrapper>
  );
}
