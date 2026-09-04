import { useLocation } from "react-router-dom";
import { Hammer } from "lucide-react";
import { ALL_ITEMS } from "@/lib/nav";
import { PageHeader, SourcesFooter } from "@/components/ui";

/** Temporary page for screens scheduled in later sprints — keeps every sidebar link navigable from day one. */
export default function PlaceholderPage() {
  const { pathname } = useLocation();
  const item = ALL_ITEMS.find((i) => pathname.startsWith(i.path));
  return (
    <div>
      <PageHeader title={item?.labelAr ?? "الشاشة"} subtitle={item?.labelEn} />
      <div className="card px-6 py-12 flex flex-col items-center text-center">
        <span className="h-12 w-12 rounded-full bg-brand-cream border border-brand-border inline-flex items-center justify-center text-brand-green"><Hammer className="h-5 w-5" /></span>
        <div className="mt-3 text-[14px] font-bold">هذه الشاشة ضمن السبرنت {item?.sprint ?? "القادم"}</div>
        <div className="mt-1 text-[12px] text-brand-muted max-w-md">تم تجهيز نموذج البيانات والواجهات البرمجية لهذه الشاشة؛ وستُبنى بمطابقة كاملة للنموذج الأولي المعتمد في السبرنت المحدد.</div>
      </div>
      <SourcesFooter />
    </div>
  );
}
