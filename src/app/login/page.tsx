import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";
import { isCloudConfigured, safeNext } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const q = await props.searchParams;
  const next = safeNext(typeof q.next === "string" ? q.next : null);
  const failed = q.error === "link";
  return (
    <main className="page-center">
      <div className="page-card">
        <Link className="page-logo" href="/">
          Collabfin
        </Link>
        <h1>Sign in to plan together</h1>
        {isCloudConfigured ? (
          <>
            <p>We’ll email you a link to sign in. No password needed. New here? The same link creates your account.</p>
            {failed ? <p role="alert">That sign-in link didn’t work, or it expired. Enter your email to get a new one.</p> : null}
            <LoginForm next={next} />
          </>
        ) : (
          <>
            <p>Accounts aren’t set up on this copy of Collabfin yet, so your boards are saved in this browser.</p>
            <Link className="cta" href="/boards">
              Open your boards
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
