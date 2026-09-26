"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="page-center">
      <div className="page-card">
        <h1>Something went wrong</h1>
        <p>Your saved work is safe. Try again, and if it keeps happening, reload the page.</p>
        <button className="cta" onClick={reset}>
          Try again
        </button>
        <Link className="btn2" href="/boards">
          Go to your boards
        </Link>
      </div>
    </main>
  );
}
