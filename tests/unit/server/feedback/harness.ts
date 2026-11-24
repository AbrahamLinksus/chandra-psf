import { eq } from "drizzle-orm";
import { advisors, jobCards, linkTokens, questionnaires, visits } from "@/server/db/schema";
import { QUESTIONNAIRE_V1 } from "@/domain/questionnaire";
import type { Db } from "@/server/db/client";
import type { AnswerMap } from "@/domain/types";
import { hashCode, newLinkCode } from "@/server/tokens";
import { must, seedBranch, seedUser } from "../../../support/serverCtx";

const keyOf = (s: string) => s.replace(/[^A-Z0-9]/gi, "").toUpperCase();

export interface Seeded {
  code: string;
  visitId: string;
  branchId: string;
  cardId: string;
  userId: string;
}

/** A job card plus an open visit with a live link, straight into the tables. */
export async function seedLink(
  db: Db,
  o: { branchId?: string | undefined; no: string; now: Date; expiresInMs?: number },
): Promise<Seeded> {
  // `admin init` installs questionnaire v1 in production; responses reference it.
  await db
    .insert(questionnaires)
    .values({ version: QUESTIONNAIRE_V1.version, definition: QUESTIONNAIRE_V1 })
    .onConflictDoNothing();
  const branchId = o.branchId ?? (await seedBranch(db, `Velachery ${o.no}`));
  const userId = await seedUser(db, { role: "support", branchId });
  const card = await seedCard(db, { branchId, userId, no: o.no });
  const [visit] = await db
    .insert(visits)
    .values({
      jobCardId: card.id,
      branchId,
      createdBy: userId,
      createdAt: o.now,
      expiresAt: new Date(o.now.getTime() + (o.expiresInMs ?? 7 * 86_400_000)),
    })
    .returning();
  const { code, hash } = newLinkCode();
  await db
    .insert(linkTokens)
    .values({ tokenHash: hash, visitId: must(visit).id, createdBy: userId, createdAt: o.now });
  return { code, visitId: must(visit).id, branchId, cardId: card.id, userId };
}

async function seedCard(db: Db, o: { branchId: string; userId: string; no: string }) {
  const { branchId, userId } = o;
  const [adv] = await db
    .insert(advisors)
    .values({ branchId, name: `Adv ${o.no}` })
    .returning();
  const [card] = await db
    .insert(jobCards)
    .values({
      branchId,
      jobCardNo: o.no,
      jobCardKey: keyOf(o.no),
      customerName: "Ramesh Kumar",
      phone: "+919840012345",
      regNo: "TN 09 BX 4521",
      regNoKey: keyOf(`TN09BX4521${o.no}`),
      model: "Activa 6G",
      vehicleType: "scooter",
      advisorId: must(adv).id,
      serviceType: "Paid service",
      serviceDate: "2026-11-14",
      createdBy: userId,
    })
    .returning();
  return must(card);
}

/** Another live code for the same visit, superseding the old one (a resend). */
export async function resend(db: Db, s: Seeded, now: Date): Promise<string> {
  await db
    .update(linkTokens)
    .set({ supersededAt: now })
    .where(eq(linkTokens.tokenHash, hashCode(s.code)));
  const { code, hash } = newLinkCode();
  await db
    .insert(linkTokens)
    .values({ tokenHash: hash, visitId: s.visitId, createdBy: s.userId, createdAt: now });
  return code;
}

/** A complete, valid answer set: Q12 = 1 and Q15 = Yes (callback + low rating). */
export function happyAnswers(over: Record<string, unknown> = {}): AnswerMap {
  const base: Record<string, unknown> = {
    Q1: 5,
    Q2: "Yes",
    Q3: "No",
    Q4: "Yes",
    Q5: "Yes",
    Q6: 5,
    Q7: "Yes",
    Q8: "Yes",
    Q9: "Yes",
    Q10: "Yes",
    Q11: 5,
    Q12: 1,
    Q13: "Yes",
    Q15: "Yes",
    ...over,
  };
  return Object.fromEntries(Object.entries(base).filter(([, v]) => v !== undefined)) as AnswerMap;
}
