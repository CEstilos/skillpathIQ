'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import NavBar from '@/components/NavBar'

interface Profile { id: string; full_name: string; email: string; primary_sport?: string; onboarding_completed?: boolean }
interface Player { id: string; full_name: string; parent_email: string; group_id: string | null; trainer_id: string; created_at: string }
interface Group { id: string; name: string; sport: string; session_day: string; session_time: string }
interface Session { id: string; player_id: string; session_date: string; notes: string | null }
interface ScheduledSession { id: string; title: string; session_date: string; session_time: string; type: string; group_id: string | null; status?: string; rescheduled_date?: string | null; groups?: { name: string; sport: string } }
interface DrillWeek { id: string; group_id: string | null; player_id: string | null; title: string; week_start: string }
interface Drill { id: string; drill_week_id: string; title: string }
interface Completion { id: string; player_id: string; drill_id: string }
interface SessionPlayer { session_id: string; player_id: string }
interface SessionRequest { id: string; player_id: string; note: string | null; requested_at: string; status: string; players?: { id: string; full_name: string; parent_email: string } }

interface SessionLog { session_id: string }

interface Props {
  profile: Profile | null
  players: Player[]
  groups: Group[]
  sessions: Session[]
  drillWeeks: DrillWeek[]
  drills: Drill[]
  completions: Completion[]
  todaySessions: ScheduledSession[]
  upcomingSessions: ScheduledSession[]
  allSessionPlayers: SessionPlayer[]
  sessionLogs: SessionLog[]
  unloggedSessions: ScheduledSession[]
  sessionRequests: SessionRequest[]
}

export default function DashboardClient({ profile, players, groups, sessions, drillWeeks, drills, completions, todaySessions, upcomingSessions, allSessionPlayers, sessionLogs, unloggedSessions, sessionRequests }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [bannerDismissed, setBannerDismissed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('welcome_dismissed') === 'true'
    }
    return false
  })
  const [dismissingRequest, setDismissingRequest] = useState<string | null>(null)
  

  const [sessionStatuses, setSessionStatuses] = useState<Record<string, string>>({})
