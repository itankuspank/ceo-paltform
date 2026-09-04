/**
 * Dynamic workflow engine — stages, owners and SLAs live in workflow_definitions (editable in the data console).
 * One engine runs budget transfers, org-structure requests, recruitment pipelines and innovation ideas.
 */
import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { Db } from "./db";
import * as s from "../shared/schema";
import type { Role, WorkflowStage, WorkflowAction } from "../shared/schema";

export class WorkflowError extends Error { constructor(public status: number, message: string) { super(message); } }
type Actor = { userId: number; role: Role };
const DAY = 86400000;

export class WorkflowEngine {
  constructor(private db: Db) {}

  async definitions() { return this.db.select().from(s.workflowDefinitions).orderBy(asc(s.workflowDefinitions.id)); }

  async definition(key: string) {
    const [d] = await this.db.select().from(s.workflowDefinitions).where(eq(s.workflowDefinitions.key, key)).limit(1);
    if (!d) throw new WorkflowError(404, `مسار العمل «${key}» غير معرّف`);
    return d;
  }

  /** Admin edits stages (names, owners, SLAs, decision flags). Validated; version bumps; audited. */
  async updateDefinition(key: string, patch: { nameAr?: string; stages?: WorkflowStage[]; isActive?: boolean }, actor: Actor) {
    if (actor.role !== "system_admin") throw new WorkflowError(403, "تعديل مسارات العمل يتطلب صلاحية مدير النظام");
    const d = await this.definition(key);
    if (patch.stages) {
      if (!patch.stages.length) throw new WorkflowError(400, "يجب أن يحتوي المسار على مرحلة واحدة على الأقل");
      const keys = new Set<string>();
      for (const st of patch.stages) {
        if (!st.key || !st.nameAr || !st.ownerRole) throw new WorkflowError(400, "كل مرحلة تحتاج إلى رمز واسم ودور مالك");
        if (!s.ROLES.includes(st.ownerRole)) throw new WorkflowError(400, `دور غير معروف: ${st.ownerRole}`);
        if (keys.has(st.key)) throw new WorkflowError(400, `رمز مرحلة مكرر: ${st.key}`); keys.add(st.key);
        if (!(st.slaDays >= 0)) throw new WorkflowError(400, `مدة SLA غير صحيحة للمرحلة «${st.nameAr}»`);
        if (st.requiresDecision && st.decisionRole && !s.ROLES.includes(st.decisionRole)) throw new WorkflowError(400, "دور القرار غير معروف");
      }
    }
    const [after] = await this.db.update(s.workflowDefinitions).set({ ...patch, version: d.version + 1 }).where(eq(s.workflowDefinitions.id, d.id)).returning();
    await this.db.insert(s.changeLog).values({ entity: "workflow_definitions", entityId: d.id, field: patch.stages ? "stages" : "definition", oldValue: JSON.stringify(d.stages), newValue: JSON.stringify(after.stages), reasonAr: `تحديث مسار العمل (الإصدار ${after.version})`, userId: actor.userId });
    return after;
  }

  async start(definitionKey: string, entity: string, entityId: number, actor: Actor, noteAr?: string) {
    const d = await this.definition(definitionKey);
    if (!d.isActive) throw new WorkflowError(400, "مسار العمل غير مفعّل");
    const first = d.stages[0];
    const [inst] = await this.db.insert(s.workflowInstances).values({ definitionId: d.id, entity, entityId, currentStage: first.key }).returning();
    await this.db.insert(s.workflowHistory).values({ instanceId: inst.id, fromStage: null, toStage: first.key, action: "start", noteAr: noteAr ?? null, userId: actor.userId });
    return inst;
  }

  /** Who may act on a stage: its owner role, the decision role (if any), or the system admin. */
  private mayAct(stage: WorkflowStage, role: Role) {
    return role === "system_admin" || role === stage.ownerRole || (stage.requiresDecision && (stage.decisionRole ?? "ceo") === role);
  }

  async act(instanceId: number, action: WorkflowAction, actor: Actor, noteAr?: string) {
    if (!s.WORKFLOW_ACTIONS.includes(action)) throw new WorkflowError(400, "إجراء غير معروف");
    const [inst] = await this.db.select().from(s.workflowInstances).where(eq(s.workflowInstances.id, instanceId)).limit(1);
    if (!inst) throw new WorkflowError(404, "لا يوجد مسار عمل بهذا الرقم");
    if (inst.status !== "active") throw new WorkflowError(400, "هذا المسار مكتمل ولا يقبل إجراءات");
    const [d] = await this.db.select().from(s.workflowDefinitions).where(eq(s.workflowDefinitions.id, inst.definitionId)).limit(1);
    const idx = d!.stages.findIndex((x) => x.key === inst.currentStage);
    const stage = d!.stages[idx];
    if (!this.mayAct(stage, actor.role)) throw new WorkflowError(403, `هذه المرحلة («${stage.nameAr}») من صلاحية دور آخر`);
    let next: string | null = null; let status = "active"; let completedAt: Date | null = null;
    if (action === "approve") { if (idx === d!.stages.length - 1) { status = "completed"; completedAt = new Date(); next = inst.currentStage; } else next = d!.stages[idx + 1].key; }
    else if (action === "reject") { status = "rejected"; completedAt = new Date(); next = inst.currentStage; }
    else { if (idx === 0) throw new WorkflowError(400, "لا يمكن الإعادة من المرحلة الأولى"); next = d!.stages[idx - 1].key; }
    const [after] = await this.db.update(s.workflowInstances).set({ currentStage: next!, stageEnteredAt: new Date(), status, completedAt }).where(eq(s.workflowInstances.id, instanceId)).returning();
    await this.db.insert(s.workflowHistory).values({ instanceId, fromStage: inst.currentStage, toStage: next, action, noteAr: noteAr ?? null, userId: actor.userId });
    return { instance: after, outcome: status, nextStage: status === "active" ? d!.stages.find((x) => x.key === next) : null };
  }

