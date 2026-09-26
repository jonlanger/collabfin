import { Home } from "@/components/home/Home";
import { getServerSupabase } from "@/lib/supabase/server";

export default async function HomePage() {
  const sb = await getServerSupabase();
  const signedIn = sb ? Boolean((await sb.auth.getClaims()).data?.claims?.sub) : true;
  return <Home signedIn={signedIn} />;
}
