'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'

const GREEN = '#00FF9F'
const AMBER = '#F5A623'

interface BookingRequest {
  id: string
  trainer_id: string
  request_type: string
  player_id: string | null
  parent_name: string
  parent_email: string
  parent_phone: string | null
  player_name: string
  player_age: number | null
  player_position: string | null
  player_goals: string | null
  preferred_session_type: string
  message: string | null
  status: string
  created_at: string
  preferred_availability_text: string | null
  preferred_slots: Array<{ rank: number; window_id: string; slot_time: string }> | null
}

interface AvailabilityWindow {
  id: string
  day_of_week: string
  start_time: string
  end_time: string
  session_type: string
  duration_minutes: number
  display_label: string | null
}

interface SessionDuration {
  id: string
  duration_minutes: number
  label: string | null
}

interface UpcomingSession {
  id: string
  title: string | null
  session_date: string
  session_time: string | null
  duration_minutes: number | null
  session_type: string | null
  player_id: string | null
  players: { full_name: string } | null
}

interface Props {
  bookingRequest: BookingRequest
  availabilityWindows: AvailabilityWindow[]
  sessionDurations: SessionDuration[]
  upcomingSessions: UpcomingSession[]
  trainerName: string
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const RANK_LABELS = ['1st choice', '2nd choice', '3rd choice']

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${hour}:${m.toString().padStart(2, '0')}${ampm}`
}

function formatDateShort(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function nextOccurrenceOfDay(dayName: string): string {
  const today = new Date()
  const targetDay = DAY_NAMES.indexOf(dayName.toLowerCase())
  if (targetDay === -1) return today.toISOString().split('T')[0]
  const todayDay = today.getDay()
  let daysAhead = targetDay - todayDay
  if (daysAhead <= 0) daysAhead += 7
  const result = new Date(today)
  result.setDate(today.getDate() + daysAhead)
  return result.toISOString().split('T')[0]
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export default function ScheduleRequestClient({
  bookingRequest: req,
  availabilityWindows,
  sessionDurations,
  upcomingSessions,
  trainerName,
}: Props) {
  const router = useRouter()

  const windowMap = useMemo(
    () => new Map(availabilityWindows.map(w => [w.id, w])),
    [availabilityWindows]
  )

  const resolvedSlots = useMemo(() => {
    if (!req.preferred_slots?.length) return []
    return req.preferred_slots
      .sort((a, b) => a.rank - b.rank)
      .map(slot => {
        const w = windowMap.get(slot.window_id)
        if (!w) return null
        return {
          rank: slot.rank,
          window_id: slot.window_id,
          slot_time: slot.slot_time,
          day: w.day_of_week,
          displayTime: formatTime(slot.slot_time),
          sessionType: w.session_type === 'group' ? 'Group' : 'Individual',
          duration: w.duration_minutes,
        }
      })
      .filter(Boolean) as Array<{
        rank: number; window_id: string; slot_time: string
        day: string; displayTime: string; sessionType: string; duration: number
      }>
  }, [req.preferred_slots, windowMap])

  const [selectedSlotRank, setSelectedSlotRank] = useState<number | null>(null)
  const [showManualPicker, setShowManualPicker] = useState(resolvedSlots.length === 0)
  const [sessionDate, setSessionDate] = useState('')
  const [sessionTime, setSessionTime] = useState('')
  const [durationMinutes, setDurationMinutes] = useState<number>(
    sessionDurations[0]?.duration_minutes ?? 60
  )
  const [sessionType, setSessionType] = useState<'individual' | 'group'>(
    req.preferred_session_type === 'group' ? 'group' : 'individual'
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function selectSlot(rank: number, day: string, slotTime: string, duration: number, type: string) {
    setSelectedSlotRank(rank)
    setSessionDate(nextOccurrenceOfDay(day))
    setSessionTime(slotTime)
    setDurationMinutes(duration)
    setSessionType(type.toLowerCase() === 'group' ? 'group' : 'individual')
  }

  function clearSlotSelection() {
    setSelectedSlotRank(null)
  }

  const conflictingSessions = useMemo(() => {
    if (!sessionDate || !sessionTime) return []
    const selStart = toMinutes(sessionTime)
    const selEnd = selStart + durationMinutes

    return upcomingSessions.filter(s => {
      if (s.session_date !== sessionDate) return false
      if (!s.session_time) return false
      const existingStart = toMinutes(s.session_time)
      const existingEnd = existingStart + (s.duration_minutes ?? 60)
      return selStart < existingEnd && existingStart < selEnd
    })
  }, [sessionDate, sessionTime, durationMinutes, upcomingSessions])

  const hasConflict = conflictingSessions.length > 0
  const canConfirm = !!sessionDate && !!sessionTime

  async function handleConfirm() {
    if (!canConfirm) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/requests/${req.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_date: sessionDate, session_time: sessionTime, duration_minutes: durationMinutes, session_type: sessionType }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Something went wrong. Please try again.')
        return
      }
      const toast = encodeURIComponent(`Session confirmed. ${req.parent_name} has been notified.`)
      router.push(`/dashboard/players/${data.player_id}?toast=${toast}`)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    background: '#0E0E0F',
    border: '1px solid #2A2A2D',
    borderRadius: '8px',
    padding: '10px 12px',
    fontSize: '14px',
    color: '#ffffff',
    outline: 'none',
    width: '100%',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#9A9A9F',
    marginBottom: '6px',
    display: 'block',
  }

  const sectionHeaderStyle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 700,
    color: '#9A9A9F',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: '12px',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', fontFamily: 'sans-serif', overflowX: 'hidden' }}>
      <style>{`* { box-sizing: border-box; margin: 0; padding: 0; } html, body { background: #0E0E0F; overflow-x: hidden; }`}</style>

      {/* NAV */}
      <nav style={{ display: 'flex', alignItems: 'center', padding: '0 16px', height: '56px', borderBottom: '1px solid #2A2A2D', background: '#0E0E0F', position: 'sticky', top: 0, zIndex: 100 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="SkillPathIQ" onClick={() => router.push('/dashboard')} style={{ height: '52px', width: 'auto', cursor: 'pointer' }} />
      </nav>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px 16px 64px' }}>

        {/* HEADER */}
        <div style={{ marginBottom: '28px' }}>
          <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', color: '#9A9A9F', fontSize: '13px', cursor: 'pointer', padding: '0', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            ← Back to Requests
          </button>
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>Schedule Session</h1>
          <p style={{ fontSize: '14px', color: '#9A9A9F' }}>Review {req.player_name}&apos;s preferences and pick a time that works.</p>
        </div>

        {/* PLAYER & REQUEST SUMMARY */}
        <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '14px', padding: '20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(0,255,159,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, color: GREEN, flexShrink: 0 }}>
              {req.player_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>{req.player_name}</span>
                <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '99px', letterSpacing: '0.04em',
                  background: req.request_type === 'returning_player' ? 'rgba(0,255,159,0.12)' : 'rgba(154,154,159,0.12)',
                  color: req.request_type === 'returning_player' ? GREEN : '#9A9A9F',
                }}>
                  {req.request_type === 'returning_player' ? 'Returning' : 'New Player'}
                </span>
              </div>
              <div style={{ fontSize: '13px', color: '#9A9A9F', marginTop: '2px' }}>
                {req.player_age ? `Age ${req.player_age}` : ''}
                {req.player_age && req.preferred_session_type ? ' · ' : ''}
                {req.preferred_session_type === 'group' ? 'Group' : '1-on-1'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#555558', width: '90px', flexShrink: 0 }}>Parent</span>
              <span style={{ fontSize: '12px', color: '#9A9A9F' }}>{req.parent_name}</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#555558', width: '90px', flexShrink: 0 }}>Email</span>
              <span style={{ fontSize: '12px', color: '#9A9A9F', wordBreak: 'break-word' }}>{req.parent_email}</span>
            </div>
            {req.parent_phone && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#555558', width: '90px', flexShrink: 0 }}>Phone</span>
                <span style={{ fontSize: '12px', color: '#9A9A9F' }}>{req.parent_phone}</span>
              </div>
            )}
            {req.player_position && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#555558', width: '90px', flexShrink: 0 }}>Position</span>
                <span style={{ fontSize: '12px', color: '#9A9A9F' }}>{req.player_position}</span>
              </div>
            )}
            {req.player_goals && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#555558', width: '90px', flexShrink: 0 }}>Goals</span>
                <span style={{ fontSize: '12px', color: '#9A9A9F', lineHeight: 1.5 }}>{req.player_goals}</span>
              </div>
            )}
            {req.message && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#555558', width: '90px', flexShrink: 0 }}>Message</span>
                <span style={{ fontSize: '12px', color: '#9A9A9F', lineHeight: 1.5, fontStyle: 'italic' }}>&ldquo;{req.message}&rdquo;</span>
              </div>
            )}
          </div>
        </div>

        {/* RANKED PREFERENCES */}
        {resolvedSlots.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div style={sectionHeaderStyle}>Parent&apos;s preferred times</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {resolvedSlots.map(slot => {
                const isSelected = selectedSlotRank === slot.rank
                return (
                  <button
                    key={slot.rank}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        clearSlotSelection()
                      } else {
                        selectSlot(slot.rank, slot.day, slot.slot_time, slot.duration, slot.sessionType)
                        setShowManualPicker(true)
                      }
                    }}
                    style={{
                      background: isSelected ? 'rgba(0,255,159,0.06)' : '#1A1A1C',
                      border: `1px solid ${isSelected ? 'rgba(0,255,159,0.35)' : '#2A2A2D'}`,
                      borderRadius: '10px',
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer',
                      width: '100%',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ fontSize: '10px', fontWeight: 700, color: isSelected ? GREEN : '#555558', textTransform: 'uppercase', letterSpacing: '0.06em', width: '64px', flexShrink: 0 }}>
                      {RANK_LABELS[slot.rank - 1] || `#${slot.rank}`}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: isSelected ? '#ffffff' : '#9A9A9F' }}>
                        {capitalize(slot.day)} · {slot.displayTime}
                      </div>
                      <div style={{ fontSize: '12px', color: '#555558', marginTop: '2px' }}>
                        {slot.sessionType} · {slot.duration} min
                      </div>
                    </div>
                    {isSelected && (
                      <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                          <polyline points="1.5,4.5 3.5,6.5 7.5,2" stroke="#0E0E0F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* MANUAL PICKER */}
        <div style={{ marginBottom: '20px' }}>
          {resolvedSlots.length > 0 && !showManualPicker ? (
            <button
              type="button"
              onClick={() => setShowManualPicker(true)}
              style={{ background: 'none', border: 'none', color: GREEN, fontSize: '13px', fontWeight: 600, cursor: 'pointer', padding: '4px 0' }}
            >
              + Pick a different time
            </button>
          ) : (
            <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '14px', padding: '20px' }}>
              <div style={sectionHeaderStyle}>
                {resolvedSlots.length > 0 ? 'Confirm or adjust time' : 'Pick a time'}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Date + Time row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>Date</label>
                    <input
                      type="date"
                      value={sessionDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={e => { setSessionDate(e.target.value); clearSlotSelection() }}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Time</label>
                    <input
                      type="time"
                      value={sessionTime}
                      onChange={e => { setSessionTime(e.target.value); clearSlotSelection() }}
                      style={inputStyle}
                    />
                  </div>
                </div>

                {/* Duration */}
                <div>
                  <label style={labelStyle}>Duration</label>
                  {sessionDurations.length > 0 ? (
                    <select
                      value={durationMinutes}
                      onChange={e => { setDurationMinutes(Number(e.target.value)); clearSlotSelection() }}
                      style={{ ...inputStyle, cursor: 'pointer' }}
                    >
                      {sessionDurations.map(d => (
                        <option key={d.id} value={d.duration_minutes}>
                          {d.label || `${d.duration_minutes} min`}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="number"
                        min="15"
                        max="240"
                        step="15"
                        value={durationMinutes}
                        onChange={e => { setDurationMinutes(Number(e.target.value)); clearSlotSelection() }}
                        style={{ ...inputStyle, width: '100px' }}
                      />
                      <span style={{ fontSize: '13px', color: '#9A9A9F' }}>minutes</span>
                    </div>
                  )}
                </div>

                {/* Session Type */}
                <div>
                  <label style={labelStyle}>Session type</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {(['individual', 'group'] as const).map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setSessionType(t)}
                        style={{
                          padding: '10px',
                          borderRadius: '8px',
                          border: `1px solid ${sessionType === t ? 'rgba(0,255,159,0.4)' : '#2A2A2D'}`,
                          background: sessionType === t ? 'rgba(0,255,159,0.08)' : 'transparent',
                          color: sessionType === t ? GREEN : '#9A9A9F',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {t === 'individual' ? '1-on-1' : 'Group'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* UPCOMING SESSIONS — CONFLICT CHECK */}
        <div style={{ marginBottom: '24px' }}>
          <div style={sectionHeaderStyle}>Your upcoming sessions</div>
          <p style={{ fontSize: '12px', color: '#555558', marginBottom: '12px' }}>Check for conflicts before confirming.</p>

          {upcomingSessions.length === 0 ? (
            <div style={{ fontSize: '13px', color: '#9A9A9F', padding: '12px 0' }}>No upcoming sessions scheduled.</div>
          ) : (
            <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', overflow: 'hidden' }}>
              {/* Header row */}
              <div style={{ display: 'grid', gridTemplateColumns: '100px 60px 1fr 56px 72px', padding: '8px 14px', borderBottom: '1px solid #2A2A2D', gap: '8px' }}>
                {['Date', 'Time', 'Player', 'Dur.', 'Type'].map(h => (
                  <div key={h} style={{ fontSize: '10px', fontWeight: 600, color: '#555558', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
                ))}
              </div>
              {upcomingSessions.map((s, i) => {
                const isConflict = conflictingSessions.some(c => c.id === s.id)
                const playerName = s.players?.full_name || s.title || 'Session'
                const firstName = playerName.split(' ')[0]
                return (
                  <div
                    key={s.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '100px 60px 1fr 56px 72px',
                      padding: '10px 14px',
                      gap: '8px',
                      borderBottom: i < upcomingSessions.length - 1 ? '1px solid #2A2A2D' : 'none',
                      alignItems: 'center',
                      background: isConflict ? 'rgba(245,166,35,0.06)' : 'transparent',
                    }}
                  >
                    <div style={{ fontSize: '12px', color: isConflict ? AMBER : '#9A9A9F' }}>
                      {isConflict && <span style={{ marginRight: '4px' }}>⚠</span>}
                      {formatDateShort(s.session_date)}
                    </div>
                    <div style={{ fontSize: '12px', color: isConflict ? AMBER : '#9A9A9F' }}>
                      {s.session_time ? formatTime(s.session_time) : '—'}
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: isConflict ? '#ffffff' : '#9A9A9F', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {firstName}
                    </div>
                    <div style={{ fontSize: '12px', color: '#555558' }}>
                      {s.duration_minutes ? `${s.duration_minutes}m` : '—'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#555558' }}>
                      {s.session_type === 'group' ? 'Group' : '1-on-1'}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* CONFLICT WARNING */}
        {hasConflict && (
          <div style={{ background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.3)', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px', fontSize: '13px', color: AMBER, lineHeight: 1.5 }}>
            {conflictingSessions.length === 1 ? (
              <>This time conflicts with <strong>{conflictingSessions[0].players?.full_name?.split(' ')[0] || conflictingSessions[0].title || 'another session'}</strong> at {conflictingSessions[0].session_time ? formatTime(conflictingSessions[0].session_time) : 'the same time'}. You can still confirm if intended.</>
            ) : (
              <>This time conflicts with {conflictingSessions.length} existing sessions. You can still confirm if intended.</>
            )}
          </div>
        )}

        {/* ERROR */}
        {error && (
          <div style={{ background: 'rgba(224,49,49,0.08)', border: '1px solid rgba(224,49,49,0.25)', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px', fontSize: '14px', color: '#E03131' }}>
            {error}
          </div>
        )}

        {/* CONFIRM BUTTON */}
        <button
          onClick={handleConfirm}
          disabled={!canConfirm || loading}
          style={{
            width: '100%',
            background: canConfirm ? GREEN : '#2A2A2D',
            color: canConfirm ? '#0E0E0F' : '#555558',
            border: 'none',
            borderRadius: '12px',
            padding: '16px',
            fontSize: '16px',
            fontWeight: 700,
            cursor: canConfirm && !loading ? 'pointer' : 'default',
            transition: 'background 0.15s',
          }}
        >
          {loading ? 'Confirming…' : hasConflict ? 'Confirm Anyway' : 'Confirm Session'}
        </button>

        {!canConfirm && (
          <p style={{ fontSize: '12px', color: '#555558', textAlign: 'center', marginTop: '10px' }}>
            Select a date and time to continue.
          </p>
        )}

      </div>
    </div>
  )
}
