import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null, errorInfo: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen p-6 flex flex-col items-center justify-center text-center">
          <h1 className="text-red-800 font-bold">Something went wrong</h1>
          <p className="mt-2 text-sm text-red-600">{this.state.error?.message || 'An unexpected error occurred'}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
            className="mt-4 btn btn-primary"
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
