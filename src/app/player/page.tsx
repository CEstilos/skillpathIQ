'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase'
import { useSearchParams } from 'next/navigation'

interface Player { id: string; full_name: string; group_id: string | null; skill_level: string | null; birth_year: number | null }
interface DrillWeek { id: string; title: string; group_id: string | null; player_id: string | null; week_start: string }
interface Drill { id: string; title: string; description: string; reps: string; drill_week_id: string; sort_order: number }
interface Completion { id: string; drill_id: string; player_id: string }
interface Session { id: string; feedback: string | null; session_date: string; session_type: string; notes: string | null; drills_covered: string | null }
interface AllDrillWeek { id: string; title: string; week_start: string }
interface AllDrill { id: string; title: string; reps: string; drill_week_id: string }

type Tab = 'drills' | 'sessions' | 'history'

function PlayerView() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const playerId = searchParams.get('id')

  const [player, setPlayer] = useState<Player | null>(null)
  const [drillWeek, setDrillWeek] = useState<DrillWeek | null>(null)
  const [drills, setDrills] = useState<Drill[]>([])
  const [completions, setCompletions] = useState<Completion[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [allDrillWeeks, setAllDrillWeeks] = useState<AllDrillWeek[]>([])
  const [allDrills, setAllDrills] = useState<AllDrill[]>([])
  const [allCompletions, setAllCompletions] = useState<Completion[]>([])
  const [latestFeedback, setLatestFeedback] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('drills')
  const [requestSent, setRequestSent] = useState(false)
  const [requestNote, setRequestNote] = useState('')
  const [showRequestForm, setShowRequestForm] = useState(false)

  useEffect(() => {
    if (playerId) loadPlayerData()
  }, [playerId])

  async function loadPlayerData() {
    setLoading(true)

    const { data: playerData } = await supabase
      .from('players').select('*').eq('id', playerId).single()
    if (!playerData) { setError('Player not found'); setLoading(false); return }
    setPlayer(playerData)

    // Latest feedback
    const { data: sessionData } = await supabase
      .from('sessions').select('feedback, session_date')
      .eq('player_id', playerId).not('feedback', 'is', null)
      .order('session_date', { ascending: false }).limit(1).single()
    if (sessionData?.feedback) setLatestFeedback(sessionData.feedback)

    // All sessions
    const { data: sessionsData } = await supabase
      .from('sessions').select('*').eq('player_id', playerId)
      .order('session_date', { ascending: false }).limit(20)
    setSessions(sessionsData || [])

    // Current drill week
    let weekData: DrillWeek | null = null
    const { data: playerWeek } = await supabase
      .from('drill_weeks').select('*').eq('player_id', playerId)
      .order('week_start', { ascending: false }).limit(1).single()
    if (playerWeek) {
      weekData = playerWeek
    } else if (playerData.group_id) {
      const { data: groupWeek } = await supabase
        .from('drill_weeks').select('*').eq('group_id', playerData.group_id)
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

    // All drill weeks for history
    const groupId = playerData.group_id
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
      await supabase.from('completions').delete().eq('drill_id', drillId).eq('player_id', playerId)
      setCompletions(completions.filter(c => c.drill_id !== drillId))
    } else {
      const { data } = await supabase.from('completions').insert({ drill_id: drillId, player_id: playerId }).select().single()
      if (data) setCompletions([...completions, data])
    }
  }

  async function handleSessionRequest() {
    if (!player) return
    // Store request in Supabase — trainer can see it on dashboard
    await supabase.from('session_requests').insert({
      player_id: playerId,
      note: requestNote,
      requested_at: new Date().toISOString(),
    }).select()
    setRequestSent(true)
    setShowRequestForm(false)
    setRequestNote('')
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

  const doneCount = completions.length
  const totalCount = drills.length
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0
  const allDone = doneCount === totalCount && totalCount > 0

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#9A9A9F', fontSize: '14px' }}>Loading...</p>
    </div>
  )

  if (error || !player) return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#E03131', fontSize: '14px' }}>{error || 'Player not found'}</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', fontFamily: 'sans-serif', padding: '24px 16px' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>

        {/* LOGO */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <img src="/logo-dark.png" alt="SkillPathIQ" style={{ height: '36px', width: 'auto' }} />
        </div>

        {/* PLAYER HEADER */}
        <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '16px', padding: '24px', marginBottom: '16px', textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(0,255,159,0.12)', color: '#00FF9F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 600, margin: '0 auto 12px' }}>
            {getInitials(player.full_name)}
          </div>
          <div style={{ fontFamily: '"Exo 2", sans-serif', fontSize: '24px', fontWeight: 700, color: '#ffffff', marginBottom: '4px' }}>
            {player.full_name}
          </div>
          <div style={{ fontSize: '13px', color: '#9A9A9F', marginBottom: '16px' }}>
            {sessions.length} session{sessions.length !== 1 ? 's' : ''} · {allDrillWeeks.length} drill week{allDrillWeeks.length !== 1 ? 's' : ''}
          </div>

          {/* REQUEST SESSION BUTTON */}
          {!requestSent ? (
            <button
              onClick={() => setShowRequestForm(!showRequestForm)}
              style={{ background: '#00FF9F', color: '#0E0E0F', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', width: '100%' }}>
              Request next session
            </button>
          ) : (
            <div style={{ background: 'rgba(0,255,159,0.1)', border: '1px solid rgba(0,255,159,0.3)', borderRadius: '8px', padding: '10px', fontSize: '13px', color: '#00FF9F', fontWeight: 600 }}>
              ✓ Session request sent to your coach
            </div>
          )}

          {showRequestForm && (
            <div style={{ marginTop: '12px', textAlign: 'left' }}>
              <textarea
                placeholder="Any notes for your coach? (optional) — e.g. available Tuesday evenings, want to work on shooting"
                value={requestNote}
                onChange={e => setRequestNote(e.target.value)}
                style={{ width: '100%', background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: '#ffffff', outline: 'none', resize: 'none', minHeight: '80px', fontFamily: 'sans-serif', marginBottom: '8px' }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleSessionRequest}
                  style={{ flex: 1, background: '#00FF9F', color: '#0E0E0F', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                  Send request
                </button>
                <button
                  onClick={() => setShowRequestForm(false)}
                  style={{ flex: 1, background: 'transparent', color: '#9A9A9F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '10px', fontSize: '13px', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* COACH FEEDBACK */}
        {latestFeedback && (
          <div style={{ background: 'rgba(0,255,159,0.05)', border: '1px solid rgba(0,255,159,0.25)', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00FF9F', flexShrink: 0 }} />
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#00FF9F', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Latest coach note</span>
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
                background: activeTab === tab.id ? '#00FF9F' : 'transparent',
                color: activeTab === tab.id ? '#0E0E0F' : '#9A9A9F',
                transition: 'all 0.15s',
              }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB: THIS WEEK'S DRILLS */}
        {activeTab === 'drills' && (
          <>
            {drillWeek ? (
              <>
                <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '13px', color: '#9A9A9F' }}>{drillWeek.title}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '18px', fontWeight: 700, color: '#ffffff' }}>{doneCount} / {totalCount}</span>
                  </div>
                  <div style={{ height: '8px', background: '#2A2A2D', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: pct + '%', background: '#00FF9F', borderRadius: '99px', transition: 'width 0.4s ease', opacity: allDone ? 1 : 0.6 }} />
                  </div>
                </div>

                {allDone && (
                  <div style={{ background: 'rgba(0,255,159,0.1)', border: '1px solid #00FF9F', borderRadius: '12px', padding: '16px', textAlign: 'center', marginBottom: '16px' }}>
                    <p style={{ fontSize: '15px', color: '#00FF9F', fontWeight: 600, margin: 0 }}>🔥 All drills done! Coach will see your progress.</p>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {drills.map(drill => {
                    const isDone = completions.some(c => c.drill_id === drill.id)
                    return (
                      <div key={drill.id} onClick={() => toggleDrill(drill.id)} style={{ background: isDone ? 'rgba(0,255,159,0.05)' : '#1A1A1C', border: `1px solid ${isDone ? '#00FF9F' : '#2A2A2D'}`, borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', transition: 'all 0.15s' }}>
                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: isDone ? 'none' : '2px solid #9A9A9F', background: isDone ? '#00FF9F' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
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

        {/* TAB: SESSION HISTORY */}
        {activeTab === 'sessions' && (
          <div>
            {sessions.length === 0 ? (
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
                        {i === 0 && <span style={{ fontSize: '10px', background: 'rgba(0,255,159,0.12)', color: '#00FF9F', padding: '2px 7px', borderRadius: '99px', fontWeight: 600 }}>Latest</span>}
                        <span style={{ fontSize: '11px', color: '#9A9A9F' }}>{formatDaysAgo(getDaysSince(session.session_date))}</span>
                      </div>
                    </div>
                    {session.drills_covered && (
                      <div style={{ fontSize: '13px', color: '#9A9A9F', marginBottom: '6px' }}>
                        <span style={{ color: '#ffffff', fontWeight: 500 }}>Covered: </span>{session.drills_covered}
                      </div>
                    )}
                    {session.notes && (
                      <div style={{ fontSize: '13px', color: '#9A9A9F', marginBottom: '6px' }}>{session.notes}</div>
                    )}
                    {session.feedback && (
                      <div style={{ background: 'rgba(0,255,159,0.05)', border: '1px solid rgba(0,255,159,0.2)', borderRadius: '8px', padding: '10px 12px', marginTop: '8px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: '#00FF9F', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Coach note</div>
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
            {allDrillWeeks.length === 0 ? (
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
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '18px', fontFamily: 'monospace', fontWeight: 700, color: weekPct === 100 ? '#00FF9F' : '#ffffff' }}>{weekPct}%</div>
                          <div style={{ fontSize: '11px', color: '#9A9A9F' }}>{weekCompletions.length}/{weekDrills.length} done</div>
                        </div>
                      </div>
                      <div style={{ height: '4px', background: '#2A2A2D', borderRadius: '99px', overflow: 'hidden', marginBottom: '12px' }}>
                        <div style={{ height: '100%', width: weekPct + '%', background: '#00FF9F', borderRadius: '99px', opacity: weekPct === 100 ? 1 : 0.5 }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {weekDrills.map(drill => {
                          const done = allCompletions.some(c => c.drill_id === drill.id)
                          return (
                            <div key={drill.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: done ? '#00FF9F' : '#2A2A2D', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

        <div style={{ height: '40px' }} />
      </div>
    </div>
  )
}

export default function PlayerPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0E0E0F' }} />}>
      <PlayerView />
    </Suspense>
  )
}