  /** Instance enriched with definition, stage, aging and SLA breach — the shape every screen uses. */
  async status(entity: string, entityId: number) {
    const [inst] = await this.db.select().from(s.workflowInstances).where(and(eq(s.workflowInstances.entity, entity), eq(s.workflowInstances.entityId, entityId))).orderBy(desc(s.workflowInstances.id)).limit(1);
    if (!inst) return null;
    return this.enrich(inst);
  }

  async byInstance(instanceId: number) {
    const [inst] = await this.db.select().from(s.workflowInstances).where(eq(s.workflowInstances.id, instanceId)).limit(1);
    return inst ? this.enrich(inst) : null;
  }

  async enrich(inst: typeof s.workflowInstances.$inferSelect) {
    const [d] = await this.db.select().from(s.workflowDefinitions).where(eq(s.workflowDefinitions.id, inst.definitionId)).limit(1);
    const idx = d!.stages.findIndex((x) => x.key === inst.currentStage); const stage = d!.stages[idx];
    const days = Math.floor((Date.now() - new Date(inst.stageEnteredAt).getTime()) / DAY);
    const history = await this.db.select({ id: s.workflowHistory.id, fromStage: s.workflowHistory.fromStage, toStage: s.workflowHistory.toStage, action: s.workflowHistory.action, noteAr: s.workflowHistory.noteAr, createdAt: s.workflowHistory.createdAt, userName: s.users.fullName })
      .from(s.workflowHistory).leftJoin(s.users, eq(s.users.id, s.workflowHistory.userId)).where(eq(s.workflowHistory.instanceId, inst.id)).orderBy(asc(s.workflowHistory.id));
    return { ...inst, definitionKey: d!.key, definitionName: d!.nameAr, stages: d!.stages, stageIndex: idx, stage, daysInStage: days, slaBreached: inst.status === "active" && stage.slaDays > 0 && days > stage.slaDays, history };
  }

  /** All active instances of a definition with aging — for pipeline/funnel screens. */
  async pipeline(definitionKey: string) {
    const d = await this.definition(definitionKey);
    const rows = await this.db.select().from(s.workflowInstances).where(and(eq(s.workflowInstances.definitionId, d.id))).orderBy(asc(s.workflowInstances.id));
    return rows.map((inst) => {
      const idx = d.stages.findIndex((x) => x.key === inst.currentStage); const stage = d.stages[idx];
      const days = Math.floor((Date.now() - new Date(inst.stageEnteredAt).getTime()) / DAY);
      return { ...inst, stageIndex: idx, stage, daysInStage: days, slaBreached: inst.status === "active" && stage.slaDays > 0 && days > stage.slaDays };
    });
  }

  /** Decision inbox: active instances whose current stage requires a decision from the actor's role (admin sees all). */
  async inbox(role: Role) {
    const defs = await this.definitions();
    const rows = await this.db.select().from(s.workflowInstances).where(eq(s.workflowInstances.status, "active")).orderBy(asc(s.workflowInstances.stageEnteredAt));
    const out = [] as any[];
    for (const inst of rows) {
      const d = defs.find((x) => x.id === inst.definitionId)!; const stage = d.stages.find((x) => x.key === inst.currentStage)!;
      if (!stage.requiresDecision) continue;
      if (role !== "system_admin" && (stage.decisionRole ?? "ceo") !== role) continue;
      const days = Math.floor((Date.now() - new Date(inst.stageEnteredAt).getTime()) / DAY);
      out.push({ ...inst, definitionKey: d.key, definitionName: d.nameAr, stage, stages: d.stages, stageIndex: d.stages.indexOf(stage), daysInStage: days, slaBreached: stage.slaDays > 0 && days > stage.slaDays });
    }
    return out;
  }

  async counts(definitionKey: string) {
    const d = await this.definition(definitionKey);
    const rows = await this.db.select({ stage: s.workflowInstances.currentStage, status: s.workflowInstances.status, n: sql<number>`count(*)` }).from(s.workflowInstances).where(eq(s.workflowInstances.definitionId, d.id)).groupBy(s.workflowInstances.currentStage, s.workflowInstances.status);
    return { definition: d, byStage: d.stages.map((st) => ({ ...st, active: Number(rows.find((r) => r.stage === st.key && r.status === "active")?.n ?? 0) })), completed: rows.filter((r) => r.status === "completed").reduce((a, r) => a + Number(r.n), 0), rejected: rows.filter((r) => r.status === "rejected").reduce((a, r) => a + Number(r.n), 0) };
  }
}
