import React, { Component, ErrorInfo, ReactNode } from 'react';

export interface AppErrorBoundaryProps {
  children: ReactNode;
}

export interface AppErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    if (
      error?.message &&
      /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk/i.test(
        error.message
      )
    ) {
      const hasRefreshed = sessionStorage.getItem('chunk_reload_done') === 'true';
      if (!hasRefreshed) {
        sessionStorage.setItem('chunk_reload_done', 'true');
        window.location.reload();
      }
    }
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('AppErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '40px',
            textAlign: 'center',
            direction: 'rtl',
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f8fafc',
            fontFamily: 'inherit',
          }}
        >
          <h1 style={{ color: '#ef4444', marginBottom: '12px', fontSize: '22px' }}>
            عذراً، حدث خطأ ما في التطبيق.
          </h1>
          <p style={{ color: '#64748b', marginBottom: '16px', fontSize: '14px' }}>
            يرجى محاولة تحديث الصفحة أو العودة لاحقاً.
          </p>
          <pre
            style={{
              background: '#ffffff',
              padding: '16px',
              borderRadius: '8px',
              overflow: 'auto',
              textAlign: 'left',
              direction: 'ltr',
              fontSize: '12px',
              maxWidth: '600px',
              width: '100%',
              border: '1px solid #e2e8f0',
              marginBottom: '20px',
            }}
          >
            {this.state.error?.message || String(this.state.error || 'حدث خطأ غير متوقع')}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 24px',
              background: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            تحديث الصفحة
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default AppErrorBoundary;