const [rescheduleOpen, setRescheduleOpen] = useState<string | null>(null)
const [rescheduleDate, setRescheduleDate] = useState('')
const [rescheduleTime, setRescheduleTime] = useState('')
const [actionLoading, setActionLoading] = useState<string | null>(null)
const [showUnlogged, setShowUnlogged] = useState(false)
const [localSessionRequests, setLocalSessionRequests] = useState<SessionRequest[]>(sessionRequests)
const [showAllUpcoming, setShowAllUpcoming] = useState(false)
const [emailingPlayer, setEmailingPlayer] = useState<Player | null>(null)
const [quickEmailSubject, setQuickEmailSubject] = useState('')
const [quickEmailBody, setQuickEmailBody] = useState('')
const [sendingQuickEmail, setSendingQuickEmail] = useState(false)
const [quickEmailSent, setQuickEmailSent] = useState(false)
const [broadcastEmailOpen, setBroadcastEmailOpen] = useState(false)
const [broadcastSubject, setBroadcastSubject] = useState('')
const [broadcastBody, setBroadcastBody] = useState('')
  const [sendingBroadcast, setSendingBroadcast] = useState(false)
  const [broadcastResults, setBroadcastResults] = useState<{name: string; success: boolean}[]>([])
  const [showOnboarding, setShowOnboarding] = useState(!profile?.onboarding_completed && players.length === 0)
  const [onboardingStep, setOnboardingStep] = useState(0)
  const [onboardingAnswers, setOnboardingAnswers] = useState({ athlete_count: '', parent_comms: '', challenge: '', referral: '', other_comms: '' })
  const [savingOnboarding, setSavingOnboarding] = useState(false)
  function dismissBanner() {
    localStorage.setItem('welcome_dismissed', 'true')
    setBannerDismissed(true)
  }



  function getGroup(groupId: string | null) {
    if (!groupId) return null
    return groups.find(g => g.id === groupId) || null
  }

  function getLastSession(playerId: string) {
    const playerSessions = sessions.filter(s => s.player_id === playerId)
    if (!playerSessions.length) return null
    return playerSessions[0]
  }

  function getDaysSince(dateStr: string | null) {
    if (!dateStr) return null
    return Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
  }

  function getStatus(playerId: string) {
    const last = getLastSession(playerId)
    const days = getDaysSince(last?.session_date || null)
    if (days === null) return 'new'
    if (days <= 14) return 'active'
    if (days <= 30) return 'at-risk'
    return 'lapsed'
  }

  function getStatusStyle(status: string) {
    switch (status) {
      case 'active': return { color: '#00FF9F', bg: 'rgba(0,255,159,0.12)', label: 'Active' }
      case 'at-risk': return { color: '#F5A623', bg: 'rgba(245,166,35,0.15)', label: 'At risk' }
      case 'lapsed': return { color: '#E03131', bg: 'rgba(224,49,49,0.15)', label: 'Lapsed' }
      default: return { color: '#9A9A9F', bg: 'rgba(107,107,114,0.15)', label: 'New' }
    }
  }

  function getInitials(name: string) {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??'
  }
  function getSportEmoji() {
    const emojiMap: Record<string, string> = {
      basketball: '🏀',
      football: '🏈',
      golf: '⛳',
      baseball: '⚾',
      softball: '🥎',
      soccer: '⚽',
      tennis: '🎾',
      volleyball: '🏐',
      other: '🏆',
    }
    if (!groups.length) {
      return emojiMap[profile?.primary_sport || 'basketball'] || '🏀'
    }
    const sportCounts: Record<string, number> = {}
    groups.forEach(g => {
      const s = g.sport || 'basketball'
      sportCounts[s] = (sportCounts[s] || 0) + 1
    })
    const topSport = Object.entries(sportCounts).sort((a, b) => b[1] - a[1])[0][0]
    return emojiMap[topSport] || '🏆'
  }
  function formatDaysAgo(days: number | null) {
    if (days === null) return 'No sessions yet'
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days}d ago`
    if (days < 30) return `${Math.floor(days / 7)}w ago`
    return `${Math.floor(days / 30)}mo ago`
  }
  function formatTime(time: string) {
    if (!time) return ''
    const [h, m] = time.split(':')
    const hour = parseInt(h)
    const ampm = hour >= 12 ? 'pm' : 'am'
    const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
    return `${display}:${m} ${ampm}`
  }
  
  function formatUpcomingDate(dateStr: string) {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }
  function getCurrentDrillWeek(player: Player) {
    if (player.group_id) return drillWeeks.find(w => w.group_id === player.group_id) || null
    return drillWeeks.find(w => w.player_id === player.id) || null
  }

  function getCompletionPct(player: Player) {
    const week = getCurrentDrillWeek(player)
    if (!week) return null
    const weekDrills = drills.filter(d => d.drill_week_id === week.id)
    if (!weekDrills.length) return null
    const done = completions.filter(c => c.player_id === player.id && weekDrills.some(d => d.id === c.drill_id)).length
    return Math.round((done / weekDrills.length) * 100)
  }
  function getDrillCounts(player: Player) {
    const week = getCurrentDrillWeek(player)
    if (!week) return null
    const weekDrills = drills.filter(d => d.drill_week_id === week.id)
    if (!weekDrills.length) return null
    const done = completions.filter(c => c.player_id === player.id && weekDrills.some(d => d.id === c.drill_id)).length
    return { done, total: weekDrills.length }
  }
  function copyPlayerLink(playerId: string) {
    const url = `${window.location.origin}/player?id=${playerId}`
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(playerId)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  const filteredPlayers = players.filter(p => {
    const matchesFilter = activeFilter === 'all' ? true : activeFilter === 'individual' ? !p.group_id : p.group_id === activeFilter
    const matchesSearch = search === '' || p.full_name.toLowerCase().includes(search.toLowerCase()) || p.parent_email?.toLowerCase().includes(search.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const activeCount = players.filter(p => getStatus(p.id) === 'active').length
  const atRiskCount = players.filter(p => getStatus(p.id) === 'at-risk').length
  const lapsedCount = players.filter(p => getStatus(p.id) === 'lapsed').length
  
  
  async function cancelSession(sessionId: string) {
    setActionLoading(sessionId + '_cancel')
    const supabaseClient = createClient()
    await supabaseClient.from('sessions')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', sessionId)
    setSessionStatuses(prev => ({ ...prev, [sessionId]: 'cancelled' }))
    setActionLoading(null)
  }
  
  async function rescheduleSession(sessionId: string) {
    if (!rescheduleDate) return
    setActionLoading(sessionId + '_reschedule')
    const supabaseClient = createClient()
    await supabaseClient.from('sessions')
      .update({
        status: 'scheduled',
        session_date: rescheduleDate,
        rescheduled_date: rescheduleDate,
        session_time: rescheduleTime || undefined
      })
      .eq('id', sessionId)
    setSessionStatuses(prev => ({ ...prev, [sessionId]: 'rescheduled' }))
    setRescheduleOpen(null)
    setActionLoading(null)
    router.refresh()
  }
  
  function getSessionStatus(session: ScheduledSession) {
    return sessionStatuses[session.id] || session.status || 'scheduled'
  }
  
  function SessionActionButtons({ session }: { session: ScheduledSession }) {
    const status = getSessionStatus(session)
    const isOpen = rescheduleOpen === session.id
    const btnStyle = { fontSize: '11px', padding: '4px 10px', borderRadius: '6px', border: '1px solid #2A2A2D', background: 'transparent', cursor: 'pointer', whiteSpace: 'nowrap' as const, color: '#9A9A9F', display: 'block', width: '100%', textAlign: 'right' as const }
  
    if (status === 'cancelled') return (
      <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', background: 'rgba(224,49,49,0.1)', color: '#E03131', border: '1px solid rgba(224,49,49,0.3)', fontWeight: 600 }}>
        Cancelled
      </span>
    )
  
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
        <button
          onClick={() => { setRescheduleOpen(isOpen ? null : session.id); setRescheduleDate(session.rescheduled_date || session.session_date); setRescheduleTime(session.session_time || '') }}
          style={btnStyle}>
          ↷ Reschedule
        </button>
        <button
          onClick={() => cancelSession(session.id)}
          disabled={actionLoading === session.id + '_cancel'}
          style={btnStyle}>
          {actionLoading === session.id + '_cancel' ? '...' : '✕ Cancel'}
        </button>
  
        {isOpen && (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' as const, marginTop: '4px', justifyContent: 'flex-end' }}>
            <input
              type="date"
              value={rescheduleDate}
              onChange={e => setRescheduleDate(e.target.value)}
              style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '6px', padding: '5px 8px', fontSize: '12px', color: '#ffffff', outline: 'none' }}
            />
            <input
              type="time"
              value={rescheduleTime}
              onChange={e => setRescheduleTime(e.target.value)}
              style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '6px', padding: '5px 8px', fontSize: '12px', color: '#ffffff', outline: 'none' }}
            />
            <button
              onClick={() => rescheduleSession(session.id)}
              disabled={!rescheduleDate}
              style={{ fontSize: '11px', padding: '5px 10px', borderRadius: '6px', border: 'none', background: '#F5A623', color: '#0E0E0F', fontWeight: 700, cursor: 'pointer' }}>
              Save
            </button>
            <button
              onClick={() => setRescheduleOpen(null)}
              style={{ fontSize: '11px', padding: '5px 10px', borderRadius: '6px', border: '1px solid #2A2A2D', background: 'transparent', color: '#9A9A9F', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        )}
      </div>
    )
  }
 
  async function submitOnboarding(skip = false) {
    setSavingOnboarding(true)
    const supabaseClient = createClient()
    await supabaseClient.from('profiles').update({
      onboarding_completed: true,
      athlete_count: skip ? null : onboardingAnswers.athlete_count,
      parent_comms_method: skip ? null : onboardingAnswers.parent_comms === 'other' ? onboardingAnswers.other_comms : onboardingAnswers.parent_comms,
      biggest_challenge: skip ? null : onboardingAnswers.challenge,
      referral_source: skip ? null : onboardingAnswers.referral,
    }).eq('id', profile?.id)
    setSavingOnboarding(false)
    setShowOnboarding(false)
  }

  async function dismissRequest(requestId: string) {
  async function dismissRequest(requestId: string) {
    setDismissingRequest(requestId)
    const supabaseClient = createClient()
    await supabaseClient.from('session_requests')
      .update({ status: 'dismissed' })
      .eq('id', requestId)
    setDismissingRequest(null)
    setLocalSessionRequests(prev => prev.filter(r => r.id !== requestId))
  }


  function getSessionDisplayState(session: ScheduledSession) {
    const now = new Date()
    const isLogged = session.status === 'logged' || sessionLogs.some(l => l.session_id === session.id)

    if (isLogged) return { isPast: true, isLogged: true }
    if (!session.session_time) return { isPast: false, isLogged: false }

    const [h, m] = session.session_time.split(':').map(Number)
    const sessionStart = new Date()
    sessionStart.setHours(h, m, 0, 0)
    const isPast = now > sessionStart

    return { isPast, isLogged: false }
  }
  async function sendQuickEmail() {
    if (!emailingPlayer?.parent_email || !quickEmailBody.trim()) return
    setSendingQuickEmail(true)
    const playerUrl = `${window.location.origin}/player?id=${emailingPlayer.id}`
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: emailingPlayer.parent_email,
        subject: quickEmailSubject || `Update about ${emailingPlayer.full_name.split(' ')[0]}`,
        body: quickEmailBody,
        playerName: emailingPlayer.full_name.split(' ')[0],
        playerUrl,
      }),
    })
    const data = await response.json()
    setSendingQuickEmail(false)
    if (!data.error) {
      setQuickEmailSent(true)
      setTimeout(() => {
        setEmailingPlayer(null)
        setQuickEmailSubject('')
        setQuickEmailBody('')
        setQuickEmailSent(false)
      }, 2000)
    }
  }

  async function sendBroadcastEmail() {
    setSendingBroadcast(true)
    setBroadcastResults([])
    const targets = players.filter(p => {
      if (!p.parent_email) return false
      const status = getStatus(p.id)
      return status === 'active' || status === 'at-risk'
    })
    const results: {name: string; success: boolean}[] = []
    for (const player of targets) {
      const playerUrl = `${window.location.origin}/player?id=${player.id}`
      try {
        const response = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: player.parent_email,
            subject: broadcastSubject || 'Update from your trainer',
            body: broadcastBody,
            playerName: player.full_name.split(' ')[0],
            playerUrl,
          }),
        })
        const data = await response.json()
        results.push({ name: player.full_name, success: !data.error })
      } catch {
        results.push({ name: player.full_name, success: false })
      }
    }
    setBroadcastResults(results)
    setSendingBroadcast(false)
    if (results.every(r => r.success)) {
      setBroadcastBody('')
      setBroadcastSubject('')
    }
  }

  return (
  
    <div style={{ minHeight: '100vh', background: '#0E0E0F', fontFamily: 'sans-serif', overflowX: 'hidden', maxWidth: '100vw', width: '100%', position: 'relative' }}>

<style>{`
  * { box-sizing: border-box; margin: 0; padding: 0; max-width: 100%; }
  html, body { overflow-x: hidden; max-width: 100vw; }
  @media (max-width: 640px) {
    .nav-links { display: none !important; }
    .nav-menu-btn { display: flex !important; }
    .stat-grid { grid-template-columns: repeat(2, 1fr) !important; }
    .page-header { flex-direction: column !important; gap: 12px !important; }
    .header-buttons { width: 100% !important; }
    .header-buttons button { flex: 1 !important; }
    .player-card-grid { display: none !important; }
    .player-cards { display: flex !important; }
    .top-row { grid-template-columns: 1fr !important; }
  }
  @media (min-width: 641px) {
    .nav-menu-btn { display: none !important; }
    .mobile-menu { display: none !important; }
    .player-cards { display: none !important; }
  }
