import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { endSession, getUser } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = { title: "PAVU tickets", description: "Միջոցառումների տոմսեր առցանց" };

export const viewport: Viewport = { themeColor: "#1e1230" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();

  async function logout() {
    "use server";
    endSession();
    redirect("/");
  }

  return (
    <html lang="hy">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;700;800&family=Noto+Sans+Armenian:wght@400;600;800&display=swap"
        />
      </head>
      <body>
        <div className="wrap">
          <header>
            <Link className="logo" href="/">PAVU <b>tickets</b></Link>
            <nav>
              {user ? (
                <>
                  <Link href="/my-tickets">Իմ տոմսերը</Link>
                  {user.role === "ADMIN" && <Link href="/admin">Ադմին</Link>}
                  {(user.role === "STAFF" || user.role === "ADMIN") && <Link href="/scanner">Սկաներ</Link>}
                  {(user.role === "STAFF" || user.role === "ADMIN") && (
  <Link href="/staff/deliveries">Առաքումներ</Link>
)}
                  <form action={logout}><button className="btn ghost">Ելք</button></form>
                </>
              ) : (
                <>
                  <Link href="/register">Գրանցում</Link>
                  <Link className="btn ghost" href="/login">Մուտք</Link>
                </>
              )}
            </nav>
          </header>
          {children}
          <footer>PAVU tickets © 2026</footer>
        </div>
      </body>
    </html>
  );
}
