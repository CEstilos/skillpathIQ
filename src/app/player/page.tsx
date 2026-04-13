'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase'
import { useSearchParams } from 'next/navigation'

interface Player { id: string; full_name: string; group_id: string | null }
interface DrillWeek { id: string; title: string; group_id: string | null; player_id: string | null; week_start: string }
interface Drill { id: string; title: string; description: string; reps: string; drill_week_id: string; sort_order: number }
interface Completion { id: string; drill_id: string; player_id: string }
interface Session { id: string; feedback: string | null; session_date: string }

function PlayerView() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const playerId = searchParams.get('id')

  const [player, setPlayer] = useState<Player | null>(null)
  const [drillWeek, setDrillWeek] = useState<DrillWeek | null>(null)
  const [drills, setDrills] = useState<Drill[]>([])
  const [completions, setCompletions] = useState<Completion[]>([])
  const [latestFeedback, setLatestFeedback] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (playerId) loadPlayerData()
  }, [playerId])

  async function loadPlayerData() {
    setLoading(true)

    const { data: playerData } = await supabase
      .from('players').select('*').eq('id', playerId).single()
    if (!playerData) { setError('Player not found'); setLoading(false); return }
    setPlayer(playerData)

    // Fetch latest feedback from sessions
    const { data: sessionData } = await supabase
      .from('sessions')
      .select('feedback, session_date')
      .eq('player_id', playerId)
      .not('feedback', 'is', null)
      .order('session_date', { ascending: false })
      .limit(1)
      .single()
    if (sessionData?.feedback) setLatestFeedback(sessionData.feedback)

    // Fetch drill week — check player-specific first, then group
    let weekData: DrillWeek | null = null

    const { data: playerWeek } = await supabase
      .from('drill_weeks')
      .select('*')
      .eq('player_id', playerId)
      .order('week_start', { ascending: false })
      .limit(1)
      .single()

    if (playerWeek) {
      weekData = playerWeek
    } else if (playerData.group_id) {
      const { data: groupWeek } = await supabase
        .from('drill_weeks')
        .select('*')
        .eq('group_id', playerData.group_id)
        .order('week_start', { ascending: false })
        .limit(1)
        .single()
      if (groupWeek) weekData = groupWeek
    }

    if (!weekData) { setLoading(false); return }
    setDrillWeek(weekData)

    const { data: drillsData } = await supabase
      .from('drills').select('*').eq('drill_week_id', weekData.id)
      .order('sort_order', { ascending: true })
    setDrills(drillsData || [])

    const { data: completionsData } = await supabase
      .from('completions').select('*').eq('player_id', playerId)
      .in('drill_id', drillsData?.map((d: Drill) => d.id) || [])
    setCompletions(completionsData || [])
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

  function getInitials(name: string) {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??'
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
      <div style={{ maxWidth: '440px', margin: '0 auto' }}>

        {/* LOGO */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <img src="/logo.png" alt="SkillPathIQ" style={{ height: '65px', width: 'auto' }} />
        </div>

        {/* PLAYER HEADER */}
        <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '16px', padding: '24px', marginBottom: '16px', textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(0,255,159,0.12)', color: '#00FF9F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 600, margin: '0 auto 12px' }}>
            {getInitials(player.full_name)}
          </div>
          <div style={{ fontFamily: '"Exo 2", sans-serif', fontSize: '24px', fontWeight: 700, color: '#ffffff', marginBottom: '4px' }}>
            Hey {player.full_name.split(' ')[0]} 👋
          </div>
          <div style={{ fontSize: '13px', color: '#9A9A9F' }}>
            {drillWeek ? drillWeek.title : 'No drills assigned yet'}
          </div>
        </div>

        {/* COACH FEEDBACK */}
        {latestFeedback && (
          <div style={{ background: 'rgba(0,255,159,0.05)', border: '1px solid rgba(0,255,159,0.25)', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00FF9F', flexShrink: 0 }} />
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#00FF9F', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Coach feedback</span>
            </div>
            <p style={{ fontSize: '14px', color: '#ffffff', lineHeight: 1.6, margin: 0 }}>{latestFeedback}</p>
          </div>
        )}

        {drillWeek && (
          <>
            {/* PROGRESS BAR */}
            <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '13px', color: '#9A9A9F' }}>This week&apos;s progress</span>
                <span style={{ fontFamily: 'monospace', fontSize: '18px', fontWeight: 700, color: '#ffffff' }}>{doneCount} / {totalCount}</span>
              </div>
              <div style={{ height: '8px', background: '#2A2A2D', borderRadius: '99px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: pct + '%', background: '#00FF9F', borderRadius: '99px', transition: 'width 0.4s ease', opacity: allDone ? 1 : 0.6 }} />
              </div>
            </div>

            {/* ALL DONE BANNER */}
            {allDone && (
              <div style={{ background: 'rgba(0,255,159,0.1)', border: '1px solid #00FF9F', borderRadius: '12px', padding: '16px', textAlign: 'center', marginBottom: '16px' }}>
                <p style={{ fontSize: '15px', color: '#00FF9F', fontWeight: 600, margin: 0 }}>🔥 All drills done! Coach will see your progress.</p>
              </div>
            )}

            {/* DRILL LIST */}
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
        )}

        {!drillWeek && (
          <div style={{ textAlign: 'center', padding: '40px 0', background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>🏀</div>
            <p style={{ fontSize: '14px', color: '#9A9A9F' }}>Your coach hasn&apos;t assigned any drills yet.</p>
            <p style={{ fontSize: '13px', color: '#9A9A9F', marginTop: '4px' }}>Check back after your next session!</p>
          </div>
        )}

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
