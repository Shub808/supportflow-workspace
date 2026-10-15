import { redirect } from "next/navigation";

import { currentAgent } from "@/server/auth/current-user";

/**
 * Everything under this layout requires a session.
 *
 * This is a convenience redirect for navigation, not the access control:
 * every mutating action independently re-derives the actor and re-checks its
 * capability, because a Server Action can be invoked without ever rendering
 * the page that normally calls it.
 */
export default async function WorkspaceLayout({
  children,
}: LayoutProps<"/">) {
  const agent = await currentAgent();
  if (!agent) redirect("/sign-in");
  return children;
}
