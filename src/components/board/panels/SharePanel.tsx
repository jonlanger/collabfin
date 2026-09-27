"use client";

import { useState } from "react";
import type { Role, Store } from "@/lib/data";
import { Icon } from "@/components/ui/Icon";
import { Segmented } from "@/components/ui/inputs";
import { Panel } from "@/components/ui/Panel";
import { sayError } from "@/components/ui/toast";

export function SharePanel({ store, boardId, boardName, role, onClose }: { store: Store; boardId: string; boardName: string; role: Role; onClose: () => void }) {
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const canInvite = role !== "viewer";
  const create = async () => {
    setBusy(true);
    setCopied(false);
    try {
      const token = await store.createInvite(boardId, inviteRole);
      setLink(`${window.location.origin}/invite/${token}`);
    } catch (e) {
      sayError(e);
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      document.getElementById("invite-link")?.focus();
    }
  };
  return (
    <Panel title="Share" sub={`Invite people to “${boardName}”. They sign in with their email and join straight away.`} onClose={onClose}>
      {store.mode === "local" ? (
        <p className="muted">This board is saved in this browser only. Sharing needs accounts, which are turned on when the app is connected to Supabase.</p>
      ) : !canInvite ? (
        <p className="muted">You can view this board. Ask an editor or the owner to invite others.</p>
      ) : (
        <>
          <section className="group">
            <div className="eyebrow">They can</div>
            <Segmented
              label="Invite role"
              value={inviteRole}
              onChange={(v) => {
                setInviteRole(v);
                setLink(null);
              }}
              options={[
                ["editor", "Edit"],
                ["viewer", "View only"],
              ]}
            />
          </section>
          <button className="cta" style={{ height: 48, alignSelf: "flex-start" }} disabled={busy} onClick={create}>
            <Icon n="link" s={20} />
            {busy ? "Creating link…" : link ? "Create a new link" : "Create invite link"}
          </button>
          {link ? (
            <section className="group">
              <label className="eyebrow" htmlFor="invite-link">
                Invite link
              </label>
              <input id="invite-link" className="text-in" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
              <button className="btn-sm primary" style={{ alignSelf: "flex-start" }} onClick={copy}>
                <Icon n={copied ? "check" : "copy"} s={16} />
                {copied ? "Copied" : "Copy link"}
              </button>
              <p className="muted">Anyone with this link can join as {inviteRole === "editor" ? "an editor" : "a viewer"} for the next 14 days. Only share it with people you trust.</p>
            </section>
          ) : null}
        </>
      )}
    </Panel>
  );
}
