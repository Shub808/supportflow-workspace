"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { signInSchema } from "@/server/actions/schemas";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  encodeSession,
} from "@/server/auth/session";
import { listAgents } from "@/server/repo/tickets";

/**
 * Demo sign-in and sign-out.
 *
 * There is no password: the sign-in screen is a labelled demo role picker, so
 * a reviewer can see how the same screens behave for an agent, a supervisor
 * and an admin. What *is* real is the cookie — it is signed server-side, so
 * the chosen role cannot be edited client-side, and `HttpOnly` keeps it out of
 * reach of any script on the page.
 */

export async function signInAction(form: FormData): Promise<void> {
  const parsed = signInSchema.safeParse({
    agentId: String(form.get("agentId") ?? ""),
  });
  if (!parsed.success) redirect("/sign-in?error=invalid");

  const agent = listAgents().find((a) => a.id === parsed.data.agentId);
  if (!agent) redirect("/sign-in?error=unknown");

  const store = await cookies();
  store.set({
    name: SESSION_COOKIE,
    value: encodeSession({
      agentId: agent.id,
      role: agent.role,
      issuedAt: Date.now(),
    }),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  redirect("/inbox");
}

export async function signOutAction(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/sign-in");
}
