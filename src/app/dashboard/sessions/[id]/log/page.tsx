'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

interface Player { id: string; full_name: string; group_id: string }
interface Session { id: string; title: string; session_date: string; session_time: string; group_id: string }
interface DrillWeek { id: string; title: string; group_id: string }
interface Drill { id: string; title: string; reps: string; category: string; sort_order: number; drill_week_id: string }

const CATEGORIES = ['Ball handling', 'Shooting', 'Passing', 'Footwork', 'Defense', 'Conditioning']

export default function LogSessionPage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useParams()
  const sessionId = params.id as string

  const [session, setSession] = useState<Session | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [attendance, setAttendance] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [drillsCovered, setDrillsCovered] = useState('')
  const [assignDrills, setAssignDrills] = useState(false)
  const [drillWeekTitle, setDrillWeekTitle] = useState('')
  const [newDrills, setNewDrills] = useState([
    { title: '', reps: '', category: 'Ball handling' }
  ])
  const [loading, setLoading] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => { loadData() }, [sessionId])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const { data: sessionData } = await supabase
      .from('sessions').select('*').eq('id', sessionId).single()
    setSession(sessionData)

    if (sessionData?.group_id) {
      const { data: playersData } = await supabase
        .from('players').select('*').eq('group_id', sessionData.group_id)
      setPlayers(playersData || [])
      setAttendance(playersData?.map((p: Player) => p.id) || [])
    }

    setDataLoading(false)
  }

  function toggleAttendance(playerId: string) {
    setAttendance(prev =>
      prev.includes(playerId) ? prev.filter(id => id !== playerId) : [...prev, playerId]
    )
  }

  function getInitials(name: string) {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??'
  }

  function addDrill() {
    if (newDrills.length >= 7) return
    setNewDrills([...newDrills, { title: '', reps: '', category: 'Ball handling' }])
  }

  function removeDrill(index: number) {
    if (newDrills.length === 1) return
    setNewDrills(newDrills.filter((_, i) => i !== index))
  }

  function updateDrill(index: number, field: string, value: string) {
    const updated = [...newDrills]
    updated[index] = { ...updated[index], [field]: value }
    setNewDrills(updated)
  }

  function formatTime(time: string) {
    if (!time) return ''
    const [h, m] = time.split(':')
    const hour = parseInt(h)
    const ampm = hour >= 12 ? 'pm' : 'am'
    const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
    return `${display}:${m} ${ampm}`
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    await supabase.from('session_logs').insert({
      session_id: sessionId,
      trainer_id: user.id,
      notes,
      drills_covered: drillsCovered,
    })

    if (players.length > 0) {
      await supabase.from('session_attendance').upsert(
        players.map(p => ({
          session_id: sessionId,
          player_id: p.id,
          trainer_id: user.id,
          attended: attendance.includes(p.id),
        }))
      )
    }

    if (assignDrills && drillWeekTitle.trim() && session?.group_id) {
      const today = new Date()
      const day = today.getDay()
      const monday = new Date(today)
      monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1))
      const weekStart = monday.toISOString().split('T')[0]

      const { data: week } = await supabase
        .from('drill_weeks')
        .insert({
          trainer_id: user.id,
          group_id: session.group_id,
          title: drillWeekTitle,
          week_start: weekStart,
        })
        .select().single()

      if (week) {
        const drillRows = newDrills
          .filter(d => d.title.trim())
          .map((d, i) => ({
            drill_week_id: week.id,
            trainer_id: user.id,
            title: d.title,
            reps: d.reps,
            category: d.category.toLowerCase(),
            sort_order: i,
          }))
        if (drillRows.length > 0) {
          await supabase.from('drills').insert(drillRows)
        }
      }
    }

    router.push('/dashboard')
  }

  if (dataLoading) return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#9A9A9F', fontSize: '14px' }}>Loading...</p>
    </div>
  )

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

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '24px 16px' }}>

        {/* HEADER */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00FF9F', flexShrink: 0 }} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#00FF9F', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Log session</span>
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#ffffff', fontFamily: '"Exo 2", sans-serif', marginBottom: '4px' }}>{session?.title}</h1>
          {session?.session_time && (
            <p style={{ fontSize: '14px', color: '#9A9A9F' }}>{formatTime(session.session_time)}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* ATTENDANCE */}
          {players.length > 0 && (
            <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid #2A2A2D', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Attendance</span>
                <span style={{ fontSize: '12px', color: '#9A9A9F' }}>{attendance.length}/{players.length} present</span>
              </div>
              <div style={{ padding: '8px' }}>
                {players.map(player => (
                  <div key={player.id} onClick={() => toggleAttendance(player.id)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${attendance.includes(player.id) ? 'rgba(0,255,159,0.3)' : 'transparent'}`, background: attendance.includes(player.id) ? 'rgba(0,255,159,0.06)' : 'transparent', cursor: 'pointer', marginBottom: '4px' }}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: attendance.includes(player.id) ? 'none' : '2px solid #2A2A2D', background: attendance.includes(player.id) ? '#00FF9F' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {attendance.includes(player.id) && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <polyline points="1.5,5 4,7.5 8.5,2.5" stroke="#0E0E0F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'rgba(0,255,159,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, color: '#00FF9F', flexShrink: 0 }}>
                      {getInitials(player.full_name)}
                    </div>
                    <span
                      onClick={e => { e.stopPropagation(); router.push(`/dashboard/players/${player.id}`) }}
                      style={{ fontSize: '14px', color: '#ffffff', flex: 1, cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.2)' }}>
                      {player.full_name}
                    </span>
                    <span style={{ fontSize: '12px', color: attendance.includes(player.id) ? '#00FF9F' : '#9A9A9F', flexShrink: 0 }}>
                      {attendance.includes(player.id) ? 'Present' : 'Absent'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DRILLS COVERED */}
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #2A2A2D' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Drills covered in session</span>
            </div>
            <div style={{ padding: '12px 16px' }}>
              <textarea
                style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '12px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%', minHeight: '90px', resize: 'vertical', fontFamily: 'sans-serif', color: '#ffffff' } as React.CSSProperties}
                placeholder="e.g. Two-ball dribbling, crossover series, finishing at the rim..."
                value={drillsCovered}
                onChange={e => setDrillsCovered(e.target.value)}
              />
            </div>
          </div>

          {/* SESSION NOTES */}
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #2A2A2D' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Session notes</span>
            </div>
            <div style={{ padding: '12px 16px' }}>
              <textarea
                style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '12px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%', minHeight: '100px', resize: 'vertical', fontFamily: 'sans-serif' }}
                placeholder="What went well? What needs work? Any standout moments..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* ASSIGN DRILL WORK */}
          <div style={{ background: '#1A1A1C', border: `1px solid ${assignDrills ? 'rgba(0,255,159,0.3)' : '#2A2A2D'}`, borderRadius: '12px', overflow: 'hidden', transition: 'border-color 0.15s' }}>
            <div
              onClick={() => setAssignDrills(!assignDrills)}
              style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: assignDrills ? '#00FF9F' : '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Assign drill work</span>
                <p style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>Send players homework drills to complete before the next session</p>
              </div>
              <div style={{ width: '44px', height: '24px', borderRadius: '99px', background: assignDrills ? '#00FF9F' : '#2A2A2D', position: 'relative', flexShrink: 0, transition: 'background 0.15s' }}>
                <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: assignDrills ? '#0E0E0F' : '#9A9A9F', position: 'absolute', top: '3px', left: assignDrills ? '23px' : '3px', transition: 'left 0.15s' }} />
              </div>
            </div>

            {assignDrills && (
              <div style={{ padding: '0 16px 16px', borderTop: '1px solid #2A2A2D' }}>
                <div style={{ marginTop: '14px', marginBottom: '14px' }}>
                  <label style={{ fontSize: '12px', color: '#9A9A9F', display: 'block', marginBottom: '6px' }}>Week focus / title</label>
                  <input
                    style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }}
                    type="text"
                    placeholder="e.g. Ball handling focus, Finishing at the rim"
                    value={drillWeekTitle}
                    onChange={e => setDrillWeekTitle(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {newDrills.map((drill, index) => (
                    <div key={index} style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '10px', padding: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#00FF9F' }}>Drill {index + 1}</span>
                        {newDrills.length > 1 && (
                          <button type="button" onClick={() => removeDrill(index)} style={{ fontSize: '11px', color: '#9A9A9F', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                        <input
                          style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '7px', padding: '9px 11px', fontSize: '13px', color: '#ffffff', outline: 'none', flex: 2 }}
                          type="text"
                          placeholder="Drill name"
                          value={drill.title}
                          onChange={e => updateDrill(index, 'title', e.target.value)}
                        />
                        <select
                          style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '7px', padding: '9px 11px', fontSize: '13px', color: '#ffffff', outline: 'none', flex: 1 }}
                          value={drill.category}
                          onChange={e => updateDrill(index, 'category', e.target.value)}>
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <input
                        style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '7px', padding: '9px 11px', fontSize: '13px', color: '#ffffff', outline: 'none', width: '100%' }}
                        type="text"
                        placeholder="Reps / sets (e.g. 3 sets · 45 seconds)"
                        value={drill.reps}
                        onChange={e => updateDrill(index, 'reps', e.target.value)}
                      />
                    </div>
                  ))}
                  {newDrills.length < 7 && (
                    <button type="button" onClick={addDrill} style={{ background: 'transparent', border: '1px dashed #2A2A2D', borderRadius: '10px', padding: '12px', fontSize: '13px', color: '#9A9A9F', cursor: 'pointer', textAlign: 'center' as const }}>
                      + Add another drill
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* SUBMIT */}
          <button
            type="submit"
            disabled={loading}
            style={{ background: '#00FF9F', color: '#0E0E0F', border: 'none', borderRadius: '10px', padding: '14px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', width: '100%', marginTop: '4px' }}>
            {loading ? 'Saving...' : 'Save session log'}
          </button>

        </form>
      </div>
    </div>
  )
}
