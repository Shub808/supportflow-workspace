"use server";

import { revalidatePath } from "next/cache";

import { selectAiProvider } from "@/server/ai";
import { AuthorizationError, requireCapability } from "@/server/auth/current-user";
import { can } from "@/server/auth/roles";
import {
  aiSchema,
  assignSchema,
  fieldErrors,
  labelSchema,
  prioritySchema,
  replySchema,
  statusSchema,
} from "@/server/actions/schemas";
import {
  AI_IDLE,
  CONFLICT_MESSAGE,
  type ActionState,
  type AiActionState,
} from "@/server/actions/result";
import {
  addReply,
  assignTicket,
  toggleLabel,
  updatePriority,
  updateStatus,
  type MutationResult,
} from "@/server/repo/mutations";
import { searchArticles } from "@/server/repo/knowledge";
import { getTicket, listMessages } from "@/server/repo/tickets";
import type { TicketWithCustomer } from "@/types/domain";

/**
 * Server Actions.
 *
 * Every one follows the same four steps, in this order:
 *
 *   1. `requireCapability` — re-derive the actor from the signed cookie and
 *      check the permission on the server. The disabled button in the UI is a
 *      convenience; this is the control.
 *   2. Zod-parse the form data. These endpoints are publicly reachable, so the
 *      arguments are untrusted regardless of what the component sent.
 *   3. Call the repository, which performs the write conditionally on the
 *      revision the client last saw.
 *   4. Translate the outcome into an `ActionState` and revalidate the paths
 *      whose rendered output just became stale.
 */

function formValue(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

function toState(
  result: MutationResult<TicketWithCustomer>,
  successMessage: string,
): ActionState {
  if (result.ok) {
    return { status: "success", message: successMessage, ticket: result.data };
  }
  if (result.reason === "conflict") {
    return { status: "conflict", message: CONFLICT_MESSAGE, ticket: result.current };
  }
  return { status: "error", message: "That ticket no longer exists." };
}

function refresh(ticketId: string): void {
  revalidatePath("/inbox");
  revalidatePath(`/tickets/${ticketId}`);
}

/** Wraps an action body so an authorization failure becomes a rendered state. */
async function guarded(
  run: () => Promise<ActionState>,
): Promise<ActionState> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { status: "forbidden", message: error.message };
    }
    console.error("[supportflow] action failed", error);
    return {
      status: "error",
      message: "Something went wrong on our side. Nothing was changed.",
    };
  }
}

export async function changeStatusAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  return guarded(async () => {
    const agent = await requireCapability("ticket:change_status");

    const parsed = statusSchema.safeParse({
      ticketId: formValue(form, "ticketId"),
      version: formValue(form, "version"),
      status: formValue(form, "status"),
    });
    if (!parsed.success) {
      return {
        status: "invalid",
        message: "That status change could not be applied.",
        errors: fieldErrors(parsed.error),
      };
    }

    // Closing is a supervisor action even though changing status is not.
    if (parsed.data.status === "closed" && !can(agent.role, "ticket:close")) {
      return {
        status: "forbidden",
        message: `Closing a ticket requires a supervisor. Your role is ${agent.role}.`,
      };
    }

    const result = updateStatus({
      ticketId: parsed.data.ticketId,
      expectedVersion: parsed.data.version,
      status: parsed.data.status,
      actor: agent,
    });

    if (result.ok) refresh(parsed.data.ticketId);
    return toState(result, `Status set to ${parsed.data.status}.`);
  });
}

export async function changePriorityAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  return guarded(async () => {
    const agent = await requireCapability("ticket:change_priority");

    const parsed = prioritySchema.safeParse({
      ticketId: formValue(form, "ticketId"),
      version: formValue(form, "version"),
      priority: formValue(form, "priority"),
    });
    if (!parsed.success) {
      return {
        status: "invalid",
        message: "That priority change could not be applied.",
        errors: fieldErrors(parsed.error),
      };
    }

    const result = updatePriority({
      ticketId: parsed.data.ticketId,
      expectedVersion: parsed.data.version,
      priority: parsed.data.priority,
      actor: agent,
    });

    if (result.ok) refresh(parsed.data.ticketId);
    return toState(result, `Priority set to ${parsed.data.priority}.`);
  });
}

