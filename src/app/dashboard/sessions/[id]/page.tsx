'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import NavBar from '@/components/NavBar'

interface Player { id: string; full_name: string; group_id: string }
interface Session {
  id: string
  title: string
  session_date: string
  session_time: string
  group_id: string
  type: string
  status: string
  rescheduled_date: string | null
  cancelled_at: string | null
  confirmed_at: string | null
}

export default function SessionDetailPage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useParams()
  const sessionId = params.id as string

  const [session, setSession] = useState<Session | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [profile, setProfile] = useState<{ full_name: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showReschedule, setShowReschedule] = useState(false)
  const [showCancel, setShowCancel] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [newTime, setNewTime] = useState('')
  const [cancelReason, setCancelReason] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

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
    setNewDate(sessionData?.rescheduled_date || sessionData?.session_date || '')
    setNewTime(sessionData?.session_time || '')

    if (sessionData?.group_id) {
      const { data: playersData } = await supabase
        .from('players').select('*').eq('group_id', sessionData.group_id)
      setPlayers(playersData || [])
    } else {
      const { data: sessionPlayersData } = await supabase
        .from('session_players').select('player_id, players(id, full_name, group_id)')
        .eq('session_id', sessionId)
      const playersData = sessionPlayersData?.map((sp: any) => {
        const p = sp.players
        return Array.isArray(p) ? p[0] : p
      }).filter(Boolean) || []
      setPlayers(playersData as Player[])
    }

    setLoading(false)
  }

  async function handleConfirm() {
    setActionLoading('confirm')
    const { error } = await supabase
      .from('sessions')
      .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
      .eq('id', sessionId)
    if (!error) {
      setSession(s => s ? { ...s, status: 'confirmed', confirmed_at: new Date().toISOString() } : s)
      setSuccessMessage('Session confirmed')
      setTimeout(() => setSuccessMessage(''), 3000)
    }
    setActionLoading(null)
  }

  async function handleReschedule() {
    if (!newDate) return
    setActionLoading('reschedule')
    const { error } = await supabase
      .from('sessions')
      .update({
        status: 'rescheduled',
        rescheduled_date: newDate,
        session_time: newTime || session?.session_time,
      })
      .eq('id', sessionId)
    if (!error) {
      setSession(s => s ? { ...s, status: 'rescheduled', rescheduled_date: newDate, session_time: newTime || s.session_time } : s)
      setShowReschedule(false)
      setSuccessMessage('Session rescheduled')
      setTimeout(() => setSuccessMessage(''), 3000)
    }
    setActionLoading(null)
  }

  async function handleCancel() {
    setActionLoading('cancel')
    const { error } = await supabase
      .from('sessions')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', sessionId)
    if (!error) {
      setSession(s => s ? { ...s, status: 'cancelled', cancelled_at: new Date().toISOString() } : s)
      setShowCancel(false)
      setSuccessMessage('Session cancelled')
      setTimeout(() => setSuccessMessage(''), 3000)
    }
    setActionLoading(null)
  }

  async function handleRestore() {
    setActionLoading('restore')
    const { error } = await supabase
      .from('sessions')
      .update({ status: 'scheduled', cancelled_at: null, confirmed_at: null })
      .eq('id', sessionId)
    if (!error) {
      setSession(s => s ? { ...s, status: 'scheduled', cancelled_at: null, confirmed_at: null } : s)
      setSuccessMessage('Session restored')
      setTimeout(() => setSuccessMessage(''), 3000)
    }
    setActionLoading(null)
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

  function formatDate(dateStr: string) {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  }

  function getStatusStyle(status: string) {
    switch (status) {
      case 'confirmed': return { color: '#00FF9F', bg: 'rgba(0,255,159,0.1)', border: 'rgba(0,255,159,0.3)', label: 'Confirmed' }
      case 'cancelled': return { color: '#E03131', bg: 'rgba(224,49,49,0.1)', border: 'rgba(224,49,49,0.3)', label: 'Cancelled' }
      case 'rescheduled': return { color: '#F5A623', bg: 'rgba(245,166,35,0.1)', border: 'rgba(245,166,35,0.3)', label: 'Rescheduled' }
      default: return { color: '#9A9A9F', bg: 'rgba(154,154,159,0.1)', border: 'rgba(154,154,159,0.3)', label: 'Scheduled' }
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#9A9A9F' }}>Loading...</p>
    </div>
  )

  const statusStyle = getStatusStyle(session?.status || 'scheduled')
  const isCancelled = session?.status === 'cancelled'
  const isConfirmed = session?.status === 'confirmed'
  const displayDate = session?.rescheduled_date || session?.session_date

  return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', fontFamily: 'sans-serif', overflowX: 'hidden', maxWidth: '100vw', width: '100%' }}>
      <style>{`* { box-sizing: border-box; margin: 0; padding: 0; } html, body { background: #0E0E0F; overflow-x: hidden; }`}</style>

      <NavBar trainerName={profile?.full_name} />

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '20px 16px', width: '100%' }}>
        <div style={{ maxWidth: '560px' }}>

          {/* SUCCESS BANNER */}
          {successMessage && (
            <div style={{ background: 'rgba(0,255,159,0.1)', border: '1px solid rgba(0,255,159,0.3)', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', fontSize: '14px', color: '#00FF9F', fontWeight: 500 }}>
              ✓ {successMessage}
            </div>
          )}

          {/* HEADER */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', gap: '16px' }}>
            <div>
              <h1 style={{ fontFamily: '"Exo 2", sans-serif', fontSize: '26px', fontWeight: 700, color: isCancelled ? '#9A9A9F' : '#ffffff', marginBottom: '6px', textDecoration: isCancelled ? 'line-through' : 'none' }}>
                {session?.title}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' as const }}>
                <span style={{ fontSize: '14px', color: '#9A9A9F' }}>
                  {displayDate ? formatDate(displayDate) : 'No date set'}
                  {session?.status === 'rescheduled' && session?.rescheduled_date && (
                    <span style={{ color: '#F5A623', marginLeft: '6px', fontSize: '12px' }}>(rescheduled)</span>
                  )}
                </span>
                {session?.session_time && (
                  <span style={{ fontSize: '14px', color: '#9A9A9F' }}>· {formatTime(session.session_time)}</span>
                )}
              </div>
            </div>
            <span style={{ fontSize: '12px', fontWeight: 600, padding: '5px 12px', borderRadius: '99px', background: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.border}`, whiteSpace: 'nowrap' as const, flexShrink: 0 }}>
              {statusStyle.label}
            </span>
          </div>

          {/* PLAYERS */}
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '14px' }}>Players</div>
            {players.length === 0 ? (
              <p style={{ fontSize: '14px', color: '#9A9A9F' }}>No players linked to this session</p>
            ) : (
              players.map((player, i) => (
                <div key={player.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: i < players.length - 1 ? '1px solid #2A2A2D' : 'none' }}>
                  <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'rgba(0,255,159,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, color: '#00FF9F' }}>
                    {getInitials(player.full_name)}
                  </div>
                  <span style={{ fontSize: '14px', color: '#ffffff' }}>{player.full_name}</span>
                </div>
              ))
            )}
          </div>

          {/* SESSION ACTIONS */}
          {!isCancelled && (
            <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '14px' }}>Session status</div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' as const }}>
                {!isConfirmed && (
                  <button
                    onClick={handleConfirm}
                    disabled={actionLoading === 'confirm'}
                    style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: '#00FF9F', color: '#0E0E0F', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                    {actionLoading === 'confirm' ? 'Confirming...' : '✓ Confirm session'}
                  </button>
                )}
                {isConfirmed && (
                  <div style={{ padding: '9px 18px', borderRadius: '8px', background: 'rgba(0,255,159,0.1)', border: '1px solid rgba(0,255,159,0.3)', fontSize: '13px', fontWeight: 600, color: '#00FF9F' }}>
                    ✓ Confirmed
                  </div>
                )}
                <button
                  onClick={() => { setShowReschedule(!showReschedule); setShowCancel(false) }}
                  style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid #2A2A2D', background: 'transparent', color: '#ffffff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                  ↷ Reschedule
                </button>
                <button
                  onClick={() => { setShowCancel(!showCancel); setShowReschedule(false) }}
                  style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid rgba(224,49,49,0.4)', background: 'transparent', color: '#E03131', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                  ✕ Cancel session
                </button>
              </div>

              {/* RESCHEDULE FORM */}
              {showReschedule && (
                <div style={{ marginTop: '16px', padding: '16px', background: '#0E0E0F', borderRadius: '10px', border: '1px solid #2A2A2D' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', marginBottom: '12px' }}>Pick a new date and time</div>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' as const }}>
                    <div style={{ flex: 1, minWidth: '140px' }}>
                      <label style={{ fontSize: '12px', color: '#9A9A9F', display: 'block', marginBottom: '6px' }}>New date</label>
                      <input
                        type="date"
                        value={newDate}
                        onChange={e => setNewDate(e.target.value)}
                        style={{ width: '100%', background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '9px 12px', fontSize: '14px', color: '#ffffff', outline: 'none' }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: '140px' }}>
                      <label style={{ fontSize: '12px', color: '#9A9A9F', display: 'block', marginBottom: '6px' }}>New time (optional)</label>
                      <input
                        type="time"
                        value={newTime}
                        onChange={e => setNewTime(e.target.value)}
                        style={{ width: '100%', background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '9px 12px', fontSize: '14px', color: '#ffffff', outline: 'none' }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={handleReschedule}
                      disabled={!newDate || actionLoading === 'reschedule'}
                      style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: newDate ? '#F5A623' : '#2A2A2D', color: newDate ? '#0E0E0F' : '#9A9A9F', fontSize: '13px', fontWeight: 700, cursor: newDate ? 'pointer' : 'default' }}>
                      {actionLoading === 'reschedule' ? 'Saving...' : 'Confirm reschedule'}
                    </button>
                    <button onClick={() => setShowReschedule(false)} style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid #2A2A2D', background: 'transparent', color: '#9A9A9F', fontSize: '13px', cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* CANCEL CONFIRM */}
              {showCancel && (
                <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(224,49,49,0.05)', borderRadius: '10px', border: '1px solid rgba(224,49,49,0.25)' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff', marginBottom: '6px' }}>Cancel this session?</div>
                  <div style={{ fontSize: '13px', color: '#9A9A9F', marginBottom: '14px' }}>This will mark the session as cancelled. You can restore it later if needed.</div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={handleCancel}
                      disabled={actionLoading === 'cancel'}
                      style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: '#E03131', color: '#ffffff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                      {actionLoading === 'cancel' ? 'Cancelling...' : 'Yes, cancel session'}
                    </button>
                    <button onClick={() => setShowCancel(false)} style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid #2A2A2D', background: 'transparent', color: '#9A9A9F', fontSize: '13px', cursor: 'pointer' }}>
                      Keep session
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CANCELLED STATE */}
          {isCancelled && (
            <div style={{ background: 'rgba(224,49,49,0.05)', border: '1px solid rgba(224,49,49,0.25)', borderRadius: '12px', padding: '20px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#E03131', marginBottom: '4px' }}>Session cancelled</div>
                <div style={{ fontSize: '13px', color: '#9A9A9F' }}>This session has been cancelled. Restore it if plans change.</div>
              </div>
              <button
                onClick={handleRestore}
                disabled={actionLoading === 'restore'}
                style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid #2A2A2D', background: 'transparent', color: '#ffffff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                {actionLoading === 'restore' ? 'Restoring...' : 'Restore session'}
              </button>
            </div>
          )}

          {/* LOG / DRILLS */}
          {!isCancelled && (
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => router.push(`/dashboard/sessions/${sessionId}/log`)}
                style={{ flex: 1, background: '#00FF9F', color: '#0E0E0F', border: 'none', borderRadius: '8px', padding: '14px', fontSize: '15px', fontWeight: 700, cursor: 'pointer' }}>
                Log this session
              </button>
              {session?.group_id && (
                <button
                  onClick={() => router.push(`/dashboard/drills/new?group=${session.group_id}`)}
                  style={{ flex: 1, background: 'transparent', color: '#00FF9F', border: '1px solid #00FF9F', borderRadius: '8px', padding: '14px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}>
                  Assign drills
                </button>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
