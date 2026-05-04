'use client'

import { useState } from 'react'
import { generateSlots } from '@/lib/generateSlots'

const GREEN = '#00FF9F'
const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${hour}:${m.toString().padStart(2, '0')}${ampm}`
}

function sortWindows<T extends { day_of_week: string; start_time: string }>(windows: T[]) {
  return [...windows].sort((a, b) => {
    const di = DAY_ORDER.indexOf(a.day_of_week) - DAY_ORDER.indexOf(b.day_of_week)
    return di !== 0 ? di : a.start_time.localeCompare(b.start_time)
  })
}

interface Trainer {
  id: string
  full_name: string
  bio: string | null
  sport: string | null
  location: string | null
  profile_photo_url: string | null
  individual_rate: number | null
  group_rate: number | null
}

interface AvailabilityWindow {
  id: string
  day_of_week: string
  start_time: string
  end_time: string
  session_type: string
  display_label: string | null
  sort_order: number
  duration_minutes: number
  buffer_minutes: number
  max_capacity: number | null
}

interface SessionDuration {
  id: string
  duration_minutes: number
  label: string
}

type SelectedSlot = { window_id: string; slot_time: string }

const RANK_LABELS = ['1st', '2nd', '3rd']
const RANK_COLORS = ['#00FF9F', '#4A9EFF', '#F5A623']

function sessionTypeBadge(type: string) {
  if (type === 'individual') return { bg: 'rgba(74,158,255,0.15)', color: '#4A9EFF', label: 'Individual' }
  if (type === 'group') return { bg: 'rgba(245,166,35,0.15)', color: '#F5A623', label: 'Group' }
  return { bg: 'rgba(0,255,159,0.12)', color: GREEN, label: 'Both' }
}

export default function TrainerProfileClient({
  trainer,
  availabilityWindows,
  sessionDurations,
  upcomingBlackouts,
}: {
  trainer: Trainer
  availabilityWindows: AvailabilityWindow[]
  sessionDurations: SessionDuration[]
  upcomingBlackouts: string[]
}) {
  const [form, setForm] = useState({
    parentName: '',
    parentEmail: '',
    parentPhone: '',
    playerName: '',
    playerAge: '',
    playerPosition: '',
    playerGoals: '',
    sessionType: 'individual' as 'individual' | 'group',
    message: '',
  })
  const [selectedSlots, setSelectedSlots] = useState<SelectedSlot[]>([])
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function toggleSlot(window_id: string, slot_time: string) {
    setSelectedSlots(prev => {
      const idx = prev.findIndex(s => s.window_id === window_id && s.slot_time === slot_time)
      if (idx !== -1) {
        return prev.filter((_, i) => i !== idx)
      }
      if (prev.length < 3) return [...prev, { window_id, slot_time }]
      // shift: drop oldest (index 0), add new at end
      return [...prev.slice(1), { window_id, slot_time }]
    })
  }

  function slotRank(window_id: string, slot_time: string): number {
    return selectedSlots.findIndex(s => s.window_id === window_id && s.slot_time === slot_time)
  }

  // Generate all slots grouped by day
  const slotsByDay = DAY_ORDER.reduce<Record<string, Array<{ window: AvailabilityWindow; time: string }>>>((acc, day) => {
    const dayWindows = sortWindows(availabilityWindows.filter(w => w.day_of_week === day))
    const slots = dayWindows.flatMap(w =>
      generateSlots(w.start_time, w.end_time, w.duration_minutes, w.buffer_minutes).map(t => ({ window: w, time: t }))
    )
    if (slots.length > 0) acc[day] = slots
    return acc
  }, {})

  const hasSlots = Object.keys(slotsByDay).length > 0

  // Compute upcoming blackout display dates
  const upcomingBlackoutDisplay = upcomingBlackouts
    .map(d => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.parentName.trim() || !form.parentEmail.trim() || !form.playerName.trim()) {
      setError('Please fill in all required fields.')
      return
    }
    if (!form.playerAge || parseInt(form.playerAge) < 1) {
      setError('Player age is required.')
      return
    }
    if (!form.parentPhone.trim()) {
      setError('Phone number is required.')
      return
    }
    if (hasSlots && selectedSlots.length === 0) {
      setError('Please select at least one preferred time.')
      return
    }
    setLoading(true)
    setError(null)

    const preferredSlots = selectedSlots.map((s, i) => ({
      rank: i + 1,
      window_id: s.window_id,
      slot_time: s.slot_time,
    }))

    try {
      const res = await fetch('/api/booking-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainer_id: trainer.id,
          trainer_name: trainer.full_name,
          parent_name: form.parentName.trim(),
          parent_email: form.parentEmail.trim(),
          parent_phone: form.parentPhone.trim(),
          player_name: form.playerName.trim(),
          player_age: parseInt(form.playerAge),
          player_position: form.playerPosition.trim() || null,
          player_goals: form.playerGoals.trim() || null,
          preferred_session_type: form.sessionType,
          message: form.message.trim() || null,
          preferred_slots: preferredSlots.length > 0 ? preferredSlots : null,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Something went wrong. Please try again.')
        setLoading(false)
        return
      }
      setSubmitted(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    background: '#1A1A1C',
    border: '1px solid #2A2A2D',
    borderRadius: '10px',
    padding: '12px 14px',
    fontSize: '15px',
    color: '#ffffff',
    outline: 'none',
    width: '100%',
    fontFamily: 'sans-serif',
  }

  const labelStyle = {
    fontSize: '13px',
    fontWeight: 600 as const,
    color: '#9A9A9F',
    marginBottom: '6px',
    display: 'block' as const,
  }

  function getInitials(name: string) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', fontFamily: 'sans-serif', overflowX: 'hidden' }}>
      <style>{`* { box-sizing: border-box; margin: 0; padding: 0; } html, body { background: #0E0E0F; overflow-x: hidden; }`}</style>

      {/* TOP BAR */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #1A1A1C' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: GREEN, letterSpacing: '0.04em' }}>SkillPathIQ</span>
      </div>

      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '32px 16px 64px' }}>

        {/* TRAINER HEADER */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '32px' }}>
          {trainer.profile_photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={trainer.profile_photo_url} alt={trainer.full_name} style={{ width: '88px', height: '88px', borderRadius: '50%', objectFit: 'cover', marginBottom: '16px' }} />
          ) : (
            <div style={{ width: '88px', height: '88px', borderRadius: '50%', background: 'rgba(0,255,159,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: 700, color: GREEN, marginBottom: '16px' }}>
              {getInitials(trainer.full_name)}
            </div>
          )}
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>{trainer.full_name}</h1>
          {(trainer.sport || trainer.location) && (
            <p style={{ fontSize: '14px', color: '#9A9A9F' }}>
              {[trainer.sport, trainer.location].filter(Boolean).join(' · ')}
            </p>
          )}
          {trainer.bio && (
            <p style={{ fontSize: '14px', color: '#9A9A9F', lineHeight: 1.7, marginTop: '12px', maxWidth: '440px' }}>
              {trainer.bio}
            </p>
          )}
        </div>

        {/* RATES */}
        {(trainer.individual_rate || trainer.group_rate) && (
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '14px', padding: '18px 20px', marginBottom: '28px', display: 'flex' }}>
            {trainer.individual_rate ? (
              <div style={{ flex: 1, textAlign: 'center', borderRight: trainer.group_rate ? '1px solid #2A2A2D' : 'none', paddingRight: trainer.group_rate ? '16px' : '0' }}>
                <div style={{ fontSize: '11px', color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Individual</div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#ffffff' }}>${trainer.individual_rate}</div>
                <div style={{ fontSize: '11px', color: '#9A9A9F', marginTop: '2px' }}>per session</div>
              </div>
            ) : null}
            {trainer.group_rate ? (
              <div style={{ flex: 1, textAlign: 'center', paddingLeft: trainer.individual_rate ? '16px' : '0' }}>
                <div style={{ fontSize: '11px', color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Group</div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#ffffff' }}>${trainer.group_rate}</div>
                <div style={{ fontSize: '11px', color: '#9A9A9F', marginTop: '2px' }}>per player / session</div>
              </div>
            ) : null}
          </div>
        )}

        {/* AVAILABILITY DISPLAY */}
        {availabilityWindows.length > 0 && (
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '14px', padding: '18px 20px', marginBottom: '28px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }}>Availability</div>

            {DAY_ORDER.filter(day => slotsByDay[day]).map(day => {
              const items = slotsByDay[day]
              const windows = sortWindows(availabilityWindows.filter(w => w.day_of_week === day))
              return (
                <div key={day} style={{ display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', textTransform: 'capitalize', minWidth: '86px', paddingTop: '2px' }}>{day}</span>
                  <div style={{ flex: 1 }}>
                    {windows.map(w => {
                      const badge = sessionTypeBadge(w.session_type)
                      const slots = generateSlots(w.start_time, w.end_time, w.duration_minutes, w.buffer_minutes)
                      return (
                        <div key={w.id} style={{ marginBottom: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '12px', padding: '2px 7px', borderRadius: '99px', fontWeight: 600, background: badge.bg, color: badge.color }}>
                              {badge.label}{w.max_capacity && w.session_type !== 'individual' ? ` · up to ${w.max_capacity}` : ''}
                            </span>
                            {w.display_label && <span style={{ fontSize: '11px', color: '#9A9A9F', fontStyle: 'italic' }}>{w.display_label}</span>}
                          </div>
                          <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '3px' }}>
                            {slots.map(formatTime).join(' · ')}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {sessionDurations.length > 0 && (
              <div style={{ borderTop: '1px solid #2A2A2D', paddingTop: '10px', marginTop: '6px' }}>
                <span style={{ fontSize: '12px', color: '#9A9A9F' }}>Session lengths: </span>
                <span style={{ fontSize: '12px', color: '#ffffff' }}>{sessionDurations.map(d => d.label).join(' · ')}</span>
              </div>
            )}

            {upcomingBlackoutDisplay.length > 0 && (
              <div style={{ marginTop: '10px', fontSize: '12px', color: '#555558' }}>
                Unavailable: {upcomingBlackoutDisplay.join(', ')}
              </div>
            )}

            <div style={{ marginTop: '10px', fontSize: '11px', color: '#555558', fontStyle: 'italic' }}>
              Availability shown is a general guide. Your preferred times will be confirmed by the trainer.
            </div>
          </div>
        )}

        {/* BOOKING FORM */}
        {submitted ? (
          <div style={{ background: 'rgba(0,255,159,0.06)', border: '1px solid rgba(0,255,159,0.25)', borderRadius: '16px', padding: '32px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>✓</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>Request sent!</div>
            <p style={{ fontSize: '14px', color: '#9A9A9F', lineHeight: 1.6 }}>
              {trainer.full_name.split(' ')[0]} will be in touch soon.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', marginBottom: '4px' }}>Request a session</div>
              <p style={{ fontSize: '13px', color: '#9A9A9F' }}>Fill out the form below and {trainer.full_name.split(' ')[0]} will be in touch to confirm.</p>
            </div>

            {/* YOUR INFO */}
            <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Your info</div>
              <div>
                <label style={labelStyle}>Your name <span style={{ color: '#E03131' }}>*</span></label>
                <input style={inputStyle} type="text" placeholder="Jane Smith" value={form.parentName} onChange={e => set('parentName', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Email address <span style={{ color: '#E03131' }}>*</span></label>
                <input style={inputStyle} type="email" placeholder="jane@email.com" value={form.parentEmail} onChange={e => set('parentEmail', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Phone number <span style={{ color: '#E03131' }}>*</span></label>
                <input style={inputStyle} type="tel" placeholder="(555) 000-0000" value={form.parentPhone} onChange={e => set('parentPhone', e.target.value)} />
              </div>
            </div>

            {/* PLAYER INFO */}
            <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Player info</div>
              <div>
                <label style={labelStyle}>Player name <span style={{ color: '#E03131' }}>*</span></label>
                <input style={inputStyle} type="text" placeholder="Alex Smith" value={form.playerName} onChange={e => set('playerName', e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Age <span style={{ color: '#E03131' }}>*</span></label>
                  <input style={inputStyle} type="number" min="1" max="99" placeholder="12" value={form.playerAge} onChange={e => set('playerAge', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Position <span style={{ fontSize: '11px', fontWeight: 400, color: '#555558' }}>(optional)</span></label>
                  <input style={inputStyle} type="text" placeholder="Point guard" value={form.playerPosition} onChange={e => set('playerPosition', e.target.value)} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Goals <span style={{ fontSize: '11px', fontWeight: 400, color: '#555558' }}>(optional)</span></label>
                <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' as const, lineHeight: 1.6 }} placeholder="What do you want your player to work on?" value={form.playerGoals} onChange={e => set('playerGoals', e.target.value)} />
              </div>
            </div>

            {/* SESSION PREFERENCE */}
            <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Session preference</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {(['individual', 'group'] as const).map(type => (
                  <button key={type} type="button" onClick={() => set('sessionType', type)} style={{ padding: '12px', borderRadius: '10px', border: `1px solid ${form.sessionType === type ? 'rgba(0,255,159,0.4)' : '#2A2A2D'}`, background: form.sessionType === type ? 'rgba(0,255,159,0.08)' : 'transparent', color: form.sessionType === type ? GREEN : '#9A9A9F', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                    {type === 'individual' ? '1-on-1' : 'Group'}
                  </button>
                ))}
              </div>

              {/* RANKED SLOT PICKER */}
              {hasSlots && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <label style={{ ...labelStyle, marginBottom: '2px' }}>
                      When works best for you? <span style={{ color: '#E03131' }}>*</span>
                    </label>
                    <div style={{ fontSize: '12px', color: '#555558' }}>
                      Select up to 3 times in order of preference
                      {selectedSlots.length > 0 && <span style={{ color: '#9A9A9F' }}> · {selectedSlots.length}/3 selected</span>}
                    </div>
                  </div>

                  {DAY_ORDER.filter(day => slotsByDay[day]).map(day => (
                    <div key={day}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>{day}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {slotsByDay[day].map(({ window: w, time }) => {
                          const rank = slotRank(w.id, time)
                          const isSelected = rank !== -1
                          const badge = sessionTypeBadge(w.session_type)
                          const rankColor = isSelected ? RANK_COLORS[rank] : null
                          return (
                            <button
                              key={`${w.id}-${time}`}
                              type="button"
                              onClick={() => toggleSlot(w.id, time)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '12px 14px',
                                minHeight: '52px',
                                borderRadius: '10px',
                                border: isSelected ? `1px solid ${rankColor}55` : '1px solid #2A2A2D',
                                background: isSelected ? `${rankColor}10` : 'transparent',
                                cursor: 'pointer',
                                textAlign: 'left' as const,
                                width: '100%',
                                position: 'relative' as const,
                              }}>
                              {/* Rank badge or empty circle */}
                              <div style={{
                                width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                                border: isSelected ? `2px solid ${rankColor}` : '2px solid #2A2A2D',
                                background: isSelected ? rankColor! : 'transparent',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                {isSelected && (
                                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#0E0E0F' }}>
                                    {rank + 1}
                                  </span>
                                )}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: '14px', fontWeight: 600, color: isSelected ? '#ffffff' : '#9A9A9F' }}>
                                    {formatTime(time)}
                                  </span>
                                  <span style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '99px', fontWeight: 600, background: badge.bg, color: badge.color }}>
                                    {badge.label}{w.duration_minutes ? ` · ${w.duration_minutes}min` : ''}
                                    {w.max_capacity && w.session_type !== 'individual' ? ` · up to ${w.max_capacity}` : ''}
                                  </span>
                                </div>
                                {isSelected && (
                                  <div style={{ fontSize: '11px', marginTop: '2px', fontWeight: 600, color: rankColor! }}>
                                    {RANK_LABELS[rank]} choice
                                  </div>
                                )}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label style={labelStyle}>Anything else? <span style={{ fontSize: '11px', fontWeight: 400, color: '#555558' }}>(optional)</span></label>
                <textarea style={{ ...inputStyle, minHeight: '72px', resize: 'vertical' as const, lineHeight: 1.6 }} placeholder="Scheduling preferences, questions, or anything else..." value={form.message} onChange={e => set('message', e.target.value)} />
              </div>
            </div>

            {error && (
              <div style={{ background: 'rgba(224,49,49,0.08)', border: '1px solid rgba(224,49,49,0.25)', borderRadius: '10px', padding: '12px 14px', fontSize: '14px', color: '#E03131' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{ background: GREEN, color: '#0E0E0F', border: 'none', borderRadius: '12px', padding: '16px', fontSize: '16px', fontWeight: 700, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1, transition: 'opacity 0.15s' }}>
              {loading ? 'Sending…' : 'Request Session'}
            </button>

            <p style={{ fontSize: '12px', color: '#555558', textAlign: 'center' }}>
              Powered by <span style={{ color: '#9A9A9F' }}>SkillPathIQ</span>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
