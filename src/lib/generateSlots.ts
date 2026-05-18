function toMinutes(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function fromMinutes(total: number) {
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

export function generateSlots(
  startTime: string,
  endTime: string,
  durationMinutes: number,
  bufferMinutes: number
): string[] {
  const start = toMinutes(startTime)
  const end = toMinutes(endTime)
  const slots: string[] = []
  let current = start
  while (current + durationMinutes <= end) {
    slots.push(fromMinutes(current))
    current += durationMinutes + bufferMinutes
  }
  return slots
}

export interface WindowWithFilters {
  id: string
  session_type: string
  gender_filter: string | null
  min_age: number | null
  max_age: number | null
  experience_filter: string[] | null
}

export interface PlayerProfile {
  age: number | null
  gender: string | null  // 'male' | 'female' | ''
  experience: string | null  // 'beginner' | 'rec_league' | 'bantam_club' | ''
}

export function filterSlots<T extends WindowWithFilters>(
  windows: T[],
  playerProfile: PlayerProfile,
  selectedSessionType: 'individual' | 'group'
): T[] {
  return windows.filter(w => {
    // Session type: individual selected → hide group-only; group selected → hide individual-only
    if (selectedSessionType === 'individual' && w.session_type === 'group') return false
    if (selectedSessionType === 'group' && w.session_type === 'individual') return false

    // Individual-only windows pass with no group filters
    if (w.session_type === 'individual') return true

    // Gender filter (group/both windows)
    if (w.gender_filter && w.gender_filter !== 'mixed' && playerProfile.gender) {
      const expected = w.gender_filter === 'boys' ? 'male' : 'female'
      if (playerProfile.gender !== expected) return false
    }

    // Age filter
    if (playerProfile.age) {
      if (w.min_age != null && playerProfile.age < w.min_age) return false
      if (w.max_age != null && playerProfile.age > w.max_age) return false
    }

    // Experience filter
    if (w.experience_filter && w.experience_filter.length > 0 && playerProfile.experience) {
      if (!w.experience_filter.includes(playerProfile.experience)) return false
    }

    return true
  })
}
