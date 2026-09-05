import { Component, type ReactNode } from "react";

/** Last line of defence: a screen-level failure shows an Arabic message with a reload, never a blank page. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error("Screen error:", error); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="card mx-auto my-10 max-w-lg px-6 py-8 text-center">
        <div className="text-[15px] font-bold">حدث خطأ غير متوقع في هذه الشاشة</div>
        <div className="mt-1 text-[12px] text-brand-muted">تم تسجيل الخطأ. يمكنك إعادة تحميل الشاشة أو العودة إلى النظرة التنفيذية.</div>
        <div className="mt-4 flex items-center justify-center gap-2">
          <button onClick={() => { this.setState({ error: null }); location.reload(); }} className="rounded-md bg-brand px-3 py-1.5 text-[12px] font-semibold text-white">إعادة التحميل</button>
          <a href="/overview" className="rounded-md border border-brand-border bg-white px-3 py-1.5 text-[12px] font-semibold">النظرة التنفيذية</a>
        </div>
      </div>
    );
  }
}
