"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useContext, useEffect, useState } from "react";

import { SessionContext } from "@/context/session";
import { login, register, setGuestSession } from "@/lib/auth";

type ViewMode = "login" | "signup" | "guest";

export default function LoginPage() {
  const session = useContext(SessionContext);
  const router = useRouter();
  const [mode, setMode] = useState<ViewMode>("login");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Once signed in, go to the admin console (admins) or the player dashboard.
  useEffect(() => {
    if (session?.user?.id) router.replace(session.user.is_admin ? "/admin" : "/");
  }, [session?.user?.id, session?.user?.is_admin, router]);

  useEffect(() => {
    setMsg(null);
  }, [mode]);

  async function handleGuest(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = (
      (e.target as HTMLFormElement).elements.namedItem("guestName") as HTMLInputElement
    ).value;
    if (!name) return;
    setLoading(true);
    const user = await setGuestSession(name);
    if (user) session?.setUser(user);
    else setMsg("Could not start a guest session. Try a different name.");
    setLoading(false);
  }

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.target as HTMLFormElement;
    const username = (f.elements.namedItem("username") as HTMLInputElement).value;
    const password = (f.elements.namedItem("password") as HTMLInputElement).value;
    if (!username || !password) return;
    setLoading(true);
    const user = await login(username, password);
    if (typeof user === "string") setMsg(user);
    else if (user?.id) session?.setUser(user);
    setLoading(false);
  }

  async function handleSignup(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.target as HTMLFormElement;
    const username = (f.elements.namedItem("username") as HTMLInputElement).value;
    const password = (f.elements.namedItem("password") as HTMLInputElement).value;
    const email = (f.elements.namedItem("email") as HTMLInputElement)?.value || undefined;
    if (!username || !password) return;
    setLoading(true);
    const user = await register(username, password, email);
    if (typeof user === "string") setMsg(user);
    else if (user?.id) session?.setUser(user);
    setLoading(false);
  }

  return (
    <div className="flex w-full min-h-screen items-center justify-center px-4 py-12 ethiopian-pattern">
      <div
        className="glass-dark animate-fade-in-up w-full max-w-md p-10"
        style={{ border: "1px solid rgba(201,162,39,0.3)", borderRadius: 24 }}
      >
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="font-display gold-text-shimmer text-4xl font-black tracking-widest">
            CHESS ARENA
          </div>
          <div className="tricolor-bar mx-auto mt-3 w-20" />
          <p className="mt-4 text-sm text-[rgba(216,204,176,0.6)]">
            {mode === "login" && "Welcome back, warrior"}
            {mode === "signup" && "Join the battle"}
            {mode === "guest" && "Quick entry to the arena"}
          </p>
        </div>

        {/* LOGIN FORM */}
        {mode === "login" && (
          <form className="flex flex-col gap-4" onSubmit={handleLogin}>
            <div>
              <label className="field-label" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                name="username"
                className="input-field"
                placeholder="Enter your username"
                pattern="[A-Za-z0-9]+"
                title="Letters and numbers only"
                maxLength={16}
                minLength={2}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="field-label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                className="input-field"
                placeholder="Enter your password"
                minLength={3}
                required
              />
            </div>
            <button className="btn-gold mt-2" type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </button>

            <div className="mt-4 space-y-2 text-center text-sm">
              <button
                type="button"
                onClick={() => setMode("signup")}
                className="block w-full text-[rgba(216,204,176,0.7)] hover:text-[#E8C040] transition"
              >
                New here? <span className="font-semibold text-[#E8C040]">Create an account</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("guest")}
                className="block w-full text-[rgba(216,204,176,0.5)] hover:text-[rgba(216,204,176,0.8)] transition text-xs"
              >
                or Play as Guest
              </button>
            </div>
          </form>
        )}

        {/* SIGNUP FORM */}
        {mode === "signup" && (
          <form className="flex flex-col gap-4" onSubmit={handleSignup}>
            <div>
              <label className="field-label" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                name="username"
                className="input-field"
                placeholder="Choose a username"
                pattern="[A-Za-z0-9]+"
                title="Letters and numbers only"
                maxLength={16}
                minLength={2}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="field-label" htmlFor="email">
                Email (optional)
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className="input-field"
                placeholder="your@email.com"
              />
              <p className="mt-1 text-xs text-[rgba(216,204,176,0.4)]">
                For account recovery
              </p>
            </div>
            <div>
              <label className="field-label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                className="input-field"
                placeholder="Create a password"
                minLength={3}
                required
              />
            </div>
            <button className="btn-gold mt-2" type="submit" disabled={loading}>
              {loading ? "Creating account..." : "Create Account"}
            </button>

            <button
              type="button"
              onClick={() => setMode("login")}
              className="mt-4 text-center text-sm text-[rgba(216,204,176,0.7)] hover:text-[#E8C040] transition"
            >
              Already have an account? <span className="font-semibold text-[#E8C040]">Sign in</span>
            </button>
          </form>
        )}

        {/* GUEST FORM */}
        {mode === "guest" && (
          <form className="flex flex-col gap-4" onSubmit={handleGuest}>
            <div>
              <label className="field-label" htmlFor="guestName">
                Display Name
              </label>
              <input
                id="guestName"
                name="guestName"
                className="input-field"
                placeholder="Enter a name"
                pattern="[A-Za-z0-9]+"
                title="Letters and numbers only"
                maxLength={16}
                minLength={2}
                required
                autoFocus
              />
            </div>

            {/* Guest Limitations */}
            <div className="rounded-xl bg-[rgba(201,162,39,0.08)] border border-[rgba(201,162,39,0.2)] p-4">
              <div className="flex items-start gap-3">
                <div className="text-2xl">⚠️</div>
                <div className="text-xs text-[rgba(216,204,176,0.7)] space-y-1">
                  <p className="font-semibold text-[#E8C040]">Guest Limitations:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>Stats are NOT saved</li>
                    <li>No access to Web3 features</li>
                    <li>Cannot earn rewards or NFTs</li>
                    <li>Session ends when you close browser</li>
                  </ul>
                </div>
              </div>
            </div>

            <button className="btn-gold mt-2" type="submit" disabled={loading}>
              {loading ? "..." : "Play as Guest"}
            </button>

            <button
              type="button"
              onClick={() => setMode("login")}
              className="mt-4 text-center text-sm text-[rgba(216,204,176,0.7)] hover:text-[#E8C040] transition"
            >
              Want to save your progress? <span className="font-semibold text-[#E8C040]">Sign in</span>
            </button>
          </form>
        )}

        {msg && (
          <div className="mt-5 rounded-xl border border-[rgba(184,24,24,0.4)] bg-[rgba(184,24,24,0.15)] px-4 py-3 text-sm text-[#e85050]">
            {msg}
          </div>
        )}
      </div>
    </div>
  );
}
