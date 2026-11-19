import { useState, useEffect, useRef, useCallback } from 'react'

const STEPS = [
  { id: 1, label: 'Account', fields: ['name', 'email'] },
  { id: 2, label: 'Plan', fields: ['plan', 'billing_country'] },
  { id: 3, label: 'Caps', fields: ['minutes_cap', 'sms_cap'] },
  { id: 4, label: 'Webhook', fields: ['webhook_url'] },
]

const PLAN_OPTIONS = ['basic', 'pro', 'enterprise']
const COUNTRY_OPTIONS = ['US', 'IN', 'GB', 'CA', 'AU']

export function SettingsForm({ accountId, drafts, stepErrors, failedData, saving, submitError, setDraft, setStepError, clearStepError, saveStep, submit, onBack }) {
  const [step, setStep] = useState(1)
  const [local, setLocal] = useState({})
  const [dirty, setDirty] = useState(false)
  const firstInputRef = useRef(null)
  const saveTimer = useRef(null)
  const touchedRef = useRef(false)
  const [submitted, setSubmitted] = useState(false)

  // Adopt the saved draft when the step changes (and focus its first input).
  // A rejected draft wins, so the value that caused the error stays visible with it.
  useEffect(() => {
    const rejected = failedData?.[step]
    touchedRef.current = false
    setLocal(rejected || drafts[step] || {})
    setDirty(Boolean(rejected))
    const timer = setTimeout(() => {
      if (firstInputRef.current) firstInputRef.current.focus()
    }, 50)
    return () => clearTimeout(timer)
  }, [step, failedData])

  // Hydrate from the server once drafts arrive, without clobbering in-progress typing.
  useEffect(() => {
    if (touchedRef.current || failedData?.[step]) return
    const server = drafts[step]
    if (!server) return
    setLocal((cur) => (Object.keys(cur).length === 0 ? server : cur))
  }, [drafts, step, failedData])

  const normalize = (data) => {
    const next = { ...data }
    if (next.minutes_cap !== undefined && next.minutes_cap !== '') next.minutes_cap = Number(next.minutes_cap)
    if (next.sms_cap !== undefined && next.sms_cap !== '') next.sms_cap = Number(next.sms_cap)
    return next
  }

  const flush = useCallback(() => {
    if (!dirty) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setDirty(false)
    saveStep(step, normalize(local))
  }, [dirty, local, step, saveStep])

  // Autosave: debounce saving the current step when local changes
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    if (!dirty) return
    saveTimer.current = setTimeout(() => {
      saveStep(step, normalize(local)).then(({ ok }) => {
        if (ok) setDirty(false)
      })
    }, 500)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [dirty, local, step, saveStep])

  const setField = useCallback((field, value) => {
    touchedRef.current = true
    setLocal((d) => {
      const next = { ...d, [field]: value }
      setDirty(true)
      return next
    })
    // Clear server error for this field when user starts typing
    const nextErrors = { ...(stepErrors[step] || {}) }
    if (nextErrors[field]) {
      delete nextErrors[field]
      setStepError(step, nextErrors)
    }
  }, [step, stepErrors, setStepError])

  const canProceed = (s) => {
    const d = drafts[s] || {}
    if (s === 1) return !!(d.name && d.email)
    if (s === 2) return !!(d.plan && d.billing_country)
    if (s === 3) return true
    if (s === 4) return true
    return false
  }

  const allStepsSaved = () => STEPS.every(({ id }) => !!(drafts[id] && Object.keys(drafts[id]).length > 0))

  const goTo = (n) => {
    if (n < 1 || n > 4 || n === step) return
    flush()
    setStep(n)
  }

  const prev = () => {
    if (step > 1) goTo(step - 1)
  }

  const next = () => {
    if (step < 4 && canProceed(step)) goTo(step + 1)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!allStepsSaved()) return
    flush()
    const res = await submit()
    if (res.ok) setSubmitted(true)
  }

  const stepDef = STEPS.find((s) => s.id === step)
  const errors = stepErrors[step] || {}
  const stepSaving = saving

  if (submitted) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
        <h3 className="text-sm font-semibold text-green-800">Settings saved</h3>
        <p className="mt-2 text-sm text-green-700">All 4 steps are finalized for this account.</p>
        <button onClick={onBack} className="mt-4 btn btn-primary">Back to accounts</button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={onBack} className="btn-ghost text-sm mb-4 flex items-center gap-1" aria-label="Back to accounts list">
        ← Back
      </button>

      {/* Step indicator */}
      <div className="flex gap-2 mb-6">
        {STEPS.map((s) => {
          const completed = !!(drafts[s.id] && Object.keys(drafts[s.id]).length > 0)
          const active = step === s.id
          const hasError = Object.keys(stepErrors[s.id] || {}).length > 0
          return (
            <button
              key={s.id}
              onClick={() => goTo(s.id)}
              className={`flex-1 flex flex-col items-center gap-1 px-3 py-2 rounded-md text-sm transition ${
                hasError
                  ? 'bg-red-50 text-red-700 font-semibold border border-red-300'
                  : active
                  ? 'bg-blue-100 text-blue-700 font-semibold border border-blue-300'
                  : completed
                  ? 'bg-green-100 text-green-700 font-semibold border border-green-300'
                  : 'bg-gray-100 text-gray-500 border border-gray-300'
              }`}
              aria-current={active ? 'step' : undefined}
              aria-label={active ? `Step ${s.id} of 4: ${s.label} (current)` : `Step ${s.id}: ${s.label}${completed ? ', complete' : ''}`}
            >
              <span className="font-mono">{s.id}</span>
              <span className="text-balance">{s.label}</span>
              {hasError && <span className="text-[10px]" aria-hidden="true">⚠</span>}
            </button>
          )
        })}
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="space-y-4">
          {step === 1 && (
            <>
              <div>
                <label htmlFor="name" className="label">Name</label>
                <input
                  ref={firstInputRef}
                  id="name"
                  type="text"
                  value={local.name || ''}
                  onChange={(e) => setField('name', e.target.value)}
                  className={`input ${errors.name ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}`}
                  aria-invalid={errors.name ? 'true' : 'false'}
                  aria-describedby={errors.name ? 'name-error' : undefined}
                  required
                />
                {errors.name && <p id="name-error" className="text-xs text-red-600 mt-1" role="alert">{errors.name}</p>}
              </div>
              <div className="mt-4">
                <label className="label">Email</label>
                <input
                  id="email"
                  type="email"
                  value={local.email || ''}
                  onChange={(e) => setField('email', e.target.value)}
                  className={`input ${errors.email ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}`}
                  aria-invalid={errors.email ? 'true' : 'false'}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                  required
                />
                {errors.email && <p id="email-error" className="text-xs text-red-600 mt-1" role="alert">{errors.email}</p>}
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <div>
                <label className="label">Plan</label>
                <select
                  id="plan"
                  value={local.plan || ''}
                  onChange={(e) => setField('plan', e.target.value)}
                  className={`input ${errors.plan ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}`}
                  aria-invalid={errors.plan ? 'true' : 'false'}
                  aria-describedby={errors.plan ? 'plan-error' : undefined}
                >
                  <option value="">Select a plan</option>
                  {PLAN_OPTIONS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                {errors.plan && <p id="plan-error" className="text-xs text-red-600 mt-1" role="alert">{errors.plan}</p>}
              </div>
              <div className="mt-4">
                <label className="label">Billing country</label>
                <select
                  id="billing-country"
                  value={local.billing_country || ''}
                  onChange={(e) => setField('billing_country', e.target.value)}
                  className={`input ${errors.billing_country ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}`}
                  aria-invalid={errors.billing_country ? 'true' : 'false'}
                  aria-describedby={errors.billing_country ? 'country-error' : undefined}
                >
                  <option value="">Select a country</option>
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                {errors.billing_country && (
                  <p id="country-error" className="text-xs text-red-600 mt-1" role="alert">{errors.billing_country}</p>
                )}
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <div>
                <label className="label">Minutes cap</label>
                <input
                  id="minutes-cap"
                  type="number"
                  min="0"
                  value={local.minutes_cap !== undefined ? String(local.minutes_cap) : ''}
                  onChange={(e) => setField('minutes_cap', e.target.value)}
                  className={`input ${errors.minutes_cap ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}`}
                  aria-invalid={errors.minutes_cap ? 'true' : 'false'}
                  aria-describedby={errors.minutes_cap ? 'minutes-error' : undefined}
                  placeholder="Optional"
                />
                {errors.minutes_cap && (
                  <p id="minutes-error" className="text-xs text-red-600 mt-1" role="alert">{errors.minutes_cap}</p>
                )}
              </div>
              <div className="mt-4">
                <label className="label">SMS cap</label>
                <input
                  id="sms-cap"
                  type="number"
                  min="0"
                  value={local.sms_cap !== undefined ? String(local.sms_cap) : ''}
                  onChange={(e) => setField('sms_cap', e.target.value)}
                  className={`input ${errors.sms_cap ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}`}
                  aria-invalid={errors.sms_cap ? 'true' : 'false'}
                  aria-describedby={errors.sms_cap ? 'sms-error' : undefined}
                  placeholder="Optional"
                />
                {errors.sms_cap && <p id="sms-error" className="text-xs text-red-600 mt-1" role="alert">{errors.sms_cap}</p>}
              </div>
            </>
          )}
          {step === 4 && (
            <div>
              <label className="label">Webhook URL</label>
              <input
                id="webhook-url"
                type="url"
                value={local.webhook_url || ''}
                onChange={(e) => setField('webhook_url', e.target.value)}
                className={`input ${errors.webhook_url ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}`}
                aria-invalid={errors.webhook_url ? 'true' : 'false'}
                aria-describedby={errors.webhook_url ? 'webhook-error' : undefined}
                placeholder="https://example.com/webhook"
              />
              {errors.webhook_url && (
                <p id="webhook-error" className="text-xs text-red-600 mt-1" role="alert">{errors.webhook_url}</p>
              )}
            </div>
          )}
        </div>

        {/* Step-level notice for cross-step behavior */}
        {step === 2 && drafts[4] && Object.keys(drafts[4]).length > 0 && errors.billing_country && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm text-amber-800">
              Your webhook (step 4) is already saved. The server may reject changes to the billing country
              until the webhook draft is cleared. You can still complete and submit the form.
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-col sm:flex-row sm:justify-end gap-3">
          <button
            type="button"
            disabled={step === 1}
            onClick={prev}
            className="btn-secondary"
          >
            Previous
          </button>
          {step < 4 ? (
            <button
              type="button"
              disabled={!canProceed(step)}
              onClick={next}
              className="btn-primary"
            >
              Next
            </button>
          ) : (
            <button
              type="submit"
              disabled={!allStepsSaved() || stepSaving}
              className="btn-primary"
            >
              Finalize all steps
            </button>
          )}
        </div>

        {stepSaving && (
          <p className="mt-2 text-xs text-gray-500">Saving draft…</p>
        )}
        {submitError && (
          <p role="alert" className="mt-2 text-xs text-red-600">{submitError}</p>
        )}
      </form>
    </div>
  )
}