export async function assignAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  return guarded(async () => {
    const agent = await requireCapability("ticket:assign_self");

    const parsed = assignSchema.safeParse({
      ticketId: formValue(form, "ticketId"),
      version: formValue(form, "version"),
      assigneeId: formValue(form, "assigneeId"),
    });
    if (!parsed.success) {
      return {
        status: "invalid",
        message: "That assignment could not be applied.",
        errors: fieldErrors(parsed.error),
      };
    }

    // An agent may take a ticket or drop their own; routing work to someone
    // else is a supervisor capability.
    const assigningToSomeoneElse =
      parsed.data.assigneeId !== null && parsed.data.assigneeId !== agent.id;
    if (assigningToSomeoneElse && !can(agent.role, "ticket:assign_others")) {
      return {
        status: "forbidden",
        message: `Assigning to another agent requires a supervisor. Your role is ${agent.role}.`,
      };
    }

    const result = assignTicket({
      ticketId: parsed.data.ticketId,
      expectedVersion: parsed.data.version,
      assigneeId: parsed.data.assigneeId,
      actor: agent,
    });

    if (result.ok) refresh(parsed.data.ticketId);
    return toState(
      result,
      parsed.data.assigneeId ? "Ticket assigned." : "Ticket unassigned.",
    );
  });
}

export async function toggleLabelAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  return guarded(async () => {
    const agent = await requireCapability("ticket:label");

    const parsed = labelSchema.safeParse({
      ticketId: formValue(form, "ticketId"),
      version: formValue(form, "version"),
      label: formValue(form, "label").toLowerCase(),
    });
    if (!parsed.success) {
      return {
        status: "invalid",
        message: "That label could not be applied.",
        errors: fieldErrors(parsed.error),
      };
    }

    const result = toggleLabel({
      ticketId: parsed.data.ticketId,
      expectedVersion: parsed.data.version,
      label: parsed.data.label,
      actor: agent,
    });

    if (result.ok) refresh(parsed.data.ticketId);
    return toState(result, `Label "${parsed.data.label}" updated.`);
  });
}

export async function replyAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  return guarded(async () => {
    const internalRequested = formValue(form, "internal") === "on";
    const agent = await requireCapability(
      internalRequested ? "ticket:note" : "ticket:reply",
    );

    const parsed = replySchema.safeParse({
      ticketId: formValue(form, "ticketId"),
      version: formValue(form, "version"),
      body: formValue(form, "body"),
      internal: formValue(form, "internal"),
      nextStatus: formValue(form, "nextStatus"),
    });
    if (!parsed.success) {
      return {
        status: "invalid",
        message: "Your reply was not sent.",
        errors: fieldErrors(parsed.error),
      };
    }

    if (
      parsed.data.nextStatus === "closed" &&
      !can(agent.role, "ticket:close")
    ) {
      return {
        status: "forbidden",
        message: `Closing a ticket requires a supervisor. Your role is ${agent.role}.`,
      };
    }

    const result = addReply({
      ticketId: parsed.data.ticketId,
      expectedVersion: parsed.data.version,
      body: parsed.data.body,
      internal: parsed.data.internal,
      nextStatus: parsed.data.nextStatus,
      actor: agent,
    });

    if (result.ok) refresh(parsed.data.ticketId);
    return toState(
      result,
      parsed.data.internal ? "Internal note added." : "Reply sent.",
    );
  });
}

/**
 * AI assistance.
 *
 * Reads the ticket and knowledge base on the server, hands them to whichever
 * provider is configured, and returns a reviewable result. The provider name
 * and whether it is simulated travel with the response so the UI can label it
 * honestly rather than implying a model ran when none did.
 */
export async function aiAssistAction(
  _previous: AiActionState,
  form: FormData,
): Promise<AiActionState> {
  try {
    await requireCapability("ticket:reply");

    const parsed = aiSchema.safeParse({
      ticketId: formValue(form, "ticketId"),
      mode: formValue(form, "mode"),
      instruction: formValue(form, "instruction"),
    });
    if (!parsed.success) {
      return { ...AI_IDLE, status: "error", message: "Invalid request." };
    }

    const ticket = getTicket(parsed.data.ticketId);
    if (!ticket) {
      return { ...AI_IDLE, status: "error", message: "Ticket not found." };
    }

    const provider = selectAiProvider();
    const context = {
      ticket,
      messages: listMessages(ticket.id),
      articles: searchArticles(null),
    };

    const result =
      parsed.data.mode === "summarise"
        ? await provider.summarise(context)
        : await provider.draftReply(context, parsed.data.instruction);

    if (!result.ok) {
      return {
        ...AI_IDLE,
        status: "error",
        provider: result.provider,
        simulated: result.simulated,
        message: result.error,
      };
    }

    return {
      status: "ready",
      text: result.output.text,
      notes: result.output.notes,
      citations: result.output.citations,
      provider: result.provider,
      simulated: result.simulated,
    };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ...AI_IDLE, status: "error", message: error.message };
    }
    console.error("[supportflow] AI action failed", error);
    return {
      ...AI_IDLE,
      status: "error",
      message: "The assistant is unavailable. Nothing was changed.",
    };
  }
}
