"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useContext, useState } from "react";

import { SessionContext } from "@/context/session";
import { createGame } from "@/lib/game";

export default function CreateGame() {
  const session = useContext(SessionContext);
  const [buttonLoading, setButtonLoading] = useState(false);
  const [opponent, setOpponent] = useState<"human" | "computer">("human");
  const router = useRouter();

  async function submitCreateGame(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!session?.user?.id) {
      router.push("/login");
      return;
    }

    setButtonLoading(true);

    const target = e.target as HTMLFormElement;
    const unlisted = target.elements.namedItem("createUnlisted") as HTMLInputElement;
    const startingSide = (target.elements.namedItem("createStartingSide") as HTMLSelectElement)
      .value;
    const vsBot = opponent === "computer";
    const difficulty = vsBot
      ? (target.elements.namedItem("createDifficulty") as HTMLSelectElement).value
      : undefined;

    const game = await createGame(startingSide, unlisted?.checked ?? false, { vsBot, difficulty });

    if (game) {
      router.push(`/${game.code}`);
    } else {
      console.error("❌ [SUBMIT] Game creation failed");
      setButtonLoading(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={submitCreateGame}>
      <div>
        <label className="field-label" htmlFor="createOpponent">
          Opponent
        </label>
        <select
          className="input-field"
          name="createOpponent"
          id="createOpponent"
          value={opponent}
          onChange={(e) => setOpponent(e.target.value as "human" | "computer")}
        >
          <option value="human">Another player</option>
          <option value="computer">Computer</option>
        </select>
      </div>

      {opponent === "computer" && (
        <div>
          <label className="field-label" htmlFor="createDifficulty">
            Difficulty
          </label>
          <select className="input-field" name="createDifficulty" id="createDifficulty" defaultValue="medium">
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      )}

      <div>
        <label className="field-label" htmlFor="createStartingSide">
          Your side
        </label>
        <select className="input-field" name="createStartingSide" id="createStartingSide">
          <option value="random">Random</option>
          <option value="white">White</option>
          <option value="black">Black</option>
        </select>
      </div>

      {opponent === "human" && (
        <label className="flex cursor-pointer items-center gap-2 text-sm text-[rgb(var(--rgb-text)_/_0.7)]">
          <input
            type="checkbox"
            className="checkbox checkbox-warning checkbox-sm"
            name="createUnlisted"
            id="createUnlisted"
          />
          Invite-only (unlisted)
        </label>
      )}

      <button className="btn-gold" type="submit" disabled={buttonLoading}>
        {buttonLoading ? "Creating…" : opponent === "computer" ? "Play Computer" : "Create Game"}
      </button>
    </form>
  );
}
