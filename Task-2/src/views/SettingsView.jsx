import { useSettings } from '../hooks/useAccounts'
import { SettingsForm } from '../components/SettingsForm'
import { ErrorState } from '../components/Status'
import { Spinner } from '../components/Spinner'

export default function SettingsView({ accountId, onBack }) {
  const {
    drafts,
    stepErrors,
    failedData,
    loading,
    saving,
    loadError,
    error,
    setDraft,
    setStepError,
    clearStepError,
    saveStep,
    submit,
  } = useSettings(accountId)

  if (loading) return <Spinner label="Loading settings…" />
  if (loadError) return <ErrorState message={loadError} onRetry={onBack} title="Failed to load settings" />

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-lg font-bold text-gray-900">Account settings</h1>
      <p className="text-sm text-gray-500">Account #{accountId}</p>
      <SettingsForm
        accountId={accountId}
        drafts={drafts}
        stepErrors={stepErrors}
        failedData={failedData}
        saving={saving}
        submitError={error}
        setDraft={setDraft}
        setStepError={setStepError}
        clearStepError={clearStepError}
        saveStep={saveStep}
        submit={submit}
        onBack={onBack}
      />
    </div>
  )
}
