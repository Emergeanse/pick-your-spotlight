import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportError } from "@/lib/error-log";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
    // C'est l'erreur la plus grave qui soit côté navigateur : elle a fait
    // tomber l'écran. Elle ne doit surtout pas rester dans la seule console.
    void reportError(error, {
      origine: "frontière React",
      composants: info.componentStack?.slice(0, 1000) ?? null,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex flex-col items-center justify-center min-h-dvh gap-4 p-6 text-center">
            <p className="text-foreground/60 text-sm font-sans">
              Oups, quelque chose s'est mal passé. Rafraîchis la page.
            </p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="px-4 py-2 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-sans"
            >
              Réessayer
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
