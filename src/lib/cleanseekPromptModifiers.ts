/** Mirrors mobile `ResponseLengthSlider`, `promptModifiers`, and CleanSeek comprehension helpers — keeps TanStack CleanSeek-X prompts aligned with `/cleanseek`. */

export const RESPONSE_LENGTH_LEVELS = [
  { label: 'Brief', hint: '~75 words', instruction: ' [Respond in 75 words or fewer. Be very concise.]' },
  { label: 'Short', hint: '~150 words', instruction: ' [Respond in roughly 150 words. Be concise but clear.]' },
  { label: 'Standard', hint: 'default', instruction: '' },
  { label: 'Detailed', hint: '~400 words', instruction: ' [Respond in roughly 400 words with clear explanations.]' },
  { label: 'In-depth', hint: '600+ words', instruction: ' [Provide a comprehensive response of 600+ words with depth, examples, and nuance.]' },
] as const

export function getResponseInstruction(level: number): string {
  const i = Math.max(0, Math.min(4, Math.round(level)))
  return RESPONSE_LENGTH_LEVELS[i]?.instruction ?? ''
}

export const TONE_LEVELS = [
  { label: 'Sensitive', emoji: '🥺', prompt: ' Use a sensitive, empathetic, warm, caring tone. Be gentle and supportive.' },
  { label: 'Kind', emoji: '🫂', prompt: ' Use a kind, considerate, encouraging tone.' },
  { label: 'Friendly', emoji: '😊', prompt: ' Use a warm, friendly, casual tone.' },
  { label: 'Witty', emoji: '😏', prompt: ' Use a witty, lightly humorous tone where appropriate. Do not sacrifice accuracy for humor.' },
  { label: 'Sarcastic', emoji: '😈', prompt: ' Use a dry, sarcastic tone where appropriate. Stay informative; never mean-spirited.' },
  { label: 'Angry', emoji: '😠', prompt: ' Use a sharp, angry tone where appropriate. Stay accurate; no slurs or personal attacks.' },
] as const

export function getToneInstruction(enabled: boolean, level: number): string {
  if (!enabled) return ''
  const clamped = Math.max(0, Math.min(TONE_LEVELS.length - 1, Math.round(level)))
  return TONE_LEVELS[clamped]?.prompt ?? ''
}

export const COMPREHENSION_INSTRUCTIONS = [
  ' [Explain like the user is 5 years old. Use very simple words and concrete examples.]',
  ' [Explain at a middle school level. Keep it accessible and avoid jargon.]',
  ' [Explain at a college student level. Use technical terms where appropriate.]',
  ' [Explain at an adult professional level. Be precise and substantive.]',
  ' [Explain with maximum intellectual depth. Be rigorous, dense, and assume mastery of the subject.]',
] as const

export function getComprehensionInstruction(enabled: boolean, level: number): string {
  if (!enabled) return ''
  const i = Math.max(0, Math.min(4, Math.round(level)))
  return COMPREHENSION_INSTRUCTIONS[i] ?? ''
}

export type ReasoningStyle = 'concise' | 'stepbystep' | 'exploratory' | 'skeptical'

export type ModifierFlag = 'tldr' | 'nextsteps' | 'counterargs' | 'list'

export const REASONING_STYLES: Record<ReasoningStyle, { label: string; emoji: string; prompt: string }> = {
  concise: {
    label: 'Concise',
    emoji: '⚡',
    prompt: ' Be direct and concise — no preamble or filler.',
  },
  stepbystep: {
    label: 'Step-by-step',
    emoji: '🪜',
    prompt: ' Think step-by-step and show your reasoning before the final answer.',
  },
  exploratory: {
    label: 'Exploratory',
    emoji: '🔭',
    prompt: ' Explore multiple angles and surface less obvious possibilities before concluding.',
  },
  skeptical: {
    label: 'Skeptical',
    emoji: '🔍',
    prompt: ' Apply critical scrutiny — challenge assumptions and flag what could be wrong or missing.',
  },
}

export const MODIFIER_FLAGS: Record<ModifierFlag, { label: string; emoji: string; prompt: string }> = {
  tldr: {
    label: 'TL;DR first',
    emoji: '📌',
    prompt: ' Start with a 1–2 sentence TL;DR summary before the full answer.',
  },
  nextsteps: {
    label: 'Action steps',
    emoji: '✅',
    prompt: ' End with 3–5 specific, prioritized action items.',
  },
  counterargs: {
    label: 'Counter-args',
    emoji: '⚖️',
    prompt: ' After your answer, list the top 3 counter-arguments or limitations.',
  },
  list: {
    label: 'List',
    emoji: '📝',
    prompt: ' Format the answer as a clear list of items.',
  },
}

export function buildPromptModifiers(reasoningStyle: ReasoningStyle | null, modifierFlags: ModifierFlag[]): string {
  const parts: string[] = []
  if (reasoningStyle && REASONING_STYLES[reasoningStyle]) parts.push(REASONING_STYLES[reasoningStyle].prompt)
  for (const flag of modifierFlags) {
    if (MODIFIER_FLAGS[flag]) parts.push(MODIFIER_FLAGS[flag].prompt)
  }
  return parts.join('')
}

export type PromptModifierSnapshot = {
  responseLengthEnabled: boolean
  responseLength: number
  toneEnabled: boolean
  toneLevel: number
  comprehensionEnabled: boolean
  comprehensionLevel: number
  personaEnabled: boolean
  personaText: string
  reasoningStyle: ReasoningStyle | null
  modifierFlags: ModifierFlag[]
}

/** Same suffix order as mobile `cleanseek.web.tsx` `previewPrompt`. */
export function composeCleanseekPrompt(rawQuery: string, snap: PromptModifierSnapshot, liveInstruction: string): string {
  const q = rawQuery.trim()
  const personaInstruction =
    snap.personaEnabled && snap.personaText.trim()
      ? ` [The user describes themselves as: ${snap.personaText.trim()}. Tailor your response to be relevant and useful for this person.]`
      : ''
  const lengthPart = snap.responseLengthEnabled ? getResponseInstruction(snap.responseLength) : ''
  const comprehensionPart = getComprehensionInstruction(snap.comprehensionEnabled, snap.comprehensionLevel)
  const tonePart = getToneInstruction(snap.toneEnabled, snap.toneLevel)
  const modifierSuffix = buildPromptModifiers(snap.reasoningStyle, snap.modifierFlags)
  return q + personaInstruction + lengthPart + comprehensionPart + tonePart + liveInstruction + modifierSuffix
}
