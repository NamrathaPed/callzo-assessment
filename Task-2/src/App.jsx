import { useState } from 'react'
import ErrorBoundary from './components/ErrorBoundary'
import AccountsView from './views/AccountsView'
import SettingsView from './views/SettingsView'

export default function App() {
  const [view, setView] = useState('accounts')
  const [accountId, setAccountId] = useState(null)
  const [error, setError] = useState(null)

  if (error) {
    return (
      <div className="min-h-screen p-4 flex flex-col items-center justify-center">
        <h1 className="text-red-800 font-bold">Application Error</h1>
        <p className="mt-2 text-red-600">{error}</p>
        <button
          onClick={() => setError(null)}
          className="mt-4 btn btn-primary"
        >
          Reload
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <a href="#main" className="skip-link">Skip to main content</a>
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-blue-600">Callzo</span>
            <span className="text-sm text-gray-500">Usage Admin</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView('accounts')}
              className={`btn-ghost ${view === 'accounts' ? 'bg-blue-50 text-blue-700 font-semibold' : ''}`}
              aria-pressed={view === 'accounts'}
            >
              Accounts
            </button>
          </div>
        </div>
      </header>

      <main id="main" className="max-w-6xl mx-auto px-4 py-6" tabIndex={-1} aria-label="Main content">
        <ErrorBoundary>
          {view === 'accounts' ? (
            <AccountsView onEditAccount={setAccountId} onSetView={(v) => setView(v)} />
          ) : (
            <SettingsView accountId={accountId} onBack={() => { setAccountId(null); setView('accounts') }} />
          )}
        </ErrorBoundary>
      </main>

      <footer className="max-w-6xl mx-auto px-4 pb-6 text-xs text-gray-400">
        build {__BUILD_ID__}
      </footer>
    </div>
  )
}
