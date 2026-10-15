import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto mt-24 max-w-md px-4 text-center">
      <p className="text-xs font-semibold tracking-widest text-muted uppercase">
        404
      </p>
      <h1 className="mt-2 text-lg font-semibold text-ink">Not found</h1>
      <p className="mt-2 text-xs text-muted">
        That ticket or article does not exist in this workspace.
      </p>
      <Link
        href="/inbox"
        className="mt-5 inline-flex h-9 items-center rounded-(--radius-control) bg-accent-600 px-4 text-sm font-medium text-white"
      >
        Back to the inbox
      </Link>
    </main>
  );
}
