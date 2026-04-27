'use client'

import React, { useState, useEffect } from 'react'
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
  const [showDrillAlert, setShowDrillAlert] = useState(false)
  const [drillNudge, setDrillNudge] = useState<string | null>(null)
  const [drillNudgeLoading, setDrillNudgeLoading] = useState(false)
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
    const pct = Math.round((done / weekDrills.length) * 100)
    if (isNaN(pct)) {
      console.warn(`[DrillEngagement] NaN pct for player ${player.id}: done=${done} total=${weekDrills.length}`)
      return null
    }
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
  const mobileAtRiskCount = players.filter(p => {
    const last = getLastSession(p.id)
    const days = getDaysSince(last?.session_date || null)
    return days !== null && days >= 14
  }).length

  const lowEngagementPlayers = players
    .map(p => {
      const counts = getDrillCounts(p)
      if (!counts) return null
      const pct = Math.round((counts.done / counts.total) * 100)
      return { player: p, pct, done: counts.done, total: counts.total }
    })
    .filter((x): x is { player: Player; pct: number; done: number; total: number } => x !== null && x.pct < 70)

  useEffect(() => {
    if (lowEngagementPlayers.length === 0) return
    setDrillNudgeLoading(true)
    const dataStr = lowEngagementPlayers
      .map(item => `${item.player.full_name.split(' ')[0]}: ${item.pct}% (${item.done}/${item.total} drills)`)
      .join(', ')
    fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 120,
        messages: [{ role: 'user', content: `You are a coaching assistant for a youth sports trainer. Given the following player drill engagement data, write a short, specific, actionable nudge (2 sentences max) that helps the trainer decide whether and how to follow up with these players before their next session. Be direct and practical. Do not use generic phrases like 'consider reaching out'. Data: ${dataStr}` }],
      }),
    })
      .then(r => r.json())
      .then(data => {
        const text = data.content?.find((b: { type: string; text: string }) => b.type === 'text')?.text?.trim()
        setDrillNudge(text || null)
      })
      .catch(() => {})
      .finally(() => setDrillNudgeLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  function RevenueSnapshot() {
    const individualRate = (profile as any)?.individual_rate || 0
    const hasRates = individualRate > 0
    const monthlyPerClient = individualRate * 4

    const newCount = players.filter(p => getStatus(p.id) === 'new').length
    const activeRevenue = activeCount * monthlyPerClient
    const atRiskRevenue = atRiskCount * monthlyPerClient
    const lapsedRevenue = lapsedCount * monthlyPerClient
    const newPotential = newCount * monthlyPerClient
    const avgPerClient = activeCount > 0 ? Math.round(activeRevenue / activeCount) : 0

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const sessionsThisMonth = sessions.filter(s => {
      const d = new Date(s.session_date)
      return d >= startOfMonth && d <= now && s.player_id
    })
    const loggedRevenue = sessionsThisMonth.length * individualRate

    const maxRevenue = Math.max(activeRevenue, atRiskRevenue, lapsedRevenue, newPotential, 1)

    const rows = [
      { label: 'Active', count: activeCount, color: '#00FF9F', revenue: activeRevenue, valueLabel: hasRates ? `$${activeRevenue.toLocaleString()}` : '—' },
      { label: 'At Risk', count: atRiskCount, color: '#F5A623', revenue: atRiskRevenue, valueLabel: hasRates ? `$${atRiskRevenue.toLocaleString()}` : '—' },
      { label: 'Lapsed', count: lapsedCount, color: '#E03131', revenue: lapsedRevenue, valueLabel: hasRates ? `$${lapsedRevenue.toLocaleString()} recoverable` : '—' },
      { label: 'New', count: newCount, color: '#4A9EFF', revenue: newPotential, valueLabel: hasRates ? `−$${newPotential.toLocaleString()} potential` : '—' },
    ]

    return (
      <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '14px', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #2A2A2D' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#9A9A9F', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>Revenue Snapshot</div>
        </div>
        <div style={{ padding: '14px 16px' }}>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: '4px' }}>Monthly Active Revenue</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <div style={{ fontSize: '30px', fontWeight: 700, color: '#00FF9F', lineHeight: 1 }}>
                {hasRates ? `$${activeRevenue.toLocaleString()}` : '—'}
              </div>
              {hasRates && <span style={{ fontSize: '14px', color: '#9A9A9F', fontWeight: 400 }}>/mo</span>}
            </div>
            <div style={{ fontSize: '11px', color: '#9A9A9F', marginTop: '4px' }}>
              {hasRates
                ? `${activeCount} active client${activeCount !== 1 ? 's' : ''} · avg $${avgPerClient}/client`
                : 'Set your rates to unlock revenue tracking'}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
            {rows.map(row => (
              <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: row.color, flexShrink: 0 }} />
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff', width: '48px', flexShrink: 0 }}>{row.label}</div>
                <div style={{ fontSize: '11px', color: '#9A9A9F', width: '64px', flexShrink: 0 }}>{row.count} client{row.count !== 1 ? 's' : ''}</div>
                <div style={{ flex: 1, height: '4px', background: '#2A2A2D', borderRadius: '2px', overflow: 'hidden' }}>
                  {hasRates && <div style={{ height: '100%', width: `${(row.revenue / maxRevenue) * 100}%`, background: row.color, borderRadius: '2px' }} />}
                </div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: row.label === 'New' ? '#4A9EFF' : row.label === 'Lapsed' ? '#E03131' : '#9A9A9F', textAlign: 'right' as const, minWidth: '80px', flexShrink: 0 }}>{row.valueLabel}</div>
              </div>
            ))}
          </div>

          {hasRates ? (
            <div style={{ borderTop: '1px solid #2A2A2D', paddingTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <div style={{ fontSize: '10px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Logged This Month</div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff' }}>
                ${loggedRevenue.toLocaleString()} across {sessionsThisMonth.length} session{sessionsThisMonth.length !== 1 ? 's' : ''}
              </div>
            </div>
          ) : (
            <button onClick={() => router.push('/dashboard/settings')} style={{ width: '100%', background: '#00FF9F', color: '#0E0E0F', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', marginTop: '4px' }}>
              Set rates to unlock →
            </button>
          )}
        </div>
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
  .mobile-training-hub { display: none; }
  .mobile-bottom-nav { display: none; }
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
    .desktop-training-hub { display: none !important; }
    .mobile-training-hub { display: flex !important; flex-direction: column; }
    .mobile-bottom-nav { display: flex !important; }
  }
  @media (min-width: 641px) {
    .nav-menu-btn { display: none !important; }
    .mobile-menu { display: none !important; }
    .player-cards { display: none !important; }
    .mobile-training-hub { display: none !important; }
    .mobile-bottom-nav { display: none !important; }
  }
`}</style>

      {/* NAV */}
      <NavBar trainerName={profile?.full_name} />

      {/* === MOBILE TRAINING HUB === */}
      <div className="mobile-training-hub" style={{ flexDirection: 'column', minHeight: 'calc(100vh - 56px)', paddingBottom: '88px' }}>

        {/* HEADER */}
        <div style={{ padding: '20px 16px 8px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#ffffff', margin: 0 }}>Training Hub</h1>
          <p style={{ fontSize: '13px', color: '#9A9A9F', marginTop: '4px' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            {players.length > 0 && <> &nbsp;&middot;&nbsp; {players.length} player{players.length !== 1 ? 's' : ''}</>}
            {groups.length > 0 && <> &nbsp;&middot;&nbsp; {groups.length} group{groups.length !== 1 ? 's' : ''}</>}
          </p>
        </div>

        {/* QUICK ADD */}
        <div style={{ padding: '12px 16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>Quick Add</div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => router.push('/dashboard/players/new')}
              style={{ flex: 1, background: '#1A1A1C', color: '#ffffff', border: '1px solid rgba(0,255,159,0.5)', borderRadius: '10px', padding: '14px 12px', fontSize: '15px', fontWeight: 700, cursor: 'pointer' }}>
              + Add Player
            </button>
            <button
              onClick={() => router.push('/dashboard/sessions/new')}
              style={{ flex: 1, background: '#00FF9F', color: '#0E0E0F', border: 'none', borderRadius: '10px', padding: '14px 12px', fontSize: '15px', fontWeight: 700, cursor: 'pointer' }}>
              + Session
            </button>
          </div>
        </div>

        {/* TODAY'S SESSIONS */}
        <div style={{ padding: '4px 16px 12px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>Today&apos;s Sessions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {todaySessions.length === 0 && upcomingSessions.length === 0 && (
              <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '20px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: '13px', color: '#9A9A9F', margin: 0 }}>No sessions scheduled</p>
              </div>
            )}
            {todaySessions.map(session => {
              const sessionPlayers = session.group_id
                ? players.filter(p => p.group_id === session.group_id)
                : allSessionPlayers.filter(sp => sp.session_id === session.id).map(sp => players.find(p => p.id === sp.player_id)).filter(Boolean) as Player[]
              const { isLogged } = getSessionDisplayState(session)
              const displayName = session.groups?.name || sessionPlayers.map(p => p.full_name).join(', ') || 'Session'
              const timeParts = session.session_time ? formatTime(session.session_time).split(' ') : null
              return (
                <div key={session.id} style={{ background: '#1A1A1C', border: '1px solid rgba(0,255,159,0.25)', borderLeft: '3px solid #00FF9F', borderRadius: '12px', padding: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ textAlign: 'center', flexShrink: 0, minWidth: '38px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', lineHeight: 1 }}>{timeParts ? timeParts[0] : '—'}</div>
                    <div style={{ fontSize: '10px', color: '#9A9A9F', marginTop: '2px' }}>{timeParts ? timeParts[1] : ''}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '15px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                      {session.group_id
                        ? <span onClick={() => router.push(`/dashboard/groups/${session.group_id}`)} style={{ color: '#ffffff', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.3)' }}>{session.groups?.name || 'Group'}</span>
                        : sessionPlayers.length === 1
                          ? <span onClick={() => router.push(`/dashboard/players/${sessionPlayers[0].id}`)} style={{ color: '#ffffff', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.3)' }}>{sessionPlayers[0].full_name}</span>
                          : sessionPlayers.length > 1
                            ? sessionPlayers.map((p, i) => <span key={p.id}><span onClick={() => router.push(`/dashboard/players/${p.id}`)} style={{ color: '#ffffff', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.3)' }}>{p.full_name}</span>{i < sessionPlayers.length - 1 ? ', ' : ''}</span>)
                            : <span style={{ color: '#9A9A9F' }}>Session</span>}
                    </div>
                    {session.title && <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{session.title}</div>}
                  </div>
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
                    style={{ fontSize: '13px', padding: '8px 16px', borderRadius: '8px', border: 'none', background: isLogged ? '#2A2A2D' : '#00FF9F', color: isLogged ? '#9A9A9F' : '#0E0E0F', fontWeight: 700, cursor: isLogged ? 'default' : 'pointer', flexShrink: 0 }}>
                    {isLogged ? '✓' : 'Log'}
                  </button>
                </div>
              )
            })}
            {upcomingSessions.length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '2px 0' }}>
                  <span style={{ fontSize: '12px', color: '#9A9A9F' }}>Next up →</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff', background: '#2A2A2D', padding: '3px 10px', borderRadius: '99px' }}>
                    {upcomingSessions.length} upcoming
                  </span>
                </div>
                {upcomingSessions.slice(0, 2).map(session => {
                  const upcomingPlayers = session.group_id
                    ? players.filter(p => p.group_id === session.group_id)
                    : allSessionPlayers.filter(sp => sp.session_id === session.id).map(sp => players.find(p => p.id === sp.player_id)).filter(Boolean) as Player[]
                  const displayName = session.groups?.name || upcomingPlayers.map(p => p.full_name).join(', ') || 'Session'
                  const dayAbbr = new Date(session.session_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase()
                  const timeParts = session.session_time ? formatTime(session.session_time).split(' ') : null
                  return (
                    <div key={session.id} style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ textAlign: 'center', flexShrink: 0, minWidth: '38px' }}>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', lineHeight: 1 }}>{timeParts ? timeParts[0] : '—'}</div>
                        <div style={{ fontSize: '10px', color: '#9A9A9F', marginTop: '2px' }}>{dayAbbr}</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                          {session.group_id
                            ? <span onClick={() => router.push(`/dashboard/groups/${session.group_id}`)} style={{ color: '#ffffff', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.3)' }}>{session.groups?.name || 'Group'}</span>
                            : upcomingPlayers.length === 1
                              ? <span onClick={() => router.push(`/dashboard/players/${upcomingPlayers[0].id}`)} style={{ color: '#ffffff', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.3)' }}>{upcomingPlayers[0].full_name}</span>
                              : upcomingPlayers.length > 1
                                ? upcomingPlayers.map((p, i) => <span key={p.id}><span onClick={() => router.push(`/dashboard/players/${p.id}`)} style={{ color: '#ffffff', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.3)' }}>{p.full_name}</span>{i < upcomingPlayers.length - 1 ? ', ' : ''}</span>)
                                : <span style={{ color: '#9A9A9F' }}>Session</span>}
                        </div>
                        {session.title && <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{session.title}</div>}
                      </div>
                      <button
                        onClick={() => router.push(`/dashboard/sessions/${session.id}`)}
                        style={{ fontSize: '13px', padding: '7px 14px', borderRadius: '8px', border: '1px solid #2A2A2D', background: 'transparent', color: '#ffffff', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                        View
                      </button>
                    </div>
                  )
                })}
              </>
            )}
          </div>
        </div>

        {/* ACTION NEEDED */}
        {(unloggedSessions.length > 0 || mobileAtRiskCount > 0 || lowEngagementPlayers.length > 0) && (
          <div style={{ padding: '4px 16px 12px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>Action Needed</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {unloggedSessions.length > 0 && (
                <>
                  <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '18px', flexShrink: 0, filter: 'grayscale(1) brightness(0.7)' }}>⚠️</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff' }}>{unloggedSessions.length} unlogged sessions</div>
                      <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>AI recaps unavailable until logged</div>
                    </div>
                    <button
                      onClick={() => setShowUnlogged(!showUnlogged)}
                      style={{ fontSize: '12px', padding: '7px 12px', borderRadius: '8px', border: '1px solid rgba(245,166,35,0.5)', background: 'transparent', color: '#F5A623', fontWeight: 700, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' as const }}>
                      Review
                    </button>
                  </div>
                  {showUnlogged && (
                    <div style={{ background: '#1A1A1C', border: '1px solid rgba(245,166,35,0.3)', borderRadius: '12px', overflow: 'hidden' }}>
                      <div style={{ padding: '10px 14px', borderBottom: '1px solid #2A2A2D', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#F5A623', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Unlogged ({unloggedSessions.length})</span>
                        <button onClick={() => setShowUnlogged(false)} style={{ background: 'none', border: 'none', color: '#9A9A9F', cursor: 'pointer', fontSize: '16px' }}>×</button>
                      </div>
                      {unloggedSessions.map((session, i) => {
                        const sessionPlayers = session.group_id
                          ? players.filter(p => p.group_id === session.group_id)
                          : allSessionPlayers.filter(sp => sp.session_id === session.id).map(sp => players.find(p => p.id === sp.player_id)).filter(Boolean) as Player[]
                        return (
                          <div key={session.id} style={{ padding: '10px 14px', borderBottom: i < unloggedSessions.length - 1 ? '1px solid #2A2A2D' : 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '13px', fontWeight: 500, color: '#ffffff' }}>{session.title}</div>
                              <div style={{ fontSize: '11px', color: '#9A9A9F', marginTop: '1px' }}>
                                {new Date(session.session_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                {session.groups?.name && <span style={{ color: '#00FF9F' }}> · {session.groups.name}</span>}
                                {!session.groups?.name && sessionPlayers.length > 0 && <span> · {sessionPlayers.map(p => p.full_name.split(' ')[0]).join(', ')}</span>}
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                if (session.group_id) {
                                  router.push(`/dashboard/sessions/${session.id}/log`)
                                } else if (sessionPlayers.length === 1) {
                                  router.push(`/dashboard/players/${sessionPlayers[0].id}/log?sessionId=${session.id}`)
                                } else {
                                  router.push(`/dashboard/sessions/${session.id}/log`)
                                }
                              }}
                              style={{ fontSize: '11px', padding: '5px 10px', borderRadius: '7px', border: 'none', background: '#E03131', color: '#ffffff', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                              Log now
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
              {mobileAtRiskCount > 0 && (
                <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '18px', flexShrink: 0, filter: 'grayscale(1) brightness(0.6)' }}>🔴</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff' }}>{mobileAtRiskCount} players lapsed</div>
                    <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>No session in 14+ days</div>
                  </div>
                  <button
                    onClick={() => router.push('/dashboard/clients')}
                    style={{ fontSize: '12px', padding: '7px 12px', borderRadius: '8px', border: '1px solid rgba(224,49,49,0.5)', background: 'transparent', color: '#E03131', fontWeight: 700, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' as const }}>
                    Re-engage
                  </button>
                </div>
              )}
              {lowEngagementPlayers.length > 0 && (
                <>
                  <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '18px', flexShrink: 0, filter: 'grayscale(1) brightness(0.7)' }}>📊</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff' }}>Low drill engagement</div>
                      <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>{lowEngagementPlayers.length} player{lowEngagementPlayers.length !== 1 ? 's' : ''} below 70% this week</div>
                    </div>
                    <button onClick={() => setShowDrillAlert(!showDrillAlert)} style={{ fontSize: '12px', padding: '7px 12px', borderRadius: '8px', border: '1px solid rgba(245,166,35,0.5)', background: 'transparent', color: '#F5A623', fontWeight: 700, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' as const }}>Review</button>
                  </div>
                  {showDrillAlert && (
                    <div style={{ background: '#1A1A1C', border: '1px solid rgba(245,166,35,0.3)', borderRadius: '12px', overflow: 'hidden' }}>
                      <div style={{ padding: '10px 14px', borderBottom: '1px solid #2A2A2D', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#F5A623', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Drill Engagement</span>
                        <button onClick={() => setShowDrillAlert(false)} style={{ background: 'none', border: 'none', color: '#9A9A9F', cursor: 'pointer', fontSize: '16px' }}>×</button>
                      </div>
                      {lowEngagementPlayers.map((item, i) => (
                        <div key={item.player.id} style={{ padding: '10px 14px', borderBottom: i < lowEngagementPlayers.length - 1 ? '1px solid #2A2A2D' : 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: 500, color: '#ffffff' }}>{item.player.full_name.split(' ')[0]}</div>
                            <div style={{ marginTop: '4px', height: '4px', borderRadius: '99px', background: '#2A2A2D', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${item.pct}%`, background: item.pct === 0 ? '#E03131' : '#F5A623', borderRadius: '99px' }} />
                            </div>
                          </div>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: item.pct === 0 ? '#E03131' : '#F5A623', flexShrink: 0 }}>{item.pct}%</div>
                          <button onClick={() => router.push(`/dashboard/players/${item.player.id}`)} style={{ fontSize: '11px', padding: '5px 10px', borderRadius: '7px', border: 'none', background: '#2A2A2D', color: '#ffffff', cursor: 'pointer', flexShrink: 0 }}>View</button>
                        </div>
                      ))}
                      {drillNudgeLoading && (
                        <div style={{ padding: '10px 14px', fontSize: '12px', color: '#9A9A9F', fontStyle: 'italic' }}>Getting coaching tip…</div>
                      )}
                      {drillNudge && !drillNudgeLoading && (
                        <div style={{ padding: '10px 14px', borderTop: '1px solid #2A2A2D', fontSize: '12px', color: '#9A9A9F', lineHeight: 1.5 }}>
                          <span style={{ color: '#F5A623', fontWeight: 600 }}>Tip: </span>{drillNudge}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* REVENUE SNAPSHOT - MOBILE */}
        <div style={{ padding: '4px 16px 12px' }}>
          <RevenueSnapshot />
        </div>

      </div>

      {/* === DESKTOP TRAINING HUB === */}
      <div className="desktop-training-hub" style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px', width: '100%' }}>
        {/* PAGE HEADER */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '26px' }}>{getSportEmoji()}</span>
              {profile?.full_name ? `${profile.full_name.split(' ')[0]}'s Training Hub` : 'Training Hub'}
            </h1>
            <p style={{ fontSize: '13px', color: '#9A9A9F', marginTop: '4px' }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => setBroadcastEmailOpen(!broadcastEmailOpen)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: '1px solid rgba(0,255,159,0.4)', borderRadius: '8px', cursor: 'pointer', padding: '8px 12px', fontSize: '13px', color: '#00FF9F', fontWeight: 600 }}>
              ✉ Email all
            </button>
            <button onClick={() => router.push('/dashboard/sessions/new')} style={{ background: 'transparent', color: '#ffffff', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '9px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
              + Schedule session
            </button>
            <button onClick={() => router.push('/dashboard/players/new')} style={{ background: '#00FF9F', color: '#0E0E0F', border: 'none', borderRadius: '8px', padding: '9px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
              + Add player
            </button>
          </div>
        </div>

        {/* BROADCAST EMAIL */}
        {broadcastEmailOpen && (
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
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
              <input type="text" placeholder="Subject: Update from your trainer" value={broadcastSubject} onChange={e => setBroadcastSubject(e.target.value)} style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }} />
              <textarea placeholder="Write your update — going out of town, schedule changes, new availability, etc..." value={broadcastBody} onChange={e => setBroadcastBody(e.target.value)} rows={4} style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%', resize: 'vertical' as const, fontFamily: 'sans-serif' }} />
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
              <button onClick={sendBroadcastEmail} disabled={sendingBroadcast || !broadcastBody.trim()} style={{ background: broadcastBody.trim() ? '#00FF9F' : '#2A2A2D', color: broadcastBody.trim() ? '#0E0E0F' : '#9A9A9F', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '14px', fontWeight: 700, cursor: broadcastBody.trim() ? 'pointer' : 'default' }}>
                {sendingBroadcast ? 'Sending...' : `Send to ${players.filter(p => p.parent_email && (getStatus(p.id) === 'active' || getStatus(p.id) === 'at-risk')).length} parents`}
              </button>
            </div>
          </div>
        )}

        {/* TWO-COLUMN LAYOUT */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '24px', alignItems: 'start' }}>

          {/* ===== LEFT COLUMN ===== */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* TODAY'S SESSIONS */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00FF9F' }} />
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#00FF9F', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Today&apos;s sessions</span>
                <span style={{ fontSize: '12px', color: '#9A9A9F' }}>{todaySessions.length > 0 ? `${todaySessions.length} scheduled` : 'None scheduled'}</span>
              </div>
              {todaySessions.length === 0 ? (
                <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '24px', textAlign: 'center' as const }}>
                  <div style={{ fontSize: '13px', color: '#9A9A9F' }}>No sessions scheduled for today</div>
                  <button onClick={() => router.push('/dashboard/sessions/new')} style={{ marginTop: '12px', background: 'transparent', border: '1px solid rgba(0,255,159,0.3)', borderRadius: '8px', padding: '7px 14px', fontSize: '13px', color: '#00FF9F', cursor: 'pointer', fontWeight: 600 }}>Schedule one</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {todaySessions.map(session => {
                    const sessionPlayers = session.group_id
                      ? players.filter(p => p.group_id === session.group_id)
                      : allSessionPlayers.filter(sp => sp.session_id === session.id).map(sp => players.find(p => p.id === sp.player_id)).filter(Boolean) as Player[]
                    const { isPast, isLogged } = getSessionDisplayState(session)
                    return (
                      <div key={session.id} style={{ background: isPast ? 'rgba(154,154,159,0.05)' : 'rgba(0,255,159,0.05)', border: `1px solid ${isPast ? 'rgba(154,154,159,0.2)' : 'rgba(0,255,159,0.25)'}`, borderLeft: `3px solid ${isPast ? 'rgba(154,154,159,0.4)' : '#00FF9F'}`, borderRadius: '12px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ textAlign: 'center' as const, flexShrink: 0, minWidth: '52px', position: 'relative' }}>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: isPast ? '#9A9A9F' : '#00FF9F', lineHeight: 1, marginBottom: '4px' }}>
                            {session.session_time ? formatTime(session.session_time) : '—'}
                          </div>
                          <button onClick={() => setRescheduleOpen(rescheduleOpen === session.id ? null : session.id)} style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', border: '1px solid #2A2A2D', background: 'transparent', color: '#9A9A9F', cursor: 'pointer' }}>Modify</button>
                          {rescheduleOpen === session.id && (
                            <div style={{ position: 'absolute', left: 0, top: '100%', marginTop: '4px', background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '10px', padding: '8px', zIndex: 50, minWidth: '140px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                              <button onClick={() => setRescheduleOpen(`reschedule-${session.id}`)} style={{ width: '100%', padding: '8px 12px', textAlign: 'left' as const, background: 'none', border: 'none', color: '#ffffff', fontSize: '13px', cursor: 'pointer', borderRadius: '6px' }}>Reschedule</button>
                              <button onClick={async () => { const supabaseClient = createClient(); await supabaseClient.from('sessions').update({ status: 'cancelled' }).eq('id', session.id); setRescheduleOpen(null); router.refresh() }} style={{ width: '100%', padding: '8px 12px', textAlign: 'left' as const, background: 'none', border: 'none', color: '#E03131', fontSize: '13px', cursor: 'pointer', borderRadius: '6px' }}>Cancel session</button>
                            </div>
                          )}
                          {rescheduleOpen === `reschedule-${session.id}` && (
                            <div style={{ position: 'absolute', left: 0, top: '100%', marginTop: '4px', background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '10px', padding: '16px', zIndex: 50, minWidth: '220px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                              <div style={{ fontSize: '12px', color: '#9A9A9F', marginBottom: '10px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Pick new date & time</div>
                              <input type="date" defaultValue={session.session_date} id={`today-date-${session.id}`} style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '8px 12px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%', marginBottom: '8px' }} />
                              <input type="time" defaultValue={session.session_time || ''} id={`today-time-${session.id}`} style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '8px 12px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%', marginBottom: '10px' }} />
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={async () => { const dateInput = document.getElementById(`today-date-${session.id}`) as HTMLInputElement; const timeInput = document.getElementById(`today-time-${session.id}`) as HTMLInputElement; if (!dateInput?.value) return; const supabaseClient = createClient(); await supabaseClient.from('sessions').update({ session_date: dateInput.value, session_time: timeInput?.value || null }).eq('id', session.id); setRescheduleOpen(null); router.refresh() }} style={{ flex: 1, background: '#00FF9F', color: '#0E0E0F', border: 'none', borderRadius: '8px', padding: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>Save</button>
                                <button onClick={() => setRescheduleOpen(null)} style={{ flex: 1, background: 'transparent', color: '#9A9A9F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '8px', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                              </div>
                            </div>
                          )}
                        </div>
                        <div style={{ width: '1px', height: '36px', background: isPast ? 'rgba(154,154,159,0.2)' : 'rgba(0,255,159,0.2)', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {session.groups?.name
                            ? <span onClick={() => router.push(`/dashboard/groups/${session.group_id}`)} style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.2)' }}>{session.groups.name}</span>
                            : sessionPlayers.length > 0
                              ? <span>{sessionPlayers.map((p, i) => (<span key={p.id}><span onClick={() => router.push(`/dashboard/players/${p.id}`)} style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.2)' }}>{p.full_name}</span>{i < sessionPlayers.length - 1 ? ', ' : ''}</span>))}</span>
                              : <span style={{ fontSize: '15px', color: '#9A9A9F' }}>No players linked</span>}
                          {isPast && (
                            <span style={{ marginLeft: '8px', fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '99px', background: isLogged ? 'rgba(154,154,159,0.15)' : 'rgba(224,49,49,0.15)', color: isLogged ? '#9A9A9F' : '#E03131' }}>
                              {isLogged ? 'Logged' : 'Not logged'}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => { if (isLogged) return; if (session.group_id) { router.push(`/dashboard/sessions/${session.id}/log`) } else if (sessionPlayers.length === 1) { router.push(`/dashboard/players/${sessionPlayers[0].id}/log?sessionId=${session.id}`) } else if (sessionPlayers.length > 1) { router.push(`/dashboard/players/${sessionPlayers[0].id}/log?also=${sessionPlayers.slice(1).map(p => p.id).join(',')}&sessionId=${session.id}`) } else { router.push(`/dashboard/sessions/${session.id}/log`) } }}
                          style={{ fontSize: '12px', padding: '7px 14px', borderRadius: '8px', border: 'none', background: isLogged ? '#2A2A2D' : isPast ? '#E03131' : '#00FF9F', color: isLogged ? '#9A9A9F' : '#0E0E0F', fontWeight: 700, cursor: isLogged ? 'default' : 'pointer', flexShrink: 0 }}>
                          {isLogged ? '✓ Logged' : 'Log session'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* UPCOMING SESSIONS */}
            {upcomingSessions.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#9A9A9F', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Upcoming</span>
                  {upcomingSessions.length > 5 && (
                    <button onClick={() => setShowAllUpcoming(!showAllUpcoming)} style={{ fontSize: '12px', color: '#00FF9F', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, padding: '0' }}>
                      {showAllUpcoming ? 'Show less' : `See all (${upcomingSessions.length})`}
                    </button>
                  )}
                </div>
                <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', overflow: 'hidden' }}>
                  {(showAllUpcoming ? upcomingSessions : upcomingSessions.slice(0, 5)).map((session, i) => {
                    const visibleSessions = showAllUpcoming ? upcomingSessions : upcomingSessions.slice(0, 5)
                    return (
                      <div key={session.id} style={{ padding: '12px 16px', borderBottom: i < visibleSessions.length - 1 ? '1px solid #2A2A2D' : 'none', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ textAlign: 'center' as const, flexShrink: 0, minWidth: '40px' }}>
                          <div style={{ fontSize: '10px', color: '#9A9A9F', textTransform: 'uppercase' as const, letterSpacing: '0.06em', lineHeight: 1 }}>
                            {new Date(session.session_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
                          </div>
                          <div style={{ fontSize: '22px', fontFamily: 'monospace', fontWeight: 700, color: '#ffffff', lineHeight: 1.1 }}>
                            {new Date(session.session_date + 'T00:00:00').getDate()}
                          </div>
                          {session.session_time && (
                            <div style={{ fontSize: '10px', color: '#9A9A9F', lineHeight: 1.2 }}>{formatTime(session.session_time)}</div>
                          )}
                        </div>
                        <div style={{ width: '1px', height: '36px', background: '#2A2A2D', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {session.groups?.name
                            ? <span onClick={() => router.push(`/dashboard/groups/${session.group_id}`)} style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.2)' }}>{session.groups.name}</span>
                            : (() => {
                                const upcomingPlayers = allSessionPlayers.filter(sp => sp.session_id === session.id).map(sp => players.find(p => p.id === sp.player_id)).filter(Boolean) as Player[]
                                return upcomingPlayers.length > 0
                                  ? <span>{upcomingPlayers.map((p, j) => (<span key={p.id}><span onClick={() => router.push(`/dashboard/players/${p.id}`)} style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.2)' }}>{p.full_name}</span>{j < upcomingPlayers.length - 1 ? ', ' : ''}</span>))}</span>
                                  : <span style={{ fontSize: '14px', color: '#9A9A9F' }}>Individual session</span>
                              })()}
                          {session.type === 'recurring' && (
                            <span style={{ marginLeft: '8px', fontSize: '10px', background: 'rgba(0,255,159,0.12)', color: '#00FF9F', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>Recurring</span>
                          )}
                        </div>
                        <div style={{ flexShrink: 0, position: 'relative' }}>
                          <button onClick={() => setRescheduleOpen(rescheduleOpen === session.id ? null : session.id)} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', border: '1px solid #2A2A2D', background: 'transparent', color: '#9A9A9F', cursor: 'pointer', marginRight: '6px' }}>Modify</button>
                          <button onClick={() => router.push(`/dashboard/sessions/${session.id}`)} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', border: '1px solid #2A2A2D', background: 'transparent', color: '#9A9A9F', cursor: 'pointer' }}>View</button>
                          {rescheduleOpen === session.id && (
                            <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: '4px', background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '10px', padding: '8px', zIndex: 50, minWidth: '140px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                              <button onClick={() => setRescheduleOpen(`reschedule-${session.id}`)} style={{ width: '100%', padding: '8px 12px', textAlign: 'left' as const, background: 'none', border: 'none', color: '#ffffff', fontSize: '13px', cursor: 'pointer', borderRadius: '6px' }}>Reschedule</button>
                              <button onClick={async () => { const supabaseClient = createClient(); await supabaseClient.from('sessions').update({ status: 'cancelled' }).eq('id', session.id); setRescheduleOpen(null); router.refresh() }} style={{ width: '100%', padding: '8px 12px', textAlign: 'left' as const, background: 'none', border: 'none', color: '#E03131', fontSize: '13px', cursor: 'pointer', borderRadius: '6px' }}>Cancel session</button>
                            </div>
                          )}
                          {rescheduleOpen === `reschedule-${session.id}` && (
                            <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: '4px', background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '10px', padding: '16px', zIndex: 50, minWidth: '220px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                              <div style={{ fontSize: '12px', color: '#9A9A9F', marginBottom: '10px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Pick new date & time</div>
                              <input type="date" defaultValue={session.session_date} id={`upcoming-date-${session.id}`} style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '8px 12px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%', marginBottom: '8px' }} />
                              <input type="time" defaultValue={session.session_time || ''} id={`upcoming-time-${session.id}`} style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '8px 12px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%', marginBottom: '10px' }} />
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={async () => { const dateInput = document.getElementById(`upcoming-date-${session.id}`) as HTMLInputElement; const timeInput = document.getElementById(`upcoming-time-${session.id}`) as HTMLInputElement; if (!dateInput?.value) return; const supabaseClient = createClient(); await supabaseClient.from('sessions').update({ session_date: dateInput.value, session_time: timeInput?.value || null }).eq('id', session.id); setRescheduleOpen(null); router.refresh() }} style={{ flex: 1, background: '#00FF9F', color: '#0E0E0F', border: 'none', borderRadius: '8px', padding: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>Save</button>
                                <button onClick={() => setRescheduleOpen(null)} style={{ flex: 1, background: 'transparent', color: '#9A9A9F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '8px', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* SESSION REQUESTS */}
            {localSessionRequests.length > 0 && (
              <div style={{ background: '#1A1A1C', border: '1px solid rgba(0,255,159,0.25)', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #2A2A2D', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00FF9F' }} />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#00FF9F', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
                    Session requests ({localSessionRequests.length})
                  </span>
                </div>
                {localSessionRequests.map((req, i) => (
                  <div key={req.id} style={{ padding: '14px 16px', borderBottom: i < localSessionRequests.length - 1 ? '1px solid #2A2A2D' : 'none', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(0,255,159,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, color: '#00FF9F', flexShrink: 0 }}>
                      {req.players?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div onClick={() => router.push(`/dashboard/players/${req.player_id}`)} style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.2)' }}>{req.players?.full_name}</div>
                      {req.note && <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>{req.note}</div>}
                      <div style={{ fontSize: '11px', color: '#9A9A9F', marginTop: '2px' }}>{new Date(req.requested_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button onClick={async () => { setLocalSessionRequests(prev => prev.filter(r => r.id !== req.id)); const supabaseClient = createClient(); supabaseClient.from('session_requests').update({ status: 'dismissed' }).eq('id', req.id).then(() => {}); router.push(`/dashboard/sessions/new?player=${req.player_id}`) }} style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '8px', border: 'none', background: '#00FF9F', color: '#0E0E0F', fontWeight: 700, cursor: 'pointer' }}>Schedule</button>
                      <button onClick={() => dismissRequest(req.id)} disabled={dismissingRequest === req.id} style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '8px', border: '1px solid #2A2A2D', background: 'transparent', color: '#9A9A9F', cursor: 'pointer' }}>{dismissingRequest === req.id ? '...' : 'Dismiss'}</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* UNLOGGED SESSIONS PANEL */}
            {showUnlogged && unloggedSessions.length > 0 && (
              <div style={{ background: '#1A1A1C', border: '1px solid rgba(224,49,49,0.3)', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(224,49,49,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#E03131', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Unlogged sessions ({unloggedSessions.length})</span>
                  <button onClick={() => setShowUnlogged(false)} style={{ background: 'none', border: 'none', color: '#9A9A9F', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}>×</button>
                </div>
                {unloggedSessions.map((session, i) => {
                  const sessionPlayers = session.group_id
                    ? players.filter(p => p.group_id === session.group_id)
                    : allSessionPlayers.filter(sp => sp.session_id === session.id).map(sp => players.find(p => p.id === sp.player_id)).filter(Boolean) as Player[]
                  return (
                    <div key={session.id} style={{ padding: '12px 16px', borderBottom: i < unloggedSessions.length - 1 ? '1px solid #2A2A2D' : 'none', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '14px', fontWeight: 500, color: '#ffffff' }}>{session.title}</div>
                        <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>
                          {new Date(session.session_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {session.groups?.name && <span style={{ color: '#00FF9F' }}> · {session.groups.name}</span>}
                          {!session.groups?.name && sessionPlayers.length > 0 && <span> · {sessionPlayers.map(p => p.full_name.split(' ')[0]).join(', ')}</span>}
                        </div>
                      </div>
                      <button onClick={() => { if (session.group_id) { router.push(`/dashboard/sessions/${session.id}/log`) } else if (sessionPlayers.length === 1) { router.push(`/dashboard/players/${sessionPlayers[0].id}/log?sessionId=${session.id}`) } else if (sessionPlayers.length > 1) { router.push(`/dashboard/players/${sessionPlayers[0].id}/log?also=${sessionPlayers.slice(1).map(p => p.id).join(',')}&sessionId=${session.id}`) } else { router.push(`/dashboard/sessions/${session.id}/log`) } }} style={{ fontSize: '12px', padding: '6px 14px', borderRadius: '8px', border: 'none', background: '#E03131', color: '#ffffff', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>Log now</button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* RECENT SESSIONS TABLE */}
            {sessions.filter(s => s.player_id).length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#9A9A9F', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Recent sessions</span>
                  <button onClick={() => router.push('/dashboard/clients')} style={{ fontSize: '12px', color: '#00FF9F', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>View all →</button>
                </div>
                <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 120px 72px', padding: '8px 16px', borderBottom: '1px solid #2A2A2D' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Player</div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Date</div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Type</div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Action</div>
                  </div>
                  {sessions.filter(s => s.player_id).slice(0, 8).map((session, i, arr) => {
                    const player = players.find(p => p.id === session.player_id)
                    return (
                      <div key={session.id} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 120px 72px', padding: '11px 16px', borderBottom: i < arr.length - 1 ? '1px solid #2A2A2D' : 'none', alignItems: 'center' }}>
                        <div onClick={() => player && router.push(`/dashboard/players/${player.id}`)} style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', cursor: player ? 'pointer' : 'default', textDecoration: player ? 'underline' : 'none', textDecorationColor: 'rgba(255,255,255,0.2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                          {player?.full_name || 'Unknown player'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#9A9A9F' }}>{new Date(session.session_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                        <div style={{ fontSize: '12px', color: '#9A9A9F' }}>{(session as any).session_type || '1-on-1'}</div>
                        <button onClick={() => player && router.push(`/dashboard/players/${player.id}`)} style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #2A2A2D', background: 'transparent', color: '#9A9A9F', cursor: 'pointer' }}>View</button>
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
                { key: 'player', title: 'Add your first player', desc: 'Build your roster by adding a player to the app', done: hasPlayer, action: () => router.push('/dashboard/players/new') },
                { key: 'schedule', title: 'Schedule a session', desc: 'Set up an upcoming training session', done: hasScheduled, action: () => router.push('/dashboard/sessions/new') },
                { key: 'log', title: 'Log your first session', desc: 'Record what happened after a training session', done: hasLoggedSession, action: () => players.length > 0 ? router.push(`/dashboard/players/${players[0].id}/log`) : router.push('/dashboard/players/new') },
                { key: 'ai', title: 'Generate an AI parent recap', desc: 'Let AI write a personalized parent update after a session', done: hasAiRecap, action: () => players.length > 0 ? router.push(`/dashboard/players/${players[0].id}/log`) : router.push('/dashboard/players/new') },
              ]
              const completedCount = steps.filter(s => s.done).length
              if (completedCount === steps.length) return null
              return (
                <div style={{ background: 'rgba(0,255,159,0.04)', border: '1px solid rgba(0,255,159,0.2)', borderRadius: '16px', padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#00FF9F' }}>Getting started 👋</div>
                    <div style={{ fontSize: '13px', color: '#9A9A9F' }}>{completedCount} of {steps.length} complete</div>
                  </div>
                  <div style={{ height: '4px', background: '#2A2A2D', borderRadius: '99px', overflow: 'hidden', marginBottom: '20px' }}>
                    <div style={{ height: '100%', width: `${(completedCount / steps.length) * 100}%`, background: '#00FF9F', borderRadius: '99px', transition: 'width 0.4s ease' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {steps.map(s => (
                      <div key={s.key} onClick={!s.done ? () => s.action() : undefined} style={{ display: 'flex', alignItems: 'center', gap: '14px', background: s.done ? 'rgba(0,255,159,0.04)' : '#1A1A1C', borderRadius: '10px', padding: '14px 16px', cursor: !s.done ? 'pointer' : 'default', border: `1px solid ${s.done ? 'rgba(0,255,159,0.15)' : '#2A2A2D'}`, opacity: s.done ? 0.6 : 1 }}>
                        <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: s.done ? '#00FF9F' : '#2A2A2D', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {s.done ? <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><polyline points="2,5.5 4.5,8 9,3" stroke="#0E0E0F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg> : <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#9A9A9F' }} />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: s.done ? '#9A9A9F' : '#ffffff', textDecoration: s.done ? 'line-through' : 'none' }}>{s.title}</div>
                          {!s.done && <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>{s.desc}</div>}
                        </div>
                        {!s.done && <div style={{ color: '#00FF9F', fontSize: '16px', flexShrink: 0 }}>→</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* MY GROUPS */}
            {groups.length > 0 && (
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#9A9A9F', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: '12px' }}>My groups</div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' as const }}>
                  {groups.map(group => (
                    <div key={group.id} style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px', minWidth: '180px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(0,255,159,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>
                        {group.sport === 'basketball' ? '🏀' : group.sport === 'soccer' ? '⚽' : group.sport === 'football' ? '🏈' : group.sport === 'baseball' ? '⚾' : group.sport === 'tennis' ? '🎾' : group.sport === 'volleyball' ? '🏐' : group.sport === 'golf' ? '⛳' : '🏆'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff', marginBottom: '2px' }}>{group.name}</div>
                        <div style={{ fontSize: '12px', color: '#9A9A9F' }}>{players.filter(p => p.group_id === group.id).length} player{players.filter(p => p.group_id === group.id).length !== 1 ? 's' : ''} · {group.session_day || 'No day set'}</div>
                      </div>
                      <button onClick={() => router.push(`/dashboard/groups/${group.id}`)} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', border: '1px solid #2A2A2D', background: 'transparent', color: '#00FF9F', cursor: 'pointer', whiteSpace: 'nowrap' as const }}>Manage</button>
                    </div>
                  ))}
                  <div onClick={() => router.push('/dashboard/groups/new')} style={{ background: 'transparent', border: '1px dashed #2A2A2D', borderRadius: '12px', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '140px', cursor: 'pointer', color: '#9A9A9F', fontSize: '13px', gap: '6px' }}>+ New group</div>
                </div>
              </div>
            )}

            {/* MY PLAYERS TABLE */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <h2 style={{ fontSize: '12px', fontWeight: 700, color: '#9A9A9F', textTransform: 'uppercase' as const, letterSpacing: '0.1em', margin: 0 }}>My players</h2>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button onClick={() => router.push(`/dashboard/drills/new${activeFilter !== 'all' && activeFilter !== 'individual' ? `?group=${activeFilter}` : ''}`)} style={{ fontSize: '12px', color: '#00FF9F', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>+ Assign drills</button>
                  <button onClick={() => router.push('/dashboard/clients')} style={{ fontSize: '12px', color: '#9A9A9F', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>View all →</button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', overflowX: 'auto', paddingBottom: '4px', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
                <button onClick={() => setActiveFilter('all')} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #2A2A2D', background: activeFilter === 'all' ? '#00FF9F' : 'transparent', color: activeFilter === 'all' ? '#0E0E0F' : '#9A9A9F', fontSize: '12px', fontWeight: 500, cursor: 'pointer', flexShrink: 0 }}>All ({players.length})</button>
                <button onClick={() => setActiveFilter('individual')} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #2A2A2D', background: activeFilter === 'individual' ? '#00FF9F' : 'transparent', color: activeFilter === 'individual' ? '#0E0E0F' : '#9A9A9F', fontSize: '12px', fontWeight: 500, cursor: 'pointer', flexShrink: 0 }}>Individual ({players.filter(p => !p.group_id).length})</button>
                {groups.map(g => (
                  <button key={g.id} onClick={() => setActiveFilter(g.id)} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #2A2A2D', background: activeFilter === g.id ? '#00FF9F' : 'transparent', color: activeFilter === g.id ? '#0E0E0F' : '#9A9A9F', fontSize: '12px', fontWeight: 500, cursor: 'pointer', flexShrink: 0 }}>{g.name} ({players.filter(p => p.group_id === g.id).length})</button>
                ))}
              </div>
              <div style={{ marginBottom: '12px' }}>
                <input type="text" placeholder="Search players..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '9px 14px', fontSize: '14px', color: '#ffffff', outline: 'none' }} />
              </div>
              <div className="player-card-grid" style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 1fr 1fr 1fr 1fr', padding: '8px 16px', borderBottom: '1px solid #2A2A2D', alignItems: 'center' }}>
                  <div />
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase' as const, letterSpacing: '0.06em', paddingLeft: '12px' }}>Player</div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase' as const, letterSpacing: '0.06em', textAlign: 'center' as const }}>Group</div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase' as const, letterSpacing: '0.06em', textAlign: 'center' as const }}>Last Session</div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase' as const, letterSpacing: '0.06em', textAlign: 'center' as const }}>Drills</div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase' as const, letterSpacing: '0.06em', paddingLeft: '8px' }}>Actions</div>
                </div>
                {filteredPlayers.length === 0 ? (
                  <div style={{ padding: '48px 20px', textAlign: 'center' as const }}>
                    <p style={{ fontSize: '14px', color: '#9A9A9F', marginBottom: '16px' }}>{players.length === 0 ? 'No players yet' : 'No players in this filter'}</p>
                    <button onClick={() => router.push('/dashboard/players/new')} style={{ background: '#00FF9F', color: '#0E0E0F', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Add first player</button>
                  </div>
                ) : (
                  filteredPlayers.map((player, i) => {
                    const lastSession = getLastSession(player.id)
                    const days = getDaysSince(lastSession?.session_date || null)
                    const group = getGroup(player.group_id)
                    const isLast = i === filteredPlayers.length - 1
                    return (
                      <div key={player.id} style={{ display: 'grid', gridTemplateColumns: '36px 1fr 1fr 1fr 1fr 1fr', padding: '12px 16px', borderBottom: isLast ? 'none' : '1px solid #2A2A2D', alignItems: 'center' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(0,255,159,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, color: '#00FF9F' }}>{getInitials(player.full_name)}</div>
                        <div style={{ paddingLeft: '12px', minWidth: 0 }}>
                          <div onClick={() => router.push(`/dashboard/players/${player.id}`)} style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{player.full_name}</div>
                        </div>
                        <div style={{ textAlign: 'center' as const }}>
                          {group ? <span style={{ fontSize: '12px', background: '#2A2A2D', padding: '3px 8px', borderRadius: '6px', color: '#9A9A9F', whiteSpace: 'nowrap' as const }}>{group.name}</span> : <span style={{ fontSize: '12px', color: '#9A9A9F' }}>Individual</span>}
                        </div>
                        <div style={{ textAlign: 'center' as const }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: days !== null && days > 30 ? '#E03131' : '#9A9A9F' }}>{formatDaysAgo(days)}</div>
                        </div>
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
                        <div style={{ display: 'flex', gap: '5px', paddingLeft: '8px' }}>
                          <button onClick={() => router.push(`/dashboard/sessions/new?player=${player.id}`)} style={{ fontSize: '11px', padding: '5px 8px', borderRadius: '6px', border: '1px solid rgba(0,255,159,0.4)', background: '#1A1A1C', color: '#ffffff', cursor: 'pointer', whiteSpace: 'nowrap' as const, fontWeight: 500 }}>+ Session</button>
                          <button onClick={() => router.push(`/dashboard/players/${player.id}/log`)} style={{ fontSize: '11px', padding: '5px 8px', borderRadius: '6px', border: '1px solid rgba(0,255,159,0.4)', background: '#1A1A1C', color: '#ffffff', cursor: 'pointer', whiteSpace: 'nowrap' as const, fontWeight: 500 }}>Log</button>
                          {player.parent_email && (
                            <button onClick={() => setEmailingPlayer(player)} style={{ fontSize: '11px', padding: '5px 8px', borderRadius: '6px', border: '1px solid rgba(0,255,159,0.4)', background: '#1A1A1C', color: '#ffffff', cursor: 'pointer', fontWeight: 500 }}>Email</button>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
              <div className="player-cards" style={{ flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{filteredPlayers.length} player{filteredPlayers.length !== 1 ? 's' : ''}</span>
                </div>
                {filteredPlayers.map(player => {
                  const lastSession = getLastSession(player.id)
                  const days = getDaysSince(lastSession?.session_date || null)
                  const group = getGroup(player.group_id)
                  return (
                    <div key={player.id} style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(0,255,159,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, color: '#00FF9F', flexShrink: 0 }}>{getInitials(player.full_name)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div onClick={() => router.push(`/dashboard/players/${player.id}`)} style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{player.full_name}</div>
                        <div style={{ fontSize: '11px', color: '#9A9A9F', marginTop: '1px' }}>{group ? group.name : 'Individual'}</div>
                      </div>
                      <div style={{ textAlign: 'center' as const, flexShrink: 0, minWidth: '40px' }}>
                        <div style={{ fontSize: '9px', color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Last</div>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: days !== null && days > 30 ? '#E03131' : '#ffffff' }}>{formatDaysAgo(days)}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                        <button onClick={() => router.push(`/dashboard/sessions/new?player=${player.id}`)} style={{ fontSize: '10px', padding: '4px 7px', borderRadius: '5px', border: '1px solid rgba(0,255,159,0.4)', background: '#1A1A1C', color: '#ffffff', cursor: 'pointer', whiteSpace: 'nowrap' as const, fontWeight: 500 }}>+ Session</button>
                        <button onClick={() => router.push(`/dashboard/players/${player.id}/log`)} style={{ fontSize: '10px', padding: '4px 7px', borderRadius: '5px', border: '1px solid rgba(0,255,159,0.4)', background: '#1A1A1C', color: '#ffffff', cursor: 'pointer', whiteSpace: 'nowrap' as const, fontWeight: 500 }}>Log</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

          </div>

          {/* ===== RIGHT SIDEBAR ===== */}
          <div style={{ position: 'sticky', top: '76px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* REVENUE SNAPSHOT */}
            <RevenueSnapshot />

            {/* ACTION NEEDED */}
            {(unloggedSessions.length > 0 || players.filter(p => getStatus(p.id) === 'new').length > 0 || localSessionRequests.length > 0 || lowEngagementPlayers.length > 0) && (
              <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '14px', overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid #2A2A2D' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#9A9A9F', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>Action Needed</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {unloggedSessions.length > 0 && (
                    <div style={{ padding: '12px 16px', borderBottom: (players.filter(p => getStatus(p.id) === 'new').length > 0 || localSessionRequests.length > 0) ? '1px solid #2A2A2D' : 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F5A623', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>{unloggedSessions.length} unlogged session{unloggedSessions.length !== 1 ? 's' : ''}</div>
                        <div style={{ fontSize: '11px', color: '#9A9A9F', marginTop: '2px' }}>Keep your records up to date</div>
                      </div>
                      <button onClick={() => setShowUnlogged(!showUnlogged)} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(245,166,35,0.3)', background: 'transparent', color: '#F5A623', cursor: 'pointer', flexShrink: 0, fontWeight: 600 }}>Review</button>
                    </div>
                  )}
                  {players.filter(p => getStatus(p.id) === 'new').length > 0 && (
                    <div style={{ padding: '12px 16px', borderBottom: localSessionRequests.length > 0 ? '1px solid #2A2A2D' : 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4A9EFF', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>{players.filter(p => getStatus(p.id) === 'new').length} new player{players.filter(p => getStatus(p.id) === 'new').length !== 1 ? 's' : ''}</div>
                        <div style={{ fontSize: '11px', color: '#9A9A9F', marginTop: '2px' }}>Haven&apos;t had a session yet</div>
                      </div>
                      <button onClick={() => router.push('/dashboard/sessions/new')} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(74,158,255,0.3)', background: 'transparent', color: '#4A9EFF', cursor: 'pointer', flexShrink: 0, fontWeight: 600 }}>Schedule</button>
                    </div>
                  )}
                  {localSessionRequests.length > 0 && (
                    <div style={{ padding: '12px 16px', borderBottom: lowEngagementPlayers.length > 0 ? '1px solid #2A2A2D' : 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00FF9F', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>{localSessionRequests.length} session request{localSessionRequests.length !== 1 ? 's' : ''}</div>
                        <div style={{ fontSize: '11px', color: '#9A9A9F', marginTop: '2px' }}>Players waiting for a response</div>
                      </div>
                      <button onClick={() => router.push('/dashboard/clients')} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(0,255,159,0.3)', background: 'transparent', color: '#00FF9F', cursor: 'pointer', flexShrink: 0, fontWeight: 600 }}>View</button>
                    </div>
                  )}
                  {lowEngagementPlayers.length > 0 && (
                    <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F5A623', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>{lowEngagementPlayers.length} low drill engagement</div>
                        <div style={{ fontSize: '11px', color: '#9A9A9F', marginTop: '2px' }}>Below 70% completion this week</div>
                      </div>
                      <button onClick={() => setShowDrillAlert(!showDrillAlert)} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(245,166,35,0.3)', background: 'transparent', color: '#F5A623', cursor: 'pointer', flexShrink: 0, fontWeight: 600 }}>Review</button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* DRILL ENGAGEMENT */}
            {(lowEngagementPlayers.length > 0 || drillNudgeLoading) && showDrillAlert && (
              <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '14px', overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid #2A2A2D', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#9A9A9F', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>Drill Engagement</div>
                  <button onClick={() => setShowDrillAlert(false)} style={{ background: 'none', border: 'none', color: '#9A9A9F', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}>×</button>
                </div>
                {lowEngagementPlayers.map((item, i) => (
                  <div key={item.player.id} onClick={() => router.push(`/dashboard/players/${item.player.id}`)} style={{ padding: '12px 16px', borderBottom: i < lowEngagementPlayers.length - 1 ? '1px solid #2A2A2D' : 'none', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>{item.player.full_name.split(' ')[0]}</div>
                      <div style={{ marginTop: '5px', height: '4px', borderRadius: '99px', background: '#2A2A2D', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${item.pct}%`, background: item.pct === 0 ? '#E03131' : '#F5A623', borderRadius: '99px' }} />
                      </div>
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: item.pct === 0 ? '#E03131' : '#F5A623', flexShrink: 0 }}>{item.pct}%</div>
                  </div>
                ))}
                {drillNudgeLoading && (
                  <div style={{ padding: '12px 16px', fontSize: '12px', color: '#9A9A9F', fontStyle: 'italic', borderTop: lowEngagementPlayers.length > 0 ? '1px solid #2A2A2D' : 'none' }}>Getting coaching tip…</div>
                )}
                {drillNudge && !drillNudgeLoading && (
                  <div style={{ padding: '12px 16px', borderTop: '1px solid #2A2A2D', fontSize: '12px', color: '#9A9A9F', lineHeight: 1.5 }}>
                    <span style={{ color: '#F5A623', fontWeight: 600 }}>Tip: </span>{drillNudge}
                  </div>
                )}
              </div>
            )}

            {/* QUICK NAV */}
            <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '14px', overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid #2A2A2D' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#9A9A9F', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>Quick Access</div>
              </div>
              {[
                { label: 'My Players', sub: `${players.length} player${players.length !== 1 ? 's' : ''}`, path: '/dashboard/clients' },
                { label: 'My Groups', sub: `${groups.length} group${groups.length !== 1 ? 's' : ''}`, path: '/dashboard/groups' },
                { label: 'Business Stats', sub: 'Revenue & metrics', path: '/dashboard/business' },
                { label: 'Settings', sub: 'Profile & rates', path: '/dashboard/settings' },
              ].map((item, i, arr) => (
                <div key={item.label} onClick={() => router.push(item.path)} style={{ padding: '12px 16px', borderBottom: i < arr.length - 1 ? '1px solid #2A2A2D' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>{item.label}</div>
                    <div style={{ fontSize: '11px', color: '#9A9A9F', marginTop: '2px' }}>{item.sub}</div>
                  </div>
                  <span style={{ color: '#9A9A9F', fontSize: '14px' }}>→</span>
                </div>
              ))}
            </div>

          </div>

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
{/* === MOBILE BOTTOM NAV === */}
<div className="mobile-bottom-nav" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: '72px', background: '#0E0E0F', borderTop: '1px solid #2A2A2D', zIndex: 200, alignItems: 'stretch' }}>
  {([
    { label: 'Hub', path: '/dashboard', active: true, icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    )},
    { label: 'Players', path: '/dashboard/clients', active: false, icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    )},
    { label: 'Sessions', path: '/dashboard/sessions/new', active: false, icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1" /><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" /><line x1="12" y1="11" x2="12" y2="17" /><line x1="9" y1="14" x2="15" y2="14" />
      </svg>
    )},
    { label: 'Business', path: '/dashboard/business', active: false, icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    )},
  ] as { label: string; path: string; active: boolean; icon: React.ReactNode }[]).map(tab => (
    <button
      key={tab.label}
      onClick={() => router.push(tab.path)}
      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px', background: 'none', border: 'none', cursor: 'pointer', color: tab.active ? '#00FF9F' : '#9A9A9F', padding: '8px 0' }}>
      {tab.icon}
      <span style={{ fontSize: '10px', fontWeight: tab.active ? 700 : 400 }}>{tab.label}</span>
    </button>
  ))}
</div>

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
