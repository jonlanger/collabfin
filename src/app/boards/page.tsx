import type { Metadata } from "next";
import { BoardsHome } from "@/components/board/BoardsHome";

export const metadata: Metadata = { title: "Your boards" };

export default async function BoardsPage(props: PageProps<"/boards">) {
  const q = await props.searchParams;
  return <BoardsHome openNew={q.new === "1"} />;
}
