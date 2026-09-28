// src/lib/streetQueuePlan.ts: what the hourly generation route does with one queued street, given
// makeStreetDecision's answer (MC-047 step 0; the switch is MC-049's, src/lib/streetRegen.ts).
//
// A pure step, so the rule can be tested without a database: the route asks makeStreetDecision,
// hands the answer here, and carries out what comes back.
//
//   generate   build the page now ("build" spends one of today's new-page budget; "regenerate"
//              rewrites an existing page and spends none)
//   held       STREET_REGEN_ENABLED is off: the row is left in the queue exactly as it is, with no
//              status change and no attempt counted, for a run with the switch on. Since MC-047
//              this holds new pages ("build") as well as rewrites ("regenerate").
//   deferred   a new page over today's cap (DEC-NEW-PAGE-CAP): left pending for tomorrow's budget
//   close      the decision needs no page: skip_low_data closes the row "ineligible", anything else
//              "done" (UPG-4 Stage 2 Piece 3: a row must always leave pending once examined)
export type QueueAction =
  | { kind: "generate" }
  | { kind: "held" }
  | { kind: "deferred" }
  | { kind: "close"; status: "done" | "ineligible" };

export function planQueueItem(
  decision: string,
  state: { generationEnabled: boolean; newPageBudget: number },
): { action: QueueAction; newPageBudget: number } {
  const budget = state.newPageBudget;
  if (decision === "build" || decision === "regenerate") {
    if (!state.generationEnabled) return { action: { kind: "held" }, newPageBudget: budget };
    if (decision === "build") {
      if (budget <= 0) return { action: { kind: "deferred" }, newPageBudget: budget };
      return { action: { kind: "generate" }, newPageBudget: budget - 1 };
    }
    return { action: { kind: "generate" }, newPageBudget: budget };
  }
  return { action: { kind: "close", status: decision === "skip_low_data" ? "ineligible" : "done" }, newPageBudget: budget };
}
