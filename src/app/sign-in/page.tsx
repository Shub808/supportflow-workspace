import type { Metadata } from "next";

import { signInAction } from "@/server/actions/session";
import { ROLE_CAPABILITIES } from "@/server/auth/roles";
import { Avatar, Button, Panel } from "@/components/ui/primitives";
import { listAgents } from "@/server/repo/tickets";

export const metadata: Metadata = { title: "Sign in" };

const ROLE_BLURB: Record<string, string> = {
  agent: "Works tickets: replies, notes, status, priority, labels, and can take a ticket for themselves.",
  supervisor: "Everything an agent can do, plus routing work to other agents and closing tickets.",
  admin: "Everything a supervisor can do, plus workspace settings.",
};

/**
 * Demo sign-in.
 *
 * There is no password and no identity provider — this is a labelled role
 * picker so a reviewer can see how the same screens behave at each permission
 * level. What *is* real is everything downstream: the cookie is signed
 * server-side so the role cannot be edited in the browser, and every mutating
 * action re-checks the capability on the server.
 */
export default function SignInPage() {
  const agents = listAgents();

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-4 py-10">
      <header className="mb-6">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="flex size-8 items-center justify-center rounded-lg bg-accent-600 text-sm font-bold text-white"
          >
            S
          </span>
          <h1 className="text-lg font-semibold text-ink">SupportFlow</h1>
        </div>
        <p className="mt-3 text-sm text-muted">
          Choose a demo profile to enter the workspace. This is a portfolio
          project running on seeded data — there is no password, and every
          person and company in it is invented.
        </p>
      </header>

      <Panel className="divide-y divide-line">
        {agents.map((agent) => (
          <form key={agent.id} action={signInAction} className="block">
            <input type="hidden" name="agentId" value={agent.id} />
            <div className="flex flex-wrap items-center gap-3 p-4">
              <Avatar name={agent.name} className="size-9" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">
                  {agent.name}{" "}
                  <span className="font-normal text-subtle">· {agent.role}</span>
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {ROLE_BLURB[agent.role]}
                </p>
                <p className="mt-1 text-xs text-subtle">
                  {ROLE_CAPABILITIES[agent.role].length} capabilities
                </p>
              </div>
              <Button type="submit" variant="primary">
                Continue as {agent.name.split(" ")[0]}
              </Button>
            </div>
          </form>
        ))}
      </Panel>

      <p className="mt-5 text-xs text-subtle">
        The session cookie is HMAC-signed and <code>HttpOnly</code>, so the role
        cannot be changed from the browser. Permissions are enforced again on
        the server inside every action — the UI only mirrors them.
      </p>
    </main>
  );
}
