'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import NavBar from '@/components/NavBar'

interface Player { id: string; full_name: string; group_id: string; parent_email: string | null; birth_year: number | null; skill_level: string | null }
interface Session { id: string; title: string; session_date: string; session_time: string; group_id: string }

const CATEGORIES = ['Ball handling', 'Shooting', 'Passing', 'Footwork', 'Defense', 'Conditioning']

type Step = 'log' | 'player-notes' | 'emails'


interface PlayerNote { playerId: string; note: string }
interface PlayerEmail { playerId: string; playerName: string; parentEmail: string | null; email: string; copied: boolean }

export default function LogSessionPage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useParams()
  const sessionId = params.id as string

  const [step, setStep] = useState<Step>('log')
  const [session, setSession] = useState<Session | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [profile, setProfile] = useState<{ full_name: string } | null>(null)
  const [attendance, setAttendance] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [drillsCovered, setDrillsCovered] = useState('')
  const [assignDrills, setAssignDrills] = useState(false)
  const [drillWeekTitle, setDrillWeekTitle] = useState('')
  const [newDrills, setNewDrills] = useState([{ title: '', reps: '', category: 'Ball handling' }])
  const [loading, setLoading] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)
  const [playerNotes, setPlayerNotes] = useState<PlayerNote[]>([])
  const [playerEmails, setPlayerEmails] = useState<PlayerEmail[]>([])
  const [generatingEmails, setGeneratingEmails] = useState(false)
  const [sendingEmail, setSendingEmail] = useState<string | null>(null)
