import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BoardApp } from "@/components/board/BoardApp";

export const metadata: Metadata = { title: "Board" };

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOCAL_ID = /^[\w-]{6,64}$/;

export default async function BoardPage(props: PageProps<"/boards/[boardId]">) {
  const { boardId } = await props.params;
  const q = await props.searchParams;
  if (!ID.test(boardId) && !LOCAL_ID.test(boardId)) notFound();
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return <BoardApp boardId={boardId} initialPlanId={one(q.plan)} start={one(q.start)} />;
}
