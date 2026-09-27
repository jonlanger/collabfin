"use client";

import { useEffect, useState } from "react";

interface ToastMsg {
  msg: string;
  tag?: string;
}

/** Shows a short message at the bottom of the screen. Safe to call from anywhere in the browser. */
export function say(msg: string, tag?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ToastMsg>("cf-toast", { detail: { msg, tag } }));
}

/** Reports an error from the data store (their messages are already written for people). */
export function sayError(e: unknown) {
  say(e instanceof Error && e.message ? e.message : "Something went wrong. Try again in a moment.");
}

export function Toast() {
  const [msg, setMsg] = useState<ToastMsg | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const on = (e: Event) => {
      setMsg((e as CustomEvent<ToastMsg>).detail);
      clearTimeout(t);
      t = setTimeout(() => setMsg(null), 4200);
    };
    window.addEventListener("cf-toast", on);
    return () => {
      clearTimeout(t);
      window.removeEventListener("cf-toast", on);
    };
  }, []);
  return (
    <div className={msg ? "toast" : "sr"} role="status" aria-live="polite">
      {msg?.tag ? <span className="tag">{msg.tag}</span> : null}
      {msg ? <span>{msg.msg}</span> : null}
    </div>
  );
}
