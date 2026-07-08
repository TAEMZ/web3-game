"use client";

import { IconCopy } from "@tabler/icons-react";
import { useEffect, useState } from "react";

export default function CopyLink({ name }: { name: string }) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [host, setHost] = useState("");
  useEffect(() => setHost(window.location.host), []);

  function copyLink() {
    const text = `${window.location.origin}/user/${name}`;

    if ("clipboard" in navigator) {
      navigator.clipboard.writeText(text);
    } else {
      document.execCommand("copy", true, text);
    }
    setCopiedLink(true);
    setTimeout(() => {
      setCopiedLink(false);
    }, 5000);
  }
  return (
    <div className={"dropdown dropdown-top dropdown-end" + (copiedLink ? " dropdown-open" : "")}>
      <label
        tabIndex={0}
        className="badge badge-md bg-base-300 text-base-content h-8 gap-1 font-mono text-xs sm:h-5 sm:text-sm"
        onClick={copyLink}
      >
        <IconCopy size={16} />
        {host}/user/{name}
      </label>
      <div tabIndex={0} className="dropdown-content badge badge-neutral text-xs shadow">
        copied to clipboard
      </div>
    </div>
  );
}
