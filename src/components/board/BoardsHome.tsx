"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DEFAULT_SETTINGS } from "@/lib/engine";
import { getStore, type BoardSummary } from "@/lib/data";
import { Icon } from "@/components/ui/Icon";
import { sayError } from "@/components/ui/toast";
import { NewBoardForm, type BoardStart } from "./BoardsDrawer";
import { ago } from "./people";

export function BoardsHome({ openNew }: { openNew: boolean }) {
  const router = useRouter();
  const store = useMemo(() => getStore(), []);
  const [boards, setBoards] = useState<BoardSummary[] | null>(null);
  const [creating, setCreating] = useState(openNew);
  useEffect(() => {
    store.listBoards().then(setBoards, (e) => {
      sayError(e);
      setBoards([]);
    });
  }, [store]);
  const create = async (name: string, start: BoardStart) => {
    try {
      const { boardId } = await store.createBoard(name, DEFAULT_SETTINGS);
      router.push(`/boards/${boardId}${start !== "blank" ? `?start=${encodeURIComponent(start)}` : ""}`);
    } catch (e) {
      sayError(e);
    }
  };
  const first = boards !== null && boards.length === 0;
  return (
    <div className="boards-page">
      <header className="boards-head">
        <Link className="page-logo" href="/">
          Collabfin
        </Link>
        <span className="spacer" />
        {store.mode === "cloud" ? (
          <form action="/auth/signout" method="post">
            <button className="btn-sm" type="submit">
              <Icon n="logout" s={16} />
              Sign out
            </button>
          </form>
        ) : null}
      </header>
      <main className="boards-main">
        <h1>{first ? "Start your first board." : "Your boards"}</h1>
        {store.mode === "local" ? <p className="muted">Accounts aren’t set up, so boards are saved in this browser. Connect Supabase to share boards and plan together live.</p> : null}
        {creating || first ? (
          <div className="new-tile">
            <NewBoardForm existing={(boards ?? []).map((b) => b.name)} onCreate={create} onCancel={first ? undefined : () => setCreating(false)} />
          </div>
        ) : (
          <button className="cta" style={{ alignSelf: "flex-start" }} onClick={() => setCreating(true)}>
            <Icon n="plus" s={20} />
            New board
          </button>
        )}
        {boards === null ? <p className="muted">Loading your boards…</p> : null}
        {boards?.length ? (
          <div className="boards-grid">
            {boards.map((b) => (
              <Link key={b.id} className="board-tile" href={`/boards/${b.id}`}>
                <span className="b-ico">
                  <Icon n="grid" s={18} />
                </span>
                <b>{b.name}</b>
                <small>
                  Updated {ago(b.updatedAt)}
                  {b.role !== "owner" ? ` · ${b.role === "editor" ? "Can edit" : "View only"}` : ""}
                </small>
              </Link>
            ))}
          </div>
        ) : null}
      </main>
    </div>
  );
}
