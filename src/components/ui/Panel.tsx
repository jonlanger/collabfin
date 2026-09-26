"use client";

import { useEffect, useEffectEvent, type ReactNode } from "react";
import { Icon } from "./Icon";

/** A side panel on desktop and a bottom sheet on phones. */
export function Panel({ title, sub, onClose, wide, children }: { title: string; sub?: string; onClose: () => void; wide?: boolean; children: ReactNode }) {
  const onEscape = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  });
  useEffect(() => {
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, []);
  return (
    <>
      <div className="scrim phone-only" onClick={onClose} />
      <aside className={`panel${wide ? " wide" : ""}`} role="dialog" aria-label={title}>
        <div className="grab" />
        <div className="panel-head">
          <div style={{ flex: 1 }}>
            <h2>{title}</h2>
            {sub ? <p>{sub}</p> : null}
          </div>
          <button className="close" aria-label={`Close ${title}`} onClick={onClose}>
            <Icon n="x" />
          </button>
        </div>
        <div className="panel-body">{children}</div>
      </aside>
    </>
  );
}
