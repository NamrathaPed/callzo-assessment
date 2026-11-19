import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
} from 'recharts'
import { Spinner } from './Spinner'
import { EmptyState } from './Status'

export function SummaryChart({ series, loading, error, onRetry }) {
  const hasData = Array.isArray(series) && series.length > 0
  if (loading && !hasData) return <Spinner label="Loading usage chart..." />

  if (error && !hasData) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <h3 className="text-sm font-semibold text-amber-800 mb-2">Chart unavailable</h3>
        <p className="text-xs text-amber-700 mb-3">{error}</p>
        <button
          onClick={onRetry}
          className="text-xs underline text-blue-600 hover:text-blue-800"
          aria-label="Retry chart"
        >
          Retry chart
        </button>
      </div>
    )
  }

  if (!hasData) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Usage summary</h3>
        <EmptyState message="No summary data available for the selected range." title="No chart data" />
      </div>
    )
  }

  const chartData = series.map((s) => ({
    date: s.date,
    minutes: s.minutes,
    sms: s.sms,
    cost: Math.round((s.cost_cents || 0) / 100),
  }))

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Usage summary</h3>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} />
            <YAxis tickFormatter={(v) => `${v / 1000}k`} tick={{ fontSize: 11, fill: '#6b7280' }} />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const entry = payload[0].payload
                  return (
                    <div className="p-2 bg-white border border-gray-200 shadow-sm rounded">
                      <div className="text-xs font-medium text-gray-900">{entry.date}</div>
                      <div className="text-xs text-gray-600">Minutes: {entry.minutes.toLocaleString()}</div>
                      <div className="text-xs text-gray-600">SMS: {entry.sms.toLocaleString()}</div>
                      <div className="text-xs text-gray-600">Cost: ${entry.cost.toLocaleString()}</div>
                    </div>
                  )
                }
                return null
              }}
            />
            <Legend />
            <Line type="monotone" dataKey="minutes" stroke="#3b82f6" strokeWidth={2} name="Minutes" />
            <Line type="monotone" dataKey="sms" stroke="#10b981" strokeWidth={2} name="SMS" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
