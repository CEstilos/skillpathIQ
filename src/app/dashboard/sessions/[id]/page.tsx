'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

interface Player { id: string; full_name: string; group_id: string }
interface Session { id: string; title: string; session_date: string; session_time: string; group_id: string; type: string }

export default function SessionLogPage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useParams()
  const sessionId = params.id as string

  const [session, setSession] = useState<Session | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [attendance, setAttendance] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [drillsCovered, setDrillsCovered] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    } else {
      const { data: sessionPlayersData } = await supabase
        .from('session_players').select('player_id, players(*)').eq('session_id', sessionId)
      const playersData = sessionPlayersData?.map((sp: { player_id: string; players: Player }) => sp.players) || []
      setPlayers(playersData)
      setAttendance(playersData.map((p: Player) => p.id))
    }

    const { data: existingLog } = await supabase
      .from('session_logs').select('*').eq('session_id', sessionId).single()
    if (existingLog) {
      setNotes(existingLog.notes || '')
      setDrillsCovered(existingLog.drills_covered || '')
    }

    setLoading(false)
  }

  function toggleAttendance(playerId: string) {
    setAttendance(prev =>
      prev.includes(playerId) ? prev.filter(id => id !== playerId) : [...prev, playerId]
    )
  }

  function getInitials(name: string) {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??'
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const { error: logError } = await supabase
      .from('session_logs')
      .upsert({
        session_id: sessionId,
        trainer_id: user.id,
        notes,
        drills_covered: drillsCovered,
      }, { onConflict: 'session_id' })

    if (logError) { setError(logError.message); setSaving(false); return }

    await supabase.from('session_attendance').delete().eq('session_id', sessionId)

    if (attendance.length > 0) {
      const attendanceRows = attendance.map(playerId => ({
        session_id: sessionId,
        player_id: playerId,
        trainer_id: user.id,
        attended: true,
      }))
      await supabase.from('session_attendance').insert(attendanceRows)
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleAssignDrills() {
    if (session?.group_id) {
      router.push(`/dashboard/drills/new?group=${session.group_id}`)
    }
  }

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

      <div style={{ maxWidth: '600px', margin: '48px auto', padding: '0 16px' }}>
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>{session?.title}</h1>
          <p style={{ fontSize: '14px', color: '#6B6B72' }}>
            {session?.session_date ? formatDate(session.session_date) : ''}
            {session?.session_time ? ` · ${session.session_time}` : ''}
          </p>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* ATTENDANCE */}
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '20px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '14px' }}>
              Attendance · {attendance.length}/{players.length} present
            </div>
            {players.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#6B6B72' }}>No players linked to this session</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {players.map(player => {
                  const present = attendance.includes(player.id)
                  return (
                    <div key={player.id} onClick={() => toggleAttendance(player.id)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${present ? '#1DB87A' : '#2A2A2D'}`, background: present ? 'rgba(29,184,122,0.08)' : 'transparent', cursor: 'pointer', transition: 'all 0.15s' }}>
                      <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: present ? 'rgba(29,184,122,0.2)' : 'rgba(244,88,26,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, color: present ? '#1DB87A' : '#F4581A', flexShrink: 0 }}>
                        {getInitials(player.full_name)}
                      </div>
                      <span style={{ fontSize: '14px', color: '#ffffff', flex: 1 }}>{player.full_name}</span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: present ? '#1DB87A' : '#6B6B72' }}>
                        {present ? '✓ Present' : 'Absent'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* DRILLS COVERED */}
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Drills covered</div>
            <textarea
              style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '12px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%', minHeight: '100px', resize: 'vertical', fontFamily: 'sans-serif' }}
              placeholder="e.g. Two-ball dribble, crossover series, free throws..."
              value={drillsCovered}
              onChange={e => setDrillsCovered(e.target.value)}
            />
          </div>

          {/* NOTES */}
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Session notes</div>
            <textarea
              style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '12px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%', minHeight: '120px', resize: 'vertical', fontFamily: 'sans-serif' }}
              placeholder="What went well? What needs work? Any notes on individual players..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {error && <p style={{ fontSize: '13px', color: '#E03131', background: '#1f0f0f', border: '1px solid #3a1a1a', borderRadius: '8px', padding: '10px 14px' }}>{error}</p>}

          <div style={{ display: 'flex', gap: '12px' }}>
            <button type="submit" disabled={saving} style={{ flex: 1, background: saving ? '#2A2A2D' : saved ? '#1DB87A' : '#F4581A', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '13px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }}>
              {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save session log'}
            </button>
            {session?.group_id && (
              <button type="button" onClick={handleAssignDrills} style={{ flex: 1, background: 'transparent', color: '#F4581A', border: '1px solid #F4581A', borderRadius: '8px', padding: '13px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}>
                Assign drill work →
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
