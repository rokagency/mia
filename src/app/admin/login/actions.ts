"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_COOKIE_MAX_AGE,
  ADMIN_COOKIE_NAME,
  makeSessionToken,
  passwordMatches,
} from "@/lib/admin-auth";

/**
 * Login server action. Reads the password from a posted form and,
 * on a match, sets the signed session cookie + redirects to /admin.
 *
 * On a mismatch we re-render the form with `?error=1`. We don't tell
 * the user "wrong password" vs "internal error" — both look the same.
 */
export async function loginAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (!password) {
    redirect("/admin/login?error=1");
  }

  if (!passwordMatches(password)) {
    redirect("/admin/login?error=1");
  }

  const c = await cookies();
  c.set(ADMIN_COOKIE_NAME, makeSessionToken(), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_COOKIE_MAX_AGE,
  });

  redirect("/admin");
}
