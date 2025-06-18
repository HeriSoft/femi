import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackUIMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI.
    // We store the error itself to potentially display it.
    return { hasError: true, error: error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in ErrorBoundary:", error, errorInfo);
    this.setState({ errorInfo: errorInfo });
    // You could also log the error to an error reporting service here
    // Example: logErrorToMyService(error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
            padding: '20px', 
            margin: '20px', 
            border: '2px dashed #cc0000', 
            borderRadius: '8px',
            backgroundColor: '#fff0f0', 
            color: '#a00000',
            fontFamily: 'sans-serif'
        }}>
          <h2>{this.props.fallbackUIMessage || "Oops! Something went wrong."}</h2>
          <p>We're sorry for the inconvenience. Please try refreshing the page, or contact support if the problem persists.</p>
          {this.state.error && (
            <details style={{ whiteSpace: 'pre-wrap', marginTop: '15px', fontSize: '0.9em' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Error Details (for developers)</summary>
              <div style={{ marginTop: '5px', padding: '10px', backgroundColor: '#ffebeb', border: '1px solid #ffcccc', borderRadius: '4px' }}>
                <p><strong>Message:</strong> {this.state.error.toString()}</p>
                {this.state.errorInfo && <p><strong>Component Stack:</strong><br/>{this.state.errorInfo.componentStack.split('\n').map((line, i) => <span key={i}>{line}<br/></span>)}</p>}
                {this.state.error.stack && <p><strong>Stack Trace:</strong><br />{this.state.error.stack.split('\n').map((line, i) => <span key={i}>{line}<br/></span>)}</p>}
              </div>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
