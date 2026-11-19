import { useState, useEffect } from 'react'

export function DateRangeFilter({ dateFrom, dateTo, onChange }) {
  const [localFrom, setLocalFrom] = useState(dateFrom || '')
  const [localTo, setLocalTo] = useState(dateTo || '')

  useEffect(() => {
    setLocalFrom(dateFrom || '')
    setLocalTo(dateTo || '')
  }, [dateFrom, dateTo])

  const handleApply = () => {
    onChange({ dateFrom: localFrom, dateTo: localTo })
  }

  const handleClear = () => {
    setLocalFrom('')
    setLocalTo('')
    onChange({ dateFrom: '', dateTo: '' })
  }

  return (
    <div className="flex flex-wrap items-center gap-4 p-3 border-b border-gray-200 bg-white">
      <label htmlFor="date-from" className="label">
        Signed up from
      </label>
      <input
        id="date-from"
        type="date"
        value={localFrom}
        onChange={(e) => setLocalFrom(e.target.value)}
        className="input"
        aria-label="Filter accounts by signup date from"
      />
      <label htmlFor="date-to" className="label">
        Signed up to
      </label>
      <input
        id="date-to"
        type="date"
        value={localTo}
        onChange={(e) => setLocalTo(e.target.value)}
        className="input"
        aria-label="Filter accounts by signup date to"
      />
      <button onClick={handleApply} className="btn-primary">
        Apply
      </button>
      <button onClick={handleClear} className="btn-ghost text-xs">
        Clear
      </button>
    </div>
  )
}
