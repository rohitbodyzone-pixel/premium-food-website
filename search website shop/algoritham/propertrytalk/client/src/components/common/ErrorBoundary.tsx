import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`💥 [ErrorBoundary${this.props.name ? `:${this.props.name}` : ''}] caught an error:`, error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleHome = () => {
    window.location.href = '/';
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[300px] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-6 shadow-sm text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 border border-red-100">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-slate-900 mb-1">
              Temporary Display Issue
            </h3>

            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              PropertyTalk encountered an unexpected error rendering this view. You can reload or return to the main dashboard safely.
            </p>

            <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
              <button
                onClick={this.handleReload}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload Page</span>
              </button>

              <button
                onClick={this.handleHome}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition flex items-center justify-center gap-1.5"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Home</span>
              </button>

              <button
                onClick={this.handleReset}
                className="px-3 py-2 rounded-xl text-slate-400 hover:text-slate-600 text-xs transition"
              >
                Try Again
              </button>
            </div>

            {process.env.NODE_ENV !== 'production' && this.state.error && (
              <details className="mt-4 text-left text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200 max-h-36 overflow-auto">
                <summary className="cursor-pointer font-mono font-medium text-slate-700">Error Details</summary>
                <p className="mt-1 font-mono text-red-600 break-all">{this.state.error.message}</p>
                {this.state.errorInfo?.componentStack && (
                  <pre className="mt-1 font-mono text-[10px] text-slate-400 whitespace-pre-wrap">{this.state.errorInfo.componentStack}</pre>
                )}
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
