import type { Event } from './types'

export type SuggestionItem = { emoji: string; label: string }

function isBowlingSpace(name: string): boolean {
  const n = name.toLowerCase()
  return /bowl|bowling|league|practice/.test(n)
}

export function buildSuggestions(
  spaceName: string,
  events: Event[],
  activeMemberId: string | null,
): SuggestionItem[] {
  console.log('BUILD SUGGESTIONS CALLED:', spaceName)

  if (isBowlingSpace(spaceName)) {
    return [
      { emoji: '🎳', label: 'Bowling practice' },
      { emoji: '🎳', label: 'League night' },
      { emoji: '', label: 'Working on release' },
      { emoji: '', label: 'Spare shooting' },
      { emoji: '', label: 'Ball work / adjustments' },
      { emoji: '', label: 'Reviewing tape' },
      { emoji: '', label: 'Tournament prep' },
      { emoji: '', label: 'Strength training' },
      { emoji: '', label: 'Conditioning' },
      { emoji: '', label: 'Recovery' },
    ]
  }

  return [
    { emoji: '☕️', label: 'Coffee' },
    { emoji: '💻', label: 'Working' },
    { emoji: '', label: 'Getting ready' },
    { emoji: '🏠', label: 'Home' },
    { emoji: '🚗', label: 'Out' },
    { emoji: '😊', label: 'Relaxing' },
  ]
}