`}</style>

      {/* NAV */}
      <NavBar trainerName={profile?.full_name} />
      

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '20px 16px', width: '100%' }}>
{/* PAGE HEADER */}
<div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
  <div>
    <h1 style={{ fontFamily: '"Exo 2", sans-serif', fontSize: '28px', fontWeight: 700, color: '#ffffff', letterSpacing: '1px', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
      <span style={{ fontSize: '26px' }}>{getSportEmoji()}</span>
      {profile?.full_name ? `${profile.full_name.split(' ')[0]}'s Training Hub` : 'Training Hub'}
    </h1>
    <p style={{ fontSize: '13px', color: '#9A9A9F', marginTop: '4px' }}>
      {players.length === 0 ? 'Add your first player' : `${players.length} player${players.length !== 1 ? 's' : ''} · ${groups.length} group${groups.length !== 1 ? 's' : ''}`}
    </p>
  </div>
  <div className="header-buttons" style={{ display: 'flex', gap: '8px' }}>
    <button onClick={() => router.push('/dashboard/sessions/new')} style={{ background: 'transparent', color: '#ffffff', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '9px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
      + Schedule session
    </button>
    <button onClick={() => router.push('/dashboard/players/new')} style={{ background: '#00FF9F', color: '#0E0E0F', border: 'none', borderRadius: '8px', padding: '9px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
      + Add player
    </button>
  </div>
</div>
{/* TOP ROW — TODAY'S FOCUS + QUICK ACCESS */}
<div className="top-row" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '16px', marginBottom: '20px', alignItems: 'start' }}>
      {/* TODAY'S FOCUS */}
      {(() => {
        const atRiskPlayers = players.filter(p => {
          const last = sessions.filter(s => s.player_id === p.id).sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime())[0]
          if (!last) return false
          const days = Math.floor((new Date().getTime() - new Date(last.session_date).getTime()) / (1000 * 60 * 60 * 24))
          return days >= 30
        })
        const hasAnything = todaySessions.length > 0 || unloggedSessions.length > 0 || atRiskPlayers.length > 0
        if (!hasAnything) return null
        return (
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '14px', padding: '20px', marginBottom: '20px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#00FF9F', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>Today&apos;s Focus</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

              {/* TODAY'S SESSIONS */}
              {todaySessions.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', background: 'rgba(0,255,159,0.05)', border: '1px solid rgba(0,255,159,0.15)', borderRadius: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(0,255,159,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>📅</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
                      {todaySessions.length} session{todaySessions.length !== 1 ? 's' : ''} scheduled today
                    </div>
                    <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>
                      {todaySessions.map(s => s.groups?.name || s.title).join(', ')}
                    </div>
                  </div>
                  <button
                    onClick={() => document.getElementById('todays-sessions')?.scrollIntoView({ behavior: 'smooth' })}
                    style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '7px', border: '1px solid rgba(0,255,159,0.3)', background: 'transparent', color: '#00FF9F', cursor: 'pointer', flexShrink: 0, fontWeight: 500 }}>
                    View
                  </button>
                </div>
              )}

              {/* UNLOGGED SESSIONS */}
              {unloggedSessions.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', background: 'rgba(224,49,49,0.05)', border: '1px solid rgba(224,49,49,0.2)', borderRadius: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(224,49,49,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>⚠️</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
                      {unloggedSessions.length} unlogged session{unloggedSessions.length !== 1 ? 's' : ''}
                    </div>
                    <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>Log these to keep your records and AI recaps up to date</div>
                  </div>
                  <button
                    onClick={() => setShowUnlogged(true)}
                    style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '7px', border: '1px solid rgba(224,49,49,0.3)', background: 'transparent', color: '#E03131', cursor: 'pointer', flexShrink: 0, fontWeight: 500 }}>
                    Review
                  </button>
                </div>
              )}

              {/* AT RISK PLAYERS */}
              {atRiskPlayers.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', background: 'rgba(245,166,35,0.05)', border: '1px solid rgba(245,166,35,0.2)', borderRadius: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(245,166,35,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>💬</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
                      {atRiskPlayers.length} player{atRiskPlayers.length !== 1 ? 's' : ''} haven&apos;t trained in 30+ days
                    </div>
                    <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                      {atRiskPlayers.slice(0, 3).map(p => p.full_name.split(' ')[0]).join(', ')}{atRiskPlayers.length > 3 ? ` +${atRiskPlayers.length - 3} more` : ''}
                    </div>
                  </div>
                  <button
                    onClick={() => router.push('/dashboard/clients')}
                    style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '7px', border: '1px solid rgba(245,166,35,0.3)', background: 'transparent', color: '#F5A623', cursor: 'pointer', flexShrink: 0, fontWeight: 500 }}>
                    Reach out
                  </button>
                </div>
              )}

            </div>
          </div>
      )
    })()}

 {/* QUICK ACCESS PANEL */}
 <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '14px', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #2A2A2D' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Quick Access</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {[
            {
              label: 'My Players',
              count: players.length,
              target: 'my-players',
            },
            {
              label: 'My Groups',
              count: groups.length,
              target: 'my-groups',
            },
            {
              label: 'Recent Sessions',
              count: sessions.filter(s => s.player_id).length,
              target: 'recent-sessions',
            },
          ].map((item, i, arr) => (
            <div key={item.label} style={{ padding: '14px 16px', borderBottom: i < arr.length - 1 ? '1px solid #2A2A2D' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff' }}>{item.label}</div>
                <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>{item.count} {item.label === 'My Players' ? `player${item.count !== 1 ? 's' : ''}` : item.label === 'My Groups' ? `group${item.count !== 1 ? 's' : ''}` : `logged`}</div>
              </div>
              <button
                onClick={() => document.getElementById(item.target)?.scrollIntoView({ behavior: 'smooth' })}
                style={{ fontSize: '12px', padding: '5px 14px', borderRadius: '7px', border: '1px solid #2A2A2D', background: 'transparent', color: '#00FF9F', cursor: 'pointer', fontWeight: 600 }}>
                View
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
      {/* SESSION SUMMARY ROW */}
<div id="recent-sessions" />
<div style={{ marginBottom: showUnlogged ? '0' : '20px' }}>
  <div style={{ fontSize: '13px', color: '#9A9A9F', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' as const, marginBottom: showUnlogged ? '12px' : '0' }}>
    {todaySessions.length > 0 && (
      <span><span style={{ color: '#00FF9F', fontWeight: 600 }}>{todaySessions.length}</span> session{todaySessions.length !== 1 ? 's' : ''} today</span>
    )}
    {upcomingSessions.length > 0 && (
      <span><span style={{ color: '#ffffff', fontWeight: 600 }}>{upcomingSessions.length}</span> Upcoming Sessions</span>
    )}
    {todaySessions.length === 0 && upcomingSessions.length === 0 && (
      <span>No sessions scheduled</span>
    )}
   
    {localSessionRequests.length > 0 && (
      <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <span style={{ color: '#00FF9F', fontWeight: 700, fontSize: '13px' }}>●</span>
        <span style={{ color: '#00FF9F', fontWeight: 600 }}>{localSessionRequests.length}</span>
        <span style={{ color: '#00FF9F' }}>session request{localSessionRequests.length !== 1 ? 's' : ''}</span>
      </span>
    )}
    {unloggedSessions.length > 0 && (
      <button
        onClick={() => setShowUnlogged(!showUnlogged)}
        style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', cursor: 'pointer', padding: '0' }}>
        <span style={{ color: '#E03131', fontWeight: 700, fontSize: '13px' }}>!</span>
        <span style={{ color: '#E03131', fontWeight: 600 }}>{unloggedSessions.length}</span>
        <span style={{ color: '#E03131' }}>Athletes waiting on follow-up</span>
      </button>
      
    )}
   
    <button
      onClick={() => setBroadcastEmailOpen(!broadcastEmailOpen)}
      style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: '1px solid rgba(0,255,159,0.4)', borderRadius: '6px', cursor: 'pointer', padding: '4px 10px', fontSize: '12px', color: '#00FF9F', fontWeight: 600 }}>
      ✉ Email All Athletes
    </button>
  </div>

  {/* SESSION REQUESTS */}
  {localSessionRequests.length > 0 && (
    <div style={{ background: '#1A1A1C', border: '1px solid rgba(0,255,159,0.25)', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #2A2A2D', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00FF9F' }} />
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#00FF9F', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Session requests ({localSessionRequests.length})
          </span>
        </div>
      </div>
      {localSessionRequests.map((req, i) => (
        <div key={req.id} style={{ padding: '14px 16px', borderBottom: i < localSessionRequests.length - 1 ? '1px solid #2A2A2D' : 'none', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(0,255,159,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, color: '#00FF9F', flexShrink: 0 }}>
            {req.players?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              onClick={() => router.push(`/dashboard/players/${req.player_id}`)}
              style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.2)' }}>
              {req.players?.full_name}
            </div>
            {req.note && <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>{req.note}</div>}
            <div style={{ fontSize: '11px', color: '#9A9A9F', marginTop: '2px' }}>
              {new Date(req.requested_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          <button
              onClick={async () => {
                setLocalSessionRequests(prev => prev.filter(r => r.id !== req.id))
                const supabaseClient = createClient()
                supabaseClient.from('session_requests')
                  .update({ status: 'dismissed' })
                  .eq('id', req.id)
                  .then(() => {})
                router.push(`/dashboard/sessions/new?player=${req.player_id}`)
              }}
              style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '8px', border: 'none', background: '#00FF9F', color: '#0E0E0F', fontWeight: 700, cursor: 'pointer' }}>
              Schedule
            </button>
            <button
              onClick={() => dismissRequest(req.id)}
              disabled={dismissingRequest === req.id}
              style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '8px', border: '1px solid #2A2A2D', background: 'transparent', color: '#9A9A9F', cursor: 'pointer' }}>
              {dismissingRequest === req.id ? '...' : 'Dismiss'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )}
  {/* BROADCAST EMAIL */}
  {broadcastEmailOpen && (
        <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff' }}>Email All Players and Parents</div>
              <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>
                {players.filter(p => p.parent_email && (getStatus(p.id) === 'active' || getStatus(p.id) === 'at-risk')).length} parents with email on file
              </div>
            </div>
            <button onClick={() => { setBroadcastEmailOpen(false); setBroadcastBody(''); setBroadcastSubject(''); setBroadcastResults([]) }} style={{ background: 'none', border: 'none', color: '#9A9A9F', cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}>×</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input
              type="text"
              placeholder="Subject: Update from your trainer"
              value={broadcastSubject}
              onChange={e => setBroadcastSubject(e.target.value)}
              style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }}
            />
            <textarea
              placeholder="Write your update — going out of town, schedule changes, new availability, etc..."
              value={broadcastBody}
              onChange={e => setBroadcastBody(e.target.value)}
              rows={4}
              style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%', resize: 'vertical' as const, fontFamily: 'sans-serif' }}
            />
            {broadcastResults.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {broadcastResults.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                    <span style={{ color: r.success ? '#00FF9F' : '#E03131' }}>{r.success ? '✓' : '✕'}</span>
                    <span style={{ color: '#9A9A9F' }}>{r.name}</span>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={sendBroadcastEmail}
              disabled={sendingBroadcast || !broadcastBody.trim()}
              style={{ background: broadcastBody.trim() ? '#00FF9F' : '#2A2A2D', color: broadcastBody.trim() ? '#0E0E0F' : '#9A9A9F', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '14px', fontWeight: 700, cursor: broadcastBody.trim() ? 'pointer' : 'default' }}>
              {sendingBroadcast ? 'Sending...' : `Send to ${players.filter(p => p.parent_email && (getStatus(p.id) === 'active' || getStatus(p.id) === 'at-risk')).length} parents`}
            </button>
          </div>
        </div>
      )}
  {/* UNLOGGED PANEL */}
  {showUnlogged && unloggedSessions.length > 0 && (
    <div style={{ background: '#1A1A1C', border: '1px solid rgba(224,49,49,0.3)', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(224,49,49,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#E03131', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Unlogged sessions ({unloggedSessions.length})
        </span>
        <button onClick={() => setShowUnlogged(false)} style={{ background: 'none', border: 'none', color: '#9A9A9F', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}>×</button>
      </div>
      {unloggedSessions.map((session, i) => {
        const sessionPlayers = session.group_id
          ? players.filter(p => p.group_id === session.group_id)
          : allSessionPlayers
              .filter(sp => sp.session_id === session.id)
              .map(sp => players.find(p => p.id === sp.player_id))
              .filter(Boolean) as Player[]
        return (
          <div key={session.id} style={{ padding: '12px 16px', borderBottom: i < unloggedSessions.length - 1 ? '1px solid #2A2A2D' : 'none', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '14px', fontWeight: 500, color: '#ffffff' }}>{session.title}</div>
              <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>
                {new Date(session.session_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                {session.groups?.name && <span style={{ color: '#00FF9F' }}> · {session.groups.name}</span>}
                {!session.groups?.name && sessionPlayers.length > 0 && (
                  <span> · {sessionPlayers.map(p => p.full_name.split(' ')[0]).join(', ')}</span>
                )}
              </div>
            </div>
            <button
              onClick={() => {
                if (session.group_id) {
                  router.push(`/dashboard/sessions/${session.id}/log`)
                } else if (sessionPlayers.length === 1) {
                  router.push(`/dashboard/players/${sessionPlayers[0].id}/log?sessionId=${session.id}`)
                } else if (sessionPlayers.length > 1) {
                  router.push(`/dashboard/players/${sessionPlayers[0].id}/log?also=${sessionPlayers.slice(1).map(p => p.id).join(',')}&sessionId=${session.id}`)
                } else {
                  router.push(`/dashboard/sessions/${session.id}/log`)
                }
              }}
              style={{ fontSize: '12px', padding: '6px 14px', borderRadius: '8px', border: 'none', background: '#E03131', color: '#ffffff', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
              Log now
            </button>
          </div>
        )
      })}
    </div>
  )}
</div>

{/* TODAY'S SESSIONS */}
{todaySessions.length > 0 && (
  <div id="todays-sessions" style={{ marginBottom: '20px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00FF9F' }} />
      <span style={{ fontSize: '12px', fontWeight: 600, color: '#00FF9F', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Today&apos;s sessions</span>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {todaySessions.map(session => {
       const sessionPlayers = session.group_id
       ? players.filter(p => p.group_id === session.group_id)
       : allSessionPlayers
         .filter(sp => sp.session_id === session.id)
         .map(sp => players.find(p => p.id === sp.player_id))
         .filter(Boolean) as Player[]
         const { isPast, isLogged } = getSessionDisplayState(session)
         return (
          <div key={session.id} style={{ background: isPast ? 'rgba(154,154,159,0.05)' : 'rgba(0,255,159,0.05)', border: `1px solid ${isPast ? 'rgba(154,154,159,0.2)' : 'rgba(0,255,159,0.25)'}`, borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '14px' }}>

            {/* TIME + MODIFY */}
            <div style={{ textAlign: 'center', flexShrink: 0, minWidth: '44px', position: 'relative' }}>
              <div style={{ fontSize: '13px', fontFamily: 'monospace', fontWeight: 700, color: isPast ? '#9A9A9F' : '#ffffff', lineHeight: 1, marginBottom: '4px' }}>
                {session.session_time ? formatTime(session.session_time) : '—'}
              </div>
              <button
                onClick={() => setRescheduleOpen(rescheduleOpen === session.id ? null : session.id)}
                style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', border: '1px solid #2A2A2D', background: 'transparent', color: '#9A9A9F', cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
                Modify
              </button>
              {rescheduleOpen === session.id && (
                <div style={{ position: 'absolute', left: 0, top: '100%', marginTop: '4px', background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '10px', padding: '8px', zIndex: 50, minWidth: '140px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                  <button
                    onClick={() => setRescheduleOpen(`reschedule-${session.id}`)}
                    style={{ width: '100%', padding: '8px 12px', textAlign: 'left' as const, background: 'none', border: 'none', color: '#ffffff', fontSize: '13px', cursor: 'pointer', borderRadius: '6px' }}>
                    Reschedule
                  </button>
                  <button
                    onClick={async () => {
                      const supabaseClient = createClient()
                      await supabaseClient.from('sessions').update({ status: 'cancelled' }).eq('id', session.id)
                      setRescheduleOpen(null)
                      router.refresh()
                    }}
                    style={{ width: '100%', padding: '8px 12px', textAlign: 'left' as const, background: 'none', border: 'none', color: '#E03131', fontSize: '13px', cursor: 'pointer', borderRadius: '6px' }}>
                    Cancel session
                  </button>
                </div>
              )}
              {rescheduleOpen === `reschedule-${session.id}` && (
                <div style={{ position: 'absolute', left: 0, top: '100%', marginTop: '4px', background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '10px', padding: '16px', zIndex: 50, minWidth: '220px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                  <div style={{ fontSize: '12px', color: '#9A9A9F', marginBottom: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pick new date & time</div>
                  <input type="date" defaultValue={session.session_date} id={`today-date-${session.id}`} style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '8px 12px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%', marginBottom: '8px' }} />
                  <input type="time" defaultValue={session.session_time || ''} id={`today-time-${session.id}`} style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '8px 12px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%', marginBottom: '10px' }} />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={async () => {
                        const dateInput = document.getElementById(`today-date-${session.id}`) as HTMLInputElement
                        const timeInput = document.getElementById(`today-time-${session.id}`) as HTMLInputElement
                        if (!dateInput?.value) return
                        const supabaseClient = createClient()
                        await supabaseClient.from('sessions').update({ session_date: dateInput.value, session_time: timeInput?.value || null }).eq('id', session.id)
                        setRescheduleOpen(null)
                        router.refresh()
                      }}
                      style={{ flex: 1, background: '#00FF9F', color: '#0E0E0F', border: 'none', borderRadius: '8px', padding: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                      Save
                    </button>
                    <button
                      onClick={() => setRescheduleOpen(null)}
                      style={{ flex: 1, background: 'transparent', color: '#9A9A9F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '8px', fontSize: '13px', cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* DIVIDER */}
            <div style={{ width: '1px', height: '36px', background: isPast ? 'rgba(154,154,159,0.2)' : 'rgba(0,255,159,0.2)', flexShrink: 0 }} />

            {/* NAME */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {session.groups?.name
                ? <span onClick={() => router.push(`/dashboard/groups/${session.group_id}`)} style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff', cursor: 'pointer' }}>{session.groups.name}</span>
                : sessionPlayers.length > 0
                  ? <span>{sessionPlayers.map((p, i) => (
                      <span key={p.id}>
                        <span onClick={() => router.push(`/dashboard/players/${p.id}`)} style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff', cursor: 'pointer' }}>{p.full_name}</span>
                        {i < sessionPlayers.length - 1 ? ', ' : ''}
                      </span>
                    ))}</span>
                  : <span style={{ fontSize: '15px', color: '#9A9A9F' }}>No players linked</span>}
              {isPast && (
                <span style={{ marginLeft: '8px', fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '99px', background: isLogged ? 'rgba(154,154,159,0.15)' : 'rgba(224,49,49,0.15)', color: isLogged ? '#9A9A9F' : '#E03131' }}>
                  {isLogged ? 'Logged' : 'Not logged'}
                </span>
              )}
            </div>

            {/* LOG BUTTON */}
            <button
              onClick={() => {
                if (isLogged) return
                if (session.group_id) {
                  router.push(`/dashboard/sessions/${session.id}/log`)
                } else if (sessionPlayers.length === 1) {
                  router.push(`/dashboard/players/${sessionPlayers[0].id}/log?sessionId=${session.id}`)
                } else if (sessionPlayers.length > 1) {
                  router.push(`/dashboard/players/${sessionPlayers[0].id}/log?also=${sessionPlayers.slice(1).map(p => p.id).join(',')}&sessionId=${session.id}`)
                } else {
                  router.push(`/dashboard/sessions/${session.id}/log`)
                }
              }}
              style={{ fontSize: '12px', padding: '7px 14px', borderRadius: '8px', border: 'none', background: isLogged ? '#2A2A2D' : isPast ? '#E03131' : '#00FF9F', color: isLogged ? '#9A9A9F' : '#0E0E0F', fontWeight: 700, cursor: isLogged ? 'default' : 'pointer', flexShrink: 0 }}>
              {isLogged ? '✓ Logged' : 'Log session'}
            </button>

            
          </div>
         
          )
        })}
  </div>
</div>
)}

{/* UPCOMING SESSIONS */}
{upcomingSessions.length > 0 && (
  <div style={{ marginBottom: '20px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
      <div style={{ fontSize: '12px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Upcoming</div>
      {upcomingSessions.length > 3 && (
        <button
          onClick={() => setShowAllUpcoming(!showAllUpcoming)}
          style={{ fontSize: '12px', color: '#00FF9F', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, padding: '0' }}>
          {showAllUpcoming ? 'Show less' : `See all (${upcomingSessions.length})`}
        </button>
      )}
    </div>
    <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', overflow: 'hidden' }}>
      {(showAllUpcoming ? upcomingSessions : upcomingSessions.slice(0, 3)).map((session, i) => {
        const visibleSessions = showAllUpcoming ? upcomingSessions : upcomingSessions.slice(0, 3)
        return (
          <div key={session.id} style={{ padding: '11px 16px', borderBottom: i < visibleSessions.length - 1 ? '1px solid #2A2A2D' : 'none', display: 'flex', alignItems: 'center', gap: '12px' }}>

          {/* DATE */}
          <div style={{ textAlign: 'center' as const, flexShrink: 0, minWidth: '32px' }}>
            <div style={{ fontSize: '10px', color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1 }}>
              {new Date(session.session_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
            </div>
            <div style={{ fontSize: '20px', fontFamily: 'monospace', fontWeight: 700, color: '#ffffff', lineHeight: 1.1 }}>
              {new Date(session.session_date + 'T00:00:00').getDate()}
            </div>
          </div>

          {/* TIME + MODIFY */}
          <div style={{ textAlign: 'center' as const, flexShrink: 0, position: 'relative' }}>
            <div style={{ fontSize: '12px', color: '#ffffff', fontWeight: 600, marginBottom: '3px' }}>
              {session.session_time ? formatTime(session.session_time) : '—'}
            </div>
            <button
              onClick={() => setRescheduleOpen(rescheduleOpen === session.id ? null : session.id)}
              style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', border: '1px solid #2A2A2D', background: 'transparent', color: '#9A9A9F', cursor: 'pointer' }}>
              Modify
            </button>
            {rescheduleOpen === session.id && (
              <div style={{ position: 'absolute', left: 0, top: '100%', marginTop: '4px', background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '10px', padding: '8px', zIndex: 50, minWidth: '140px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                <button
                  onClick={() => setRescheduleOpen(`reschedule-${session.id}`)}
                  style={{ width: '100%', padding: '8px 12px', textAlign: 'left' as const, background: 'none', border: 'none', color: '#ffffff', fontSize: '13px', cursor: 'pointer', borderRadius: '6px' }}>
                  Reschedule
                </button>
                <button
                  onClick={async () => {
                    const supabaseClient = createClient()
                    await supabaseClient.from('sessions').update({ status: 'cancelled' }).eq('id', session.id)
                    setRescheduleOpen(null)
                    router.refresh()
                  }}
                  style={{ width: '100%', padding: '8px 12px', textAlign: 'left' as const, background: 'none', border: 'none', color: '#E03131', fontSize: '13px', cursor: 'pointer', borderRadius: '6px' }}>
                  Cancel session
                </button>
              </div>
            )}
            {rescheduleOpen === `reschedule-${session.id}` && (
              <div style={{ position: 'absolute', left: 0, top: '100%', marginTop: '4px', background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '10px', padding: '16px', zIndex: 50, minWidth: '220px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                <div style={{ fontSize: '12px', color: '#9A9A9F', marginBottom: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pick new date & time</div>
                <input type="date" defaultValue={session.session_date} id={`upcoming-date-${session.id}`} style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '8px 12px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%', marginBottom: '8px' }} />
                <input type="time" defaultValue={session.session_time || ''} id={`upcoming-time-${session.id}`} style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '8px 12px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%', marginBottom: '10px' }} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={async () => {
                      const dateInput = document.getElementById(`upcoming-date-${session.id}`) as HTMLInputElement
                      const timeInput = document.getElementById(`upcoming-time-${session.id}`) as HTMLInputElement
                      if (!dateInput?.value) return
                      const supabaseClient = createClient()
                      await supabaseClient.from('sessions').update({ session_date: dateInput.value, session_time: timeInput?.value || null }).eq('id', session.id)
                      setRescheduleOpen(null)
                      router.refresh()
                    }}
                    style={{ flex: 1, background: '#00FF9F', color: '#0E0E0F', border: 'none', borderRadius: '8px', padding: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                    Save
                  </button>
                  <button
                    onClick={() => setRescheduleOpen(null)}
                    style={{ flex: 1, background: 'transparent', color: '#9A9A9F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '8px', fontSize: '13px', cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* DIVIDER */}
          <div style={{ width: '1px', height: '30px', background: '#2A2A2D', flexShrink: 0 }} />

          {/* NAME */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {session.groups?.name
              ? <span onClick={() => router.push(`/dashboard/groups/${session.group_id}`)} style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff', cursor: 'pointer' }}>{session.groups.name}</span>
              : (() => {
                  const upcomingPlayers = allSessionPlayers
                    .filter(sp => sp.session_id === session.id)
                    .map(sp => players.find(p => p.id === sp.player_id))
                    .filter(Boolean) as Player[]
                  return upcomingPlayers.length > 0
                    ? <span>{upcomingPlayers.map((p, j) => (
                        <span key={p.id}>
                          <span onClick={() => router.push(`/dashboard/players/${p.id}`)} style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff', cursor: 'pointer' }}>{p.full_name}</span>
                          {j < upcomingPlayers.length - 1 ? ', ' : ''}
                        </span>
                      ))}</span>
                    : <span style={{ fontSize: '14px', color: '#9A9A9F' }}>Individual session</span>
                })()}
            {session.type === 'recurring' && (
              <span style={{ marginLeft: '8px', fontSize: '10px', background: 'rgba(0,255,159,0.12)', color: '#00FF9F', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>Recurring</span>
            )}
          </div>
        </div>
     )
    })}
  </div>
</div>
)}



{/* ACTIVATION CHECKLIST */}
{(() => {
  const hasPlayer = players.length > 0
  const hasScheduled = todaySessions.length > 0 || upcomingSessions.length > 0
  const hasLoggedSession = sessions.some(s => s.player_id !== null)
  const hasAiRecap = sessions.some(s => s.player_id !== null && (s as { feedback?: string | null }).feedback)


  const steps = [
    {
      key: 'player',
      title: 'Add your first player',
      desc: 'Build your roster by adding a player to the app',
      done: hasPlayer,
      action: () => router.push('/dashboard/players/new'),
    },
    {
      key: 'schedule',
      title: 'Schedule a session',
      desc: 'Set up an upcoming training session',
      done: hasScheduled,
      action: () => router.push('/dashboard/sessions/new'),
    },
    {
      key: 'log',
      title: 'Log your first session',
      desc: 'Record what happened after a training session',
      done: hasLoggedSession,
      action: () => players.length > 0 ? router.push(`/dashboard/players/${players[0].id}/log`) : router.push('/dashboard/players/new'),
    },
    {
      key: 'ai',
      title: 'Generate an AI parent recap',
      desc: 'Let AI write a personalized parent update after a session',
      done: hasAiRecap,
      action: () => players.length > 0 ? router.push(`/dashboard/players/${players[0].id}/log`) : router.push('/dashboard/players/new'),
    },
    
  ]

  const completedCount = steps.filter(s => s.done).length
  const allDone = completedCount === steps.length

  if (allDone) return null

  return (
    <div style={{ background: 'rgba(0,255,159,0.04)', border: '1px solid rgba(0,255,159,0.2)', borderRadius: '16px', padding: '24px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <div style={{ fontSize: '15px', fontWeight: 700, color: '#00FF9F', fontFamily: '"Exo 2", sans-serif' }}>Getting started 👋</div>
        <div style={{ fontSize: '13px', color: '#9A9A9F' }}>{completedCount} of {steps.length} complete</div>
      </div>
      <div style={{ height: '4px', background: '#2A2A2D', borderRadius: '99px', overflow: 'hidden', marginBottom: '20px' }}>
        <div style={{ height: '100%', width: `${(completedCount / steps.length) * 100}%`, background: '#00FF9F', borderRadius: '99px', transition: 'width 0.4s ease' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {steps.map(s => (
          <div
            key={s.key}
            onClick={!s.done && s.action ? () => s.action!() : undefined}
            style={{ display: 'flex', alignItems: 'center', gap: '14px', background: s.done ? 'rgba(0,255,159,0.04)' : '#1A1A1C', borderRadius: '10px', padding: '14px 16px', cursor: !s.done && s.action !== null ? 'pointer' : 'default', border: `1px solid ${s.done ? 'rgba(0,255,159,0.15)' : '#2A2A2D'}`, opacity: s.done ? 0.6 : 1 }}>
            <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: s.done ? '#00FF9F' : '#2A2A2D', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {s.done ? (
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <polyline points="2,5.5 4.5,8 9,3" stroke="#0E0E0F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#9A9A9F' }} />
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: s.done ? '#9A9A9F' : '#ffffff', textDecoration: s.done ? 'line-through' : 'none' }}>{s.title}</div>
              {!s.done && <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>{s.desc}</div>}
            </div>
            {!s.done && s.action !== null && <div style={{ color: '#00FF9F', fontSize: '16px', flexShrink: 0 }}>→</div>}
          </div>
        ))}
      </div>
    </div>
  )
})()}

{/* MY GROUPS */}
{groups.length > 0 && (
          <div id="my-groups" style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '20px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>My groups</div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' as const }}>
              {groups.map(group => (
                <div key={group.id} style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px', minWidth: '180px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(0,255,159,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>
                    {group.sport === 'basketball' ? '🏀' : group.sport === 'soccer' ? '⚽' : group.sport === 'football' ? '🏈' : group.sport === 'baseball' ? '⚾' : group.sport === 'tennis' ? '🎾' : group.sport === 'volleyball' ? '🏐' : group.sport === 'golf' ? '⛳' : '🏆'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff', marginBottom: '2px' }}>{group.name}</div>
                    <div style={{ fontSize: '12px', color: '#9A9A9F' }}>
                      {players.filter(p => p.group_id === group.id).length} player{players.filter(p => p.group_id === group.id).length !== 1 ? 's' : ''} · {group.session_day || 'No day set'}
                    </div>
                  </div>
                  <button
  onClick={() => router.push(`/dashboard/groups/${group.id}`)}
  style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', border: '1px solid #2A2A2D', background: 'transparent', color: '#00FF9F', cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
  Manage
</button>
                </div>
              ))}
              <div
                onClick={() => router.push('/dashboard/groups/new')}
                style={{ background: 'transparent', border: '1px dashed #2A2A2D', borderRadius: '12px', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '140px', cursor: 'pointer', color: '#9A9A9F', fontSize: '13px', gap: '6px' }}>
                + New group
              </div>
            </div>
          </div>
        )}

     
{/* PLAYER LIST HEADING */}
<div id="my-players" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', marginTop: '8px' }}>
  <h2 style={{ fontFamily: '"Exo 2", sans-serif', fontSize: '20px', fontWeight: 700, color: '#ffffff',textTransform: 'uppercase', margin: 0 }}>My Players</h2>
</div>
        {/* FILTER TABS */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
          <button onClick={() => setActiveFilter('all')} style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid #2A2A2D', background: activeFilter === 'all' ? '#00FF9F' : 'transparent', color: activeFilter === 'all' ? '#0E0E0F' : '#9A9A9F', fontSize: '13px', fontWeight: 500, cursor: 'pointer', flexShrink: 0 }}>
            All ({players.length})
          </button>
          <button onClick={() => setActiveFilter('individual')} style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid #2A2A2D', background: activeFilter === 'individual' ? '#00FF9F' : 'transparent', color: activeFilter === 'individual' ? '#0E0E0F' : '#9A9A9F', fontSize: '13px', fontWeight: 500, cursor: 'pointer', flexShrink: 0 }}>
            Individual ({players.filter(p => !p.group_id).length})
          </button>
          {groups.map(g => (
            <button key={g.id} onClick={() => setActiveFilter(g.id)} style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid #2A2A2D', background: activeFilter === g.id ? '#00FF9F' : 'transparent', color: activeFilter === g.id ? '#0E0E0F' : '#9A9A9F', fontSize: '13px', fontWeight: 500, cursor: 'pointer', flexShrink: 0 }}>
              {g.name} ({players.filter(p => p.group_id === g.id).length})
            </button>
          ))}
          <button onClick={() => router.push('/dashboard/groups/new')} style={{ padding: '7px 14px', borderRadius: '8px', border: '1px dashed #2A2A2D', background: 'transparent', color: '#9A9A9F', fontSize: '13px', cursor: 'pointer', flexShrink: 0 }}>
            + Group
          </button>
        </div>
{/* SEARCH */}
<div style={{ marginBottom: '16px' }}>
  <input
    type="text"
    placeholder="Search players by name or parent email..."
    value={search}
    onChange={e => setSearch(e.target.value)}
    style={{ width: '100%', background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', color: '#ffffff', outline: 'none' }}
  />
</div>
        {/* DESKTOP TABLE */}
        <div className="player-card-grid" style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #2A2A2D', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {activeFilter === 'all' ? 'All players' : activeFilter === 'individual' ? 'Individual' : groups.find(g => g.id === activeFilter)?.name || 'Players'}
            </span>
            <button onClick={() => router.push(`/dashboard/drills/new${activeFilter !== 'all' && activeFilter !== 'individual' ? `?group=${activeFilter}` : ''}`)} style={{ fontSize: '12px', color: '#00FF9F', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
              + Assign drills
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 1fr 1fr 1fr 1fr', gap: '0', padding: '8px 20px', borderBottom: '1px solid #2A2A2D', alignItems: 'center' }}>
            <div />
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em', paddingLeft: '12px' }}>Player</div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' as const }}>Group</div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' as const }}>Last Session</div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' as const }}>Drills</div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em', paddingLeft: '8px' }}>Actions</div>
          </div>
          {filteredPlayers.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: '14px', color: '#9A9A9F', marginBottom: '16px' }}>{players.length === 0 ? 'No players yet' : 'No players in this filter'}</p>
              <button onClick={() => router.push('/dashboard/players/new')} style={{ background: '#00FF9F', color: '#0E0E0F', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Add first player</button>
            </div>
          ) : (
            filteredPlayers.map((player, i) => {
              const status = getStatus(player.id)
              const statusStyle = getStatusStyle(status)
              const lastSession = getLastSession(player.id)
              const days = getDaysSince(lastSession?.session_date || null)
              const group = getGroup(player.group_id)
              const pct = getCompletionPct(player)
              const isCopied = copiedId === player.id
              const isLast = i === filteredPlayers.length - 1
              return (
                <div key={player.id} style={{ display: 'grid', gridTemplateColumns: '36px 1fr 1fr 1fr 1fr 1fr', gap: '0', padding: '12px 20px', borderBottom: isLast ? 'none' : '1px solid #2A2A2D', alignItems: 'center' }}>
                  {/* INITIALS */}
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(0,255,159,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, color: '#00FF9F' }}>{getInitials(player.full_name)}</div>
                  {/* NAME */}
                  <div style={{ paddingLeft: '12px', minWidth: 0 }}>
                    <div onClick={() => router.push(`/dashboard/players/${player.id}`)} style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.2)' }}>{player.full_name}</div>
                  </div>
                  {/* GROUP */}
                  <div style={{ textAlign: 'center' as const }}>
                    {group
                      ? <span style={{ fontSize: '12px', background: '#2A2A2D', padding: '3px 8px', borderRadius: '6px', color: '#9A9A9F', whiteSpace: 'nowrap' as const }}>{group.name}</span>
                      : <span style={{ fontSize: '12px', color: '#9A9A9F' }}>Individual</span>}
                  </div>
                  {/* LAST SESSION */}
                  <div style={{ textAlign: 'center' as const }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: days !== null && days > 30 ? '#E03131' : '#9A9A9F' }}>{formatDaysAgo(days)}</div>
                  </div>
                  {/* DRILLS */}
                  <div style={{ textAlign: 'center' as const }}>
                    {(() => {
                      const counts = getDrillCounts(player)
                      if (!counts) return <span style={{ fontSize: '13px', color: '#9A9A9F' }}>—</span>
                      const pct = Math.round((counts.done / counts.total) * 100)
                      return (
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: counts.done === counts.total ? '#00FF9F' : '#9A9A9F', marginBottom: '4px' }}>{counts.done}/{counts.total}</div>
                          <div style={{ height: '3px', background: '#2A2A2D', borderRadius: '99px', overflow: 'hidden', margin: '0 auto', width: '50px' }}>
                            <div style={{ height: '100%', width: pct + '%', background: counts.done === counts.total ? '#00FF9F' : 'rgba(0,255,159,0.5)', borderRadius: '99px' }} />
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                  {/* ACTIONS */}
                  <div style={{ display: 'flex', gap: '5px', paddingLeft: '8px' }}>
                    <button onClick={() => router.push(`/dashboard/sessions/new?player=${player.id}`)} style={{ fontSize: '11px', padding: '5px 8px', borderRadius: '6px', border: '1px solid rgba(0,255,159,0.4)', background: '#1A1A1C', color: '#ffffff', cursor: 'pointer', whiteSpace: 'nowrap' as const, fontWeight: 500 }}>+ Session</button>
                    <button onClick={() => router.push(`/dashboard/players/${player.id}/log`)} style={{ fontSize: '11px', padding: '5px 8px', borderRadius: '6px', border: '1px solid rgba(0,255,159,0.4)', background: '#1A1A1C', color: '#ffffff', cursor: 'pointer', whiteSpace: 'nowrap' as const, fontWeight: 500 }}>Log Session</button>
                    {player.parent_email && (
                      <button onClick={() => setEmailingPlayer(player)} style={{ fontSize: '11px', padding: '5px 8px', borderRadius: '6px', border: '1px solid rgba(0,255,159,0.4)', background: '#1A1A1C', color: '#ffffff', cursor: 'pointer', whiteSpace: 'nowrap' as const, fontWeight: 500 }}>Email</button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* MOBILE CARDS */}
        <div className="player-cards" style={{ flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {filteredPlayers.length} player{filteredPlayers.length !== 1 ? 's' : ''}
            </span>
            <button onClick={() => router.push(`/dashboard/drills/new${activeFilter !== 'all' && activeFilter !== 'individual' ? `?group=${activeFilter}` : ''}`)} style={{ fontSize: '12px', color: '#00FF9F', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
              + Assign drills
            </button>
          </div>

          {filteredPlayers.length === 0 ? (
            <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '32px 16px', textAlign: 'center' }}>
              <p style={{ fontSize: '14px', color: '#9A9A9F', marginBottom: '16px' }}>{players.length === 0 ? 'No players yet' : 'No players in this filter'}</p>
              <button onClick={() => router.push('/dashboard/players/new')} style={{ background: '#00FF9F', color: '#0E0E0F', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Add first player</button>
            </div>
          ) : (
            filteredPlayers.map(player => {
              const status = getStatus(player.id)
              const statusStyle = getStatusStyle(status)
              const lastSession = getLastSession(player.id)
              const days = getDaysSince(lastSession?.session_date || null)
              const group = getGroup(player.group_id)
              const pct = getCompletionPct(player)
              const isCopied = copiedId === player.id
              return (
                <div key={player.id} style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {/* INITIALS */}
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(0,255,159,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, color: '#00FF9F', flexShrink: 0 }}>{getInitials(player.full_name)}</div>
                  {/* NAME */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div onClick={() => router.push(`/dashboard/players/${player.id}`)} style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{player.full_name}</div>
                    <div style={{ fontSize: '11px', color: '#9A9A9F', marginTop: '1px' }}>{group ? group.name : 'Individual'}</div>
                  </div>
                  {/* LAST SESSION */}
                  <div style={{ textAlign: 'center' as const, flexShrink: 0, minWidth: '40px' }}>
                    <div style={{ fontSize: '9px', color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Last</div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: days !== null && days > 30 ? '#E03131' : '#ffffff' }}>{formatDaysAgo(days)}</div>
                  </div>
                  {/* DRILLS */}
                  <div style={{ textAlign: 'center' as const, flexShrink: 0, minWidth: '36px' }}>
                    <div style={{ fontSize: '9px', color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Drills</div>
                    {(() => {
                      const counts = getDrillCounts(player)
                      if (!counts) return <span style={{ fontSize: '11px', color: '#9A9A9F' }}>—</span>
                      const pct = Math.round((counts.done / counts.total) * 100)
                      return (
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: 600, color: counts.done === counts.total ? '#00FF9F' : '#ffffff', marginBottom: '2px' }}>{counts.done}/{counts.total}</div>
                          <div style={{ height: '2px', background: '#2A2A2D', borderRadius: '99px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: pct + '%', background: counts.done === counts.total ? '#00FF9F' : 'rgba(0,255,159,0.5)', borderRadius: '99px' }} />
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                  {/* ACTIONS — stacked vertically */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                    <button onClick={() => router.push(`/dashboard/sessions/new?player=${player.id}`)} style={{ fontSize: '10px', padding: '4px 7px', borderRadius: '5px', border: '1px solid rgba(0,255,159,0.4)', background: '#1A1A1C', color: '#ffffff', cursor: 'pointer', whiteSpace: 'nowrap' as const, fontWeight: 500 }}>+ Session</button>
                    <button onClick={() => router.push(`/dashboard/players/${player.id}/log`)} style={{ fontSize: '10px', padding: '4px 7px', borderRadius: '5px', border: '1px solid rgba(0,255,159,0.4)', background: '#1A1A1C', color: '#ffffff', cursor: 'pointer', whiteSpace: 'nowrap' as const, fontWeight: 500 }}>Log</button>
                    {player.parent_email && (
                      <button onClick={() => setEmailingPlayer(player)} style={{ fontSize: '10px', padding: '4px 7px', borderRadius: '5px', border: '1px solid rgba(0,255,159,0.4)', background: '#1A1A1C', color: '#ffffff', cursor: 'pointer', fontWeight: 500 }}>✉ Email</button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        </div>
{/* ONBOARDING QUESTIONNAIRE */}
{showOnboarding && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '16px' }}>
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '480px' }}>

            {/* HEADER */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#00FF9F', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                {onboardingStep + 1} of 4
              </div>
              <div style={{ height: '3px', background: '#2A2A2D', borderRadius: '99px', overflow: 'hidden', marginBottom: '20px' }}>
                <div style={{ height: '100%', width: `${((onboardingStep + 1) / 4) * 100}%`, background: '#00FF9F', borderRadius: '99px', transition: 'width 0.3s ease' }} />
              </div>

              {onboardingStep === 0 && (
                <>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff', fontFamily: '"Exo 2", sans-serif', marginBottom: '6px' }}>How many athletes do you train?</div>
                  <div style={{ fontSize: '14px', color: '#9A9A9F' }}>Helps us tailor the experience for your roster size</div>
                </>
              )}
              {onboardingStep === 1 && (
                <>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff', fontFamily: '"Exo 2", sans-serif', marginBottom: '6px' }}>How do you currently communicate with parents?</div>
                  <div style={{ fontSize: '14px', color: '#9A9A9F' }}>What's your go-to right now?</div>
                </>
              )}
              {onboardingStep === 2 && (
                <>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff', fontFamily: '"Exo 2", sans-serif', marginBottom: '6px' }}>What's your biggest challenge?</div>
                  <div style={{ fontSize: '14px', color: '#9A9A9F' }}>We'll focus on solving this for you first</div>
                </>
              )}
              {onboardingStep === 3 && (
                <>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff', fontFamily: '"Exo 2", sans-serif', marginBottom: '6px' }}>How did you hear about us?</div>
                  <div style={{ fontSize: '14px', color: '#9A9A9F' }}>Just so we know where to focus</div>
                </>
              )}
            </div>

            {/* OPTIONS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
              {onboardingStep === 0 && ['1–10', '11–20', '21–40', '40+'].map(opt => (
                <button key={opt} onClick={() => setOnboardingAnswers(prev => ({ ...prev, athlete_count: opt }))}
                  style={{ padding: '14px 16px', borderRadius: '10px', border: `1px solid ${onboardingAnswers.athlete_count === opt ? '#00FF9F' : '#2A2A2D'}`, background: onboardingAnswers.athlete_count === opt ? 'rgba(0,255,159,0.08)' : '#0E0E0F', color: onboardingAnswers.athlete_count === opt ? '#00FF9F' : '#ffffff', fontSize: '15px', fontWeight: 500, cursor: 'pointer', textAlign: 'left' as const, transition: 'all 0.15s' }}>
                  {opt} athletes
                </button>
              ))}

              {onboardingStep === 1 && (
                <>
                  {['Text message', 'Email', 'Google Sheets', 'Other'].map(opt => (
                    <button key={opt} onClick={() => setOnboardingAnswers(prev => ({ ...prev, parent_comms: opt.toLowerCase().replace(' ', '_') }))}
                      style={{ padding: '14px 16px', borderRadius: '10px', border: `1px solid ${onboardingAnswers.parent_comms === opt.toLowerCase().replace(' ', '_') ? '#00FF9F' : '#2A2A2D'}`, background: onboardingAnswers.parent_comms === opt.toLowerCase().replace(' ', '_') ? 'rgba(0,255,159,0.08)' : '#0E0E0F', color: onboardingAnswers.parent_comms === opt.toLowerCase().replace(' ', '_') ? '#00FF9F' : '#ffffff', fontSize: '15px', fontWeight: 500, cursor: 'pointer', textAlign: 'left' as const, transition: 'all 0.15s' }}>
                      {opt}
                    </button>
                  ))}
                  {onboardingAnswers.parent_comms === 'other' && (
                    <input
                      type="text"
                      placeholder="Which tool do you use?"
                      value={onboardingAnswers.other_comms}
                      onChange={e => setOnboardingAnswers(prev => ({ ...prev, other_comms: e.target.value }))}
                      style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '10px', padding: '14px 16px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }}
                    />
                  )}
                </>
              )}

              {onboardingStep === 2 && ['Keeping athletes engaged between sessions', 'Parent communication', 'Scheduling sessions', 'Getting repeat bookings'].map(opt => (
                <button key={opt} onClick={() => setOnboardingAnswers(prev => ({ ...prev, challenge: opt }))}
                  style={{ padding: '14px 16px', borderRadius: '10px', border: `1px solid ${onboardingAnswers.challenge === opt ? '#00FF9F' : '#2A2A2D'}`, background: onboardingAnswers.challenge === opt ? 'rgba(0,255,159,0.08)' : '#0E0E0F', color: onboardingAnswers.challenge === opt ? '#00FF9F' : '#ffffff', fontSize: '15px', fontWeight: 500, cursor: 'pointer', textAlign: 'left' as const, transition: 'all 0.15s' }}>
                  {opt}
                </button>
              ))}

              {onboardingStep === 3 && ['Instagram', 'Website', 'Word of mouth', 'Other'].map(opt => (
                <button key={opt} onClick={() => setOnboardingAnswers(prev => ({ ...prev, referral: opt }))}
                  style={{ padding: '14px 16px', borderRadius: '10px', border: `1px solid ${onboardingAnswers.referral === opt ? '#00FF9F' : '#2A2A2D'}`, background: onboardingAnswers.referral === opt ? 'rgba(0,255,159,0.08)' : '#0E0E0F', color: onboardingAnswers.referral === opt ? '#00FF9F' : '#ffffff', fontSize: '15px', fontWeight: 500, cursor: 'pointer', textAlign: 'left' as const, transition: 'all 0.15s' }}>
                  {opt}
                </button>
              ))}
            </div>

            {/* FOOTER */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button
                onClick={() => submitOnboarding(true)}
                style={{ fontSize: '13px', color: '#9A9A9F', background: 'none', border: 'none', cursor: 'pointer', padding: '0' }}>
                Skip for now
              </button>
              <button
                onClick={() => {
                  if (onboardingStep < 3) {
                    setOnboardingStep(prev => prev + 1)
                  } else {
                    submitOnboarding(false)
                  }
                }}
                disabled={savingOnboarding}
                style={{ background: '#00FF9F', color: '#0E0E0F', border: 'none', borderRadius: '10px', padding: '12px 28px', fontSize: '15px', fontWeight: 700, cursor: 'pointer' }}>
                {savingOnboarding ? 'Saving...' : onboardingStep < 3 ? 'Next →' : 'Finish'}
              </button>
            </div>

          </div>
        </div>
      )}
{/* QUICK EMAIL MODAL */}
{emailingPlayer && (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
    <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '480px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>Email parent</div>
          <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>To: {emailingPlayer.parent_email}</div>
        </div>
        <button onClick={() => { setEmailingPlayer(null); setQuickEmailSubject(''); setQuickEmailBody(''); setQuickEmailSent(false) }} style={{ background: 'none', border: 'none', color: '#9A9A9F', cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}>×</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <input
          type="text"
          placeholder={`Subject: Update about ${emailingPlayer.full_name.split(' ')[0]}`}
          value={quickEmailSubject}
          onChange={e => setQuickEmailSubject(e.target.value)}
          style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }}
        />
        <textarea
          placeholder="Write your message to the parent..."
          value={quickEmailBody}
          onChange={e => setQuickEmailBody(e.target.value)}
          rows={5}
          style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%', resize: 'vertical' as const, fontFamily: 'sans-serif' }}
        />
        <button
          onClick={sendQuickEmail}
          disabled={sendingQuickEmail || !quickEmailBody.trim()}
          style={{ background: quickEmailSent ? '#2A2A2D' : quickEmailBody.trim() ? '#00FF9F' : '#2A2A2D', color: quickEmailSent ? '#9A9A9F' : quickEmailBody.trim() ? '#0E0E0F' : '#9A9A9F', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '14px', fontWeight: 700, cursor: quickEmailBody.trim() ? 'pointer' : 'default' }}>
          {quickEmailSent ? '✓ Sent!' : sendingQuickEmail ? 'Sending...' : 'Send email'}
        </button>
      </div>
    </div>
  </div>
)}
</div>
)
}
