import { Component, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-stone-950 text-stone-100 flex items-center justify-center p-6">
          <div className="max-w-md text-center space-y-3">
            <h1 className="text-xl font-bold text-red-400">Erreur d&apos;affichage</h1>
            <p className="text-sm text-stone-400 break-words">{this.state.error.message}</p>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                this.setState({ error: null });
                window.location.assign('/dashboard');
              }}
            >
              Recharger
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
