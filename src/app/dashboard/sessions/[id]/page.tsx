'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

interface Player { id: string; full_name: string; group_id: string }
interface Session { id: string; title: string; session_date: string; session_time: string; group_id: string; type: string }

export default function SessionDetailPage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useParams()
  const sessionId = params.id as string

  const [session, setSession] = useState<Session | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)

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
    } else {
      const { data: sessionPlayersData } = await supabase
        .from('session_players').select('player_id, players(id, full_name, group_id)')
        .eq('session_id', sessionId)
      const playersData = sessionPlayersData?.map((sp: { player_id: string; players: Player | Player[] }) => {
        const p = sp.players
        return Array.isArray(p) ? p[0] : p
      }).filter(Boolean) || []
      setPlayers(playersData as Player[])
    }

    setLoading(false)
  }

  function getInitials(name: string) {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??'
  }

  function formatTime(time: string) {
    if (!time) return ''
    const [h, m] = time.split(':')
    const hour = parseInt(h)
    const ampm = hour >= 12 ? 'pm' : 'am'
    const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
    return `${display}:${m} ${ampm}`
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

      <div style={{ maxWidth: '560px', margin: '48px auto', padding: '0 16px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>{session?.title}</h1>
        <p style={{ fontSize: '14px', color: '#6B6B72', marginBottom: '32px' }}>
          {session?.session_time ? formatTime(session.session_time) : 'No time set'} · {session?.type}
        </p>

        <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '16px' }}>Players</div>
          {players.length === 0 ? (
            <p style={{ fontSize: '14px', color: '#6B6B72' }}>No players linked to this session</p>
          ) : (
            players.map(player => (
              <div key={player.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid #2A2A2D' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'rgba(244,88,26,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, color: '#F4581A' }}>
                  {getInitials(player.full_name)}
                </div>
                <span style={{ fontSize: '14px', color: '#ffffff' }}>{player.full_name}</span>
              </div>
            ))
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => router.push(`/dashboard/sessions/${sessionId}/log`)}
            style={{ flex: 1, background: '#F4581A', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '14px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}>
            Log this session
          </button>
          {session?.group_id && (
            <button
              onClick={() => router.push(`/dashboard/drills/new?group=${session.group_id}`)}
              style={{ flex: 1, background: 'transparent', color: '#F4581A', border: '1px solid #F4581A', borderRadius: '8px', padding: '14px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}>
              Assign drills
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
