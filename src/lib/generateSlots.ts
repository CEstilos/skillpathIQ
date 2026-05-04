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
