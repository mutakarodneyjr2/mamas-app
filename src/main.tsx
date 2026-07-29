import React, { StrictMode, useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, errorInfo: null };

  constructor(props: Props) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ backgroundColor: '#dc2626', color: 'white', minHeight: '100vh', padding: '2rem', fontFamily: 'sans-serif', zIndex: 9999, position: 'relative' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem' }}>Component Rendering Error</h1>
          <p style={{ fontSize: '1.25rem', marginBottom: '1rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {this.state.error && this.state.error.toString()}
          </p>
          {this.state.errorInfo && (
            <pre style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '0.5rem', overflow: 'auto', marginBottom: '1rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.875rem' }}>
              {this.state.errorInfo.componentStack}
            </pre>
          )}
          <button 
            onClick={() => window.location.reload()}
            style={{ padding: '0.75rem 1.5rem', backgroundColor: 'white', color: '#dc2626', border: 'none', borderRadius: '0.25rem', fontSize: '1.125rem', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function GlobalErrorCatcher({ children }: { children: ReactNode }) {
  const [globalError, setGlobalError] = useState<Error | string | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setGlobalError(event.error || event.message);
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      setGlobalError(event.reason || "Unhandled Promise Rejection");
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  if (globalError) {
    return (
      <div style={{ backgroundColor: '#dc2626', color: 'white', minHeight: '100vh', padding: '2rem', fontFamily: 'sans-serif', zIndex: 9999, position: 'relative' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem' }}>Global JavaScript Error</h1>
        <p style={{ fontSize: '1.25rem', marginBottom: '1rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {typeof globalError === 'string' ? globalError : globalError?.toString()}
        </p>
        {typeof globalError === 'object' && globalError?.stack && (
          <pre style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '0.5rem', overflow: 'auto', marginBottom: '1rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.875rem' }}>
            {globalError.stack}
          </pre>
        )}
        <button 
          onClick={() => window.location.reload()}
          style={{ padding: '0.75rem 1.5rem', backgroundColor: 'white', color: '#dc2626', border: 'none', borderRadius: '0.25rem', fontSize: '1.125rem', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Reload App
        </button>
      </div>
    );
  }

  return <>{children}</>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalErrorCatcher>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </GlobalErrorCatcher>
  </StrictMode>,
);
