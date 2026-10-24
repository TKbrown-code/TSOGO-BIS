import React from "react";
import { Link } from "react-router-dom";
import "../../styles/route-errors.css";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to console in development
    console.error("Error caught by boundary:", error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // TODO: Send to error tracking service (e.g., Sentry)
    // logErrorToService(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="app-error-page">
          <span className="app-error-mark" aria-hidden="true">TS</span>
          <span className="app-error-brand">TSOGO-BIS · A CONSIDERED EDIT</span>
          <h1>We hit an unexpected problem</h1>
          <p>Your page could not be displayed just now. You can try again or return to the shop.</p>
          <div className="app-error-actions">
            <button type="button" onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}>Try again</button>
            <Link to="/" onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}>Return to the shop</Link>
          </div>
          
          {import.meta.env.DEV && this.state.error && (
            <details style={{ marginTop: "2rem", textAlign: "left", maxWidth: "600px" }}>
              <summary style={{ cursor: "pointer", color: "#666" }}>
                Error Details (Development Only)
              </summary>
              <pre style={{
                backgroundColor: "#f4f4f4",
                padding: "1rem",
                borderRadius: "4px",
                overflow: "auto",
                fontSize: "0.875rem"
              }}>
                {this.state.error.toString()}
                {this.state.errorInfo && this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
        </main>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
