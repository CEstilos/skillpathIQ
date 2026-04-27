'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import NavBar from '@/components/NavBar'

interface Player { id: string; full_name: string; group_id: string | null; birth_year: number | null; skill_level: string | null; parent_email: string | null; contact_type: string | null }
interface Profile { full_name: string }
interface PlayerRecap { playerId: string; playerName: string; parentSummary: string; copied: boolean }

const CATEGORIES = ['Ball handling', 'Shooting', 'Passing', 'Footwork', 'Defense', 'Conditioning']

const SKILL_TAGS = [
  'Ball handling', 'Crossover', 'Finishing', 'Left hand', 'Right hand',
  'Pull-up jumper', 'Free throws', 'Three pointers', 'Mid-range',
  'Passing', 'Defense', 'Footwork', 'Conditioning', 'IQ / reads',
]

export default function QuickLogPage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const scheduledSessionId = searchParams.get('sessionId') || null
  const playerId = params.id as string
  const alsoPlayerIds = searchParams.get('also')?.split(',').filter(Boolean) || []

  const [players, setPlayers] = useState<Player[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().split('T')[0])
  const [sessionType, setSessionType] = useState('individual')
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [playerRecaps, setPlayerRecaps] = useState<PlayerRecap[]>([])
  const [assignDrills, setAssignDrills] = useState(false)
  const [drillWeekTitle, setDrillWeekTitle] = useState('')
  const [newDrills, setNewDrills] = useState([{ title: '', reps: '', category: 'Ball handling' }])
  const [loading, setLoading] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiGenerated, setAiGenerated] = useState(false)
  const [step, setStep] = useState<'log' | 'emails'>('log')
  const [playerEmails, setPlayerEmails] = useState<{ playerId: string; playerName: string; parentEmail: string; email: string; copied: boolean; sent: boolean; sending: boolean }[]>([])
  const [generatingEmails, setGeneratingEmails] = useState(false)

  const allPlayerIds = [playerId, ...alsoPlayerIds]
  const isMultiPlayer = allPlayerIds.length > 1
  const primaryPlayer = players.find(p => p.id === playerId) || null

  useEffect(() => { loadData() }, [playerId])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const { data: profileData } = await supabase
      .from('profiles').select('full_name').eq('id', user.id).single()
    setProfile(profileData)

    const { data: playersData } = await supabase
      .from('players').select('*').in('id', allPlayerIds)
    setPlayers(playersData || [])

    if (scheduledSessionId) {
      const { data: scheduledSession } = await supabase
        .from('sessions').select('session_date').eq('id', scheduledSessionId).single()
      if (scheduledSession?.session_date) {
        setSessionDate(scheduledSession.session_date)
      }
    }

    setDataLoading(false)
  }

  function getInitials(name: string) {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??'
  }

  function toggleSkill(skill: string) {
    setSelectedSkills(prev =>
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    )
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

  async function generateRecapForPlayer(player: Player, trainerName: string, skillsList: string) {
    const age = player.birth_year ? new Date().getFullYear() - player.birth_year : null
    const prompt = `You are helping a youth sports trainer quickly log a session and assign homework drills.

Trainer: ${trainerName}
Player: ${player.full_name}
Age: ${age ? `${age} years old` : 'Unknown'}
Skill level: ${player.skill_level || 'intermediate'}
Session type: ${sessionType}
Skills covered: ${skillsList}
Trainer notes: ${notes || 'None provided'}

Generate THREE things:

1. A SHORT summary (2-3 sentences) — warm and personal, written from the trainer to the ${player.contact_type === 'player' ? 'athlete directly (coach-to-athlete tone, use their first name)' : 'parent (warm, parent-facing tone)'}.

2. A drill week title (4-6 words max) based on what was covered.

3. Exactly 3 homework drills the player can do at home with no gym equipment. Each drill should directly reinforce what was covered. Make them age and skill appropriate for a ${age ? `${age} year old` : 'youth'} ${player.skill_level || 'intermediate'} level player.

Return ONLY valid JSON, no markdown:
{
  "parentSummary": "...",
  "drillWeekTitle": "...",
  "drills": [
    { "title": "...", "description": "...", "reps": "...", "category": "..." },
    { "title": "...", "description": "...", "reps": "...", "category": "..." },
    { "title": "...", "description": "...", "reps": "...", "category": "..." }
  ]
}`

    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await response.json()
    const raw = data.content?.find((b: { type: string; text: string }) => b.type === 'text')?.text?.trim()
    const clean = raw?.replace(/```json|```/g, '').trim()
    return JSON.parse(clean)
  }

  async function handleAiAssist() {
    if (selectedSkills.length === 0 && !notes.trim()) return
    setAiLoading(true)

    const trainerName = profile?.full_name?.split(' ')[0] || 'Coach'
    const skillsList = selectedSkills.join(', ') || 'general skills'

    try {
      if (isMultiPlayer) {
        // Generate individual recap for each player
        const recaps: PlayerRecap[] = []
        for (const player of players) {
          const parsed = await generateRecapForPlayer(player, trainerName, skillsList)
          recaps.push({
            playerId: player.id,
            playerName: player.full_name,
            parentSummary: parsed.parentSummary,
            copied: false,
          })
        }
        setPlayerRecaps(recaps)
        // Use first player's drills as default
        const firstParsed = await generateRecapForPlayer(players[0], trainerName, skillsList)
        setDrillWeekTitle(firstParsed.drillWeekTitle)
        setNewDrills(firstParsed.drills.map((d: { title: string; reps: string; category: string }) => ({
          title: d.title, reps: d.reps, category: d.category || 'Ball handling',
        })))
      } else {
        const parsed = await generateRecapForPlayer(players[0], trainerName, skillsList)
        setPlayerRecaps([{ playerId: players[0].id, playerName: players[0].full_name, parentSummary: parsed.parentSummary, copied: false }])
        setDrillWeekTitle(parsed.drillWeekTitle)
        setNewDrills(parsed.drills.map((d: { title: string; reps: string; category: string }) => ({
          title: d.title, reps: d.reps, category: d.category || 'Ball handling',
        })))
      }
      setAssignDrills(true)
      setAiGenerated(true)
    } catch {
      setAssignDrills(true)
    } finally {
      setAiLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    // Log session for each player individually
    for (const player of players) {
      const recap = playerRecaps.find(r => r.playerId === player.id)
      await supabase.from('sessions').insert({
        trainer_id: user.id,
        player_id: player.id,
        session_date: sessionDate,
        session_type: sessionType,
        title: `Session — ${player.full_name}`,
        drills_covered: selectedSkills.join(', '),
        notes,
        feedback: recap?.parentSummary || null,
        status: 'logged',
      })

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
            player_id: player.id,
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
    }
// Mark original scheduled session as logged
if (scheduledSessionId) {
  await supabase.from('sessions')
    .update({ status: 'logged' })
    .eq('id', scheduledSessionId)
}

setLoading(false)

// If any players have parent emails and AI generated recaps, show email step
const playersWithEmails = players.filter(p => p.parent_email)
if (playersWithEmails.length > 0 && playerRecaps.length > 0) {
  const emails = playersWithEmails.map(p => {
    const recap = playerRecaps.find(r => r.playerId === p.id)
    return {
      playerId: p.id,
      playerName: p.full_name,
      parentEmail: p.parent_email!,
      email: recap?.parentSummary || '',
      copied: false,
      sent: false,
      sending: false,
    }
  }).filter(e => e.email)
  if (emails.length > 0) {
    setPlayerEmails(emails)
    setStep('emails')
    return
  }
}

router.push(`/dashboard/players/${playerId}`)
}

  if (dataLoading) return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#9A9A9F', fontSize: '14px' }}>Loading...</p>
    </div>
  )
  async function handleSendPlayerEmail(playerId: string) { //added 
    const pe = playerEmails.find(e => e.playerId === playerId)
    if (!pe) return
    setPlayerEmails(prev => prev.map(e => e.playerId === playerId ? { ...e, sending: true } : e))
    const playerUrl = `${window.location.origin}/player?id=${playerId}`
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
      setPlayerEmails(prev => prev.map(e => e.playerId === playerId ? { ...e, sending: false, sent: !data.error } : e))
    } catch {
      setPlayerEmails(prev => prev.map(e => e.playerId === playerId ? { ...e, sending: false } : e))
    }
  }
  return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', fontFamily: 'sans-serif', overflowX: 'hidden', maxWidth: '100vw', width: '100%' }}>
      <style>{`* { box-sizing: border-box; margin: 0; padding: 0; } html, body { background: #0E0E0F; overflow-x: hidden; } @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>

      <NavBar trainerName={profile?.full_name} />

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px 16px' }}>

        {/* HEADER */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00FF9F' }} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#00FF9F', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Log session</span>
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#ffffff', fontFamily: '"Exo 2", sans-serif', marginBottom: '4px' }}>
            {isMultiPlayer ? `${players.map(p => p.full_name.split(' ')[0]).join(' & ')}` : primaryPlayer?.full_name}
          </h1>
          <p style={{ fontSize: '14px', color: '#9A9A9F' }}>Record what happened and let AI handle the rest</p>
        </div>

        {/* PLAYER CARDS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          {players.map(player => (
            <div key={player.id} style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(0,255,159,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 600, color: '#00FF9F', flexShrink: 0 }}>
                {getInitials(player.full_name)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff' }}>{player.full_name}</div>
                <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>
                  {player.group_id ? 'Group player' : 'Individual'}
                  {player.birth_year && ` · Age ${new Date().getFullYear() - player.birth_year}`}
                  {player.skill_level && ` · ${player.skill_level.charAt(0).toUpperCase() + player.skill_level.slice(1)}`}
                </div>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* DATE + TYPE */}
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

          {/* SKILLS */}
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #2A2A2D' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Skills covered</span>
              <p style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>Tap everything you worked on today</p>
            </div>
            <div style={{ padding: '12px 16px', display: 'flex', flexWrap: 'wrap' as const, gap: '8px' }}>
              {SKILL_TAGS.map(skill => (
                <button key={skill} type="button" onClick={() => toggleSkill(skill)} style={{ padding: '6px 12px', borderRadius: '99px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', border: `1px solid ${selectedSkills.includes(skill) ? 'rgba(0,255,159,0.4)' : '#2A2A2D'}`, background: selectedSkills.includes(skill) ? 'rgba(0,255,159,0.1)' : 'transparent', color: selectedSkills.includes(skill) ? '#00FF9F' : '#9A9A9F', transition: 'all 0.1s' }}>
                  {skill}
                </button>
              ))}
            </div>
          </div>

          {/* NOTES */}
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #2A2A2D' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Quick notes</span>
              <p style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>Optional — anything specific AI should know</p>
            </div>
            <div style={{ padding: '12px 16px' }}>
              <textarea
                style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '12px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%', minHeight: '80px', resize: 'vertical', fontFamily: 'sans-serif' }}
                placeholder={isMultiPlayer ? `e.g. Both players worked hard today. Cruz struggled with left hand, Naliyah showed great improvement on crossover...` : `e.g. Player struggled with left hand at first but finished strong...`}
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* AI BUTTON */}
          {(selectedSkills.length > 0 || notes.trim()) && !aiGenerated && (
            <button
              type="button"
              onClick={handleAiAssist}
              disabled={aiLoading}
              style={{ background: aiLoading ? '#1A1A1C' : 'rgba(0,255,159,0.1)', border: '1px solid rgba(0,255,159,0.3)', borderRadius: '12px', padding: '16px', cursor: aiLoading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%' }}>
              {aiLoading ? (
                <>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00FF9F', animation: `pulse 0.8s ease-in-out ${i * 0.15}s infinite` }} />
                    ))}
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#00FF9F' }}>AI is writing recaps...</span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: '16px' }}>✦</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#00FF9F' }}>
                    {isMultiPlayer ? `Generate parent summaries for ${players.length} players with AI` : 'Generate parent summary + homework drills with AI'}
                  </span>
                </>
              )}
            </button>
          )}

          {/* AI RESULTS — one per player */}
          {aiGenerated && playerRecaps.map(recap => (
            <div key={recap.playerId} style={{ background: 'rgba(0,255,159,0.05)', border: '1px solid rgba(0,255,159,0.25)', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(0,255,159,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#00FF9F', textTransform: 'uppercase', letterSpacing: '0.06em' }}>✦ {recap.playerName} — Parent summary</span>
                  <p style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>AI-generated — edit before sending</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(recap.parentSummary)
                    setPlayerRecaps(prev => prev.map(r => r.playerId === recap.playerId ? { ...r, copied: true } : r))
                    setTimeout(() => setPlayerRecaps(prev => prev.map(r => r.playerId === recap.playerId ? { ...r, copied: false } : r)), 2000)
                  }}
                  style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '6px', border: 'none', background: recap.copied ? '#00FF9F' : '#2A2A2D', color: recap.copied ? '#0E0E0F' : '#ffffff', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                  {recap.copied ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
              <div style={{ padding: '12px 16px' }}>
                <textarea
                  style={{ background: 'transparent', border: 'none', padding: '0', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%', minHeight: '80px', resize: 'vertical', fontFamily: 'sans-serif', lineHeight: 1.6 }}
                  value={recap.parentSummary}
                  onChange={e => setPlayerRecaps(prev => prev.map(r => r.playerId === recap.playerId ? { ...r, parentSummary: e.target.value } : r))}
                />
              </div>
            </div>
          ))}

          {aiGenerated && (
            <button
              type="button"
              onClick={() => { setAiGenerated(false); setPlayerRecaps([]); setDrillWeekTitle(''); setNewDrills([{ title: '', reps: '', category: 'Ball handling' }]); setAssignDrills(false) }}
              style={{ fontSize: '12px', color: '#9A9A9F', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' as const, padding: '0' }}>
              ↺ Regenerate with AI
            </button>
          )}

          {/* DRILL ASSIGNMENT */}
          <div style={{ background: '#1A1A1C', border: `1px solid ${assignDrills ? 'rgba(0,255,159,0.3)' : '#2A2A2D'}`, borderRadius: '12px', overflow: 'hidden', transition: 'border-color 0.15s' }}>
            <div onClick={() => setAssignDrills(!assignDrills)} style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: assignDrills ? '#00FF9F' : '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Assign drill work {aiGenerated && <span style={{ fontSize: '10px', background: 'rgba(0,255,159,0.15)', color: '#00FF9F', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px' }}>AI filled</span>}
                </span>
                <p style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>
                  {isMultiPlayer ? `Same drills assigned to all ${players.length} players` : 'Homework drills for the player to complete before next session'}
                </p>
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
                    type="text" placeholder="e.g. Ball handling focus" value={drillWeekTitle}
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
            {loading ? 'Saving...' : `Save session${isMultiPlayer ? ` for ${players.length} players` : ''}`}
          </button>

        </form>
        {/* STEP 2 — EMAIL PREVIEWS */}
        {step === 'emails' && (
          <>
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <span style={{ fontSize: '16px' }}>✦</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#00FF9F', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Emails ready</span>
              </div>
              <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#ffffff', fontFamily: '"Exo 2", sans-serif', marginBottom: '8px' }}>Review and send</h1>
              <p style={{ fontSize: '14px', color: '#9A9A9F' }}>AI-generated parent updates based on today&apos;s session. Edit before sending.</p>
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
                        onClick={() => { navigator.clipboard.writeText(pe.email); setPlayerEmails(prev => prev.map(e => e.playerId === pe.playerId ? { ...e, copied: true } : e)); setTimeout(() => setPlayerEmails(prev => prev.map(e => e.playerId === pe.playerId ? { ...e, copied: false } : e)), 2000) }}
                        style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '8px', border: '1px solid #2A2A2D', background: 'transparent', color: pe.copied ? '#00FF9F' : '#9A9A9F', fontWeight: 600, cursor: 'pointer' }}>
                        {pe.copied ? '✓ Copied' : 'Copy'}
                      </button>
                      <button
                        onClick={() => handleSendPlayerEmail(pe.playerId)}
                        disabled={pe.sending || pe.sent}
                        style={{ fontSize: '12px', padding: '6px 14px', borderRadius: '8px', border: 'none', background: pe.sent ? '#2A2A2D' : '#00FF9F', color: pe.sent ? '#9A9A9F' : '#0E0E0F', fontWeight: 700, cursor: pe.sent ? 'default' : 'pointer' }}>
                        {pe.sending ? 'Sending...' : pe.sent ? '✓ Sent' : 'Send email'}
                      </button>
                    </div>
                  </div>
                  <div style={{ padding: '16px' }}>
                    <textarea
                      value={pe.email}
                      onChange={e => setPlayerEmails(prev => prev.map(r => r.playerId === pe.playerId ? { ...r, email: e.target.value } : r))}
                      style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '12px', fontSize: '13px', color: '#ffffff', outline: 'none', width: '100%', minHeight: '120px', resize: 'vertical' as const, fontFamily: 'sans-serif', lineHeight: 1.7 }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => router.push(`/dashboard/players/${playerId}`)}
              style={{ background: '#00FF9F', color: '#0E0E0F', border: 'none', borderRadius: '10px', padding: '14px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', width: '100%' }}>
              Done — go to player profile
            </button>
          </>
        )}
      </div>
    </div>
  )
}
