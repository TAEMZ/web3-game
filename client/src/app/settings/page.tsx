"use client";

import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { SessionContext } from "@/context/session";
import { useContext, useState } from "react";
import { updateUser } from "@/lib/auth";
import WalletButton from "@/components/wallet/WalletButton";

export default function Settings() {
  const session = useContext(SessionContext);
  const router = useRouter();

  const [buttonLoading, setButtonLoading] = useState(false);
  const [serverMessage, setServerMessage] = useState<string | null>(null);

  if (!session || session.user === undefined) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className="loading loading-spinner loading-lg text-warning"></span>
      </div>
    );
  }

  if (session.user === null) {
    router.replace("/");
    return;
  }

  const user = session.user;
  const hasWallet = !!user.walletAddress;
  const isGuest = typeof user.id === "string";

  async function updateAccount(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const target = e.target as HTMLFormElement;
    const updateUsername = target.elements.namedItem("updateUsername") as HTMLInputElement;
    const updateEmail = target.elements.namedItem("updateEmail") as HTMLInputElement;
    const updatePassword = target.elements.namedItem("updatePassword") as HTMLInputElement;

    const newName =
      !updateUsername.value || updateUsername.value === session?.user?.name
        ? undefined
        : updateUsername.value;
    const newEmail =
      !updateEmail.value || updateEmail.value === session?.user?.email
        ? undefined
        : updateEmail.value;

    if (!newName && !newEmail && !updatePassword.value) return;

    setButtonLoading(true);
    const user = await updateUser(newName, newEmail, updatePassword.value || undefined);

    if (typeof user === "string") {
      setServerMessage(user);
    } else if (user?.id) {
      session?.setUser(user);
      setServerMessage("Account updated successfully");
      setTimeout(() => {
        setServerMessage(null);
      }, 5000);
    }

    updatePassword.value = "";
    setButtonLoading(false);
  }

  return (
    <div className="w-full py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-display text-3xl font-bold text-[#E8C040]">Settings</h1>
          <p className="mt-1 text-sm text-[rgba(216,204,176,0.5)]">
            Manage your account and Web3 features
          </p>
        </div>

        {/* Web3 Section */}
        <div
          className="glass-dark rounded-2xl p-6"
          style={{ border: "1px solid rgba(201,162,39,0.18)" }}
        >
          <h2 className="font-display text-xl font-bold text-[#E8C040] mb-4">Web3 Features</h2>

          {hasWallet ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl bg-[rgba(26,107,63,0.15)] border border-[rgba(26,107,63,0.3)] p-4">
                <div className="text-2xl">✅</div>
                <div className="flex-1">
                  <p className="font-semibold text-[#5fc88f]">Wallet Connected</p>
                  <p className="text-xs text-[rgba(216,204,176,0.6)] mt-1 font-mono">
                    {user.walletAddress}
                  </p>
                  <p className="text-xs text-[rgba(216,204,176,0.5)] mt-2">
                    You have access to rewards, NFT badges, and staked matches
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl bg-[rgba(201,162,39,0.08)] border border-[rgba(201,162,39,0.2)] p-4">
                <div className="flex items-start gap-3 mb-4">
                  <div className="text-2xl">🔓</div>
                  <div className="flex-1">
                    <p className="font-semibold text-[#E8C040]">Unlock Web3 Features</p>
                    <p className="text-xs text-[rgba(216,204,176,0.6)] mt-1">
                      Connect your wallet to access the full arena experience
                    </p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3 mb-4">
                  <div className="flex items-center gap-2 text-xs text-[rgba(216,204,176,0.7)]">
                    <span>💰</span>
                    <span>Earn token rewards</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[rgba(216,204,176,0.7)]">
                    <span>🏆</span>
                    <span>Collect NFT badges</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[rgba(216,204,176,0.7)]">
                    <span>⚔️</span>
                    <span>Play staked matches</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[rgba(216,204,176,0.7)]">
                    <span>🎯</span>
                    <span>On-chain records</span>
                  </div>
                </div>

                <WalletButton />
              </div>
            </div>
          )}
        </div>

        {/* Account Settings Section */}
        {!isGuest && (
          <div
            className="glass-dark rounded-2xl p-6"
            style={{ border: "1px solid rgba(201,162,39,0.18)" }}
          >
            <h2 className="font-display text-xl font-bold text-[#E8C040] mb-4">
              Account Settings
            </h2>

            <form className="space-y-4" onSubmit={updateAccount}>
              <div>
                <label className="field-label" htmlFor="updateUsername">
                  Username
                </label>
                <input
                  type="text"
                  pattern="[A-Za-z0-9]+"
                  title="Alphanumeric characters only"
                  id="updateUsername"
                  name="updateUsername"
                  placeholder={user.name || "Username"}
                  defaultValue={user.name || undefined}
                  className="input-field"
                  maxLength={16}
                  minLength={2}
                />
              </div>

              <div>
                <label className="field-label" htmlFor="updateEmail">
                  Email
                </label>
                <input
                  type="email"
                  className="input-field"
                  id="updateEmail"
                  name="updateEmail"
                  placeholder={user.email || "Email address"}
                  defaultValue={user.email}
                  minLength={4}
                />
                <p className="mt-1 text-xs text-[rgba(216,204,176,0.4)]">
                  For account recovery
                </p>
              </div>

              <div>
                <label className="field-label" htmlFor="updatePassword">
                  New Password
                </label>
                <input
                  type="password"
                  className="input-field"
                  id="updatePassword"
                  name="updatePassword"
                  placeholder="Leave blank to keep current"
                  minLength={6}
                />
              </div>

              {serverMessage && (
                <div
                  className={
                    "rounded-xl px-4 py-3 text-sm " +
                    (serverMessage.includes("successful")
                      ? "bg-[rgba(26,107,63,0.15)] border border-[rgba(26,107,63,0.3)] text-[#5fc88f]"
                      : "bg-[rgba(184,24,24,0.15)] border border-[rgba(184,24,24,0.4)] text-[#e85050]")
                  }
                >
                  {serverMessage}
                </div>
              )}

              <button type="submit" className="btn-gold" disabled={buttonLoading}>
                {buttonLoading ? "Updating..." : "Update Account"}
              </button>
            </form>
          </div>
        )}

        {/* Guest Notice */}
        {isGuest && (
          <div
            className="glass-dark rounded-2xl p-6"
            style={{ border: "1px solid rgba(201,162,39,0.18)" }}
          >
            <div className="flex items-start gap-3">
              <div className="text-3xl">👻</div>
              <div>
                <h3 className="font-semibold text-[#E8C040] mb-2">Playing as Guest</h3>
                <p className="text-sm text-[rgba(216,204,176,0.6)] mb-3">
                  You&apos;re in guest mode. Your stats won&apos;t be saved when you close the browser.
                </p>
                <p className="text-xs text-[rgba(216,204,176,0.5)]">
                  Create a permanent account to save your progress and unlock all features.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
