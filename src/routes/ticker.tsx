import { createFileRoute } from '@tanstack/react-router'
import { CleanSeekLite } from './cleanseek-x'

export const Route = createFileRoute('/ticker')({
  component: TickerPage,
})

function TickerPage() {
  return (
    <CleanSeekLite
      variant="desktop"
      layout="ticker"
      defaultUseLatest={true}
      defaultPreset="allin"
      defaultEnginePickMode="custom"
      defaultEnabledEngineIds={['grokx', 'groksearch', 'tavily', 'brave', 'chatgptsearch']}
      storageKeys={{
        enabledEnginesKey: 'seekbox_ticker_enabled_engines_v1',
        enginePickModeKey: 'seekbox_ticker_engine_pick_mode_v1',
        promptModsKey: 'seekbox_ticker_prompt_modifiers_v1',
      }}
    />
  )
}

