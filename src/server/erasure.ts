import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { stripFreeText } from "@/domain/erasure";
import type { AnswerMap, AlertNote } from "@/domain/types";
import type { Tx } from "./db/client";
import { alerts, auditLog, erasureJournal, jobCards, responses, visits } from "./db/schema";
import { log } from "./log";

export type ErasureSource = "request" | "retention";

export const ERASED_MARK = "[erased]";
const ERASED_JSON = sql`${JSON.stringify(ERASED_MARK)}::jsonb`;

async function eraseResponses(tx: Tx, visitIds: string[]): Promise<string[]> {
  if (visitIds.length === 0) return [];
  const rows = await tx
    .select({ id: responses.id, answers: responses.answers })
    .from(responses)
    .where(inArray(responses.visitId, visitIds));
  for (const r of rows) {
    await tx
      .update(responses)
      .set({ answers: stripFreeText(r.answers as AnswerMap) })
      .where(eq(responses.id, r.id));
  }
  return rows.map((r) => r.id);
}

async function eraseAlerts(tx: Tx, responseIds: string[]): Promise<string[]> {
  if (responseIds.length === 0) return [];
  const rows = await tx
    .select({ id: alerts.id, notes: alerts.notes })
    .from(alerts)
    .where(inArray(alerts.responseId, responseIds));
  for (const a of rows) {
    const notes = (a.notes as AlertNote[]).map((n) => ({ ...n, text: ERASED_MARK }));
    await tx.update(alerts).set({ notes }).where(eq(alerts.id, a.id));
  }
  return rows.map((a) => a.id);
}

async function redactAudit(tx: Tx, scopes: [string, string[]][]): Promise<void> {
  const parts = scopes
    .filter(([, ids]) => ids.length > 0)
    .map(([type, ids]) => and(eq(auditLog.entityType, type), inArray(auditLog.entityId, ids)));
  if (parts.length === 0) return;
  // Transaction-local, so a pooled connection never keeps the switch (LLD §24).
  await tx.execute(sql`select set_config('psf.redact', 'on', true)`);
  await tx
    .update(auditLog)
    .set({
      oldValue: sql`case when ${auditLog.oldValue} is null then null else ${ERASED_JSON} end`,
      newValue: sql`case when ${auditLog.newValue} is null then null else ${ERASED_JSON} end`,
      // Alert status/note actions copy the staff-typed note text here.
      note: sql`case when ${auditLog.note} is null or ${auditLog.note} = '' then ${auditLog.note} else ${ERASED_MARK} end`,
    })
    .where(or(...parts));
}

async function blankCards(tx: Tx, cardIds: string[], now: Date): Promise<void> {
  await tx
    .update(jobCards)
    .set({
      customerName: null,
      phone: null,
      phoneKey: null,
      regNo: null,
      regNoKey: null,
      erasedAt: now,
    })
    .where(inArray(jobCards.id, cardIds));
}

/**
 * Erases the personal data of the given job cards inside `tx` (LLD §24): name, phone, reg. no,
 * their search keys, free-text answers (also in deleted responses), alert notes and the old/new
 * values of their audit rows. Cards already erased are skipped. Returns the ids erased now;
 * call `logErasure` after the transaction commits.
 */
export async function eraseJobCards(
  tx: Tx,
  ids: string[],
  source: ErasureSource,
  now: Date,
): Promise<string[]> {
  if (ids.length === 0) return [];
  const live = await tx
    .select({ id: jobCards.id })
    .from(jobCards)
    .where(and(inArray(jobCards.id, ids), isNull(jobCards.erasedAt)));
  const cardIds = live.map((c) => c.id);
  if (cardIds.length === 0) return [];
  await blankCards(tx, cardIds, now);
  const visitIds = (
    await tx.select({ id: visits.id }).from(visits).where(inArray(visits.jobCardId, cardIds))
  ).map((v) => v.id);
  const responseIds = await eraseResponses(tx, visitIds);
  const alertIds = await eraseAlerts(tx, responseIds);
  await redactAudit(tx, [
    ["job_card", cardIds],
    ["visit", visitIds],
    ["response", responseIds],
    ["alert", alertIds],
  ]);
  await tx
    .insert(erasureJournal)
    .values(cardIds.map((jobCardId) => ({ jobCardId, erasedAt: now, source })))
    .onConflictDoNothing();
  return cardIds;
}

/** One log event after commit: source, count and job card ids only (G-5). */
export function logErasure(source: ErasureSource, jobCardIds: string[]): void {
  if (jobCardIds.length === 0) return;
  const ids = Object.fromEntries(jobCardIds.map((id, i) => [`jc${String(i + 1)}`, id]));
  log.event("erasure", { source, count: jobCardIds.length, ...ids });
}
