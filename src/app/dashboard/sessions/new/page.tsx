'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

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
  const [menuOpen, setMenuOpen] = useState(false)

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

  function getInitials(name: string) {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??'
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        trainer_id: user.id,
        group_id: sessionFor === 'group' ? selectedGroup : null,
        title,
        session_date: sessionDate,
        session_time: sessionTime,
        type,
        recurrence_rule: type === 'recurring' ? recurrenceRule : null,
      })
      .select()
      .single()

    if (sessionError) { setError(sessionError.message); setLoading(false); return }

    if (sessionFor === 'individual' && selectedPlayers.length > 0) {
      await supabase.from('session_players').insert(
        selectedPlayers.map(playerId => ({
          session_id: session.id,
          player_id: playerId,
          trainer_id: user.id,
        }))
      )
    }

    router.push('/dashboard')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', fontFamily: 'sans-serif', overflowX: 'hidden' }}>

      <style>{`* { box-sizing: border-box; margin: 0; padding: 0; } @media (max-width: 640px) { .nav-links { display: none !important; } .nav-menu-btn { display: flex !important; } }`}</style>

      {/* NAV */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', height: '56px', borderBottom: '1px solid #2A2A2D', background: '#0E0E0F', position: 'sticky', top: 0, zIndex: 100 }}>
        <img src="/logo.png" alt="SkillPathIQ" onClick={() => router.push('/dashboard')} style={{ height: '65px', width: 'auto', cursor: 'pointer' }} />
        <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => router.push('/dashboard')} style={{ fontSize: '13px', color: '#9A9A9F', background: 'none', border: 'none', cursor: 'pointer' }}>← Training Hub</button>
        </div>
        <button className="nav-menu-btn" onClick={() => setMenuOpen(!menuOpen)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', flexDirection: 'column', gap: '5px', alignItems: 'center', justifyContent: 'center', display: 'none' }}>
          <div style={{ width: '20px', height: '2px', background: '#ffffff', borderRadius: '2px' }} />
          <div style={{ width: '20px', height: '2px', background: '#ffffff', borderRadius: '2px' }} />
          <div style={{ width: '20px', height: '2px', background: '#ffffff', borderRadius: '2px' }} />
        </button>
      </nav>

      {menuOpen && (
        <div style={{ background: '#1A1A1C', borderBottom: '1px solid #2A2A2D', padding: '8px 0' }}>
          <button onClick={() => router.push('/dashboard')} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 20px', background: 'none', border: 'none', color: '#9A9A9F', fontSize: '14px', cursor: 'pointer' }}>← Training Hub</button>
        </div>
      )}

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px 16px' }}>

        {/* HEADER */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00FF9F' }} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#00FF9F', textTransform: 'uppercase', letterSpacing: '0.08em' }}>New session</span>
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#ffffff', fontFamily: '"Exo 2", sans-serif' }}>Schedule a session</h1>
          <p style={{ fontSize: '14px', color: '#9A9A9F', marginTop: '4px' }}>Set up a training session for a group or individual players</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* SESSION FOR */}
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #2A2A2D' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Session for</span>
            </div>
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(['group', 'individual'] as const).map(opt => (
                  <button key={opt} type="button" onClick={() => setSessionFor(opt)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: `1px solid ${sessionFor === opt ? 'rgba(0,255,159,0.4)' : '#2A2A2D'}`, background: sessionFor === opt ? 'rgba(0,255,159,0.08)' : 'transparent', color: sessionFor === opt ? '#00FF9F' : '#9A9A9F', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>
                    {opt === 'group' ? '👥 Group' : '👤 Individual'}
                  </button>
                ))}
              </div>

              {sessionFor === 'group' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', color: '#9A9A9F' }}>Select group</label>
                  {groups.length === 0 ? (
                    <p style={{ fontSize: '13px', color: '#9A9A9F' }}>No groups yet — <span onClick={() => router.push('/dashboard/groups/new')} style={{ color: '#00FF9F', cursor: 'pointer' }}>create one first</span></p>
                  ) : (
                    <select style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }} value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}>
                      {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  )}
                </div>
              )}

              {sessionFor === 'individual' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '12px', color: '#9A9A9F' }}>Select players</label>
                  {players.length === 0 ? (
                    <p style={{ fontSize: '13px', color: '#9A9A9F' }}>No players yet</p>
                  ) : (
                    players.map(player => (
                      <div key={player.id} onClick={() => togglePlayer(player.id)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${selectedPlayers.includes(player.id) ? 'rgba(0,255,159,0.3)' : 'transparent'}`, background: selectedPlayers.includes(player.id) ? 'rgba(0,255,159,0.06)' : '#0E0E0F', cursor: 'pointer' }}>
                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: selectedPlayers.includes(player.id) ? 'none' : '2px solid #2A2A2D', background: selectedPlayers.includes(player.id) ? '#00FF9F' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {selectedPlayers.includes(player.id) && (
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                              <polyline points="1.5,5 4,7.5 8.5,2.5" stroke="#0E0E0F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(0,255,159,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, color: '#00FF9F', flexShrink: 0 }}>
                          {getInitials(player.full_name)}
                        </div>
                        <span style={{ fontSize: '14px', color: '#ffffff' }}>{player.full_name}</span>
                        {selectedPlayers.includes(player.id) && (
                          <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#00FF9F' }}>Selected</span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* SESSION DETAILS */}
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #2A2A2D' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Session details</span>
            </div>
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', color: '#9A9A9F' }}>Session title</label>
                <input style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }} type="text" placeholder="e.g. Ball handling focus, 1-on-1 with Marcus" value={title} onChange={e => setTitle(e.target.value)} required />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                  <label style={{ fontSize: '12px', color: '#9A9A9F' }}>Date</label>
                  <input style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }} type="date" value={sessionDate} onChange={e => setSessionDate(e.target.value)} required />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                  <label style={{ fontSize: '12px', color: '#9A9A9F' }}>Time</label>
                  <input style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }} type="time" value={sessionTime} onChange={e => setSessionTime(e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          {/* FREQUENCY */}
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #2A2A2D' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Frequency</span>
            </div>
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(['one-off', 'recurring'] as const).map(opt => (
                  <button key={opt} type="button" onClick={() => setType(opt)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: `1px solid ${type === opt ? 'rgba(0,255,159,0.4)' : '#2A2A2D'}`, background: type === opt ? 'rgba(0,255,159,0.08)' : 'transparent', color: type === opt ? '#00FF9F' : '#9A9A9F', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>
                    {opt === 'one-off' ? 'One-off' : '🔄 Recurring'}
                  </button>
                ))}
              </div>
              {type === 'recurring' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', color: '#9A9A9F' }}>Repeats</label>
                  <select style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }} value={recurrenceRule} onChange={e => setRecurrenceRule(e.target.value)}>
                    <option value="weekly">Every week</option>
                    <option value="biweekly">Every 2 weeks</option>
                    <option value="monthly">Every month</option>
                  </select>
                  <span style={{ fontSize: '12px', color: '#9A9A9F' }}>Starting from the date selected above</span>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div style={{ background: 'rgba(224,49,49,0.1)', border: '1px solid rgba(224,49,49,0.3)', borderRadius: '8px', padding: '12px 14px', fontSize: '13px', color: '#E03131' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{ background: '#00FF9F', color: '#0E0E0F', border: 'none', borderRadius: '10px', padding: '14px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', width: '100%' }}>
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
