'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

interface Player { id: string; full_name: string; group_id: string | null }

const CATEGORIES = ['Ball handling', 'Shooting', 'Passing', 'Footwork', 'Defense', 'Conditioning']

export default function QuickLogPage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useParams()
  const playerId = params.id as string

  const [player, setPlayer] = useState<Player | null>(null)
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().split('T')[0])
  const [sessionType, setSessionType] = useState('individual')
  const [drillsCovered, setDrillsCovered] = useState('')
  const [notes, setNotes] = useState('')
  const [feedback, setFeedback] = useState('')
  const [assignDrills, setAssignDrills] = useState(false)
  const [drillWeekTitle, setDrillWeekTitle] = useState('')
  const [newDrills, setNewDrills] = useState([
    { title: '', reps: '', category: 'Ball handling' }
  ])
  const [loading, setLoading] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => { loadData() }, [playerId])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }
    const { data: playerData } = await supabase
      .from('players').select('*').eq('id', playerId).single()
    setPlayer(playerData)
    setDataLoading(false)
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const { error } = await supabase.from('sessions').insert({
      trainer_id: user.id,
      player_id: playerId,
      session_date: sessionDate,
      session_type: sessionType,
      title: `Session — ${player?.full_name}`,
      drills_covered: drillsCovered,
      notes,
      feedback,
    })

    if (error) {
      console.error(error)
      setLoading(false)
      return
    }

    if (assignDrills && drillWeekTitle.trim()) {
      const today = new Date()
      const day = today.getDay()
      const monday = new Date(today)
      monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1))
      const weekStart = monday.toISOString().split('T')[0]

      const { data: week } = await supabase
        .from('drill_weeks')
        .insert({
          trainer_id: user.id,
          player_id: playerId,
          group_id: null,
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

    router.push(`/dashboard/players/${playerId}`)
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
          <button onClick={() => router.push(`/dashboard/players/${playerId}`)} style={{ fontSize: '13px', color: '#9A9A9F', background: 'none', border: 'none', cursor: 'pointer' }}>← Back to profile</button>
        </div>
        <button className="nav-menu-btn" onClick={() => setMenuOpen(!menuOpen)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', flexDirection: 'column', gap: '5px', alignItems: 'center', justifyContent: 'center', display: 'none' }}>
          <div style={{ width: '20px', height: '2px', background: '#ffffff', borderRadius: '2px' }} />
          <div style={{ width: '20px', height: '2px', background: '#ffffff', borderRadius: '2px' }} />
          <div style={{ width: '20px', height: '2px', background: '#ffffff', borderRadius: '2px' }} />
        </button>
      </nav>

      {menuOpen && (
        <div style={{ background: '#1A1A1C', borderBottom: '1px solid #2A2A2D', padding: '8px 0' }}>
          <button onClick={() => router.push(`/dashboard/players/${playerId}`)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 20px', background: 'none', border: 'none', color: '#9A9A9F', fontSize: '14px', cursor: 'pointer' }}>← Back to profile</button>
        </div>
      )}

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px 16px' }}>

        {/* HEADER */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00FF9F' }} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#00FF9F', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Log session</span>
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#ffffff', fontFamily: '"Exo 2", sans-serif', marginBottom: '4px' }}>{player?.full_name}</h1>
          <p style={{ fontSize: '14px', color: '#9A9A9F' }}>Record what happened in today&apos;s session</p>
        </div>

        {/* PLAYER CARD */}
        <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '14px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(0,255,159,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 600, color: '#00FF9F', flexShrink: 0 }}>
            {getInitials(player?.full_name || '')}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff' }}>{player?.full_name}</div>
            <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>{player?.group_id ? 'Group player' : 'Individual'}</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* DATE + TYPE ROW */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '12px 14px', borderBottom: '1px solid #2A2A2D' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Date</span>
              </div>
              <div style={{ padding: '10px 14px' }}>
                <input style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '9px 11px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }} type="date" value={sessionDate} onChange={e => setSessionDate(e.target.value)} required />
              </div>
            </div>
            <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '12px 14px', borderBottom: '1px solid #2A2A2D' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Type</span>
              </div>
              <div style={{ padding: '10px 14px', display: 'flex', gap: '6px' }}>
                {['individual', 'group'].map(opt => (
                  <button key={opt} type="button" onClick={() => setSessionType(opt)} style={{ flex: 1, padding: '8px 6px', borderRadius: '8px', border: `1px solid ${sessionType === opt ? 'rgba(0,255,159,0.4)' : '#2A2A2D'}`, background: sessionType === opt ? 'rgba(0,255,159,0.08)' : 'transparent', color: sessionType === opt ? '#00FF9F' : '#9A9A9F', fontSize: '12px', fontWeight: 500, cursor: 'pointer', textTransform: 'capitalize' as const }}>
                    {opt === 'individual' ? '👤 1-on-1' : '👥 Group'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* WHAT WAS WORKED ON */}
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #2A2A2D' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>What was worked on</span>
              <p style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>Drills, skills, or concepts covered in this session</p>
            </div>
            <div style={{ padding: '12px 16px' }}>
              <textarea
                style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '12px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%', minHeight: '90px', resize: 'vertical', fontFamily: 'sans-serif' }}
                placeholder="e.g. Two-ball dribbling, crossover into pull-up, finishing through contact..."
                value={drillsCovered}
                onChange={e => setDrillsCovered(e.target.value)}
              />
            </div>
          </div>

          {/* SESSION NOTES */}
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #2A2A2D' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Session notes</span>
              <p style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>What went well, what needs work, standout moments</p>
            </div>
            <div style={{ padding: '12px 16px' }}>
              <textarea
                style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '12px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%', minHeight: '90px', resize: 'vertical', fontFamily: 'sans-serif' }}
                placeholder="Marcus showed great improvement on his left hand. Needs to work on shot off the dribble..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* FEEDBACK FOR PLAYER */}
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #2A2A2D' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Feedback for player</span>
              <p style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>Direct message to the player — shows on their drill checklist page</p>
            </div>
            <div style={{ padding: '12px 16px' }}>
              <textarea
                style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '12px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%', minHeight: '80px', resize: 'vertical', fontFamily: 'sans-serif' }}
                placeholder="Great work today! Focus on keeping your eyes up when dribbling this week..."
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
              />
            </div>
          </div>

          {/* ASSIGN DRILL WORK */}
          <div style={{ background: '#1A1A1C', border: `1px solid ${assignDrills ? 'rgba(0,255,159,0.3)' : '#2A2A2D'}`, borderRadius: '12px', overflow: 'hidden', transition: 'border-color 0.15s' }}>
            <div onClick={() => setAssignDrills(!assignDrills)} style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: assignDrills ? '#00FF9F' : '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Assign drill work</span>
                <p style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>Send homework drills for the player to complete before next session</p>
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
                    placeholder="e.g. Ball handling focus, Left hand development"
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
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
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

          <button
            type="submit"
            disabled={loading}
            style={{ background: '#00FF9F', color: '#0E0E0F', border: 'none', borderRadius: '10px', padding: '14px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', width: '100%', marginTop: '4px' }}>
            {loading ? 'Saving...' : 'Save session'}
          </button>

        </form>
      </div>
    </div>
  )
}
