'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

interface Player { id: string; full_name: string; group_id: string | null }

export default function QuickLogPage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useParams()
  const playerId = params.id as string

  const [player, setPlayer] = useState<Player | null>(null)
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [sessionType, setSessionType] = useState('individual')
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const { error } = await supabase.from('sessions').insert({
      trainer_id: user.id,
      player_id: playerId,
      session_date: sessionDate,
      notes,
      session_type: sessionType,
      title: `Session — ${player?.full_name}`,
    })

    if (error) {
      console.error(error)
      setLoading(false)
      return
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

      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '24px 16px' }}>

        {/* HEADER */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00FF9F' }} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#00FF9F', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Log session</span>
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#ffffff', fontFamily: '"Exo 2", sans-serif', marginBottom: '4px' }}>
            {player?.full_name}
          </h1>
          <p style={{ fontSize: '14px', color: '#9A9A9F' }}>Record a training session for this player</p>
        </div>

        {/* PLAYER CARD */}
        <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '14px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(0,255,159,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 600, color: '#00FF9F', flexShrink: 0 }}>
            {getInitials(player?.full_name || '')}
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff' }}>{player?.full_name}</div>
            <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>{player?.group_id ? 'Group player' : 'Individual'}</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* DATE */}
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #2A2A2D' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Session date</span>
            </div>
            <div style={{ padding: '12px 16px' }}>
              <input
                style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }}
                type="date"
                value={sessionDate}
                onChange={e => setSessionDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* SESSION TYPE */}
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #2A2A2D' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Session type</span>
            </div>
            <div style={{ padding: '12px 16px', display: 'flex', gap: '8px' }}>
              {['individual', 'group'].map(opt => (
                <button key={opt} type="button" onClick={() => setSessionType(opt)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: `1px solid ${sessionType === opt ? 'rgba(0,255,159,0.4)' : '#2A2A2D'}`, background: sessionType === opt ? 'rgba(0,255,159,0.08)' : 'transparent', color: sessionType === opt ? '#00FF9F' : '#9A9A9F', fontSize: '14px', fontWeight: 500, cursor: 'pointer', textTransform: 'capitalize' as const }}>
                  {opt === 'individual' ? '👤 Individual' : '👥 Group'}
                </button>
              ))}
            </div>
          </div>

          {/* NOTES */}
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #2A2A2D' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Session notes</span>
            </div>
            <div style={{ padding: '12px 16px' }}>
              <textarea
                style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '12px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%', minHeight: '120px', resize: 'vertical', fontFamily: 'sans-serif' }}
                placeholder="What did you work on? Any standout moments or areas to focus on next time..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ background: '#00FF9F', color: '#0E0E0F', border: 'none', borderRadius: '10px', padding: '14px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', width: '100%' }}>
            {loading ? 'Saving...' : 'Save session'}
          </button>

        </form>
      </div>
    </div>
  )
}