const [sentEmails, setSentEmails] = useState<string[]>([])

  useEffect(() => { loadData() }, [sessionId])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const { data: profileData } = await supabase
      .from('profiles').select('full_name').eq('id', user.id).single()
    setProfile(profileData)

    const { data: sessionData } = await supabase
      .from('sessions').select('*').eq('id', sessionId).single()
    setSession(sessionData)

    if (sessionData?.group_id) {
      const { data: playersData } = await supabase
        .from('players').select('*').eq('group_id', sessionData.group_id)
      setPlayers(playersData || [])
      setAttendance(playersData?.map((p: Player) => p.id) || [])
      setPlayerNotes(playersData?.map((p: Player) => ({ playerId: p.id, note: '' })) || [])
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

  function updatePlayerNote(playerId: string, note: string) {
    setPlayerNotes(prev => prev.map(pn => pn.playerId === playerId ? { ...pn, note } : pn))
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

  async function handleLogSubmit(e: React.FormEvent) {
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

      const attendingPlayers = players.filter(p => attendance.includes(p.id))
      if (attendingPlayers.length > 0) {
        await supabase.from('sessions').insert(
          attendingPlayers.map(p => ({
            trainer_id: user.id,
            player_id: p.id,
            session_date: session?.session_date || new Date().toISOString().split('T')[0],
            title: `Session — ${p.full_name}`,
            notes: notes || null,
            drills_covered: drillsCovered || null,
            session_type: 'group',
            status: 'logged',
          }))
        )
      }
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
// Mark session as logged
await supabase.from('sessions')
.update({ status: 'logged' })
.eq('id', sessionId)
    setLoading(false)

    // If group session with players who have parent emails, go to player notes step
    const attendingWithEmails = players.filter(p =>
      attendance.includes(p.id) && p.parent_email
    )
    if (attendingWithEmails.length > 0) {
      setStep('player-notes')
    } else {
      router.push('/dashboard')
    }
  }

  async function handleGenerateEmails() {
    setGeneratingEmails(true)
    const trainerName = profile?.full_name?.split(' ')[0] || 'Coach'
    const attendingPlayers = players.filter(p => attendance.includes(p.id) && p.parent_email)
    const baseUrl = window.location.origin

    const emails: PlayerEmail[] = []

    for (const player of attendingPlayers) {
      const playerNote = playerNotes.find(pn => pn.playerId === player.id)?.note || ''
      const age = player.birth_year ? new Date().getFullYear() - player.birth_year : null
      const firstName = player.full_name.split(' ')[0]
      const profileUrl = `${baseUrl}/player?id=${player.id}`

      const prompt = `You are helping a youth sports trainer write a personalized parent update email after a group training session.

Trainer: ${trainerName}
Player: ${player.full_name}
Age: ${age ? `${age} years old` : 'Unknown'}
Skill level: ${player.skill_level || 'intermediate'}
Session date: ${session?.session_date}
Group session notes: ${notes || drillsCovered || 'General training session'}
Drills covered: ${drillsCovered || 'Various drills'}
Specific note for this player: ${playerNote || 'None — use general session notes'}

Write a SHORT, warm, personalized parent email (3-4 sentences) from the trainer.
- Start with "Hi [parent]," — use a generic greeting since we don't have parent name
- Mention what the group worked on
- Include something specific and positive about ${firstName} ${playerNote ? `based on: "${playerNote}"` : 'based on general participation'}
- End with: "You can view ${firstName}'s drill assignments and progress here: ${profileUrl}"
- Sign off with the trainer's name
- Do NOT use generic phrases like "hope this finds you well"
- Sound like a real person, not a business email

Return ONLY the email text, nothing else.`

      try {
        const response = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 500,
            messages: [{ role: 'user', content: prompt }],
          }),
        })
        const data = await response.json()
        const email = data.content?.find((b: { type: string; text: string }) => b.type === 'text')?.text?.trim() || ''
        emails.push({ playerId: player.id, playerName: player.full_name, parentEmail: player.parent_email, email, copied: false })
      } catch {
        emails.push({ playerId: player.id, playerName: player.full_name, parentEmail: player.parent_email, email: `Hi,\n\nJust wanted to check in after today's session with ${firstName}. We had a great group session working on ${drillsCovered || 'various skills'}. ${firstName} worked hard today.\n\nYou can view ${firstName}'s drill assignments and progress here: ${profileUrl}\n\n${trainerName}`, copied: false })
      }
    }

    setPlayerEmails(emails)
    setGeneratingEmails(false)
    setStep('emails')
  }

  function copyEmail(playerId: string, email: string) {
    navigator.clipboard.writeText(email)
    setPlayerEmails(prev => prev.map(pe =>
      pe.playerId === playerId ? { ...pe, copied: true } : pe
    ))
    setTimeout(() => {
      setPlayerEmails(prev => prev.map(pe =>
        pe.playerId === playerId ? { ...pe, copied: false } : pe
      ))
    }, 2000)
  }
  async function handleSendEmail(pe: PlayerEmail) {
    setSendingEmail(pe.playerId)
    const playerUrl = `${window.location.origin}/player?id=${pe.playerId}`
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: pe.parentEmail,
          subject: `Session update for ${pe.playerName.split(' ')[0]}`,
          body: pe.email,
          playerName: pe.playerName.split(' ')[0],
          playerUrl,
        }),
      })
      const data = await response.json()
      if (!data.error) {
        setSentEmails(prev => [...prev, pe.playerId])
      }
    } catch {
      console.error('Failed to send email')
    } finally {
      setSendingEmail(null)
    }
  }

  if (dataLoading) return (

    <div style={{ minHeight: '100vh', background: '#0E0E0F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#9A9A9F', fontSize: '14px' }}>Loading...</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', fontFamily: 'sans-serif', overflowX: 'hidden', maxWidth: '100vw', width: '100%' }}>
      <style>{`* { box-sizing: border-box; margin: 0; padding: 0; } html, body { background: #0E0E0F; overflow-x: hidden; } @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>

      <NavBar trainerName={profile?.full_name} />

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '24px 16px' }}>

        {/* STEP 1 — SESSION LOG */}
        {step === 'log' && (
          <>
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

            <form onSubmit={handleLogSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

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
                        <span style={{ fontSize: '14px', color: '#ffffff', flex: 1 }}>{player.full_name}</span>
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
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Drills covered</span>
                </div>
                <div style={{ padding: '12px 16px' }}>
                  <textarea
                    style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '12px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%', minHeight: '90px', resize: 'vertical', fontFamily: 'sans-serif' }}
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
                <div onClick={() => setAssignDrills(!assignDrills)} style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
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
                        placeholder="e.g. Ball handling focus"
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
                              type="text" placeholder="Drill name" value={drill.title}
                              onChange={e => updateDrill(index, 'title', e.target.value)}
                            />
                            <select
                              style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '7px', padding: '9px 11px', fontSize: '13px', color: '#ffffff', outline: 'none', flex: 1 }}
                              value={drill.category} onChange={e => updateDrill(index, 'category', e.target.value)}>
                              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                          <input
                            style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '7px', padding: '9px 11px', fontSize: '13px', color: '#ffffff', outline: 'none', width: '100%' }}
                            type="text" placeholder="Reps / sets (e.g. 3 sets · 45 seconds)" value={drill.reps}
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
                {loading ? 'Saving...' : 'Save session log →'}
              </button>

            </form>
          </>
        )}

        {/* STEP 2 — PLAYER NOTES */}
        {step === 'player-notes' && (
          <>
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00FF9F' }} />
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#00FF9F', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Parent emails</span>
              </div>
              <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#ffffff', fontFamily: '"Exo 2", sans-serif', marginBottom: '8px' }}>Any specific notes?</h1>
              <p style={{ fontSize: '14px', color: '#9A9A9F', lineHeight: 1.6 }}>
                Add optional notes for individual players — AI will weave them into personalized parent emails. Leave blank to use the general session notes.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              {players.filter(p => attendance.includes(p.id) && p.parent_email).map(player => {
                const pNote = playerNotes.find(pn => pn.playerId === player.id)?.note || ''
                return (
                  <div key={player.id} style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(0,255,159,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, color: '#00FF9F', flexShrink: 0 }}>
                        {getInitials(player.full_name)}
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff' }}>{player.full_name}</div>
                        <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>{player.parent_email}</div>
                      </div>
                    </div>
                    <input
                      type="text"
                      placeholder="Optional — e.g. Strong crossover today, needs to work on left hand..."
                      value={pNote}
                      onChange={e => updatePlayerNote(player.id, e.target.value)}
                      style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#ffffff', outline: 'none', width: '100%', fontFamily: 'sans-serif' }}
                    />
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={handleGenerateEmails}
                disabled={generatingEmails}
                style={{ background: generatingEmails ? '#1A1A1C' : 'rgba(0,255,159,0.1)', border: '1px solid rgba(0,255,159,0.3)', borderRadius: '12px', padding: '16px', cursor: generatingEmails ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%' }}>
                {generatingEmails ? (
                  <>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {[0, 1, 2].map(i => (
                        <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00FF9F', animation: `pulse 0.8s ease-in-out ${i * 0.15}s infinite` }} />
                      ))}
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#00FF9F' }}>Generating parent emails...</span>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: '16px' }}>✦</span>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#00FF9F' }}>Generate personalized parent emails with AI</span>
                  </>
                )}
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                style={{ background: 'transparent', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '14px', cursor: 'pointer', fontSize: '14px', color: '#9A9A9F', width: '100%' }}>
                Skip — go to dashboard
              </button>
            </div>
          </>
        )}

        {/* STEP 3 — EMAIL PREVIEWS */}
        {step === 'emails' && (
          <>
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <span style={{ fontSize: '16px' }}>✦</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#00FF9F', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Parent emails ready</span>
              </div>
              <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#ffffff', fontFamily: '"Exo 2", sans-serif', marginBottom: '8px' }}>Review and send</h1>
              <p style={{ fontSize: '14px', color: '#9A9A9F' }}>Copy each email and send it directly to the parent. Each one is personalized.</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
              {playerEmails.map(pe => (
                <div key={pe.playerId} style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 16px', borderBottom: '1px solid #2A2A2D', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff' }}>{pe.playerName}</div>
                      <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>To: {pe.parentEmail}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                      <button
                        onClick={() => copyEmail(pe.playerId, pe.email)}
                        style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '8px', border: '1px solid #2A2A2D', background: 'transparent', color: pe.copied ? '#00FF9F' : '#9A9A9F', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>
                        {pe.copied ? '✓ Copied' : 'Copy'}
                      </button>
                      <button
                        onClick={() => handleSendEmail(pe)}
                        disabled={sendingEmail === pe.playerId || sentEmails.includes(pe.playerId)}
                        style={{ fontSize: '12px', padding: '6px 14px', borderRadius: '8px', border: 'none', background: sentEmails.includes(pe.playerId) ? '#2A2A2D' : '#00FF9F', color: sentEmails.includes(pe.playerId) ? '#9A9A9F' : '#0E0E0F', fontWeight: 700, cursor: sentEmails.includes(pe.playerId) ? 'default' : 'pointer', transition: 'all 0.15s' }}>
                        {sendingEmail === pe.playerId ? 'Sending...' : sentEmails.includes(pe.playerId) ? '✓ Sent' : 'Send email'}
                      </button>
                    </div>
                  </div>
                  <div style={{ padding: '16px', fontSize: '13px', color: '#ffffff', lineHeight: 1.7, whiteSpace: 'pre-wrap' as const }}>
                    {pe.email}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => router.push('/dashboard')}
              style={{ background: '#00FF9F', color: '#0E0E0F', border: 'none', borderRadius: '10px', padding: '14px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', width: '100%' }}>
              Done — go to dashboard
            </button>
          </>
        )}

      </div>
    </div>
  )
}
