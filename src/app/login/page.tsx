import Link from "next/link";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { createSession, safeNext } from "@/lib/auth";
import { db } from "@/lib/db";
import { allow, clearLimit } from "@/lib/rateLimit";

export default async function Login(props: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const searchParams = await props.searchParams;
  const next = safeNext(searchParams.next);

  async function login(formData: FormData) {
    "use server";
    const email = String(formData.get("email")).trim().toLowerCase();
    const ip =
      (await headers()).get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
    const limitKey = `login:${email}:${ip}`;
    // at most 8 attempts per 10 minutes for the same email from the same address
    if (!allow(limitKey, 8, 10 * 60 * 1000))
      redirect(`/login?error=rate&next=${encodeURIComponent(next)}`);
    const user = await db.user.findUnique({ where: { email } });
    if (
      !user ||
      !(await bcrypt.compare(
        String(formData.get("password")),
        user.passwordHash,
      ))
    ) {
      redirect(`/login?error=1&next=${encodeURIComponent(next)}`);
    }
    clearLimit(limitKey);
    await createSession(user.id);
    redirect(next);
  }

  return (
    <main>
      <h1>Մուտք</h1>
      <form action={login} className="panel stack">
        <label>
          Էլ. փոստ
          <input type="email" name="email" required autoComplete="email" />
        </label>
        <label>
          Գաղտնաբառ
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
          />
        </label>
        {searchParams.error === "rate" && (
          <p className="err">Չափազանց շատ փորձեր։ Փորձիր 10 րոպեից։</p>
        )}
        {searchParams.error && searchParams.error !== "rate" && (
          <p className="err">Էլ. փոստը կամ գաղտնաբառը սխալ է։</p>
        )}
        <button className="btn">Մուտք գործել</button>
        <p className="muted" style={{ margin: 0 }}>
          Հաշիվ չունե՞ս։{" "}
          <Link href="/register" style={{ textDecoration: "underline" }}>
            Գրանցվել
          </Link>
        </p>
      </form>
    </main>
  );
}
