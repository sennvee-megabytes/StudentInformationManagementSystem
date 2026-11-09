"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Lock, User } from "lucide-react";

type LoginResponse = {
  data?: {
    id: string;
    username: string;
    role: "STUDENT" | "STAFF" | "ADMIN";
    mustChangePassword: boolean;
  };
  error?: {
    code: string;
    message: string;
  };
};

function sanitizeNextPath(nextParam: string | null, fallback: string): string {
  if (!nextParam) return fallback;
  if (nextParam.startsWith("/") && !nextParam.startsWith("//") && !nextParam.includes("\\")) {
    return nextParam;
  }
  return fallback;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const body = (await res.json()) as LoginResponse;

      if (!res.ok || !body.data) {
        setError(body.error?.message ?? "Invalid username or password.");
        return;
      }

      if (body.data.mustChangePassword) {
        router.push("/change-password");
        router.refresh();
        return;
      }

      const roleDefault =
        body.data.role === "ADMIN"
          ? "/admin"
          : body.data.role === "STAFF"
            ? "/staff"
            : "/student";

      const target = sanitizeNextPath(searchParams.get("next"), roleDefault);
      router.push(target);
      router.refresh();
    } catch {
      setError("Unable to reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <div>
        <label htmlFor="username" className="block text-sm font-medium text-slate-700">
          Username
        </label>
        <div className="relative mt-1">
          <User className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loading}
            placeholder="Student number or staff username"
            className="block w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm shadow-xs focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 disabled:bg-slate-100"
          />
        </div>
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-slate-700">
          Password
        </label>
        <div className="relative mt-1">
          <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            className="block w-full rounded-lg border border-slate-300 py-2 pl-9 pr-10 text-sm shadow-xs focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 disabled:bg-slate-100"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 disabled:opacity-60"
      >
        {loading ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
