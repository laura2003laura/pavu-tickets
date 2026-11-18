
"use client";

import { useState } from "react";

type ActionResult = {
  success?: boolean;
  error?: string;
};

export default function VolunteerApply({
  action,
}: {
  action: (data: FormData) => Promise<ActionResult>;
}) {
  const [open, setOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(formData: FormData) {
    setError("");

    try {
      const result = await action(formData);

      if (result.success) {
        setOpen(false);
        setSuccessOpen(true);
      } else {
        setError(result.error || "Չհաջողվեց ուղարկել հայտը։ Փորձիր կրկին։");
      }
    } catch {
      setError("Տեղի ունեցավ սխալ։ Խնդրում ենք փորձել կրկին։");
    }
  }

  return (
    <section className="volunteer-card">
      <div>
        <span className="eyebrow">ՄԻԱՑԻՐ ՄԵՐ ԹԻՄԻՆ</span>
        <h3>Դարձիր միջոցառման կամավոր</h3>
        <p>Օգնիր ստեղծել անմոռանալի իրադարձություն, ձեռք բեր փորձ և ծանոթություններ։</p>
      </div>

      <button
        type="button"
        className="btn volunteer-btn"
        onClick={() => {
          setError("");
          setOpen(true);
        }}
      >
        Կամավորագրվել <span>↗</span>
      </button>

      {open && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <form
            className="volunteer-modal stack"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit(new FormData(e.currentTarget));
            }}
          >
            <button
              type="button"
              className="modal-close"
              aria-label="Փակել"
              onClick={() => setOpen(false)}
            >
              ×
            </button>

            <span className="eyebrow">PAVU COMMUNITY</span>
            <h2>Կամավորի հայտ</h2>
            <p className="muted">Լրացրու տվյալներդ, և մեր թիմը կապ կհաստատի քեզ հետ։</p>

            {error && <p className="err">{error}</p>}

            <div className="row2">
              <label>Անուն
                <input name="firstName" required maxLength={80} autoComplete="given-name" />
              </label>
              <label>Ազգանուն
                <input name="lastName" required maxLength={80} autoComplete="family-name" />
              </label>
            </div>

            <label>Հեռախոսահամար
              <input name="phone" required type="tel" placeholder="+374 ..." pattern="\\+?[0-9 ()-]{8,16}" />
            </label>

            <label>Ծննդյան ամսաթիվ
              <input name="birthDate" required type="date" max={new Date().toISOString().slice(0, 10)} />
            </label>

            <label>Telegram նիկնեյմ
              <input name="telegram" required placeholder="@username" maxLength={64} />
            </label>

            <button className="btn" type="submit">Ուղարկել հայտը</button>
          </form>
        </div>
      )}

      {successOpen && (
        <div className="modal-backdrop">
          <div className="volunteer-modal stack">
            <span className="eyebrow">PAVU COMMUNITY</span>
            <h2>✓ Հայտն ուղարկված է</h2>
            <p>Շնորհակալություն միանալու համար։ Մեր թիմը կապ կհաստատի քեզ հետ։</p>
            <button
              type="button"
              className="btn"
              onClick={() => setSuccessOpen(false)}
            >
              Փակել
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
