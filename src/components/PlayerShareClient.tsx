'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { generateSlots } from '@/lib/generateSlots'

const GREEN = '#00FF9F'
const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const RANK_LABELS = ['1st', '2nd', '3rd']
const RANK_COLORS = ['#00FF9F', '#4A9EFF', '#F5A623']

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

function sessionTypeBadge(type: string) {
  if (type === 'individual') return { bg: 'rgba(74,158,255,0.15)', color: '#4A9EFF', label: 'Individual' }
  if (type === 'group') return { bg: 'rgba(245,166,35,0.15)', color: '#F5A623', label: 'Group' }
  return { bg: 'rgba(0,255,159,0.12)', color: GREEN, label: 'Both' }
}

interface Player {
  id: string
  full_name: string
  birth_year: number | null
  parent_email: string | null
  parent_name?: string | null
  parent_phone?: string | null
  trainer_id: string
  group_id: string | null
  skill_level: string | null
  avatar_initials: string | null
  archived: boolean
}

interface Trainer {
  id: string
  full_name: string
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

interface DrillWeek { id: string; title: string; group_id: string | null; player_id: string | null; week_start: string }
interface Drill { id: string; title: string; description: string; reps: string; drill_week_id: string; sort_order: number }
interface Completion { id: string; drill_id: string; player_id: string }
interface Session { id: string; feedback: string | null; session_date: string; session_type: string; notes: string | null; drills_covered: string | null }
interface AllDrillWeek { id: string; title: string; week_start: string }
interface AllDrill { id: string; title: string; reps: string; drill_week_id: string }

type SelectedSlot = { window_id: string; slot_time: string }
type Tab = 'drills' | 'sessions' | 'history'

export default function PlayerShareClient({
  player,
  trainer,
  availabilityWindows,
  sessionDurations,
  upcomingBlackouts,
}: {
  player: Player
  trainer: Trainer | null
  availabilityWindows: AvailabilityWindow[]
  sessionDurations: SessionDuration[]
  upcomingBlackouts: string[]
}) {
  const supabase = createClient()

  const [drillWeek, setDrillWeek] = useState<DrillWeek | null>(null)
  const [drills, setDrills] = useState<Drill[]>([])
  const [completions, setCompletions] = useState<Completion[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [allDrillWeeks, setAllDrillWeeks] = useState<AllDrillWeek[]>([])
  const [allDrills, setAllDrills] = useState<AllDrill[]>([])
  const [allCompletions, setAllCompletions] = useState<Completion[]>([])
  const [latestFeedback, setLatestFeedback] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('drills')

  // Booking form state
  const [sessionType, setSessionType] = useState<'individual' | 'group'>('individual')
  const [selectedSlots, setSelectedSlots] = useState<SelectedSlot[]>([])
  const [formMessage, setFormMessage] = useState('')
  const [bookingLoading, setBookingLoading] = useState(false)
  const [bookingSubmitted, setBookingSubmitted] = useState(false)
  const [bookingError, setBookingError] = useState<string | null>(null)

  useEffect(() => { loadPlayerData() }, [])

  async function loadPlayerData() {
    setLoading(true)
    const playerId = player.id

    const { data: sessionData } = await supabase
      .from('sessions').select('feedback, session_date')
      .eq('player_id', playerId).not('feedback', 'is', null)
      .order('session_date', { ascending: false }).limit(1).single()
    if (sessionData?.feedback) setLatestFeedback(sessionData.feedback)

    const { data: sessionsData } = await supabase
      .from('sessions').select('*').eq('player_id', playerId)
      .order('session_date', { ascending: false }).limit(20)
    setSessions(sessionsData || [])

    let weekData: DrillWeek | null = null
    const { data: playerWeek } = await supabase
      .from('drill_weeks').select('*').eq('player_id', playerId)
      .order('week_start', { ascending: false }).limit(1).single()
    if (playerWeek) {
      weekData = playerWeek
    } else if (player.group_id) {
      const { data: groupWeek } = await supabase
        .from('drill_weeks').select('*').eq('group_id', player.group_id)
        .order('week_start', { ascending: false }).limit(1).single()
      if (groupWeek) weekData = groupWeek
    }

    if (weekData) {
      setDrillWeek(weekData)
      const { data: drillsData } = await supabase
        .from('drills').select('*').eq('drill_week_id', weekData.id)
        .order('sort_order', { ascending: true })
      setDrills(drillsData || [])
      const { data: completionsData } = await supabase
        .from('completions').select('*').eq('player_id', playerId)
        .in('drill_id', drillsData?.map((d: Drill) => d.id) || [])
      setCompletions(completionsData || [])
    }

    const groupId = player.group_id
    const { data: allWeeksData } = await supabase
      .from('drill_weeks').select('*')
      .or(groupId ? `player_id.eq.${playerId},group_id.eq.${groupId}` : `player_id.eq.${playerId}`)
      .order('week_start', { ascending: false })
    setAllDrillWeeks(allWeeksData || [])

    if (allWeeksData && allWeeksData.length > 0) {
      const { data: allDrillsData } = await supabase
        .from('drills').select('*')
        .in('drill_week_id', allWeeksData.map(w => w.id))
      setAllDrills(allDrillsData || [])
      const { data: allCompletionsData } = await supabase
        .from('completions').select('*').eq('player_id', playerId)
        .in('drill_id', allDrillsData?.map(d => d.id) || [])
      setAllCompletions(allCompletionsData || [])
    }

    setLoading(false)
  }

  async function toggleDrill(drillId: string) {
    const isCompleted = completions.some(c => c.drill_id === drillId)
    if (isCompleted) {
      await supabase.from('completions').delete().eq('drill_id', drillId).eq('player_id', player.id)
      setCompletions(completions.filter(c => c.drill_id !== drillId))
    } else {
      const { data } = await supabase.from('completions').insert({ drill_id: drillId, player_id: player.id }).select().single()
      if (data) setCompletions([...completions, data])
    }
  }

  function toggleSlot(window_id: string, slot_time: string) {
    setSelectedSlots(prev => {
      const idx = prev.findIndex(s => s.window_id === window_id && s.slot_time === slot_time)
      if (idx !== -1) return prev.filter((_, i) => i !== idx)
      if (prev.length < 3) return [...prev, { window_id, slot_time }]
      return [...prev.slice(1), { window_id, slot_time }]
    })
  }

  function slotRank(window_id: string, slot_time: string) {
    return selectedSlots.findIndex(s => s.window_id === window_id && s.slot_time === slot_time)
  }

  const slotsByDay = DAY_ORDER.reduce<Record<string, Array<{ window: AvailabilityWindow; time: string }>>>((acc, day) => {
    const dayWindows = sortWindows(availabilityWindows.filter(w => w.day_of_week === day))
    const slots = dayWindows.flatMap(w =>
      generateSlots(w.start_time, w.end_time, w.duration_minutes, w.buffer_minutes).map(t => ({ window: w, time: t }))
    )
    if (slots.length > 0) acc[day] = slots
    return acc
  }, {})

  const hasSlots = Object.keys(slotsByDay).length > 0

  async function handleBookingSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (hasSlots && selectedSlots.length === 0) {
      setBookingError('Please select at least one preferred time.')
      return
    }
    setBookingLoading(true)
    setBookingError(null)

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
          trainer_id: player.trainer_id,
          request_type: 'returning_player',
          player_id: player.id,
          preferred_session_type: sessionType,
          message: formMessage.trim() || null,
          preferred_slots: preferredSlots.length > 0 ? preferredSlots : null,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setBookingError(data.error || 'Something went wrong. Please try again.')
        return
      }
      setBookingSubmitted(true)
    } catch {
      setBookingError('Something went wrong. Please try again.')
    } finally {
      setBookingLoading(false)
    }
  }

  function getInitials(name: string) {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??'
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  function getDaysSince(dateStr: string) {
    return Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
  }

  function formatDaysAgo(days: number) {
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days}d ago`
    if (days < 30) return `${Math.floor(days / 7)}w ago`
    return `${Math.floor(days / 30)}mo ago`
  }

  const playerAge = player.birth_year ? new Date().getFullYear() - player.birth_year : null
  const doneCount = completions.length
  const totalCount = drills.length
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0
  const allDone = doneCount === totalCount && totalCount > 0

  const trainerFirstName = trainer?.full_name?.split(' ')[0] || 'your trainer'

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

  return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', fontFamily: 'sans-serif', padding: '24px 16px' }}>
      <style>{`* { box-sizing: border-box; margin: 0; padding: 0; } html, body { background: #0E0E0F; }`}</style>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>

        {/* LOGO */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-dark.png" alt="SkillPathIQ" style={{ height: '32px', width: 'auto' }} />
        </div>

        {/* PLAYER HEADER */}
        <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '16px', padding: '24px', marginBottom: '16px', textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(0,255,159,0.12)', color: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 600, margin: '0 auto 12px' }}>
            {getInitials(player.full_name)}
          </div>
          <div style={{ fontFamily: '"Exo 2", sans-serif', fontSize: '24px', fontWeight: 700, color: '#ffffff', marginBottom: '4px' }}>
            {player.full_name}
          </div>
          <div style={{ fontSize: '13px', color: '#9A9A9F' }}>
            {sessions.length} session{sessions.length !== 1 ? 's' : ''} · {allDrillWeeks.length} drill week{allDrillWeeks.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* COACH FEEDBACK */}
        {latestFeedback && (
          <div style={{ background: 'rgba(0,255,159,0.05)', border: '1px solid rgba(0,255,159,0.25)', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: GREEN, flexShrink: 0 }} />
              <span style={{ fontSize: '11px', fontWeight: 600, color: GREEN, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Latest coach note</span>
            </div>
            <p style={{ fontSize: '14px', color: '#ffffff', lineHeight: 1.6, margin: 0 }}>{latestFeedback}</p>
          </div>
        )}

        {/* TABS */}
        <div style={{ display: 'flex', gap: '4px', background: '#1A1A1C', borderRadius: '10px', padding: '4px', marginBottom: '16px' }}>
          {([
            { id: 'drills', label: 'This week' },
            { id: 'sessions', label: 'Sessions' },
            { id: 'history', label: 'Drill history' },
          ] as { id: Tab; label: string }[]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1, padding: '8px', borderRadius: '7px', border: 'none', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                background: activeTab === tab.id ? GREEN : 'transparent',
                color: activeTab === tab.id ? '#0E0E0F' : '#9A9A9F',
                transition: 'all 0.15s',
              }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB: THIS WEEK */}
        {activeTab === 'drills' && (
          <>
            {loading ? (
              <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '32px', textAlign: 'center' }}>
                <p style={{ fontSize: '13px', color: '#9A9A9F' }}>Loading...</p>
              </div>
            ) : drillWeek ? (
              <>
                <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '13px', color: '#9A9A9F' }}>{drillWeek.title}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '18px', fontWeight: 700, color: '#ffffff' }}>{doneCount} / {totalCount}</span>
                  </div>
                  <div style={{ height: '8px', background: '#2A2A2D', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: pct + '%', background: GREEN, borderRadius: '99px', transition: 'width 0.4s ease', opacity: allDone ? 1 : 0.6 }} />
                  </div>
                </div>

                {allDone && (
                  <div style={{ background: 'rgba(0,255,159,0.1)', border: '1px solid #00FF9F', borderRadius: '12px', padding: '16px', textAlign: 'center', marginBottom: '16px' }}>
                    <p style={{ fontSize: '15px', color: GREEN, fontWeight: 600, margin: 0 }}>🔥 All drills done! Coach will see your progress.</p>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {drills.map(drill => {
                    const isDone = completions.some(c => c.drill_id === drill.id)
                    return (
                      <div key={drill.id} onClick={() => toggleDrill(drill.id)} style={{ background: isDone ? 'rgba(0,255,159,0.05)' : '#1A1A1C', border: `1px solid ${isDone ? GREEN : '#2A2A2D'}`, borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', transition: 'all 0.15s' }}>
                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: isDone ? 'none' : '2px solid #9A9A9F', background: isDone ? GREEN : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                          {isDone && (
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <polyline points="2,6 5,9 10,3" stroke="#0E0E0F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '15px', fontWeight: 500, color: isDone ? '#9A9A9F' : '#ffffff', textDecoration: isDone ? 'line-through' : 'none', transition: 'all 0.15s' }}>{drill.title}</div>
                          {drill.reps && <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '3px' }}>{drill.reps}</div>}
                          {drill.description && <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '3px' }}>{drill.description}</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>🏀</div>
                <p style={{ fontSize: '14px', color: '#9A9A9F' }}>No drills assigned yet.</p>
                <p style={{ fontSize: '13px', color: '#9A9A9F', marginTop: '4px' }}>Check back after your next session!</p>
              </div>
            )}
          </>
        )}

        {/* TAB: SESSIONS */}
        {activeTab === 'sessions' && (
          <div>
            {loading ? (
              <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '32px', textAlign: 'center' }}>
                <p style={{ fontSize: '13px', color: '#9A9A9F' }}>Loading...</p>
              </div>
            ) : sessions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>📋</div>
                <p style={{ fontSize: '14px', color: '#9A9A9F' }}>No sessions logged yet.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {sessions.map((session, i) => (
                  <div key={session.id} style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: session.notes || session.feedback || session.drills_covered ? '10px' : '0' }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff' }}>{formatDate(session.session_date)}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {i === 0 && <span style={{ fontSize: '10px', background: 'rgba(0,255,159,0.12)', color: GREEN, padding: '2px 7px', borderRadius: '99px', fontWeight: 600 }}>Latest</span>}
                        <span style={{ fontSize: '11px', color: '#9A9A9F' }}>{formatDaysAgo(getDaysSince(session.session_date))}</span>
                      </div>
                    </div>
                    {session.drills_covered && (
                      <div style={{ fontSize: '13px', color: '#9A9A9F', marginBottom: '6px' }}>
                        <span style={{ color: '#ffffff', fontWeight: 500 }}>Covered: </span>{session.drills_covered}
                      </div>
                    )}
                    {session.notes && <div style={{ fontSize: '13px', color: '#9A9A9F', marginBottom: '6px' }}>{session.notes}</div>}
                    {session.feedback && (
                      <div style={{ background: 'rgba(0,255,159,0.05)', border: '1px solid rgba(0,255,159,0.2)', borderRadius: '8px', padding: '10px 12px', marginTop: '8px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: GREEN, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Coach note</div>
                        <div style={{ fontSize: '13px', color: '#ffffff', lineHeight: 1.5 }}>{session.feedback}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: DRILL HISTORY */}
        {activeTab === 'history' && (
          <div>
            {loading ? (
              <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '32px', textAlign: 'center' }}>
                <p style={{ fontSize: '13px', color: '#9A9A9F' }}>Loading...</p>
              </div>
            ) : allDrillWeeks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>📝</div>
                <p style={{ fontSize: '14px', color: '#9A9A9F' }}>No drill history yet.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {allDrillWeeks.map((week, wi) => {
                  const weekDrills = allDrills.filter(d => d.drill_week_id === week.id)
                  const weekCompletions = allCompletions.filter(c => weekDrills.some(d => d.id === c.drill_id))
                  const weekPct = weekDrills.length > 0 ? Math.round((weekCompletions.length / weekDrills.length) * 100) : 0
                  const isCurrentWeek = wi === 0
                  return (
                    <div key={week.id} style={{ background: '#1A1A1C', border: `1px solid ${isCurrentWeek ? 'rgba(0,255,159,0.3)' : '#2A2A2D'}`, borderRadius: '12px', padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff' }}>{week.title}</div>
                          <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>Week of {formatDate(week.week_start)}</div>
                        </div>
                        <div style={{ textAlign: 'right' as const }}>
                          <div style={{ fontSize: '18px', fontFamily: 'monospace', fontWeight: 700, color: weekPct === 100 ? GREEN : '#ffffff' }}>{weekPct}%</div>
                          <div style={{ fontSize: '11px', color: '#9A9A9F' }}>{weekCompletions.length}/{weekDrills.length} done</div>
                        </div>
                      </div>
                      <div style={{ height: '4px', background: '#2A2A2D', borderRadius: '99px', overflow: 'hidden', marginBottom: '12px' }}>
                        <div style={{ height: '100%', width: weekPct + '%', background: GREEN, borderRadius: '99px', opacity: weekPct === 100 ? 1 : 0.5 }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {weekDrills.map(drill => {
                          const done = allCompletions.some(c => c.drill_id === drill.id)
                          return (
                            <div key={drill.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: done ? GREEN : '#2A2A2D', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {done && (
                                  <svg width="7" height="7" viewBox="0 0 8 8" fill="none">
                                    <polyline points="1,4 3,6 7,2" stroke="#0E0E0F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                              </div>
                              <span style={{ fontSize: '13px', color: done ? '#9A9A9F' : '#ffffff', textDecoration: done ? 'line-through' : 'none' }}>{drill.title}</span>
                              {drill.reps && <span style={{ fontSize: '11px', color: '#9A9A9F', marginLeft: 'auto', whiteSpace: 'nowrap' as const }}>{drill.reps}</span>}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* BOOKING SECTION */}
        <div style={{ marginTop: '24px' }}>
          {player.archived ? (
            <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
              <p style={{ fontSize: '13px', color: '#555558', margin: 0 }}>This profile is currently inactive.</p>
            </div>
          ) : bookingSubmitted ? (
            <div style={{ background: 'rgba(0,255,159,0.06)', border: '1px solid rgba(0,255,159,0.25)', borderRadius: '16px', padding: '32px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>✓</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>Request sent!</div>
              <p style={{ fontSize: '14px', color: '#9A9A9F', lineHeight: 1.6 }}>
                {trainerFirstName} will be in touch to confirm your session.
              </p>
            </div>
          ) : (
            <form onSubmit={handleBookingSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* FORM HEADER */}
              <div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', marginBottom: '4px' }}>Request a Session</div>
                <p style={{ fontSize: '13px', color: '#9A9A9F' }}>
                  Select your preferred times and we&apos;ll confirm with {trainerFirstName}.
                </p>
              </div>

              {/* INFO ON FILE */}
              <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '14px', padding: '20px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>Info on file</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                    <span style={{ fontSize: '13px', color: '#9A9A9F', flexShrink: 0 }}>Player</span>
                    <span style={{ fontSize: '13px', color: '#ffffff', fontWeight: 500, textAlign: 'right' as const }}>
                      {player.full_name}{playerAge ? `, age ${playerAge}` : ''}
                    </span>
                  </div>
                  {player.parent_name && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                      <span style={{ fontSize: '13px', color: '#9A9A9F', flexShrink: 0 }}>Contact name</span>
                      <span style={{ fontSize: '13px', color: '#ffffff', textAlign: 'right' as const }}>{player.parent_name}</span>
                    </div>
                  )}
                  {player.parent_email && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                      <span style={{ fontSize: '13px', color: '#9A9A9F', flexShrink: 0 }}>Email</span>
                      <span style={{ fontSize: '13px', color: '#ffffff', textAlign: 'right' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>{player.parent_email}</span>
                    </div>
                  )}
                  {player.parent_phone && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                      <span style={{ fontSize: '13px', color: '#9A9A9F', flexShrink: 0 }}>Phone</span>
                      <span style={{ fontSize: '13px', color: '#ffffff', textAlign: 'right' as const }}>{player.parent_phone}</span>
                    </div>
                  )}
                </div>
                <div style={{ marginTop: '12px', fontSize: '12px', color: '#555558' }}>
                  Not your info? Contact your trainer to update your details.
                </div>
              </div>

              {/* SESSION PREFERENCE */}
              <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Session preference</div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {(['individual', 'group'] as const).map(type => (
                    <button key={type} type="button" onClick={() => setSessionType(type)} style={{ padding: '12px', borderRadius: '10px', border: `1px solid ${sessionType === type ? 'rgba(0,255,159,0.4)' : '#2A2A2D'}`, background: sessionType === type ? 'rgba(0,255,159,0.08)' : 'transparent', color: sessionType === type ? GREEN : '#9A9A9F', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                      {type === 'individual' ? '1-on-1' : 'Group'}
                    </button>
                  ))}
                </div>

                {/* RANKED SLOT PICKER */}
                {hasSlots && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <label style={{ ...labelStyle, marginBottom: '2px' }}>
                        When works best? <span style={{ color: '#E03131' }}>*</span>
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
                                  display: 'flex', alignItems: 'center', gap: '10px',
                                  padding: '12px 14px', minHeight: '52px', borderRadius: '10px',
                                  border: isSelected ? `1px solid ${rankColor}55` : '1px solid #2A2A2D',
                                  background: isSelected ? `${rankColor}10` : 'transparent',
                                  cursor: 'pointer', textAlign: 'left' as const, width: '100%',
                                }}>
                                <div style={{
                                  width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                                  border: isSelected ? `2px solid ${rankColor}` : '2px solid #2A2A2D',
                                  background: isSelected ? rankColor! : 'transparent',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                  {isSelected && <span style={{ fontSize: '10px', fontWeight: 700, color: '#0E0E0F' }}>{rank + 1}</span>}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '14px', fontWeight: 600, color: isSelected ? '#ffffff' : '#9A9A9F' }}>
                                      {formatTime(time)}
                                    </span>
                                    <span style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '99px', fontWeight: 600, background: badge.bg, color: badge.color }}>
                                      {badge.label}{w.duration_minutes ? ` · ${w.duration_minutes}min` : ''}
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
                  <label style={labelStyle}>Anything your trainer should know? <span style={{ fontSize: '11px', fontWeight: 400, color: '#555558' }}>(optional)</span></label>
                  <textarea
                    style={{ ...inputStyle, minHeight: '72px', resize: 'vertical' as const, lineHeight: 1.6 }}
                    placeholder="Goals, scheduling constraints, questions..."
                    value={formMessage}
                    onChange={e => setFormMessage(e.target.value)}
                  />
                </div>
              </div>

              {bookingError && (
                <div style={{ background: 'rgba(224,49,49,0.08)', border: '1px solid rgba(224,49,49,0.25)', borderRadius: '10px', padding: '12px 14px', fontSize: '14px', color: '#E03131' }}>
                  {bookingError}
                </div>
              )}

              <button
                type="submit"
                disabled={bookingLoading}
                style={{ background: GREEN, color: '#0E0E0F', border: 'none', borderRadius: '12px', padding: '16px', fontSize: '16px', fontWeight: 700, cursor: bookingLoading ? 'default' : 'pointer', opacity: bookingLoading ? 0.7 : 1, transition: 'opacity 0.15s' }}>
                {bookingLoading ? 'Sending…' : 'Request Session'}
              </button>

              <p style={{ fontSize: '12px', color: '#555558', textAlign: 'center' }}>
                Powered by <span style={{ color: '#9A9A9F' }}>SkillPathIQ</span>
              </p>
            </form>
          )}
        </div>

        <div style={{ height: '40px' }} />
      </div>
    </div>
  )
}
