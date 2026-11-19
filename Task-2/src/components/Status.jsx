export function ErrorState({ message, onRetry, title = 'Something went wrong' }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center rounded-lg border border-red-200 bg-red-50">
      <h3 role="alert" className="text-sm font-semibold text-red-800">{title}</h3>
      <p className="mt-2 text-sm text-red-700">{message}</p>
      {onRetry && (
        <button
          key="retry"
          onClick={onRetry}
          className="mt-4 btn btn-primary"
          aria-label="Retry"
        >
          Retry
        </button>
      )}
    </div>
  )
}

export function EmptyState({ message = 'No accounts found.', title = 'No results' }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center rounded-lg border border-gray-200 bg-gray-50">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <p className="mt-2 text-sm text-gray-500">{message}</p>
    </div>
  )
}

export function PartialFailure({ message, onRetry }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm text-amber-800">{message}</p>
      {onRetry && (
        <button key="retry" onClick={onRetry} className="mt-2 text-xs underline text-blue-600">
          Retry
        </button>
      )}
    </div>
  )
}
