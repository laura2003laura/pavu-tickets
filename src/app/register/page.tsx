import Link from "next/link";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { createSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { allow } from "@/lib/rateLimit";

export default function Register({ searchParams }: { searchParams: { error?: string } }) {
  async function register(formData: FormData) {
    "use server";
    const ip = headers().get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
    if (!allow(`register:${ip}`, 10, 60 * 60 * 1000)) redirect("/register?error=rate");
    const name = String(formData.get("name")).trim().slice(0, 80);
    const email = String(formData.get("email")).trim().toLowerCase();
    const password = String(formData.get("password"));
    if (password.length < 8) redirect("/register?error=short");
    if (await db.user.findUnique({ where: { email } })) redirect("/register?error=exists");

    let user;
    try {
      user = await db.user.create({
        data: { name, email, passwordHash: await bcrypt.hash(password, 10) },
      });
    } catch (e) {
      // two requests with the same email at once: the unique index rejects the second one
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") redirect("/register?error=exists");
      throw e;
    }
    await createSession(user.id);
    redirect("/");
  }

  return (
    <main>
      <h1>Գրանցում</h1>
      <form action={register} className="panel stack">
        <label>Անուն<input name="name" required autoComplete="name" /></label>
        <label>Էլ. փոստ<input type="email" name="email" required autoComplete="email" /></label>
        <label>Գաղտնաբառ (առնվազն 8 նիշ)<input type="password" name="password" required minLength={8} autoComplete="new-password" /></label>
        {searchParams.error === "exists" && <p className="err">Այս էլ. փոստով հաշիվ արդեն կա։</p>}
        {searchParams.error === "rate" && <p className="err">Չափազանց շատ փորձեր։ Փորձիր ավելի ուշ։</p>}
        {searchParams.error === "short" && <p className="err">Գաղտնաբառը պետք է լինի առնվազն 8 նիշ։</p>}
        <button className="btn">Ստեղծել հաշիվ</button>
        <p className="muted" style={{ margin: 0 }}>Արդեն ունե՞ս հաշիվ։ <Link href="/login" style={{ textDecoration: "underline" }}>Մուտք</Link></p>
      </form>
    </main>
  );
}
