"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useContext, useState } from "react";

import { SessionContext } from "@/context/session";
import { fetchActiveGame } from "@/lib/game";

export default function JoinGame() {
  const session = useContext(SessionContext);
  const [buttonLoading, setButtonLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const router = useRouter();

  async function submitJoinGame(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!session?.user?.id) {
      router.push("/login");
      return;
    }

    const target = e.target as HTMLFormElement;
    const codeEl = target.elements.namedItem("joinGameCode") as HTMLInputElement;

    let code = codeEl.value.trim();
    if (!code) return;

    setButtonLoading(true);

    // Accept a pasted invite URL (any host, with or without protocol) or a bare code.
    if (code.includes("/")) {
      const url = code.startsWith("http") ? code : "http://" + code;
      try {
        code = new URL(url).pathname.split("/")[1] || code;
      } catch {
        /* not a URL — use as-is */
      }
    }

    const game = await fetchActiveGame(code);

    if (game && game.code) {
      router.push(`/${game.code}`);
    } else {
      setButtonLoading(false);
      setNotFound(true);
      setTimeout(() => setNotFound(false), 5000);
      codeEl.value = "";
    }
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={submitJoinGame}>
      <div>
        <label className="field-label" htmlFor="joinGameCode">
          Invite link or code
        </label>
        <input
          type="text"
          placeholder="e.g. AbC123"
          className="input-field"
          name="joinGameCode"
          id="joinGameCode"
        />
      </div>

      {notFound && <p className="text-sm text-[var(--c-red-text)]">Game not found — check the code.</p>}

      <button className="btn-dark" type="submit" disabled={buttonLoading}>
        {buttonLoading ? "Joining…" : "Join Game"}
      </button>
    </form>
  );
}
