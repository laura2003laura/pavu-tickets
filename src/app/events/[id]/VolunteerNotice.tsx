"use client";

import { useState } from "react";

export default function VolunteerNotice() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className="success-note volunteer-notice">
      <span>
        ✓ Հայտը հաջողությամբ ուղարկվել է։ Շնորհակալություն միանալու համար։
      </span>
      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label="Փակել"
      >
        ×
      </button>
    </div>
  );
}
