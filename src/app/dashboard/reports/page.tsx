'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function ReportsView() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const groupId = searchParams.get('group')

  const [players, setPlayers] = useState([])
  const [drillWeek, setDrillWeek] = useState(null)
  const [drills, setDrills] = useState([])
  const [completions, setCompletions] = useState([])
  const [group, setGroup] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedPlayer, setSelectedPlayer] = useState(null)

  useEffect(() => {
    if (groupId) loadData()
  }, [groupId])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const { data: profileData } = await supabase
      .from('profiles').select('*').eq('id', user.id).single()
    setProfile(profileData)

    const { data: groupData } = await supabase
      .from('groups').select('*').eq('id', groupId).single()
    setGroup(groupData)

    const { data: playersData } = await supabase
      .from('players').select('*').eq('group_id', groupId)
    setPlayers(playersData || [])

    const { data: weekData } = await supabase
      .from('drill_weeks').select('*').eq('group_id', groupId)
      .order('week_start', { ascending: false }).limit(1).single()
    setDrillWeek(weekData)

    if (weekData) {
      const { data: drillsData } = await supabase
        .from('drills').select('*').eq('drill_week_id', weekData.id)
        .order('sort_order', { ascending: true })
      setDrills(drillsData || [])

      const { data: completionsData } = await supabase
        .from('completions').select('*')
        .in('player_id', playersData?.map(p => p.id) || [])
        .in('drill_id', drillsData?.map(d => d.id) || [])
      setCompletions(completionsData || [])
    }

    setSelectedPlayer(playersData?.[0]?.id || null)
    setLoading(false)
  }

  function getPlayerCompletions(playerId) {
    return completions.filter(c => c.player_id === playerId)
  }

  function getInitials(name) {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??'
  }

  function getPct(playerId) {
    const done = getPlayerCompletions(playerId).length
    return drills.length > 0 ? Math.round((done / drills.length) * 100) : 0
  }

  function formatDate(dateStr) {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }

  const player = players.find(p => p.id === selectedPlayer)
  const playerCompletions = selectedPlayer ? getPlayerCompletions(selectedPlayer) : []
  const pct = selectedPlayer ? getPct(selectedPlayer) : 0

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#6B6B72' }}>Loading...</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', fontFamily: 'sans-serif' }}>
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', height: '60px', borderBottom: '1px solid #2A2A2D' }}>
        <div style={{ fontFamily: 'monospace', fontSize: '20px', fontWeight: 700, color: '#ffffff', letterSpacing: '2px' }}>
          SkillPath<span style={{ color: '#F4581A' }}>IQ</span>
        </div>
        <Link href="/dashboard" style={{ fontSize: '13px', color: '#6B6B72', textDecoration: 'none' }}>← Back to dashboard</Link>
      </nav>

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '32px 16px' }}>
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>Parent reports</h1>
          <p style={{ fontSize: '14px', color: '#6B6B72' }}>{group?.name} · Week of {formatDate(drillWeek?.week_start)}</p>
        </div>

        {/* PLAYER SELECTOR */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {players.map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedPlayer(p.id)}
              style={{
                padding: '8px 16px', borderRadius: '8px', border: '1px solid #2A2A2D',
                background: selectedPlayer === p.id ? '#F4581A' : 'transparent',
                color: selectedPlayer === p.id ? '#ffffff' : '#6B6B72',
                fontSize: '13px', fontWeight: 500, cursor: 'pointer'
              }}>
              {p.full_name}
            </button>
          ))}
        </div>

        {player && (
          /* EMAIL PREVIEW */
          <div style={{ background: '#ffffff', borderRadius: '16px', overflow: 'hidden', color: '#0E0E0F' }}>

            {/* EMAIL HEADER */}
            <div style={{ background: '#0E0E0F', padding: '28px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontFamily: 'monospace', fontSize: '20px', fontWeight: 700, color: '#ffffff', letterSpacing: '2px' }}>
                SkillPath<span style={{ color: '#F4581A' }}>IQ</span>
              </div>
              <div style={{ fontSize: '12px', color: '#6B6B72' }}>Weekly player report</div>
            </div>

            <div style={{ padding: '32px' }}>
              <p style={{ fontSize: '16px', color: '#333', marginBottom: '8px' }}>
                Hi {player.parent_email ? player.parent_email.split('@')[0] : 'there'},
              </p>
              <p style={{ fontSize: '14px', color: '#555', lineHeight: 1.7, marginBottom: '24px' }}>
                Here's {player.full_name.split(' ')[0]}'s practice report for the week of {formatDate(drillWeek?.week_start)}. 
                {pct === 100
                  ? ` ${player.full_name.split(' ')[0]} completed all assigned drills this week — great work!`
                  : pct > 0
                  ? ` ${player.full_name.split(' ')[0]} completed ${playerCompletions.length} of ${drills.length} assigned drills this week.`
                  : ` ${player.full_name.split(' ')[0]} hasn't started this week's drills yet — a little encouragement goes a long way!`
                }
              </p>

              {/* STATS */}
              <div style={{ background: '#f5f5f7', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888', marginBottom: '14px' }}>
                  This week's summary — {drillWeek?.title}
                </div>

                {/* PLAYER ROW */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(29,184,122,0.15)', color: '#0D6B47', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 600 }}>
                    {getInitials(player.full_name)}
                  </div>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 600, color: '#0E0E0F' }}>{player.full_name}</div>
                    <div style={{ fontSize: '13px', color: '#888', marginTop: '2px' }}>{group?.name} · {group?.sport}</div>
                  </div>
                </div>

                {/* STAT ROW */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
                  {[
                    { label: 'Drills done', value: `${playerCompletions.length}/${drills.length}`, green: pct === 100 },
                    { label: 'Completion', value: pct + '%', green: pct === 100 },
                    { label: 'Focus', value: drillWeek?.title || '—' },
                  ].map(s => (
                    <div key={s.label} style={{ background: '#ffffff', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                      <div style={{ fontFamily: 'monospace', fontSize: '22px', fontWeight: 700, color: s.green ? '#0D6B47' : '#0E0E0F' }}>{s.value}</div>
                      <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* DRILL BREAKDOWN */}
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888', marginBottom: '10px' }}>
                  Drill breakdown
                </div>
                {drills.map(drill => {
                  const done = playerCompletions.some(c => c.drill_id === drill.id)
                  return (
                    <div key={drill.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid #e5e5e5', fontSize: '13px' }}>
                      <span style={{ fontSize: '14px' }}>{done ? '✅' : '⬜'}</span>
                      <span style={{ flex: 1, color: done ? '#333' : '#aaa', textDecoration: done ? 'none' : 'none' }}>{drill.title}</span>
                      <span style={{ fontSize: '11px', color: '#aaa' }}>{done ? 'Done' : 'Not done'}</span>
                    </div>
                  )
                })}
              </div>

              {/* TRAINER NOTE */}
              <p style={{ fontSize: '14px', color: '#555', lineHeight: 1.7, marginBottom: '20px' }}>
                {pct === 100
                  ? `${player.full_name.split(' ')[0]} is putting in the work between sessions — that consistency is exactly what builds real skill. See you at the next session!`
                  : `Encourage ${player.full_name.split(' ')[0]} to knock out the remaining drills before the next session. Even 10 minutes a day makes a big difference over time.`
                }
              </p>

              {/* TRAINER SIG */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '20px', borderTop: '1px solid #e5e5e5' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#F4581A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 600, color: '#ffffff' }}>
                  {getInitials(profile?.full_name)}
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#0E0E0F' }}>{profile?.full_name}</div>
                  <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>SkillPathIQ · {group?.name} Trainer</div>
                </div>
              </div>
            </div>

            {/* EMAIL FOOTER */}
            <div style={{ background: '#f5f5f7', padding: '20px 32px', fontSize: '12px', color: '#999', textAlign: 'center', borderTop: '1px solid #e5e5e5' }}>
              You're receiving this because {player.full_name} is enrolled in {profile?.full_name}'s {group?.name}.<br />
              Powered by SkillPathIQ
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0E0E0F' }} />}>
      <ReportsView />
    </Suspense>
  )
}
