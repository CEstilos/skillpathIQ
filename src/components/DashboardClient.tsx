'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import NavBar from '@/components/NavBar'

interface Profile { id: string; full_name: string; email: string; primary_sport?: string }
interface Player { id: string; full_name: string; parent_email: string; group_id: string | null; trainer_id: string; created_at: string }
interface Group { id: string; name: string; sport: string; session_day: string; session_time: string }
interface Session { id: string; player_id: string; session_date: string; notes: string | null }
interface ScheduledSession { id: string; title: string; session_date: string; session_time: string; type: string; group_id: string | null; status?: string; rescheduled_date?: string | null; groups?: { name: string; sport: string } }
interface DrillWeek { id: string; group_id: string | null; player_id: string | null; title: string; week_start: string }
interface Drill { id: string; drill_week_id: string; title: string }
interface Completion { id: string; player_id: string; drill_id: string }
interface SessionPlayer { session_id: string; player_id: string }

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
}

export default function DashboardClient({ profile, players, groups, sessions, drillWeeks, drills, completions, todaySessions, upcomingSessions, allSessionPlayers }: Props) {
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

  const [sessionStatuses, setSessionStatuses] = useState<Record<string, string>>({})
const [rescheduleOpen, setRescheduleOpen] = useState<string | null>(null)
const [rescheduleDate, setRescheduleDate] = useState('')
const [rescheduleTime, setRescheduleTime] = useState('')
const [actionLoading, setActionLoading] = useState<string | null>(null)
  
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
      .update({ status: 'rescheduled', rescheduled_date: rescheduleDate, session_time: rescheduleTime || undefined })
      .eq('id', sessionId)
    setSessionStatuses(prev => ({ ...prev, [sessionId]: 'rescheduled' }))
    setRescheduleOpen(null)
    setActionLoading(null)
  }
  
  function getSessionStatus(session: ScheduledSession) {
    return sessionStatuses[session.id] || session.status || 'scheduled'
  }
  
  function SessionActionButtons({ session }: { session: ScheduledSession }) {
    const status = getSessionStatus(session)
    const isOpen = rescheduleOpen === session.id
    const btnStyle = { fontSize: '11px', padding: '4px 10px', borderRadius: '6px', border: '1px solid #2A2A2D', background: 'transparent', cursor: 'pointer', whiteSpace: 'nowrap' as const }
  
    if (status === 'cancelled') return (
      <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', background: 'rgba(224,49,49,0.1)', color: '#E03131', border: '1px solid rgba(224,49,49,0.3)', fontWeight: 600 }}>
        Cancelled
      </span>
    )
  
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' as const, justifyContent: 'flex-end' }}>
         
          <button
            onClick={() => { setRescheduleOpen(isOpen ? null : session.id); setRescheduleDate(session.rescheduled_date || session.session_date); setRescheduleTime(session.session_time || '') }}
            style={{ ...btnStyle, color: '#F5A623' }}>
            ↷ Reschedule
          </button>
          <button
            onClick={() => cancelSession(session.id)}
            disabled={actionLoading === session.id + '_cancel'}
            style={{ ...btnStyle, color: '#E03131' }}>
            {actionLoading === session.id + '_cancel' ? '...' : '✕ Cancel'}
          </button>
        </div>
  
        {isOpen && (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' as const }}>
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
  return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', fontFamily: 'sans-serif', overflowX: 'hidden', maxWidth: '100vw', width: '100%' }}>

<style>{`
  * { box-sizing: border-box; margin: 0; padding: 0; }
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
{/* TODAY'S SESSIONS */}
{todaySessions.length > 0 && (
  <div style={{ marginBottom: '20px' }}>
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
        return (
          <div key={session.id} style={{ background: 'rgba(0,255,159,0.05)', border: '1px solid rgba(0,255,159,0.25)', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' as const }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff', marginBottom: '4px' }}>{session.title}</div>
              <div style={{ fontSize: '13px', color: '#9A9A9F' }}>
                {session.groups?.name && <span>{session.groups.name} · </span>}
                {session.session_time && <span>{formatTime(session.session_time)} · </span>}
                {sessionPlayers.length > 0 ? (
  <span>
    {sessionPlayers.map((p, i) => (
      <span key={p.id}>
        <span
          onClick={() => router.push(`/dashboard/players/${p.id}`)}
          style={{ color: '#00FF9F', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(0,255,159,0.4)' }}>
          {p.full_name}
        </span>
        {i < sessionPlayers.length - 1 ? ', ' : ''}
      </span>
    ))}
  </span>
) : <span>Individual session</span>}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end', flexShrink: 0 }}>
  <div style={{ display: 'flex', gap: '8px' }}>
    <button
      onClick={() => {
        if (sessionPlayers.length === 1) {
          router.push(`/dashboard/players/${sessionPlayers[0].id}/log`)
        } else if (sessionPlayers.length > 1) {
          router.push(`/dashboard/players/${sessionPlayers[0].id}/log`)
        } else {
          router.push(`/dashboard/sessions/${session.id}/log`)
        }
      }}
      style={{ fontSize: '13px', padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#00FF9F', color: '#0E0E0F', fontWeight: 600, cursor: 'pointer' }}>
      Log session
    </button>
    {session.group_id && (
      <button
        onClick={() => router.push(`/dashboard/drills/new?group=${session.group_id}`)}
        style={{ fontSize: '13px', padding: '8px 16px', borderRadius: '8px', border: '1px solid #2A2A2D', background: 'transparent', color: '#9A9A9F', cursor: 'pointer' }}>
        Assign drills
      </button>
    )}
  </div>
  <SessionActionButtons session={session} />
</div>
          </div>
        )
      })}
    </div>
  </div>
)}

{/* UPCOMING SESSIONS */}
{upcomingSessions.length > 0 && (
  <div style={{ marginBottom: '20px' }}>
    <div style={{ fontSize: '12px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>Upcoming</div>
    <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', overflow: 'hidden' }}>
      {upcomingSessions.map((session, i) => (
        <div key={session.id} style={{ padding: '14px 20px', borderBottom: i < upcomingSessions.length - 1 ? '1px solid #2A2A2D' : 'none', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '44px', textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: '10px', color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {new Date(session.session_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
            </div>
            <div style={{ fontSize: '22px', fontFamily: 'monospace', fontWeight: 700, color: '#ffffff', lineHeight: 1 }}>
              {new Date(session.session_date + 'T00:00:00').getDate()}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 500, color: '#ffffff' }}>{session.title}</div>
            <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>
            {session.groups?.name ? (
  <span>{session.groups.name} · </span>
) : (
  <span>
    {allSessionPlayers
      .filter(sp => sp.session_id === session.id)
      .map(sp => players.find(p => p.id === sp.player_id))
      .filter(Boolean)
      .map((p, i, arr) => (
        <span key={p!.id}>
          <span
            onClick={() => router.push(`/dashboard/players/${p!.id}`)}
            style={{ color: '#00FF9F', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(0,255,159,0.4)' }}>
            {p!.full_name}
          </span>
          {i < arr.length - 1 ? ', ' : ''}
        </span>
      ))}
    {' · '}
  </span>
)}
{session.session_time ? formatTime(session.session_time) : 'No time set'}
              {session.type === 'recurring' && (
                <span style={{ marginLeft: '8px', fontSize: '11px', background: 'rgba(0,255,159,0.12)', color: '#00FF9F', padding: '2px 6px', borderRadius: '4px' }}>Recurring</span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end', flexShrink: 0 }}>
  <div style={{ fontSize: '12px', color: '#9A9A9F' }}>{formatUpcomingDate(session.session_date)}</div>
  <SessionActionButtons session={session} />
</div>
        </div>
      ))}
    </div>
  </div>
)}


        {/* STAT ROW */}
<div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px', marginBottom: '20px' }}>
  {[
    { label: 'Sessions today', value: todaySessions.length, color: todaySessions.length > 0 ? '#00FF9F' : '#ffffff' },
    { label: 'Sessions this week', value: upcomingSessions.filter(s => {
        const d = new Date(s.session_date + 'T00:00:00')
        const now = new Date()
        const endOfWeek = new Date(now)
        endOfWeek.setDate(now.getDate() + (6 - now.getDay()))
        return d <= endOfWeek
      }).length + todaySessions.length, color: '#ffffff' },
    { label: 'Total scheduled', value: todaySessions.length + upcomingSessions.length, color: '#ffffff' },
  ].map(s => (
    <div key={s.label} style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '10px', padding: '14px' }}>
      <div style={{ fontSize: '10px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>{s.label}</div>
      <div style={{ fontFamily: '"Exo 2", sans-serif', fontSize: '28px', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
    </div>
  ))}
</div>
{/* WELCOME BANNER */}
{!bannerDismissed && players.length === 0 && (
  <div style={{ background: 'rgba(0,255,159,0.06)', border: '1px solid rgba(0,255,159,0.2)', borderRadius: '16px', padding: '24px', marginBottom: '20px', position: 'relative' }}>
    <button onClick={dismissBanner} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: '#9A9A9F', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>×</button>
    <div style={{ fontSize: '15px', fontWeight: 700, color: '#00FF9F', marginBottom: '4px', fontFamily: '"Exo 2", sans-serif' }}>Welcome to SkillPathIQ 👋</div>
    <div style={{ fontSize: '13px', color: '#9A9A9F', marginBottom: '20px' }}>Get started in three simple steps</div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {[
        { step: '01', title: 'Add your first player', desc: 'Tap + Add player to add a player to your roster', action: () => router.push('/dashboard/players/new') },
        { step: '02', title: 'Log your first session', desc: 'After training, log the date and what you worked on', action: () => router.push('/dashboard/sessions/new') },
        { step: '03', title: 'Share a player link', desc: 'Send players their personal drill checklist link', action: null },
      ].map(s => (
        <div key={s.step} onClick={s.action ? s.action : undefined} style={{ display: 'flex', alignItems: 'center', gap: '14px', background: '#1A1A1C', borderRadius: '10px', padding: '14px 16px', cursor: s.action ? 'pointer' : 'default' }}>
          <div style={{ fontFamily: '"Exo 2", sans-serif', fontSize: '20px', fontWeight: 800, color: '#00FF9F', flexShrink: 0, width: '32px' }}>{s.step}</div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>{s.title}</div>
            <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>{s.desc}</div>
          </div>
          {s.action && <div style={{ marginLeft: 'auto', color: '#00FF9F', fontSize: '16px' }}>→</div>}
        </div>
      ))}
    </div>
  </div>
)}
{/* MY GROUPS */}
{groups.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
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
                  <div style={{ display: 'flex', gap: '6px' }}>
  <button
    onClick={() => setActiveFilter(group.id)}
    style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', border: '1px solid #2A2A2D', background: 'transparent', color: '#9A9A9F', cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
    View
  </button>
  <button
    onClick={() => router.push(`/dashboard/groups/${group.id}`)}
    style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', border: '1px solid #2A2A2D', background: 'transparent', color: '#00FF9F', cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
    Edit
  </button>
</div>
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
<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', marginTop: '8px' }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1.5fr', gap: '16px', padding: '10px 20px', borderBottom: '1px solid #2A2A2D' }}>
          {['Player', 'Group', 'Last session', 'Drills', 'Status', 'Actions'].map(h => (
  <div key={h} style={{ fontSize: '11px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
))}
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
                <div key={player.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1.5fr', gap: '16px', padding: '14px 20px', borderBottom: isLast ? 'none' : '1px solid #2A2A2D', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(0,255,159,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, color: '#00FF9F', flexShrink: 0 }}>{getInitials(player.full_name)}</div>
                    <div>
                    <div onClick={() => router.push(`/dashboard/players/${player.id}`)} style={{ fontSize: '14px', fontWeight: 500, color: '#ffffff', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.2)' }}>{player.full_name}</div>
                      <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>{player.parent_email || 'No parent email'}</div>
                    </div>
                  </div>
                  <div>{group ? <span style={{ background: '#2A2A2D', padding: '3px 8px', borderRadius: '6px', fontSize: '12px', color: '#a0a0a8' }}>{group.name}</span> : <span style={{ fontSize: '12px', color: '#9A9A9F' }}>Individual</span>}</div>
                  <div style={{ fontSize: '13px', color: days !== null && days > 30 ? '#E03131' : '#a0a0a8' }}>
                    {formatDaysAgo(days)}
                    {lastSession?.notes && <div style={{ fontSize: '11px', color: '#9A9A9F', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>{lastSession.notes}</div>}
                  </div>
                  <div>
                    {pct !== null ? (
                      <div>
                        <div style={{ height: '4px', background: '#2A2A2D', borderRadius: '99px', overflow: 'hidden', marginBottom: '4px', width: '80px' }}>
                          <div style={{ height: '100%', width: pct + '%', background: pct === 100 ? '#00FF9F' : '#00FF9F', borderRadius: '99px' }} />
                        </div>
                        <div style={{ fontSize: '11px', color: '#9A9A9F' }}>{pct}% done</div>
                      </div>
                    ) : <span style={{ fontSize: '12px', color: '#9A9A9F' }}>No drills</span>}
                  </div>
                  <div>
  <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '99px', background: statusStyle.bg, color: statusStyle.color, whiteSpace: 'nowrap' }}>{statusStyle.label}</span>
</div>
<div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
  <button onClick={() => router.push(`/dashboard/sessions/new?player=${player.id}`)} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', border: '1px solid #2A2A2D', background: 'transparent', color: '#ffffff', cursor: 'pointer', whiteSpace: 'nowrap', textAlign: 'left' }}>Schedule Session</button>
  <button onClick={() => copyPlayerLink(player.id)} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', border: `1px solid ${isCopied ? '#00FF9F' : '#2A2A2D'}`, background: 'transparent', color: isCopied ? '#00FF9F' : '#9A9A9F', cursor: 'pointer', whiteSpace: 'nowrap', textAlign: 'left' }}>{isCopied ? '✓ Copied!' : 'Send Player Profile'}</button>
  <button onClick={() => router.push(`/dashboard/drills/new?player=${player.id}`)} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', border: '1px solid #2A2A2D', background: 'transparent', color: '#9A9A9F', cursor: 'pointer', whiteSpace: 'nowrap', textAlign: 'left' }}>Assign drills</button>
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
                <div key={player.id} style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(0,255,159,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600, color: '#00FF9F', flexShrink: 0 }}>{getInitials(player.full_name)}</div>
                      <div>
                      <div onClick={() => router.push(`/dashboard/players/${player.id}`)} style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.2)' }}>{player.full_name}</div>
                        <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '1px' }}>{group ? group.name : 'Individual'}</div>
                      </div>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '99px', background: statusStyle.bg, color: statusStyle.color, flexShrink: 0 }}>{statusStyle.label}</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                    <div style={{ background: '#0E0E0F', borderRadius: '8px', padding: '10px' }}>
                      <div style={{ fontSize: '10px', color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Last session</div>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: days !== null && days > 30 ? '#E03131' : '#ffffff' }}>{formatDaysAgo(days)}</div>
                      {lastSession?.notes && <div style={{ fontSize: '11px', color: '#9A9A9F', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lastSession.notes}</div>}
                    </div>
                    <div style={{ background: '#0E0E0F', borderRadius: '8px', padding: '10px' }}>
                      <div style={{ fontSize: '10px', color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Drills</div>
                      {pct !== null ? (
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 500, color: '#ffffff', marginBottom: '4px' }}>{pct}% done</div>
                          <div style={{ height: '4px', background: '#2A2A2D', borderRadius: '99px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: pct + '%', background: pct === 100 ? '#00FF9F' : '#00FF9F', borderRadius: '99px' }} />
                          </div>
                        </div>
                      ) : <div style={{ fontSize: '13px', color: '#9A9A9F' }}>None assigned</div>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
  <button onClick={() => router.push(`/dashboard/players/${player.id}/log`)} style={{ flex: 1, padding: '9px', borderRadius: '8px', border: '1px solid #2A2A2D', background: 'transparent', color: '#ffffff', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
    + Log session
  </button>
  <button onClick={() => router.push(`/dashboard/drills/new?player=${player.id}`)} style={{ flex: 1, padding: '9px', borderRadius: '8px', border: '1px solid #2A2A2D', background: 'transparent', color: '#9A9A9F', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
    Assign drills
  </button>
</div>
                </div>
              )
            })
          )}
        </div>

      </div>
    </div>
  )
}
