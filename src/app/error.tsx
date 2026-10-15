"use client";

import { useEffect } from "react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[supportflow] unhandled error", error);
  }, [error]);

  return (
    <main className="mx-auto mt-24 max-w-md px-4 text-center">
      <h1 className="text-base font-semibold text-ink">
        This view failed to render
      </h1>
      <p className="mt-2 text-xs text-muted">
        {error.message || "An unexpected error occurred."}
      </p>
      {error.digest ? (
        <p className="mt-1 font-mono text-xs text-subtle">
          Reference: {error.digest}
        </p>
      ) : null}
      <button
        type="button"
        onClick={reset}
        className="mt-5 inline-flex h-9 items-center rounded-(--radius-control) bg-accent-600 px-4 text-sm font-medium text-white"
      >
        Try again
      </button>
    </main>
  );
}
