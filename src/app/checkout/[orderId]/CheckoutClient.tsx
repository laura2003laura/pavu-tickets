"use client";
import { useState } from "react";
import dynamic from "next/dynamic";

const DeliveryMap = dynamic(() => import("./DeliveryMap"), {
  ssr: false,
  loading: () => <p className="muted">Քարտեզը բեռնվում է…</p>,
});

type Props = {
  lines: { name: string; qty: number; price: string }[];
  total: string;
  
  stripeEnabled: boolean;
  error: string | null;
  payOnline: (formData: FormData) => Promise<void>;
  orderDelivery: (formData: FormData) => Promise<void>;
};

const groupDigits = (v: string) => v.replace(/\D/g, "").slice(0, 19).replace(/(.{4})/g, "$1 ").trim();
const fixExpiry = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

export default function CheckoutClient({ lines, total, stripeEnabled, error, payOnline, orderDelivery }: Props) {
  const [method, setMethod] = useState<"online" | "delivery" | null>(
    error === "delivery" || error === "delivery-card" ? "delivery" : error === "card" || error === "payment" ? "online" : null,
  );
  const [pt, setPt] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState("");
  const [card, setCard] = useState({ number: "", expiry: "", cvc: "", holder: "" });
  const [isGift, setIsGift] = useState(false);
  const [giftAnonymous, setGiftAnonymous] = useState(true);

  return (
    <div className="stack" style={{ maxWidth: 640 }}>
      <div className="panel" style={{ maxWidth: 640 }}>
        {lines.map((l) => (
          <div key={l.name} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span>{l.name} Г— {l.qty}</span><span>{l.price}</span>
          </div>
        ))}
        <p style={{ margin: "12px 0 0", fontWeight: 800 }}>Ընդամենը՝ {total}</p>
        
      </div>

      <h3 style={{ margin: "8px 0 0" }}>Ինչպե՞ս ես ուզում ստանալ տոմսերը</h3>
      <div className="choices">
        <button type="button" className={`choice ${method === "online" ? "on" : ""}`} aria-pressed={method === "online"} onClick={() => setMethod("online")}>
          <strong>💳 Առցանց</strong>
          <span>Վճարիր քարտով հիմա, տոմսերը անմիջապես կհայտնվեն «Իմ տոմսերը» բաժնում։</span>
        </button>
        <button type="button" className={`choice ${method === "delivery" ? "on" : ""}`} aria-pressed={method === "delivery"} onClick={() => setMethod("delivery")}>
          <strong>🚚 Առաքում</strong>
          <span>Նշիր քարտեզի վրա Երևանում, որտեղ պետք է բերել տոմսերը։ Նշիր առաքման հասցեն, ապա հաստատիր վճարումը քարտով։</span>
        </button>
      </div>

      {method === "online" && (
        <form action={payOnline} className="panel stack" style={{ maxWidth: 640 }}>
          <h3 style={{ margin: 0 }}>Վճարում քարտով</h3>
          {error === "card" && <p className="err">Քարտի տվյալները սխալ են։ Ստուգիր համարը, ժամկետը և CVC-ն։</p>}
          {error === "payment" && <p className="err">Վճարումը չհաջողվեց սկսել։ Փորձիր նորից։</p>}
          <div className="stack" style={{ padding: "14px 0", borderTop: "1px solid var(--line, #ddd)", borderBottom: "1px solid var(--line, #ddd)" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="checkbox"
                name="isGift"
                checked={isGift}
                onChange={(e) => setIsGift(e.target.checked)}
              />
              <strong>Գնել որպես նվեր</strong>
            </label>

            {isGift && (
              <>
                <label>Ստացողի անունը (պարտադիր չէ)
                  <input name="giftRecipientName" maxLength={100} placeholder="Ստացողի անունը" />
                </label>
                <label>Ստացողի հեռախոսահամարը
                  <input
                    name="giftRecipientPhone"
                    type="tel"
                    required
                    autoComplete="tel"
                    placeholder="+374 77 123456"
                    pattern="\+?[0-9 ()-]{8,20}"
                  />
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="checkbox"
                    name="giftAnonymous"
                    checked={giftAnonymous}
                    onChange={(e) => setGiftAnonymous(e.target.checked)}
                  />
                  Ուղարկել անանուն
                </label>
              </>
            )}
          </div>
          {error === "gift" && <p className="err">Նշեք ստացողի վավեր հեռախոսահամարը։</p>}

          {stripeEnabled ? (
            <>
              <p className="muted" style={{ margin: 0 }}>
                Քարտի տվյալները լրացվում են Stripe-ի անվտանգ էջում, մեր կայքը դրանք չի տեսնում։
              </p>
              <button className="btn">Անցնել վճարման · {total}</button>
            </>
          ) : (
            <>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                Ցուցադրական ռեժիմ՝ տվյալները միայն ստուգվում են և չեն պահվում։ Թեստային քարտ՝ 4242 4242 4242 4242, ցանկացած ապագա ամսաթիվ և CVC։
              </p>
              <label>Քարտապանի անուն
                <input name="cardHolder" autoComplete="cc-name" required value={card.holder}
                  onChange={(e) => setCard({ ...card, holder: e.target.value })} />
              </label>
              <label>Քարտի համար
                <input name="cardNumber" inputMode="numeric" autoComplete="cc-number" placeholder="1234 5678 9012 3456" required
                  value={card.number} onChange={(e) => setCard({ ...card, number: groupDigits(e.target.value) })} />
              </label>
              <div className="row2">
                <label>Ժամկետ (ԱԱ/ՏՏ)
                  <input name="cardExpiry" inputMode="numeric" autoComplete="cc-exp" placeholder="MM/YY" required maxLength={5}
                    value={card.expiry} onChange={(e) => setCard({ ...card, expiry: fixExpiry(e.target.value) })} />
                </label>
                <label>CVC
                  <input name="cardCvc" inputMode="numeric" autoComplete="cc-csc" placeholder="123" required maxLength={4} type="password"
                    value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value.replace(/\D/g, "") })} />
                </label>
              </div>
              <button className="btn">Վճարել {total}</button>
            </>
          )}
        </form>
      )}

      {method === "delivery" && (
        <form action={orderDelivery} className="panel stack" style={{ maxWidth: 640 }}>
          <h3 style={{ margin: 0 }}>Առաքում Երևանում</h3>
          {error === "delivery" && <p className="err">Նշիր առաքման կետը քարտեզի վրա, լրացրու հասցեն և ճիշտ հեռախոսահամար։</p>}
          <p className="muted" style={{ margin: 0 }}>Սեղմիր քարտեզի վրա՝ առաքման վայրը նշելու համար։</p>
          <DeliveryMap onPick={(lat, lng, addr) => { setPt({ lat, lng }); if (addr) setAddress(addr); }} />
          <input type="hidden" name="lat" value={pt?.lat ?? ""} />
          <input type="hidden" name="lng" value={pt?.lng ?? ""} />
          <label>Հասցե (կարող ես ճշտել)
            <input name="address" required maxLength={200} value={address} onChange={(e) => setAddress(e.target.value)}
              placeholder="Փողոց, շենք, մուտք, բնակարան" />
          </label>
          <label>Հեռախոսահամար
            <input name="phone" type="tel" required autoComplete="tel" placeholder="+374 77 123456" pattern="\+?[0-9 ()\-]{8,16}" />
          </label>
          <div className="payment-confirm">
  <h4>Վճարում առաքման պահին</h4>
  <p className="muted">
    Պատվերի համար կվճարես առաքիչին՝ տոմսերը ստանալիս։
    QR տոմսը կստեղծվի վճարումը հաստատելուց հետո։
  </p>
</div>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>Ընդհանուր՝ {total}։ QR տոմսերը կստեղծվեն միայն քարտային վճարման հաջող հաստատումից հետո։</p>
          <button className="btn" disabled={!pt}>{pt ? (stripeEnabled ? "Անցնել անվտանգ վճարման" : "Հաստատել քարտը և պատվերը") : "Նախ նշիր կետը քարտեզի վրա"}</button>
        </form>
      )}
    </div>
  );
}
