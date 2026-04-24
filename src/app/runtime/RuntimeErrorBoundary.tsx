import { Component, type ReactNode } from 'react';

interface RuntimeErrorBoundaryProps {
  children: ReactNode;
  fallback: (error: Error) => ReactNode;
}

interface RuntimeErrorBoundaryState {
  error: Error | null;
}

export class RuntimeErrorBoundary extends Component<
  RuntimeErrorBoundaryProps,
  RuntimeErrorBoundaryState
> {
  state: RuntimeErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): RuntimeErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error): void {
    console.error('Holdfast runtime boundary caught an error', error);
  }

  override render(): ReactNode {
    if (this.state.error) {
      return this.props.fallback(this.state.error);
    }

    return this.props.children;
  }
}
