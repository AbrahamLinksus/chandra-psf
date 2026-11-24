// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TSX_CLI } from "../../../support/nodeCli";
import { createTestDb } from "../../../support/pglite";

const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
const ADMIN = "00000000-0000-0000-0000-0000000000a1";
const ADV_A = "00000000-0000-0000-0000-0000000000d1";
const ADV_B = "00000000-0000-0000-0000-0000000000d2";
const VISIT = "00000000-0000-0000-0000-0000000000f1";

let c: PGlite;
const rejects = async (sql: string, msg: RegExp) => {
  await expect(c.exec(sql)).rejects.toThrow(msg);
};
const jobCard = (branch: string, adv: string) =>
  `insert into job_cards(branch_id,job_card_no,job_card_key,model,vehicle_type,service_type,service_date,advisor_id,created_by) values ('${branch}','1','1','m','scooter','s','2026-01-01','${adv}','${ADMIN}')`;
const token = (h: string) =>
  `insert into link_tokens(token_hash,visit_id,created_by) values ('\\x${h}','${VISIT}','${ADMIN}')`;

beforeAll(async () => {
  ({ client: c } = await createTestDb());
  await c.exec(`
    insert into branches(id,name,city) values ('${A}','A','c'),('${B}','B','c');
    insert into users(id,name,email,password_hash,role) values ('${ADMIN}','x','A@x.com','h','main_admin');
    insert into advisors(id,branch_id,name) values ('${ADV_A}','${A}','ad'),('${ADV_B}','${B}','ad');
  `);
  await c.exec(jobCard(A, ADV_A));
  await c.exec(
    `insert into visits(id,job_card_id,branch_id,created_by,expires_at) select '${VISIT}',id,branch_id,'${ADMIN}',now() from job_cards limit 1`,
  );
});
afterAll(async () => {
  await c.close();
});

describe("migration", () => {
  it("creates all 14 LLD tables from drizzle/0000_init.sql", async () => {
    const r = await c.query<{ n: number }>(
      "select count(*)::int n from information_schema.tables where table_schema='public'",
    );
    expect(r.rows[0]?.n).toBe(14);
  });
});

describe("migration objects", () => {
  it("creates the five enums", async () => {
    const r = await c.query<{ t: string }>(
      "select typname t from pg_type where typtype='e' order by 1",
    );
    expect(r.rows.map((x) => x.t)).toEqual([
      "alert_status",
      "erasure_source",
      "login_kind",
      "role_enum",
      "vehicle_type",
    ]);
  });

  it("creates the key unique and partial indexes", async () => {
    const r = await c.query<{ indexname: string; indexdef: string }>(
      "select indexname, indexdef from pg_indexes where schemaname='public'",
    );
    const defs = new Map(r.rows.map((x) => [x.indexname, x.indexdef]));
    for (const name of [
      "branches_name_lower_uq",
      "users_email_lower_uq",
      "advisors_branch_name_lower_uq",
      "job_cards_branch_key_uq",
      "job_cards_create_request_uq",
      "link_tokens_one_live_uq",
      "responses_visit_uq",
      "alerts_response_uq",
    ]) {
      expect(defs.get(name), name).toMatch(/CREATE UNIQUE INDEX/);
    }
    expect(defs.get("link_tokens_one_live_uq")).toMatch(/WHERE \(?.*superseded_at IS NULL/);
  });

  it("scripts/migrate.ts applies the migrations to pglite:memory", () => {
    const out = execFileSync(process.execPath, [TSX_CLI, "scripts/migrate.ts"], {
      env: { ...process.env, DATABASE_URL: "pglite:memory", VERCEL_ENV: "" },
      encoding: "utf8",
    });
    expect(out).toContain("migrations applied (pglite:memory)");
  }, 60_000);
});

describe("uniqueness and role rules", () => {
  it("rejects a duplicate lower(email)", async () => {
    await rejects(
      `insert into users(name,email,password_hash,role,branch_id) values ('y','a@X.com','h','support','${A}')`,
      /users_email_lower_uq/,
    );
  });

  it("rejects a main admin with a branch", async () => {
    await rejects(
      `insert into users(name,email,password_hash,role,branch_id) values ('y','m@x.com','h','main_admin','${A}')`,
      /users_main_admin_no_branch/,
    );
  });

  it("rejects a duplicate job card key in one branch but allows it in another", async () => {
    await rejects(jobCard(A, ADV_A), /job_cards_branch_key_uq/);
    await expect(c.exec(jobCard(B, ADV_B))).resolves.toBeDefined();
  });

  it("rejects two live tokens for one visit, allows one after supersede", async () => {
    await c.exec(token("01"));
    await rejects(token("02"), /link_tokens_one_live_uq/);
    await c.exec("update link_tokens set superseded_at=now()");
    await expect(c.exec(token("03"))).resolves.toBeDefined();
  });
});

describe("audit_log immutability", () => {
  beforeAll(async () => {
    await c.exec(
      `insert into audit_log(actor_name,action,entity_type,entity_id,old_value,note) values ('s','a','e','1','{"p":1}','n')`,
    );
  });

  it("rejects DELETE", async () => {
    await rejects("delete from audit_log", /cannot be deleted/);
  });

  it("rejects UPDATE without psf.redact", async () => {
    await rejects("update audit_log set note='x'", /cannot be updated/);
  });

  it("rejects TRUNCATE", async () => {
    await rejects("truncate audit_log", /cannot be truncated/);
  });

  it("allows redaction of old/new/note only when psf.redact is on", async () => {
    await c.exec(
      "begin; set local psf.redact='on'; update audit_log set old_value=null, note='redacted'; commit",
    );
    await rejects(
      "begin; set local psf.redact='on'; update audit_log set action='z'; commit",
      /may change only old_value, new_value and note/,
    );
    await c.exec("rollback");
    const r = await c.query<{ note: string }>("select note from audit_log");
    expect(r.rows[0]?.note).toBe("redacted");
  });
});
