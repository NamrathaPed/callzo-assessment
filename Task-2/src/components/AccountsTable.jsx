import { useState } from 'react'
import { Spinner } from './Spinner'

const COLUMNS = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Name' },
  { key: 'company', label: 'Company' },
  { key: 'country', label: 'Country' },
  { key: 'plan', label: 'Plan' },
  { key: 'status', label: 'Status' },
  { key: 'signup_date', label: 'Signed up' },
  { key: 'current_month_minutes', label: 'Minutes' },
  { key: 'current_month_sms', label: 'SMS' },
  { key: 'cost_cents', label: 'Cost' },
  { key: 'last_active', label: 'Last active' },
]

export function AccountsTable({
  data,
  total,
  page,
  pageSize,
  loading,
  error,
  selectedIds,
  sortBy,
  sortDir,
  onSetPage,
  onSort,
  onToggleSelection,
  onSelectAllPage,
  onClearSelection,
  onEdit,
}) {
  const [sortByInternal, setSortByInternal] = useState(sortBy)
  const [sortDirInternal, setSortDirInternal] = useState(sortDir)

  const handleSort = (key) => {
    let dir = 'asc'
    if (key === sortByInternal && sortDirInternal === 'asc') dir = 'desc'
    setSortByInternal(key)
    setSortDirInternal(dir)
    onSort(key, dir)
  }

  const rows = Array.isArray(data) ? data : []
  const isSelectedAll = rows.length > 0 && rows.every((r) => selectedIds.has(String(r.id)))
  const isIndeterminate = rows.length > 0 && !isSelectedAll && rows.some((r) => selectedIds.has(String(r.id)))

  if (loading) return <Spinner label="Loading accounts..." />
  if (error) return <ErrorState message={error} onRetry={() => {}} />

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        <EmptyState message="Try adjusting your search or filters." title="No accounts found" />
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 flex flex-wrap items-center gap-4 text-sm">
        <div className="flex items-center gap-2 text-gray-700 font-medium">
          <span className="font-semibold">{rows.length}</span> of <span className="font-semibold">{total}</span> accounts
        </div>
        <div className="flex-1"></div>
        {selectedIds.size > 0 && (
          <button
            onClick={onClearSelection}
            className="btn-ghost text-xs text-red-600 hover:text-red-800 underline"
            aria-label="Clear selection"
          >
            Clear selection ({selectedIds.size})
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th scope="col" className="w-10 p-3">
                <input
                  type="checkbox"
                  checked={isSelectedAll}
                  indeterminate={isIndeterminate}
                  onChange={() => {
                    if (isSelectedAll) onClearSelection()
                    else onSelectAllPage(rows.map((r) => String(r.id)))
                  }}
                  aria-label={isSelectedAll ? 'Deselect all on this page' : 'Select all on this page'}
                />
              </th>
              {COLUMNS.map(({ key, label }) => {
                const sorted = key === sortByInternal
                return (
                  <th
                    key={key}
                    scope="col"
                    className="p-3 cursor-pointer select-none hover:bg-gray-100"
                    onClick={() => handleSort(key)}
                  >
                    <button className="flex items-center gap-1 text-gray-600 font-medium" aria-sort={sorted ? (sortDirInternal === 'asc' ? 'ascending' : 'descending') : 'none'}>
                      {label}
                      {sorted && (sortDirInternal === 'asc' ? ' ▲' : ' ▼')}
                    </button>
                  </th>
                )
              })}
              <th scope="col" className="p-3 text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rows.map((row) => {
              const id = String(row.id)
              const selected = selectedIds.has(id)
              return (
                <tr
                  key={id}
                  className={`hover:bg-gray-50 border-b border-gray-100 transition-colors ${selected ? 'bg-blue-50' : ''}`}
                >
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => onToggleSelection(id)}
                      aria-label={`Select ${row.name}`}
                    />
                  </td>
                  <td className="p-3 tabular-nums text-gray-500">{row.id}</td>
                  <td className="p-3 font-medium">{row.name}</td>
                  <td className="p-3">{row.company}</td>
                  <td className="p-3">{row.country}</td>
                  <td className="p-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${row.plan === 'enterprise' ? 'bg-purple-100 text-purple-700' : row.plan === 'pro' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                      {row.plan}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${row.status === 'active' ? 'bg-green-100 text-green-700' : row.status === 'suspended' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="p-3 whitespace-nowrap">{row.signup_date}</td>
                  <td className="p-3 tabular-nums">{row.current_month_minutes}</td>
                  <td className="p-3 tabular-nums">{row.current_month_sms}</td>
                  <td className="p-3 tabular-nums font-medium">${(((row && row.cost_cents) || 0) / 100).toFixed(2)}</td>
                  <td className="p-3">{row.last_active}</td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => onEdit(id)}
                      className="btn-ghost text-xs underline text-blue-600 hover:text-blue-800"
                      aria-label={`Edit settings for ${row.name}`}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 text-gray-700">
          Showing{' '}
          <span className="font-semibold">{Math.min((page - 1) * pageSize + 1, total)}</span>{' '}
          to{' '}
          <span className="font-semibold">{Math.min(page * pageSize, total)}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            disabled={page === 1}
            onClick={() => onSetPage(page - 1)}
            className="btn-secondary"
            aria-label="Previous page"
          >
            Prev
          </button>
          <span className="text-gray-600">{page}</span>
          <button
            disabled={page * pageSize >= total}
            onClick={() => onSetPage(page + 1)}
            className="btn-secondary"
            aria-label="Next page"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
