CREATE TYPE "public"."alert_status" AS ENUM('open', 'contacted', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."erasure_source" AS ENUM('request', 'retention');--> statement-breakpoint
CREATE TYPE "public"."login_kind" AS ENUM('signin', 'stepup');--> statement-breakpoint
CREATE TYPE "public"."role_enum" AS ENUM('support', 'branch_admin', 'main_admin');--> statement-breakpoint
CREATE TYPE "public"."vehicle_type" AS ENUM('scooter', 'motorcycle');--> statement-breakpoint
CREATE TABLE "branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"city" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role_enum" NOT NULL,
	"branch_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"must_set_password" boolean DEFAULT false NOT NULL,
	"otp_expires_at" timestamp with time zone,
	"last_sign_in_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_main_admin_no_branch" CHECK (("users"."role" = 'main_admin') = ("users"."branch_id" is null))
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id_hash" "bytea" PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"email_key" text NOT NULL,
	"ip_hash" "bytea" NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" "login_kind" NOT NULL,
	"user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"bucket" text NOT NULL,
	"key" "bytea" NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_bucket_key_window_start_pk" PRIMARY KEY("bucket","key","window_start")
);
--> statement-breakpoint
CREATE TABLE "advisors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"job_card_no" text NOT NULL,
	"job_card_key" text NOT NULL,
	"customer_name" text,
	"phone" text,
	"phone_key" text,
	"reg_no" text,
	"reg_no_key" text,
	"model" text NOT NULL,
	"vehicle_type" "vehicle_type" NOT NULL,
	"service_type" text NOT NULL,
	"service_date" date NOT NULL,
	"advisor_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"create_request_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"erased_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_card_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"opened_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"replaced_by" uuid
);
--> statement-breakpoint
CREATE TABLE "link_tokens" (
	"token_hash" "bytea" PRIMARY KEY NOT NULL,
	"visit_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"superseded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "questionnaires" (
	"version" integer PRIMARY KEY NOT NULL,
	"definition" jsonb NOT NULL,
	"installed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visit_id" uuid NOT NULL,
	"questions_version" integer NOT NULL,
	"answers" jsonb NOT NULL,
	"submission_id" uuid NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"response_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"reasons" jsonb NOT NULL,
	"status" "alert_status" DEFAULT 'open' NOT NULL,
	"notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" uuid,
	"actor_name" text NOT NULL,
	"branch_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "erasure_journal" (
	"job_card_id" uuid PRIMARY KEY NOT NULL,
	"erased_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" "erasure_source" NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisors" ADD CONSTRAINT "advisors_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_cards" ADD CONSTRAINT "job_cards_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_cards" ADD CONSTRAINT "job_cards_advisor_id_advisors_id_fk" FOREIGN KEY ("advisor_id") REFERENCES "public"."advisors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_cards" ADD CONSTRAINT "job_cards_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_job_card_id_job_cards_id_fk" FOREIGN KEY ("job_card_id") REFERENCES "public"."job_cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_replaced_by_visits_id_fk" FOREIGN KEY ("replaced_by") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_tokens" ADD CONSTRAINT "link_tokens_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_tokens" ADD CONSTRAINT "link_tokens_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responses" ADD CONSTRAINT "responses_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responses" ADD CONSTRAINT "responses_questions_version_questionnaires_version_fk" FOREIGN KEY ("questions_version") REFERENCES "public"."questionnaires"("version") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_response_id_responses_id_fk" FOREIGN KEY ("response_id") REFERENCES "public"."responses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "branches_name_lower_uq" ON "branches" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_uq" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "login_attempts_email_at_idx" ON "login_attempts" USING btree ("email_key","at");--> statement-breakpoint
CREATE INDEX "login_attempts_ip_at_idx" ON "login_attempts" USING btree ("ip_hash","at");--> statement-breakpoint
CREATE INDEX "login_attempts_user_at_idx" ON "login_attempts" USING btree ("user_id","at");--> statement-breakpoint
CREATE UNIQUE INDEX "advisors_branch_name_lower_uq" ON "advisors" USING btree ("branch_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "job_cards_branch_key_uq" ON "job_cards" USING btree ("branch_id","job_card_key");--> statement-breakpoint
CREATE UNIQUE INDEX "job_cards_create_request_uq" ON "job_cards" USING btree ("create_request_id");--> statement-breakpoint
CREATE INDEX "job_cards_phone_key_idx" ON "job_cards" USING btree ("phone_key");--> statement-breakpoint
CREATE INDEX "job_cards_reg_no_key_idx" ON "job_cards" USING btree ("reg_no_key");--> statement-breakpoint
CREATE INDEX "job_cards_branch_date_idx" ON "job_cards" USING btree ("branch_id","service_date");--> statement-breakpoint
CREATE INDEX "visits_branch_created_idx" ON "visits" USING btree ("branch_id","created_at" desc);--> statement-breakpoint
CREATE INDEX "visits_job_card_idx" ON "visits" USING btree ("job_card_id");--> statement-breakpoint
CREATE INDEX "link_tokens_visit_idx" ON "link_tokens" USING btree ("visit_id");--> statement-breakpoint
CREATE UNIQUE INDEX "link_tokens_one_live_uq" ON "link_tokens" USING btree ("visit_id") WHERE "link_tokens"."superseded_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "responses_visit_uq" ON "responses" USING btree ("visit_id");--> statement-breakpoint
CREATE INDEX "responses_deleted_at_idx" ON "responses" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "alerts_response_uq" ON "alerts" USING btree ("response_id");--> statement-breakpoint
CREATE INDEX "alerts_branch_status_idx" ON "alerts" USING btree ("branch_id","status");--> statement-breakpoint
CREATE INDEX "audit_log_branch_id_idx" ON "audit_log" USING btree ("branch_id","id" desc);--> statement-breakpoint
CREATE INDEX "audit_log_action_id_idx" ON "audit_log" USING btree ("action","id" desc);--> statement-breakpoint
CREATE FUNCTION "audit_log_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		RAISE EXCEPTION 'audit_log rows cannot be deleted';
	END IF;
	IF TG_OP = 'TRUNCATE' THEN
		RAISE EXCEPTION 'audit_log cannot be truncated';
	END IF;
	IF coalesce(current_setting('psf.redact', true), '') <> 'on' THEN
		RAISE EXCEPTION 'audit_log rows cannot be updated';
	END IF;
	IF (to_jsonb(NEW) - 'old_value' - 'new_value' - 'note') IS DISTINCT FROM (to_jsonb(OLD) - 'old_value' - 'new_value' - 'note') THEN
		RAISE EXCEPTION 'audit_log redaction may change only old_value, new_value and note';
	END IF;
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "audit_log_no_delete" BEFORE DELETE ON "audit_log" FOR EACH ROW EXECUTE FUNCTION "audit_log_guard"();--> statement-breakpoint
CREATE TRIGGER "audit_log_guard_update" BEFORE UPDATE ON "audit_log" FOR EACH ROW EXECUTE FUNCTION "audit_log_guard"();--> statement-breakpoint
CREATE TRIGGER "audit_log_no_truncate" BEFORE TRUNCATE ON "audit_log" FOR EACH STATEMENT EXECUTE FUNCTION "audit_log_guard"();
