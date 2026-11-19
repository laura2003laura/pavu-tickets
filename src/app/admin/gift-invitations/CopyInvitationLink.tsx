"use client";

import { useState } from "react";

export default function CopyInvitationLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" className="btn" onClick={copyLink}>
      {copied ? "Հղումը պատճենվեց" : "Պատճենել հրավերի հղումը"}
    </button>
  );
}
