"use server";

// The VOW desk's one write (MP-007): clear a reviewer hold (R-8.21). Guarded on the admin
// cookie here, then delegated to src/lib/vow/hold.ts. A plain <form action> target; no client
// component. Redirects back to the desk with the outcome.

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { verifyAdminCookieValue } from "@/lib/adminAuth";
import { clearReviewerHold } from "@/lib/vow/hold";

const DESK = "/admin/vow";

/**
 * Clear a reviewer hold. Refuses when the admin cookie is absent or invalid.
 * @param form - `userId`.
 * @returns never (redirects).
 */
export async function clearReviewerHoldAction(form: FormData): Promise<void> {
  if (!verifyAdminCookieValue(cookies().get("miltonly_admin")?.value)) {
    redirect(`${DESK}?hold=refused`);
  }
  const outcome = await clearReviewerHold(String(form.get("userId") ?? ""));
  revalidatePath(DESK);
  redirect(`${DESK}?hold=${outcome}`);
}
