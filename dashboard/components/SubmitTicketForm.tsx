"use client";

import { useState, type FormEvent } from "react";

export function SubmitTicketForm() {
  const [message, setMessage] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const webhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;
    if (!webhookUrl) {
      setLoading(false);
      setError("Webhook URL is not configured.");
      return;
    }

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket_message: message,
          customer_email: customerEmail,
        }),
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      setSubmitted(true);
      setMessage("");
      setCustomerEmail("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to submit ticket.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
          Support
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
          Ticket submitted
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Thanks — we received your message. Our team will review it shortly.
        </p>
        <button
          type="button"
          onClick={() => setSubmitted(false)}
          className="mt-6 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
        >
          Submit another
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm"
    >
      <div className="mb-8">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
          Support
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
          Ask a question or book
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Send a question or booking request — we will reply from our knowledge
          base, connect you with staff, or check calendar availability.
        </p>
      </div>

      <div className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-zinc-800">Email</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={customerEmail}
            onChange={(event) => setCustomerEmail(event.target.value)}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-zinc-800">Message</span>
          <textarea
            required
            rows={6}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm leading-6 outline-none focus:border-zinc-400"
            placeholder="e.g. What are your hours? or Book me Thursday at 14:00"
          />
        </label>
      </div>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="mt-6 w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Submitting…" : "Submit ticket"}
      </button>
    </form>
  );
}
