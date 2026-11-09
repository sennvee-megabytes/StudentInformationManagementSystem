"use client";

import { useState } from "react";
import { Check, Copy, KeyRound, ShieldAlert } from "lucide-react";

export function TempPasswordDialog({
  title,
  username,
  temporaryPassword,
  onClose,
}: {
  title: string;
  username: string;
  temporaryPassword: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  async function copyPassword() {
    await navigator.clipboard.writeText(temporaryPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="temp-password-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center gap-2.5 text-emerald-700">
          <KeyRound className="h-5 w-5" />
          <h2 id="temp-password-title" className="text-base font-bold text-slate-900">
            {title}
          </h2>
        </div>

        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <p>
              This temporary password is shown <strong>only once</strong> and is never stored in
              plaintext. The user will be required to change it on their first sign-in.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3 rounded-lg bg-slate-50 p-3.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Username</span>
            <span className="font-mono font-semibold text-slate-900">{username}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">Temporary Password</span>
            <div className="flex items-center gap-2">
              <code className="rounded bg-white px-2.5 py-1 font-mono text-sm font-bold text-emerald-800 ring-1 ring-slate-200">
                {temporaryPassword}
              </code>
              <button
                type="button"
                onClick={copyPassword}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <label className="mt-4 flex cursor-pointer items-center gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
          />
          I have recorded or securely shared this temporary password.
        </label>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            disabled={!acknowledged}
            onClick={onClose}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
