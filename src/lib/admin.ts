
import { redirect } from "next/navigation";
import { getUser } from "./auth";

export async function requireAdmin() {
  const user = await getUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "ADMIN") redirect("/");
  return user;
}

export async function requireStaffOrAdmin() {
  const user = await getUser();
  if (!user) redirect("/login?next=/scanner");
  if (user.role !== "ADMIN" && user.role !== "STAFF") redirect("/");
  return user;
}
