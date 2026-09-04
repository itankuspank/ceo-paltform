import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, X, RotateCcw, Clock } from "lucide-react";
import clsx from "clsx";
import { post } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ROLE_LABELS } from "@shared/rbac";
import type { WorkflowStage } from "@shared/schema";

export type WorkflowView = {
  instanceId: number; stage: WorkflowStage; stageIndex: number; stages: WorkflowStage[]; status: string; daysInStage: number; slaBreached: boolean;
  history?: { id: number; fromStage: string | null; toStage: string | null; action: string; noteAr: string | null; createdAt: string; userName: string | null }[];
};

/** Horizontal stage tracker — done · current (with aging / SLA) · upcoming. */
export function StageTracker({ wf, compact }: { wf: WorkflowView; compact?: boolean }) {
  return (
    <div className={clsx("flex items-center gap-1", compact ? "text-[9.5px]" : "text-[10.5px]")}>
      {wf.stages.map((st, i) => {
        const done = wf.status === "completed" ? true : i < wf.stageIndex; const current = wf.status === "active" && i === wf.stageIndex; const rejected = wf.status === "rejected" && i === wf.stageIndex;
        return (
          <div key={st.key} className="flex items-center gap-1 min-w-0">
            <div className={clsx("rounded-full px-2 py-0.5 whitespace-nowrap border", done ? "bg-rag-greenBg border-[#CFE6D8] text-rag-green" : current ? (wf.slaBreached ? "bg-rag-redBg border-[#F0C9C9] text-rag-red font-bold" : "bg-[#FBF6E7] border-brand-gold text-[#8A6A12] font-bold") : rejected ? "bg-rag-redBg border-[#F0C9C9] text-rag-red" : "bg-brand-cream border-brand-border text-brand-muted")} title={`${ROLE_LABELS[st.ownerRole]?.ar} · SLA ${st.slaDays} يوم`}>
              {st.nameAr}{current && <span className="num"> · {wf.daysInStage}/{st.slaDays} يوم</span>}
            </div>
            {i < wf.stages.length - 1 && <span className="text-brand-border">←</span>}
          </div>
        );
      })}
    </div>
  );
}

/** Action bar — shown only to the role that owns the current stage (or admin / the decision role). */
export function WorkflowActions({ wf, invalidate, size = "sm" }: { wf: WorkflowView; invalidate: string[][]; size?: "sm" | "md" }) {
  const { user } = useAuth(); const qc = useQueryClient(); const [note, setNote] = useState(""); const [err, setErr] = useState<string | null>(null);
  const may = user && wf.status === "active" && (user.role === "system_admin" || user.role === wf.stage.ownerRole || (wf.stage.requiresDecision && (wf.stage.decisionRole ?? "ceo") === user.role));
  const act = useMutation({ mutationFn: (action: string) => post(`/api/workflow/${wf.instanceId}/act`, { action, noteAr: note }), onSuccess: () => { setNote(""); setErr(null); invalidate.forEach((k) => qc.invalidateQueries({ queryKey: k })); }, onError: (e: any) => setErr(e.message) });
  if (!may) return wf.status === "active" ? <div className="text-[10.5px] text-brand-muted flex items-center gap-1"><Clock className="h-3 w-3" /> بانتظار: {ROLE_LABELS[wf.stage.ownerRole]?.ar}</div> : null;
  const btn = size === "md" ? "px-3 py-1.5 text-[12px]" : "px-2.5 py-1 text-[11px]";
  const last = wf.stageIndex === wf.stages.length - 1;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة (اختياري)" className="rounded-md border border-brand-border bg-white px-2 py-1 text-[11px] w-44" />
      <button disabled={act.isPending} onClick={() => act.mutate("approve")} className={clsx("inline-flex items-center gap-1 rounded-md bg-brand font-semibold text-white hover:bg-brand-hover disabled:opacity-60", btn)}><Check className="h-3.5 w-3.5" /> {last ? "إتمام" : wf.stage.requiresDecision ? "اعتماد" : "إحالة للمرحلة التالية"}</button>
      {wf.stageIndex > 0 && <button disabled={act.isPending} onClick={() => act.mutate("return")} className={clsx("inline-flex items-center gap-1 rounded-md border border-brand-border bg-white font-semibold hover:bg-brand-cream disabled:opacity-60", btn)}><RotateCcw className="h-3.5 w-3.5" /> إعادة</button>}
      <button disabled={act.isPending} onClick={() => act.mutate("reject")} className={clsx("inline-flex items-center gap-1 rounded-md border border-[#F0C9C9] bg-rag-redBg font-semibold text-rag-red disabled:opacity-60", btn)}><X className="h-3.5 w-3.5" /> رفض</button>
      {err && <span className="text-[10.5px] text-rag-red">{err}</span>}
    </div>
  );
}

export function WorkflowHistory({ history }: { history: NonNullable<WorkflowView["history"]> }) {
  const label: Record<string, string> = { start: "بدء", approve: "إحالة / اعتماد", reject: "رفض", return: "إعادة" };
  return (
    <ul className="space-y-1 text-[10.5px]">{history.map((h) => (
      <li key={h.id} className="flex items-center gap-2 text-brand-muted"><span className="num">{new Date(h.createdAt).toLocaleDateString("ar-SA")}</span><span className="font-semibold text-brand-text">{label[h.action] ?? h.action}</span>{h.toStage && <span>→ {h.toStage}</span>}<span>{h.userName ?? ""}</span>{h.noteAr && <span className="italic">— {h.noteAr}</span>}</li>
    ))}</ul>
  );
}
