'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

interface Player { id: string; full_name: string; group_id: string }
interface Session { id: string; title: string; session_date: string; session_time: string; group_id: string }

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
  const [loading, setLoading] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)

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

    await supabase.from('session_attendance').upsert(
      players.map(p => ({
        session_id: sessionId,
        player_id: p.id,
        trainer_id: user.id,
        attended: attendance.includes(p.id),
      }))
    )

    router.push('/dashboard')
  }

  if (dataLoading) return (
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

      <div style={{ maxWidth: '560px', margin: '48px auto', padding: '0 16px' }}>
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>Log session</h1>
          <p style={{ fontSize: '14px', color: '#6B6B72' }}>{session?.title}</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* ATTENDANCE */}
          {players.length > 0 && (
            <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Attendance</div>
                <span style={{ fontSize: '12px', color: '#6B6B72' }}>{attendance.length}/{players.length} present</span>
              </div>
              {players.map(player => (
                <div key={player.id} onClick={() => toggleAttendance(player.id)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '8px', border: `1px solid ${attendance.includes(player.id) ? '#1DB87A' : '#2A2A2D'}`, background: attendance.includes(player.id) ? 'rgba(29,184,122,0.08)' : 'transparent', cursor: 'pointer' }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: attendance.includes(player.id) ? 'none' : '2px solid #6B6B72', background: attendance.includes(player.id) ? '#1DB87A' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {attendance.includes(player.id) && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <polyline points="1.5,5 4,7.5 8.5,2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(244,88,26,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, color: '#F4581A' }}>
                    {getInitials(player.full_name)}
                  </div>
                  <span style={{ fontSize: '14px', color: '#ffffff' }}>{player.full_name}</span>
                  <span style={{ marginLeft: 'auto', fontSize: '12px', color: attendance.includes(player.id) ? '#1DB87A' : '#6B6B72' }}>
                    {attendance.includes(player.id) ? 'Present' : 'Absent'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* DRILLS COVERED */}
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Drills covered</div>
            <textarea
              style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '12px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%', minHeight: '100px', resize: 'vertical', fontFamily: 'sans-serif' }}
              placeholder="e.g. Two-ball dribbling, crossover series, finishing at the rim..."
              value={drillsCovered}
              onChange={e => setDrillsCovered(e.target.value)}
            />
          </div>

          {/* NOTES */}
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Session notes</div>
            <textarea
              style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '12px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%', minHeight: '120px', resize: 'vertical', fontFamily: 'sans-serif' }}
              placeholder="What went well? What needs work? Any standout moments..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          <button type="submit" disabled={loading} style={{ background: '#F4581A', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '14px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}>
            {loading ? 'Saving...' : 'Save session log'}
          </button>
        </form>
      </div>
    </div>
  )
}
