import type { HelperIntent } from './types'

export interface IntentMeta {
  pillId: string
  intent: HelperIntent
  label: string
  tagline: string
  placeholder: string
}

export const BASELINE_INTENT_PILLS: IntentMeta[] = [
  {
    pillId: 'help',
    intent: 'help',
    label: 'Help',
    tagline: 'Find your way around this X.SeekBoxAI surface',
    placeholder: 'What does this page do?',
  },
  {
    pillId: 'features',
    intent: 'feature',
    label: 'Features',
    tagline: 'How a feature works or how to find one',
    placeholder: 'How does ___ work?',
  },
  {
    pillId: 'bugs',
    intent: 'bug',
    label: 'Bugs',
    tagline: 'Tell us what broke and how to repro it',
    placeholder: 'When I ___, I expected ___ but got ___',
  },
  {
    pillId: 'support',
    intent: 'support',
    label: 'Support',
    tagline: 'Troubleshoot sign-in, data, billing, or search',
    placeholder: 'I need help with ___',
  },
  {
    pillId: 'feedback',
    intent: 'feedback',
    label: 'Feedback',
    tagline: 'Share what should change on this site',
    placeholder: 'My feedback is ___',
  },
  {
    pillId: 'ideas',
    intent: 'idea',
    label: 'Ideas',
    tagline: 'Brainstorm something X.SeekBoxAI could do',
    placeholder: 'I wish X.SeekBoxAI could ___',
  },
  {
    pillId: 'must-haves',
    intent: 'must_have',
    label: 'Must-haves',
    tagline: 'The thing you need before you can commit',
    placeholder: 'I would only use X.SeekBoxAI if it ___',
  },
  {
    pillId: 'roadmap',
    intent: 'roadmap',
    label: 'Roadmap',
    tagline: 'What is planned and when',
    placeholder: 'When will X.SeekBoxAI have ___?',
  },
]

export const INTENT_PILLS: IntentMeta[] = BASELINE_INTENT_PILLS

export const STARTERS_BY_PILL: Record<string, string[]> = {
  help: [
    'What does this page do?',
    'What should I look at first?',
    'Where should I go next?',
  ],
  features: [
    'How does LIVE SEEKBOX CACHE work?',
    'How do industry pages work?',
    'How do I search live from here?',
    'How do XMarks work?',
  ],
  bugs: [
    'When I tap X, Y happens instead of Z.',
    'A specific result would not load.',
    'The app crashed when I...',
  ],
  support: [
    'I cannot sign in.',
    'The cache data is not loading.',
    'The search stream is not responding.',
    'My role or searches-left badge looks wrong.',
  ],
  feedback: [
    'This page would be better if...',
    'The most confusing thing here is...',
    'I want to report a rough edge.',
  ],
  ideas: [
    'I wish X.SeekBoxAI could...',
    'Can X.SeekBoxAI be used to...',
    'What if X.SeekBoxAI had...',
  ],
  'must-haves': [
    'I need X.SeekBoxAI to...',
    'I would only use X.SeekBoxAI for ___ if it had...',
    'Without ___ I cannot recommend it to my team.',
  ],
  roadmap: [
    'What is on the roadmap?',
    'When will Family/Business launch?',
    'When will Operator be released?',
    'Are mobile apps coming?',
  ],
}

export function placeholderForPill(pillId: string): string {
  const found = INTENT_PILLS.find((pill) => pill.pillId === pillId)
  return found?.placeholder ?? 'Ask anything about X.SeekBoxAI...'
}

export function placeholderFor(intent: HelperIntent): string {
  const found = INTENT_PILLS.find((pill) => pill.intent === intent)
  return found?.placeholder ?? 'Ask anything about X.SeekBoxAI...'
}
