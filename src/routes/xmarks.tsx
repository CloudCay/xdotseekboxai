import { createFileRoute } from '@tanstack/react-router'
import { CleanSeekLite } from './cleanseek-x'

export const Route = createFileRoute('/xmarks')({
  component: XMarksPage,
})

function XMarksPage() {
  return (
    <CleanSeekLite
      variant="desktop"
      layout="xmarks"
      // Default: Grok X only (no Grok Live auto-append).
      defaultUseLatest={false}
      defaultPreset="allin"
      defaultEnginePickMode="custom"
      defaultEnabledEngineIds={['grokx']}
      storageKeys={{
        enabledEnginesKey: 'seekbox_xmarks_enabled_engines_v1',
        enginePickModeKey: 'seekbox_xmarks_engine_pick_mode_v1',
        promptModsKey: 'seekbox_xmarks_prompt_modifiers_v1',
      }}
    />
  )
}

