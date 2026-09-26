import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page-center">
      <div className="page-card">
        <h1>That page doesn’t exist</h1>
        <p>The link may be out of date. Your boards are still where you left them.</p>
        <Link className="cta" href="/boards">
          Go to your boards
        </Link>
      </div>
    </main>
  );
}
