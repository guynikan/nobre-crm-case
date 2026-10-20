"use client";

import { Component, type ReactNode } from "react";

interface Props {
  fallback: (error: unknown, reset: () => void) => ReactNode;
  children: ReactNode;
}

/** Catches render and suspense-query errors so one broken panel does not blank the page. */
export class ErrorBoundary extends Component<Props, { error: unknown }> {
  state = { error: null as unknown };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  reset = () => this.setState({ error: null });

  render() {
    return this.state.error ? this.props.fallback(this.state.error, this.reset) : this.props.children;
  }
}
