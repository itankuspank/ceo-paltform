/** Formatting helpers shared by client screens. Arabic government register. */
export function fmtMoney(millions: number): string {
  if (millions >= 1000) return `${(millions / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })} مليار ريال`;
  return `${Math.round(millions).toLocaleString("en-US")} مليون ريال`;
}
export function fmtPct(v: number, digits = 0): string {
  return `${v.toLocaleString("en-US", { maximumFractionDigits: digits })}%`;
}
export const RAG_LABEL: Record<string, string> = { on_track: "على المسار", at_risk: "معرض للخطر", off_track: "خارج المسار" };
export const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
