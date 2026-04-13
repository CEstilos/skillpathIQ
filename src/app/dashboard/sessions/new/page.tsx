'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Group { id: string; name: string; sport: string }
interface Player { id: string; full_name: string; group_id: string }

function NewSessionForm() {
  const supabase = createClient()
  const router = useRouter()

  const [groups, setGroups] = useState<Group[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [title, setTitle] = useState('')
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().split('T')[0])
  const [sessionTime, setSessionTime] = useState('')
  const [type, setType] = useState<'one-off' | 'recurring'>('one-off')
  const [recurrenceRule, setRecurrenceRule] = useState('weekly')
  const [sessionFor, setSessionFor] = useState<'group' | 'individual'>('group')
  const [selectedGroup, setSelectedGroup] = useState('')
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }
    const { data: groupsData } = await supabase.from('groups').select('*').eq('trainer_id', user.id)
    setGroups(groupsData || [])
    const { data: playersData } = await supabase.from('players').select('*').eq('trainer_id', user.id)
    setPlayers(playersData || [])
    if (groupsData?.[0]) setSelectedGroup(groupsData[0].id)
  }

  function togglePlayer(playerId: string) {
    setSelectedPlayers(prev =>
      prev.includes(playerId) ? prev.filter(id => id !== playerId) : [...prev, playerId]
    )
  }

  const filteredPlayers = sessionFor === 'group'
    ? players.filter(p => p.group_id === selectedGroup)
    : players

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const sessionData = {
      trainer_id: user.id,
      group_id: sessionFor === 'group' ? selectedGroup : null,
      title,
      session_date: sessionDate,
      session_time: sessionTime,
      type,
      recurrence_rule: type === 'recurring' ? recurrenceRule : null,
    }

    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert(sessionData)
      .select()
      .single()

    if (sessionError) { setError(sessionError.message); setLoading(false); return }

    if (sessionFor === 'individual' && selectedPlayers.length > 0) {
      const playerRows = selectedPlayers.map(playerId => ({
        session_id: session.id,
        player_id: playerId,
        trainer_id: user.id,
      }))
      const { error: playersError } = await supabase.from('session_players').insert(playerRows)
      if (playersError) { setError(playersError.message); setLoading(false); return }
    }

    router.push('/dashboard')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', fontFamily: 'sans-serif' }}>
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', height: '60px', borderBottom: '1px solid #2A2A2D' }}>
        <div style={{ fontFamily: 'monospace', fontSize: '20px', fontWeight: 700, color: '#ffffff', letterSpacing: '2px' }}>
          SkillPath<span style={{ color: '#F4581A' }}>IQ</span>
        </div>
        <Link href="/dashboard" style={{ fontSize: '13px', color: '#6B6B72', textDecoration: 'none' }}>← Back to dashboard</Link>
      </nav>

      <div style={{ maxWidth: '560px', margin: '48px auto', padding: '0 16px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>Schedule a session</h1>
        <p style={{ fontSize: '14px', color: '#6B6B72', marginBottom: '32px' }}>Set up a training session for a group or individual players</p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* SESSION FOR */}
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Session for</div>
            <div style={{ display: 'flex', gap: '10px' }}>
              {(['group', 'individual'] as const).map(opt => (
                <button key={opt} type="button" onClick={() => setSessionFor(opt)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: `1px solid ${sessionFor === opt ? '#F4581A' : '#2A2A2D'}`, background: sessionFor === opt ? 'rgba(244,88,26,0.1)' : 'transparent', color: sessionFor === opt ? '#F4581A' : '#6B6B72', fontSize: '14px', fontWeight: 500, cursor: 'pointer', textTransform: 'capitalize' }}>
                  {opt === 'group' ? '👥 Group' : '👤 Individual players'}
                </button>
              ))}
            </div>

            {sessionFor === 'group' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', color: '#a0a0a8' }}>Select group</label>
                <select style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }} value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            )}

            {sessionFor === 'individual' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '13px', color: '#a0a0a8' }}>Select players</label>
                {players.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#6B6B72' }}>No players yet — add players first</p>
                ) : (
                  players.map(player => (
                    <div key={player.id} onClick={() => togglePlayer(player.id)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${selectedPlayers.includes(player.id) ? '#F4581A' : '#2A2A2D'}`, background: selectedPlayers.includes(player.id) ? 'rgba(244,88,26,0.08)' : 'transparent', cursor: 'pointer' }}>
                      <div style={{ width: '20px', height: '20px', borderRadius: '4px', border: `2px solid ${selectedPlayers.includes(player.id) ? '#F4581A' : '#6B6B72'}`, background: selectedPlayers.includes(player.id) ? '#F4581A' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {selectedPlayers.includes(player.id) && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <polyline points="1.5,5 4,7.5 8.5,2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <span style={{ fontSize: '14px', color: '#ffffff' }}>{player.full_name}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* SESSION DETAILS */}
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Session details</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', color: '#a0a0a8' }}>Session title</label>
              <input style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }} type="text" placeholder="e.g. Ball handling session, 1-on-1 with Marcus" value={title} onChange={e => setTitle(e.target.value)} required />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                <label style={{ fontSize: '13px', color: '#a0a0a8' }}>Date</label>
                <input style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }} type="date" value={sessionDate} onChange={e => setSessionDate(e.target.value)} required />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                <label style={{ fontSize: '13px', color: '#a0a0a8' }}>Time</label>
                <input style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }} type="time" value={sessionTime} onChange={e => setSessionTime(e.target.value)} />
              </div>
            </div>
          </div>

          {/* SESSION TYPE */}
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Frequency</div>
            <div style={{ display: 'flex', gap: '10px' }}>
              {(['one-off', 'recurring'] as const).map(opt => (
                <button key={opt} type="button" onClick={() => setType(opt)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: `1px solid ${type === opt ? '#F4581A' : '#2A2A2D'}`, background: type === opt ? 'rgba(244,88,26,0.1)' : 'transparent', color: type === opt ? '#F4581A' : '#6B6B72', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>
                  {opt === 'one-off' ? 'One-off' : 'Recurring'}
                </button>
              ))}
            </div>

            {type === 'recurring' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', color: '#a0a0a8' }}>Repeats</label>
                <select style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }} value={recurrenceRule} onChange={e => setRecurrenceRule(e.target.value)}>
                  <option value="weekly">Every week</option>
                  <option value="biweekly">Every 2 weeks</option>
                  <option value="monthly">Every month</option>
                </select>
                <span style={{ fontSize: '12px', color: '#6B6B72' }}>Starting from the date selected above</span>
              </div>
            )}
          </div>

          {error && <p style={{ fontSize: '13px', color: '#E03131', background: '#1f0f0f', border: '1px solid #3a1a1a', borderRadius: '8px', padding: '10px 14px' }}>{error}</p>}

          <button type="submit" disabled={loading} style={{ background: '#F4581A', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '14px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}>
            {loading ? 'Scheduling...' : 'Schedule session'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function NewSessionPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0E0E0F' }} />}>
      <NewSessionForm />
    </Suspense>
  )
}
