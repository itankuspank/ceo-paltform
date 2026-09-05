CREATE TABLE "budget_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"fiscal_year" integer NOT NULL,
	"kind" text NOT NULL,
	"cost_center_id" integer,
	"project_id" integer,
	"chapter" text NOT NULL,
	"category" text NOT NULL,
	"approved" real NOT NULL,
	"committed" real DEFAULT 0 NOT NULL,
	"actual" real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_months" (
	"id" serial PRIMARY KEY NOT NULL,
	"line_id" integer NOT NULL,
	"month" integer NOT NULL,
	"planned" real NOT NULL,
	"actual" real
);
--> statement-breakpoint
CREATE TABLE "budget_transfers" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"from_line_id" integer NOT NULL,
	"to_line_id" integer NOT NULL,
	"amount" real NOT NULL,
	"justification_ar" text NOT NULL,
	"requested_by_user_id" integer,
	"status" text DEFAULT 'قيد الإجراء' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "budget_transfers_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "candidates" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name_ar" text NOT NULL,
	"requisition_id" integer NOT NULL,
	"engagement_type" text NOT NULL,
	"source_ar" text,
	"current_role_ar" text,
	"clearance_status" text DEFAULT 'لم يبدأ' NOT NULL,
	"monthly_rate" real,
	"secondment_months" integer,
	"reference_ar" text,
	"onboarded_resource_id" integer,
	"onboarded_at" date,
	"status" text DEFAULT 'قيد الإجراء' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "candidates_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "change_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity" text NOT NULL,
	"entity_id" integer NOT NULL,
	"field" text NOT NULL,
	"old_value" text,
	"new_value" text,
	"reason_ar" text,
	"user_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"reverted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "change_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity" text NOT NULL,
	"entity_id" integer NOT NULL,
	"field" text NOT NULL,
	"current_value" text,
	"proposed_value" text NOT NULL,
	"reason_ar" text,
	"requested_by_user_id" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_by_user_id" integer,
	"decided_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "change_requests_gov" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"project_id" integer NOT NULL,
	"title_ar" text NOT NULL,
	"impact_ar" text NOT NULL,
	"status" text NOT NULL,
	CONSTRAINT "change_requests_gov_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "cost_centers" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name_ar" text NOT NULL,
	"type" text NOT NULL,
	"sector_id" integer,
	CONSTRAINT "cost_centers_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "data_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"name_ar" text NOT NULL,
	"system" text NOT NULL,
	"record_count" integer NOT NULL,
	"quality" real NOT NULL,
	"last_sync_at" timestamp NOT NULL,
	"status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"title_ar" text NOT NULL,
	"type" text NOT NULL,
	"priority" text NOT NULL,
	"amount" real,
	"owner_ar" text NOT NULL,
	"project_id" integer,
	"due_date" date NOT NULL,
	"status" text NOT NULL,
	"impact_note_ar" text,
	"decided_at" timestamp,
	"decided_by_user_id" integer,
	CONSTRAINT "decisions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "deliverables" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"name_ar" text NOT NULL,
	"status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dependencies" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_project_id" integer NOT NULL,
	"to_project_id" integer NOT NULL,
	"type" text NOT NULL,
	"status" text NOT NULL,
	"note_ar" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escalations" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"title_ar" text NOT NULL,
	"owner_ar" text NOT NULL,
	"opened_days" integer NOT NULL,
	"status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financials" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"budget" real NOT NULL,
	"committed" real NOT NULL,
	"actual" real NOT NULL,
	"eac" real NOT NULL,
	"fiscal_year" integer DEFAULT 2026 NOT NULL,
	CONSTRAINT "financials_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"target_impact" real NOT NULL,
	"achieved_impact" real NOT NULL,
	"investment" real NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "goals_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "initiative_budget_years" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"fiscal_year" integer NOT NULL,
	"requested" real NOT NULL,
	"approved" real,
	"committed" real DEFAULT 0 NOT NULL,
	"actual" real DEFAULT 0 NOT NULL,
	"funding_source" text DEFAULT 'الميزانية العامة' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "innovation_assessments" (
	"id" serial PRIMARY KEY NOT NULL,
	"cycle" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" integer NOT NULL,
	"scores" json NOT NULL,
	"overall" real NOT NULL,
	"level" integer NOT NULL,
	"assessor_ar" text NOT NULL,
	"evidence_ar" text,
	"status" text DEFAULT 'منشور' NOT NULL,
	"assessed_at" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "innovation_dimensions" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"weight" real NOT NULL,
	"description_ar" text NOT NULL,
	"sort_order" integer NOT NULL,
	CONSTRAINT "innovation_dimensions_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "innovation_ideas" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"title_ar" text NOT NULL,
	"description_ar" text NOT NULL,
	"category" text NOT NULL,
	"source_type" text NOT NULL,
	"source_id" integer NOT NULL,
	"submitted_by_ar" text NOT NULL,
	"submitted_at" date NOT NULL,
	"impact_value" real DEFAULT 0 NOT NULL,
	"impact_note_ar" text,
	"linked_project_id" integer,
	"status" text DEFAULT 'قيد الإجراء' NOT NULL,
	CONSTRAINT "innovation_ideas_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "innovation_targets" (
	"id" serial PRIMARY KEY NOT NULL,
	"cycle" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" integer NOT NULL,
	"target_level" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issues" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"title_ar" text NOT NULL,
	"severity" text NOT NULL,
	"status" text NOT NULL,
	"opened_days" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kpi_readings" (
	"id" serial PRIMARY KEY NOT NULL,
	"kpi_id" integer NOT NULL,
	"month" date NOT NULL,
	"actual" real NOT NULL,
	"target" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kpis" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"goal_id" integer NOT NULL,
	"owner_sector_id" integer,
	"unit" text DEFAULT '%' NOT NULL,
	"baseline" real NOT NULL,
	"target" real NOT NULL,
	"current" real NOT NULL,
	"lower_is_better" boolean DEFAULT false NOT NULL,
	"status" text NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"root_cause_ar" text,
	CONSTRAINT "kpis_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "learning_enrollments" (
	"id" serial PRIMARY KEY NOT NULL,
	"program_id" integer NOT NULL,
	"resource_id" integer NOT NULL,
	"status" text NOT NULL,
	"completion" real DEFAULT 0 NOT NULL,
	"placement_level" text,
	"current_level" text,
	"platform" text,
	"specialization_ar" text,
	"reaction" real,
	"learning" real,
	"behavior" real,
	"results" real
);
--> statement-breakpoint
CREATE TABLE "learning_programs" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name_ar" text NOT NULL,
	"track" text NOT NULL,
	"provider_id" integer,
	"kind" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"cost" real NOT NULL,
	"capacity" integer NOT NULL,
	"status" text NOT NULL,
	"sector_id" integer,
	CONSTRAINT "learning_programs_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "learning_providers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name_ar" text NOT NULL,
	"type" text NOT NULL,
	"country_ar" text NOT NULL,
	"accredited" boolean DEFAULT true NOT NULL,
	"cost_index" integer DEFAULT 3 NOT NULL,
	"quality_score" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE "milestones" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"name_ar" text NOT NULL,
	"planned_start" date NOT NULL,
	"planned_end" date NOT NULL,
	"actual_start" date,
	"actual_end" date,
	"delay_days" integer DEFAULT 0 NOT NULL,
	"status" text NOT NULL,
	"is_critical" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "objectives" (
	"id" serial PRIMARY KEY NOT NULL,
	"goal_id" integer NOT NULL,
	"code" text NOT NULL,
	"name_ar" text NOT NULL,
	CONSTRAINT "objectives_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "org_request_units" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"unit_id" integer,
	"action" text NOT NULL,
	"proposed_name_ar" text,
	"proposed_parent_id" integer,
	"proposed_level" text,
	"proposed_positions" integer
);
--> statement-breakpoint
CREATE TABLE "org_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"requesting_unit_id" integer NOT NULL,
	"type" text NOT NULL,
	"title_ar" text NOT NULL,
	"description_ar" text NOT NULL,
	"justification_ar" text NOT NULL,
	"impact_headcount" integer DEFAULT 0 NOT NULL,
	"impact_budget" real DEFAULT 0 NOT NULL,
	"duplication_note_ar" text,
	"related_project_id" integer,
	"decision_authority" text DEFAULT 'الرئيس التنفيذي' NOT NULL,
	"priority" text DEFAULT 'متوسطة' NOT NULL,
	"correspondence_ref" text,
	"received_at" date NOT NULL,
	"status" text DEFAULT 'قيد الإجراء' NOT NULL,
	"checklist" json DEFAULT '[]'::json NOT NULL,
	CONSTRAINT "org_requests_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "org_units" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name_ar" text NOT NULL,
	"level" text NOT NULL,
	"parent_id" integer,
	"head_name_ar" text,
	"positions" integer DEFAULT 0 NOT NULL,
	"headcount" integer DEFAULT 0 NOT NULL,
	"sector_id" integer,
	"region_id" integer,
	"functions_ar" text,
	"status" text DEFAULT 'معتمد' NOT NULL,
	"effective_from" date,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "org_units_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "portfolio_goals" (
	"portfolio_id" integer NOT NULL,
	"goal_id" integer NOT NULL,
	CONSTRAINT "portfolio_goals_portfolio_id_goal_id_pk" PRIMARY KEY("portfolio_id","goal_id")
);
--> statement-breakpoint
CREATE TABLE "portfolios" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"manager_name" text NOT NULL,
	"target_impact" real DEFAULT 100 NOT NULL,
	"status" text NOT NULL,
	CONSTRAINT "portfolios_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "programs" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name_ar" text NOT NULL,
	"portfolio_id" integer NOT NULL,
	"manager_name" text NOT NULL,
	"schedule_status" text NOT NULL,
	"financial_status" text NOT NULL,
	"status" text NOT NULL,
	CONSTRAINT "programs_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "project_kpis" (
	"project_id" integer NOT NULL,
	"kpi_id" integer NOT NULL,
	"contribution_target" real NOT NULL,
	"contribution_actual" real NOT NULL,
	CONSTRAINT "project_kpis_project_id_kpi_id_pk" PRIMARY KEY("project_id","kpi_id")
);
--> statement-breakpoint
CREATE TABLE "project_regions" (
	"project_id" integer NOT NULL,
	"region_id" integer NOT NULL,
	CONSTRAINT "project_regions_project_id_region_id_pk" PRIMARY KEY("project_id","region_id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name_ar" text NOT NULL,
	"program_id" integer NOT NULL,
	"portfolio_id" integer NOT NULL,
	"sector_id" integer NOT NULL,
	"goal_id" integer NOT NULL,
	"manager_name" text NOT NULL,
	"phase" text NOT NULL,
	"progress" real NOT NULL,
	"schedule_status" text NOT NULL,
	"financial_status" text NOT NULL,
	"status" text NOT NULL,
	"impact_target" real NOT NULL,
	"impact_achieved" real NOT NULL,
	"impact_contribution" text DEFAULT 'متوسطة' NOT NULL,
	"priority_score" real DEFAULT 70 NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	CONSTRAINT "projects_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "regions" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"lat" real NOT NULL,
	"lng" real NOT NULL,
	CONSTRAINT "regions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "requisitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"role_ar" text NOT NULL,
	"sector_id" integer NOT NULL,
	"project_id" integer,
	"engagement_type" text NOT NULL,
	"band" text NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"filled" integer DEFAULT 0 NOT NULL,
	"priority" text DEFAULT 'متوسطة' NOT NULL,
	"is_senior" boolean DEFAULT false NOT NULL,
	"requested_at" date NOT NULL,
	"target_start" date NOT NULL,
	"status" text DEFAULT 'مفتوح' NOT NULL,
	"justification_ar" text,
	CONSTRAINT "requisitions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "resource_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"resource_id" integer NOT NULL,
	"project_id" integer NOT NULL,
	"hours" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" serial PRIMARY KEY NOT NULL,
	"name_ar" text NOT NULL,
	"role_ar" text NOT NULL,
	"department_ar" text NOT NULL,
	"capacity_hours" integer DEFAULT 160 NOT NULL,
	"leave_hours" integer DEFAULT 0 NOT NULL,
	"training_hours" integer DEFAULT 0 NOT NULL,
	"hourly_cost" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE "risks" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"project_id" integer NOT NULL,
	"title_ar" text NOT NULL,
	"category" text NOT NULL,
	"probability" integer NOT NULL,
	"impact" integer NOT NULL,
	"response" text NOT NULL,
	"status" text NOT NULL,
	"owner_ar" text NOT NULL,
	CONSTRAINT "risks_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "sectors" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	CONSTRAINT "sectors_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" json NOT NULL,
	"expire" timestamp (6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" serial PRIMARY KEY NOT NULL,
	"name_ar" text NOT NULL,
	"sector_id" integer NOT NULL,
	"importance" text NOT NULL,
	"required" integer NOT NULL,
	"covered" integer NOT NULL,
	"gap_closure" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE "succession_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"position_ar" text NOT NULL,
	"sector_id" integer NOT NULL,
	"incumbent_ar" text NOT NULL,
	"successor_resource_id" integer,
	"readiness" text NOT NULL,
	"readiness_pct" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"name_ar" text NOT NULL,
	"schedule_ar" text NOT NULL,
	"last_run_at" timestamp NOT NULL,
	"status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"full_name" text NOT NULL,
	"role" text NOT NULL,
	"modules" text[] DEFAULT '{core}'::text[] NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "workflow_definitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name_ar" text NOT NULL,
	"entity" text NOT NULL,
	"stages" json NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "workflow_definitions_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "workflow_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"instance_id" integer NOT NULL,
	"from_stage" text,
	"to_stage" text,
	"action" text NOT NULL,
	"note_ar" text,
	"user_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_instances" (
	"id" serial PRIMARY KEY NOT NULL,
	"definition_id" integer NOT NULL,
	"entity" text NOT NULL,
	"entity_id" integer NOT NULL,
	"current_stage" text NOT NULL,
	"stage_entered_at" timestamp DEFAULT now() NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_cost_center_id_cost_centers_id_fk" FOREIGN KEY ("cost_center_id") REFERENCES "public"."cost_centers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_months" ADD CONSTRAINT "budget_months_line_id_budget_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."budget_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_transfers" ADD CONSTRAINT "budget_transfers_from_line_id_budget_lines_id_fk" FOREIGN KEY ("from_line_id") REFERENCES "public"."budget_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_transfers" ADD CONSTRAINT "budget_transfers_to_line_id_budget_lines_id_fk" FOREIGN KEY ("to_line_id") REFERENCES "public"."budget_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_transfers" ADD CONSTRAINT "budget_transfers_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_requisition_id_requisitions_id_fk" FOREIGN KEY ("requisition_id") REFERENCES "public"."requisitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_onboarded_resource_id_resources_id_fk" FOREIGN KEY ("onboarded_resource_id") REFERENCES "public"."resources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_log" ADD CONSTRAINT "change_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_requests_gov" ADD CONSTRAINT "change_requests_gov_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_sector_id_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sectors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dependencies" ADD CONSTRAINT "dependencies_from_project_id_projects_id_fk" FOREIGN KEY ("from_project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dependencies" ADD CONSTRAINT "dependencies_to_project_id_projects_id_fk" FOREIGN KEY ("to_project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financials" ADD CONSTRAINT "financials_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initiative_budget_years" ADD CONSTRAINT "initiative_budget_years_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "innovation_ideas" ADD CONSTRAINT "innovation_ideas_linked_project_id_projects_id_fk" FOREIGN KEY ("linked_project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_readings" ADD CONSTRAINT "kpi_readings_kpi_id_kpis_id_fk" FOREIGN KEY ("kpi_id") REFERENCES "public"."kpis"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpis" ADD CONSTRAINT "kpis_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpis" ADD CONSTRAINT "kpis_owner_sector_id_sectors_id_fk" FOREIGN KEY ("owner_sector_id") REFERENCES "public"."sectors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_enrollments" ADD CONSTRAINT "learning_enrollments_program_id_learning_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."learning_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_enrollments" ADD CONSTRAINT "learning_enrollments_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_programs" ADD CONSTRAINT "learning_programs_provider_id_learning_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."learning_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_programs" ADD CONSTRAINT "learning_programs_sector_id_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sectors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_request_units" ADD CONSTRAINT "org_request_units_request_id_org_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."org_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_request_units" ADD CONSTRAINT "org_request_units_unit_id_org_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."org_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_requests" ADD CONSTRAINT "org_requests_requesting_unit_id_org_units_id_fk" FOREIGN KEY ("requesting_unit_id") REFERENCES "public"."org_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_requests" ADD CONSTRAINT "org_requests_related_project_id_projects_id_fk" FOREIGN KEY ("related_project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_units" ADD CONSTRAINT "org_units_sector_id_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sectors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_units" ADD CONSTRAINT "org_units_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_goals" ADD CONSTRAINT "portfolio_goals_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_goals" ADD CONSTRAINT "portfolio_goals_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_kpis" ADD CONSTRAINT "project_kpis_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_kpis" ADD CONSTRAINT "project_kpis_kpi_id_kpis_id_fk" FOREIGN KEY ("kpi_id") REFERENCES "public"."kpis"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_regions" ADD CONSTRAINT "project_regions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_regions" ADD CONSTRAINT "project_regions_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_sector_id_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sectors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requisitions" ADD CONSTRAINT "requisitions_sector_id_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sectors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requisitions" ADD CONSTRAINT "requisitions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_assignments" ADD CONSTRAINT "resource_assignments_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_assignments" ADD CONSTRAINT "resource_assignments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risks" ADD CONSTRAINT "risks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_sector_id_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sectors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "succession_plans" ADD CONSTRAINT "succession_plans_sector_id_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sectors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "succession_plans" ADD CONSTRAINT "succession_plans_successor_resource_id_resources_id_fk" FOREIGN KEY ("successor_resource_id") REFERENCES "public"."resources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_history" ADD CONSTRAINT "workflow_history_instance_id_workflow_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."workflow_instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_history" ADD CONSTRAINT "workflow_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_definition_id_workflow_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."workflow_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "budget_lines_fy_idx" ON "budget_lines" USING btree ("fiscal_year","kind");--> statement-breakpoint
CREATE INDEX "budget_months_line_idx" ON "budget_months" USING btree ("line_id");--> statement-breakpoint
CREATE INDEX "candidates_req_idx" ON "candidates" USING btree ("requisition_id");--> statement-breakpoint
CREATE INDEX "change_log_entity_idx" ON "change_log" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "iby_project_idx" ON "initiative_budget_years" USING btree ("project_id","fiscal_year");--> statement-breakpoint
CREATE INDEX "ia_subject_idx" ON "innovation_assessments" USING btree ("subject_type","subject_id","cycle");--> statement-breakpoint
CREATE INDEX "kpi_readings_kpi_idx" ON "kpi_readings" USING btree ("kpi_id");--> statement-breakpoint
CREATE INDEX "le_program_idx" ON "learning_enrollments" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "le_resource_idx" ON "learning_enrollments" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "milestones_project_idx" ON "milestones" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "oru_request_idx" ON "org_request_units" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "org_units_parent_idx" ON "org_units" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "projects_portfolio_idx" ON "projects" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "projects_program_idx" ON "projects" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "ra_resource_idx" ON "resource_assignments" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "session" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "wf_hist_inst_idx" ON "workflow_history" USING btree ("instance_id");--> statement-breakpoint
CREATE INDEX "wf_inst_entity_idx" ON "workflow_instances" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "wf_inst_stage_idx" ON "workflow_instances" USING btree ("current_stage","status");