import React from "react";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  message: string;
};

export class AppErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: unknown): State {
    const msg = error instanceof Error ? error.message : String(error ?? "Unknown error");
    return { hasError: true, message: msg };
  }

  componentDidCatch(error: unknown, info: unknown) {
    // Keep it visible for debugging in dev tools.
    // eslint-disable-next-line no-console
    console.error("AppErrorBoundary caught error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen film-grain flex items-center justify-center p-6">
          <div className="glass rounded-3xl p-6 border border-red-500/20 max-w-2xl w-full">
            <div className="text-[11px] tracking-[0.18em] text-red-300 uppercase">render error</div>
            <div className="mt-2 text-xl font-semibold text-slate-100">The UI hit an unexpected runtime issue.</div>
            <div className="mt-3 text-sm text-slate-300 break-all">{this.state.message}</div>
            <div className="mt-4 text-xs text-slate-400">
              Try a hard refresh. If this persists, share this message and I will patch immediately.
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

