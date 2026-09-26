import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Join a board" };

export default async function InvitePage(props: PageProps<"/invite/[token]">) {
  const { token } = await props.params;
  const sb = await getServerSupabase();
  let message = "Invites need accounts, which aren’t set up on this copy of Collabfin.";
  if (sb && /^[0-9a-f]{16,128}$/i.test(token)) {
    const { data, error } = await sb.rpc("accept_invite", { p_token: token });
    if (!error && data) redirect(`/boards/${data}`);
    message = error?.code === "P0002" ? "This invite link has expired or doesn’t exist. Ask for a new one." : "The invite couldn’t be accepted. Try the link again in a moment.";
  } else if (sb) {
    message = "This invite link isn’t valid. Check you copied all of it.";
  }
  return (
    <main className="page-center">
      <div className="page-card">
        <h1>Couldn’t join the board</h1>
        <p role="alert">{message}</p>
        <Link className="cta" href="/boards">
          Go to your boards
        </Link>
      </div>
    </main>
  );
}
