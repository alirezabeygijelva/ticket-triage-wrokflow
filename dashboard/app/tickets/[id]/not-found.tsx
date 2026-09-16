import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold text-zinc-900">Ticket not found</h1>
      <p className="text-sm text-zinc-600">
        It may have been deleted, or the ID is invalid.
      </p>
      <Link
        href="/"
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
      >
        Back to inbox
      </Link>
    </main>
  );
}
