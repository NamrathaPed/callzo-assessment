import { useState, useCallback } from 'react'
import { useAccounts, useSummary, REFRESH_MS } from '../hooks/useAccounts'
import { AccountsTable } from '../components/AccountsTable'
import { SummaryChart } from '../components/SummaryChart'
import { DateRangeFilter } from '../components/DateRangeFilter'
import { ErrorState, EmptyState, PartialFailure } from '../components/Status'
import { Spinner } from '../components/Spinner'

const STATUSES = ['active', 'trial', 'suspended']
const PLANS = ['basic', 'pro', 'enterprise']
const COUNTRIES = ['US', 'IN', 'GB', 'CA', 'AU']

export default function AccountsView({ onEditAccount, onSetView }) {
  const [chartErr, setChartErr] = useState(null)

  const {
    data,
    total,
    page,
    pageSize,
    loading,
    refreshing,
    error,
    filters,
    sortBy,
    sortDir,
    selectedIds,
    setPage,
    setFilters,
    setSort,
    toggleSelection,
    selectAllPage,
    clearSelection,
    refetch,
  } = useAccounts({
    search: '',
    status: '',
    country: '',
    plan: '',
    dateFrom: '',
    dateTo: '',
  })

  const {
    series,
    totalAccounts,
    loading: chartLoading,
    error: chartError,
    refetch: refetchSummary,
  } = useSummary({
    dateFrom: filters.dateFrom || '',
    dateTo: filters.dateTo || '',
  })

  const handleFilters = useCallback((next) => {
    setFilters((s) => ({ ...s, ...next }))
  }, [setFilters])

  const handleDateChange = useCallback((next) => {
    setFilters((s) => ({ ...s, dateFrom: next.dateFrom, dateTo: next.dateTo }))
  }, [setFilters])

  const handleRetryChart = useCallback(() => {
    setChartErr(null)
    refetchSummary()
  }, [refetchSummary])

  const activeFilters = []
  if (filters.search) activeFilters.push({ key: 'search', label: 'Search', value: filters.search })
  if (filters.status) activeFilters.push({ key: 'status', label: 'Status', value: filters.status })
  if (filters.plan) activeFilters.push({ key: 'plan', label: 'Plan', value: filters.plan })
  if (filters.country) activeFilters.push({ key: 'country', label: 'Country', value: filters.country })
  if (filters.dateFrom) activeFilters.push({ key: 'dateFrom', label: 'Signed up from', value: filters.dateFrom })
  if (filters.dateTo) activeFilters.push({ key: 'dateTo', label: 'Signed up to', value: filters.dateTo })

  if (loading) return <Spinner label="Loading accounts…" />
  if (error) return <ErrorState message={error} onRetry={refetch} title="Failed to load accounts" />

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Accounts</h1>
          <p className="text-sm text-gray-500" aria-live="polite">
            {total} total accounts · {refreshing ? 'refreshing…' : `refreshes every ${REFRESH_MS / 1000}s`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            disabled={selectedIds.size === 0}
            onClick={clearSelection}
            className="btn-ghost text-xs"
            aria-label="Clear selection"
          >
            Clear selection
          </button>
          <button onClick={refetch} className="btn-ghost text-xs" aria-label="Refresh now">
            Refresh
          </button>
        </div>
      </div>

      <DateRangeFilter
        dateFrom={filters.dateFrom || ''}
        dateTo={filters.dateTo || ''}
        onChange={handleDateChange}
      />

      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-3 border-b border-gray-200 bg-blue-50">
          <span className="text-xs font-medium text-blue-800">Active filters:</span>
          {activeFilters.map((f) => {
            const remove = () => {
              setFilters((s) => {
                const next = { ...s }
                delete next[f.key]
                return next
              })
            }
            return (
              <span
                key={f.key}
                className="flex items-center gap-1 px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs border border-blue-200"
              >
                {f.label}: {f.value}
                <button
                  onClick={remove}
                  className="ml-1 text-blue-600 hover:text-blue-900"
                  aria-label={`Remove ${f.label} filter`}
                >
                  ×
                </button>
              </span>
            )
          })}
          <button
            onClick={() =>
              setFilters({ search: '', status: '', country: '', plan: '', dateFrom: '', dateTo: '' })
            }
            className="text-xs underline text-blue-600 hover:text-blue-900 ml-3"
            aria-label="Clear all filters"
          >
            Clear all
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 p-3 border-b border-gray-200 bg-white">
        <div className="relative flex-1 min-w-[200px]">
          <label className="label">Search</label>
          <input
            type="search"
            value={filters.search || ''}
            onChange={(e) => handleFilters({ search: e.target.value })}
            className="input pl-9"
            placeholder="Name, email, company…"
            aria-label="Search accounts by name, email, or company"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
        </div>
        <div className="relative min-w-[150px]">
          <label className="label">Status</label>
          <select
            value={filters.status || ''}
            onChange={(e) => handleFilters({ status: e.target.value })}
            className="input"
            aria-label="Filter by account status"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="relative min-w-[150px]">
          <label className="label">Plan</label>
          <select
            value={filters.plan || ''}
            onChange={(e) => handleFilters({ plan: e.target.value })}
            className="input"
            aria-label="Filter by plan"
          >
            <option value="">All plans</option>
            {PLANS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div className="relative min-w-[150px]">
          <label className="label">Country</label>
          <select
            value={filters.country || ''}
            onChange={(e) => handleFilters({ country: e.target.value })}
            className="input"
            aria-label="Filter by country"
          >
            <option value="">All countries</option>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button
            onClick={() => setSort('id', 'asc')}
            className={`btn-ghost text-xs ${sortBy === 'id' && sortDir === 'asc' ? 'bg-blue-50 text-blue-700' : ''}`}
          >
            ID ▲
          </button>
          <button
            onClick={() => setSort('id', 'desc')}
            className={`btn-ghost text-xs ${sortBy === 'id' && sortDir === 'desc' ? 'bg-blue-50 text-blue-700' : ''}`}
          >
            ID ▼
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7">
          <AccountsTable
            data={data}
            total={total}
            page={page}
            pageSize={pageSize}
            loading={false}
            error={null}
            selectedIds={selectedIds}
            sortBy={sortBy}
            sortDir={sortDir}
            onSetPage={setPage}
            onSort={setSort}
            onToggleSelection={toggleSelection}
            onSelectAllPage={selectAllPage}
            onClearSelection={clearSelection}
            onEdit={(id) => {
              onEditAccount(id)
              onSetView('settings')
            }}
          />
        </div>
        <div className="lg:col-span-5">
          <SummaryChart
            series={series}
            loading={chartLoading}
            error={chartError || chartErr}
            onRetry={handleRetryChart}
          />
        </div>
      </div>
    </div>
  )
}
