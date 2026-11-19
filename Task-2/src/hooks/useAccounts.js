import { useState, useEffect, useRef, useCallback } from 'react'
import { getAccounts, getSummary, getSettings, saveStep as saveStepApi } from '../lib/api'

const REFRESH_MS = 30000

export function useAccounts(initialFilters = {}) {
  const [state, setState] = useState({
    data: [],
    total: 0,
    page: 1,
    pageSize: 50,
    loading: true,
    refreshing: false,
    error: null,
    filters: { ...initialFilters },
    sortBy: 'id',
    sortDir: 'asc',
    selectedIds: new Set(),
  })

  const mounted = useRef(true)

  const setPage = useCallback((page) => setState((s) => ({ ...s, page })), [])

  const setFilters = useCallback((filters) => {
    setState((s) => ({
      ...s,
      filters: typeof filters === 'function' ? filters(s.filters) : filters,
      page: 1,
    }))
  }, [])

  const setSort = useCallback((sortBy, sortDir) => {
    setState((s) => ({ ...s, sortBy, sortDir, page: 1 }))
  }, [])

  const toggleSelection = useCallback((id) => {
    setState((s) => {
      const next = new Set(s.selectedIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { ...s, selectedIds: next }
    })
  }, [])

  const selectAllPage = useCallback((ids) => {
    setState((s) => {
      const next = new Set(s.selectedIds)
      ids.forEach((id) => next.add(id))
      return { ...s, selectedIds: next }
    })
  }, [])

  const clearSelection = useCallback(() => setState((s) => ({ ...s, selectedIds: new Set() })), [])

  const fetchAccounts = useCallback(async () => {
    if (!mounted.current) return
    setState((s) => ({
      ...s,
      loading: s.data.length === 0,
      refreshing: s.data.length > 0,
      error: null,
    }))
    try {
      const res = await getAccounts({
        page: state.page,
        page_size: state.pageSize,
        search: state.filters.search || undefined,
        status: state.filters.status || undefined,
        country: state.filters.country || undefined,
        plan: state.filters.plan || undefined,
        date_from: state.filters.dateFrom || undefined,
        date_to: state.filters.dateTo || undefined,
        sort_by: state.sortBy,
        sort_dir: state.sortDir,
      })
      if (!mounted.current) return
      setState((s) => ({
        ...s,
        data: res.data || [],
        total: res.total || 0,
        page: res.page || s.page,
        pageSize: res.page_size || s.pageSize,
        loading: false,
        refreshing: false,
        error: null,
      }))
    } catch (err) {
      if (!mounted.current) return
      setState((s) => ({ ...s, loading: false, refreshing: false, error: err.message || 'Failed to load accounts' }))
    }
  }, [state.page, state.pageSize, state.filters, state.sortBy, state.sortDir])

  useEffect(() => {
    mounted.current = true
    fetchAccounts()
    const timer = setInterval(fetchAccounts, REFRESH_MS)
    return () => {
      mounted.current = false
      clearInterval(timer)
    }
  }, [fetchAccounts])

  return {
    ...state,
    setPage,
    setFilters,
    setSort,
    toggleSelection,
    selectAllPage,
    clearSelection,
    refetch: fetchAccounts,
  }
}

export function useSummary({ dateFrom = '', dateTo = '' } = {}) {
  const [state, setState] = useState({
    series: [],
    totalAccounts: 0,
    loading: true,
    error: null,
  })

  const cancelledRef = useRef(false)

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const res = await getSummary({
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      })
      if (cancelledRef.current) return
      setState({
        series: res.series || [],
        totalAccounts: res.total_accounts || 0,
        loading: false,
        error: null,
      })
    } catch (err) {
      if (cancelledRef.current) return
      setState((s) => ({
        ...s,
        loading: false,
        error: err.message || 'Failed to load summary chart',
      }))
    }
  }, [dateFrom, dateTo])

  useEffect(() => {
    cancelledRef.current = false
    load()
    const timer = setInterval(load, REFRESH_MS)
    return () => {
      cancelledRef.current = true
      clearInterval(timer)
    }
  }, [load])

  return { ...state, refetch: load }
}

export function useSettings(accountId) {
  const [state, setState] = useState({
    drafts: {},
    stepErrors: {},
    loading: true,
    saving: false,
    loadError: null,
    error: null,
    submitted: false,
  })

  useEffect(() => {
    if (!accountId) return
    let cancelled = false
    const load = async () => {
      setState((s) => ({ ...s, loading: true, loadError: null, error: null }))
      try {
        const res = await getSettings(accountId)
        if (cancelled) return
        const drafts = {}
        for (const [k, v] of Object.entries(res || {})) {
          drafts[Number(k)] = v.data || {}
        }
        setState((s) => ({ ...s, drafts, loading: false, loadError: null }))
      } catch (err) {
        if (cancelled) return
        setState((s) => ({ ...s, loading: false, loadError: err.message || 'Failed to load settings' }))
      }
    }
    load()
    return () => { cancelled = true }
  }, [accountId])

  const setDraft = useCallback((step, data) => {
    setState((s) => ({ ...s, drafts: { ...s.drafts, [step]: data } }))
  }, [])

  const setStepError = useCallback((step, errors) => {
    setState((s) => ({ ...s, stepErrors: { ...s.stepErrors, [step]: errors } }))
  }, [])

  const clearStepError = useCallback((step) => {
    setState((s) => {
      const next = { ...s.stepErrors }
      delete next[step]
      return { ...s, stepErrors: next }
    })
  }, [])

  const saveStep = useCallback(async (step, data) => {
    if (!accountId) return { ok: false }
    setState((s) => ({ ...s, saving: true, error: null }))
    try {
      const res = await saveStepApi(accountId, step, data)
      setState((s) => {
        const nextErrors = { ...s.stepErrors }
        delete nextErrors[step]
        return {
          ...s,
          drafts: { ...s.drafts, [step]: res.data || data },
          saving: false,
          error: null,
          stepErrors: nextErrors,
        }
      })
      return { ok: true, data: res.data }
    } catch (err) {
      if (!accountId) return { ok: false }
      const stepErrors = err.body?.detail?.errors || {}
      setState((s) => ({
        ...s,
        saving: false,
        stepErrors: { ...s.stepErrors, [step]: stepErrors },
      }))
      return { ok: false, error: err }
    }
  }, [accountId])

  const submit = useCallback(async () => {
    if (!accountId) return { ok: false }
    setState((s) => ({ ...s, saving: true, error: null }))
    try {
      await submitSettings(accountId)
      setState((s) => ({ ...s, saving: false, error: null, submitted: true }))
      return { ok: true }
    } catch (err) {
      const detail = err.body?.detail
      const missing = Array.isArray(detail?.missing_steps) ? detail.missing_steps : null
      const message = missing
        ? `Incomplete form: step${missing.length > 1 ? 's' : ''} ${missing.join(', ')} not saved`
        : typeof detail === 'string'
        ? detail
        : err.message || 'Submit failed'
      setState((s) => ({ ...s, saving: false, error: message }))
      return { ok: false, error: err }
    }
  }, [accountId])

  return {
    ...state,
    setDraft,
    setStepError,
    clearStepError,
    saveStep,
    submit,
  }
}

export { REFRESH_MS }
