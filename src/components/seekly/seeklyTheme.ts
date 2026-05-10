export type SeeklyThemeName = 'light' | 'dark' | 'newspaper' | 'seekbox'

export type SeeklyTheme = {
  name: SeeklyThemeName
  panel: string
  border: string
  header: string
  text: string
  muted: string
  soft: string
  input: string
  userBubble: string
  assistantBubble: string
  button: string
  accent: string
  logoTone: 'dark' | 'light'
}

export function normalizeSeeklyTheme(value: string | undefined): SeeklyThemeName {
  if (value === 'dark' || value === 'newspaper' || value === 'seekbox') return value
  return 'light'
}

export function themeForSeekly(name: SeeklyThemeName): SeeklyTheme {
  if (name === 'dark') {
    return {
      name,
      panel: 'bg-slate-950 text-slate-100',
      border: 'border-slate-700',
      header: 'bg-slate-900/95',
      text: 'text-slate-100',
      muted: 'text-slate-400',
      soft: 'bg-slate-900/80',
      input: 'border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500',
      userBubble: 'bg-blue-600 text-white',
      assistantBubble: 'border-slate-700 bg-slate-900/90 text-slate-100',
      button: 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800',
      accent: '#3B82F6',
      logoTone: 'dark',
    }
  }

  if (name === 'newspaper') {
    return {
      name,
      panel: 'bg-[#f4f1ea] text-neutral-950 font-serif',
      border: 'border-neutral-800/40',
      header: 'bg-[#faf8f3]',
      text: 'text-neutral-950',
      muted: 'text-neutral-600',
      soft: 'bg-[#ede9df]',
      input: 'border-neutral-800/40 bg-[#faf8f3] text-neutral-950 placeholder:text-neutral-500',
      userBubble: 'bg-neutral-950 text-[#f4f1ea]',
      assistantBubble: 'border-neutral-800/30 bg-[#faf8f3] text-neutral-950',
      button: 'border-neutral-800/35 bg-[#faf8f3] text-neutral-900 hover:bg-neutral-200',
      accent: '#111111',
      logoTone: 'light',
    }
  }

  if (name === 'seekbox') {
    return {
      name,
      panel: 'bg-[#FAFBFF] text-[#1B2A4A]',
      border: 'border-[#D6E0F0]',
      header: 'bg-white',
      text: 'text-[#1B2A4A]',
      muted: 'text-[#7B8BA8]',
      soft: 'bg-[#EEF2FF]',
      input: 'border-[#D6E0F0] bg-white text-[#1B2A4A] placeholder:text-[#7B8BA8]',
      userBubble: 'bg-[#2563EB] text-white',
      assistantBubble: 'border-[#D6E0F0] bg-white text-[#1B2A4A]',
      button: 'border-[#D6E0F0] bg-white text-[#1B2A4A] hover:bg-[#EEF2FF]',
      accent: '#2563EB',
      logoTone: 'light',
    }
  }

  return {
    name,
    panel: 'bg-white text-slate-950',
    border: 'border-slate-200',
    header: 'bg-white',
    text: 'text-slate-950',
    muted: 'text-slate-500',
    soft: 'bg-slate-50',
    input: 'border-slate-200 bg-white text-slate-950 placeholder:text-slate-400',
    userBubble: 'bg-blue-600 text-white',
    assistantBubble: 'border-slate-200 bg-white text-slate-950',
    button: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
    accent: '#3B82F6',
    logoTone: 'light',
  }
}
