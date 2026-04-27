'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import NavBar from '@/components/NavBar'

const NEW_COLOR = '#4A9EFF'

interface Profile { id: string; full_name: string; email: string; individual_rate: number | null; group_rate: number | null }
interface Player {
  id: string; full_name: string; parent_email: string; parent_name?: string | null
  group_id: string | null; created_at: string; custom_rate: number | null
}
interface Session {
  id: string; player_id: string | null; group_id?: string | null
  session_date: string; session_time?: string | null
  session_type: string; status?: string | null; rate_override: number | null
}
interface Group { id: string; name: string; sport: string }
interface DrillWeek { id: string; player_id?: string | null; group_id?: string | null; week_start: string }
interface Drill { id: string; drill_week_id: string }
interface Completion { player_id: string; drill_id: string }

interface SessionPlayer { session_id: string; player_id: string }

interface Props {
  profile: Profile | null
  players: Player[]
  sessions: Session[]
  groups: Group[]
  sessionPlayers?: SessionPlayer[]
  drillWeeks?: DrillWeek[]
  drills?: Drill[]
  completions?: Completion[]
}

export default function ClientsPageClient({ profile, players, sessions, groups, sessionPlayers = [], drillWeeks = [], drills = [], completions = [] }: Props) {
  const router = useRouter()
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null)
  const [aiMessages, setAiMessages] = useState<Record<string, string>>({})
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [emailingPlayer, setEmailingPlayer] = useState<Player | null>(null)
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
  const todayStr = now.toISOString().split('T')[0]

  function openEmailModal(player: Player) {
    setEmailingPlayer(player)
    setEmailSubject('')
    setEmailBody('')
    setEmailSent(false)
    setEmailError(null)
  }

  function closeEmailModal() {
    setEmailingPlayer(null)
    setEmailSubject('')
    setEmailBody('')
    setEmailSent(false)
    setEmailError(null)
  }

  async function sendEmail() {
    if (!emailingPlayer?.parent_email || !emailBody.trim()) return
    setSendingEmail(true)
    setEmailError(null)
    const playerUrl = `${window.location.origin}/player?id=${emailingPlayer.id}`
    try {
      const res = await fetch('/api/send-player-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emailingPlayer.parent_email,
          subject: emailSubject.trim() || `Update from ${profile?.full_name || 'your trainer'}`,
          body: emailBody,
          playerName: emailingPlayer.full_name.split(' ')[0],
          playerUrl,
          trainerName: profile?.full_name || '',
          trainerEmail: profile?.email || '',
        }),
      })
      const data = await res.json()
      setSendingEmail(false)
      if (data.error) {
        setEmailError('Failed to send. Please try again.')
      } else {
        setEmailSent(true)
        setTimeout(closeEmailModal, 2000)
      }
    } catch {
      setSendingEmail(false)
      setEmailError('Failed to send. Please try again.')
    }
  }

  function getLastSession(playerId: string) {
    const ps = sessions.filter(s => s.player_id === playerId && s.session_date <= todayStr && s.status !== 'cancelled')
    return ps.length ? ps[0] : null
  }

  function getNextSession(player: Player) {
    const linkedSessionIds = new Set(
      sessionPlayers.filter(sp => sp.player_id === player.id).map(sp => sp.session_id)
    )
    const upcoming = sessions.filter(s => {
      if (s.session_date < todayStr) return false
      if (s.status === 'cancelled' || s.status === 'logged') return false
      if (s.player_id === player.id) return true
      if (linkedSessionIds.has(s.id)) return true
      if (player.group_id && s.group_id === player.group_id) return true
      return false
    })
    upcoming.sort((a, b) => a.session_date.localeCompare(b.session_date))
    return upcoming[0] || null
  }

  function formatNextSession(session: Session | null) {
    if (!session) return 'Unscheduled'
    const date = new Date(session.session_date + 'T00:00:00')
    const dayAbbr = date.toLocaleDateString('en-US', { weekday: 'short' })
    if (session.session_time) {
      const [h, m] = session.session_time.split(':')
      const hour = parseInt(h)
      const ampm = hour >= 12 ? 'pm' : 'am'
      const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
      const minStr = m === '00' ? '' : `:${m}`
      return `${dayAbbr} ${display}${minStr}${ampm}`
    }
    return dayAbbr
  }

  function getDaysSince(dateStr: string) {
    return Math.floor((now.getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
  }

  function getStatus(playerId: string) {
    const last = getLastSession(playerId)
    if (!last) return 'new'
    const d = new Date(last.session_date)
    if (d >= thirtyDaysAgo) return 'active'
    if (d >= sixtyDaysAgo) return 'at-risk'
    return 'lapsed'
  }

  function getPlayerRate(player: Player) {
    if (player.custom_rate !== null) return player.custom_rate
    if (player.group_id) return profile?.group_rate || 0
    return profile?.individual_rate || 0
  }

  function getSessionCount(playerId: string) {
    return sessions.filter(s => s.player_id === playerId).length
  }

  function getGroupSessionCount(playerId: string) {
    return sessions.filter(s => s.player_id === playerId && s.session_type === 'group').length
  }

  function getIndividualSessionCount(playerId: string) {
    return sessions.filter(s => s.player_id === playerId && s.session_type === 'individual').length
  }

  function getMonthlyRecoveryRevenue(player: Player) {
    const playerSessions = sessions.filter(s => s.player_id === player.id)
    if (playerSessions.length === 0) return 0
    const dates = playerSessions.map(s => new Date(s.session_date).getTime())
    const firstSession = new Date(Math.min(...dates))
    const lastSession = new Date(Math.max(...dates))
    const monthsActive = Math.max(1, (lastSession.getTime() - firstSession.getTime()) / (1000 * 60 * 60 * 24 * 30))
    const totalRevenue = playerSessions.reduce((sum, s) => {
      if (s.session_type === 'group') return sum + (profile?.group_rate || 0)
      return sum + (player.custom_rate ?? profile?.individual_rate ?? 0)
    }, 0)
    return Math.round(totalRevenue / monthsActive)
  }

  function formatCurrency(val: number) {
    return val.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  }

  function formatDaysAgo(days: number) {
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days}d ago`
    if (days < 30) return `${Math.floor(days / 7)}w ago`
    return `${Math.floor(days / 30)}mo ago`
  }

  function getInitials(name: string) {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??'
  }

  function getGroup(groupId: string | null) {
    if (!groupId) return null
    return groups.find(g => g.id === groupId) || null
  }

  function getCurrentDrillWeekForPlayer(player: Player): DrillWeek | null {
    const weeks = drillWeeks.filter(w =>
      w.player_id === player.id || (player.group_id && w.group_id === player.group_id)
    )
    if (weeks.length === 0) return null
    return weeks.sort((a, b) => b.week_start.localeCompare(a.week_start))[0]
  }

  function getPlayerDrillCounts(player: Player): { done: number; total: number; pct: number } | null {
    const week = getCurrentDrillWeekForPlayer(player)
    if (!week) return null
    const weekDrills = drills.filter(d => d.drill_week_id === week.id)
    if (weekDrills.length === 0) return null
    const done = weekDrills.filter(d => completions.some(c => c.drill_id === d.id && c.player_id === player.id)).length
    const pct = Math.round((done / weekDrills.length) * 100)
    return { done, total: weekDrills.length, pct }
  }

  function getFallbackMessage(player: Player) {
    const last = getLastSession(player.id)
    const days = last ? getDaysSince(last.session_date) : null
    const firstName = player.full_name.split(' ')[0]
    if (days === null) return `Hey! Just wanted to reach out about getting ${firstName} started with some training sessions. When works best for you?`
    if (days < 45) return `Hey! It's been a few weeks since ${firstName}'s last session. Want to get something on the schedule this week?`
    return `Hey! It's been a while since we've worked with ${firstName}. I have some availability coming up — would love to get back to work and keep the momentum going!`
  }

  async function generateAiMessage(player: Player) {
    setAiLoading(prev => ({ ...prev, [player.id]: true }))
    const last = getLastSession(player.id)
    const days = last ? getDaysSince(last.session_date) : null
    const sessionCount = getSessionCount(player.id)
    const group = getGroup(player.group_id)
    const firstName = player.full_name.split(' ')[0]
    const status = getStatus(player.id)
    const trainerName = profile?.full_name?.split(' ')[0] || 'Coach'

    const prompt = `You are a youth sports trainer writing a personal text message to re-engage a client's parent.

Trainer name: ${trainerName}
Player name: ${firstName}
Player status: ${status === 'at-risk' ? 'at risk (no session in 30-60 days)' : status === 'lapsed' ? 'lapsed (no session in 60+ days)' : 'new (no sessions yet)'}
Days since last session: ${days !== null ? days : 'never trained'}
Total sessions together: ${sessionCount}
Training type: ${group ? `group training (${group.name})` : 'individual training'}
Sport: ${group?.sport || 'basketball'}

Write a SHORT, warm, personal text message (2-3 sentences max) from the trainer to the parent to re-engage them.
- Sound like a real person, not a business
- Reference the specific situation naturally
- End with a soft call to action to book a session
- Do NOT use emojis
- Do NOT use generic phrases like "hope you're doing well"
- Do NOT mention money or rates
- Return ONLY the message text, nothing else`

    try {
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
      const message = data.content?.find((b: { type: string; text: string }) => b.type === 'text')?.text?.trim()
      setAiMessages(prev => ({ ...prev, [player.id]: message || getFallbackMessage(player) }))
    } catch {
      setAiMessages(prev => ({ ...prev, [player.id]: getFallbackMessage(player) }))
    } finally {
      setAiLoading(prev => ({ ...prev, [player.id]: false }))
    }
  }

  function copyMessage(playerId: string, message: string) {
    navigator.clipboard.writeText(message)
    setCopiedId(playerId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const activePlayers = players.filter(p => getStatus(p.id) === 'active')
  const atRiskPlayers = players.filter(p => getStatus(p.id) === 'at-risk')
  const lapsedPlayers = players.filter(p => getStatus(p.id) === 'lapsed')
  const newPlayers = players.filter(p => getStatus(p.id) === 'new')

  const totalAtRiskRevenue = atRiskPlayers.reduce((sum, p) => sum + getPlayerRate(p), 0)
  const totalLapsedRevenue = lapsedPlayers.reduce((sum, p) => sum + getMonthlyRecoveryRevenue(p), 0)
  const totalActiveMonthly = activePlayers.reduce((sum, p) => sum + getMonthlyRecoveryRevenue(p), 0)

  function filteredBySearch(arr: Player[]) {
    if (!search) return arr
    const q = search.toLowerCase()
    return arr.filter(p =>
      p.full_name.toLowerCase().includes(q) || p.parent_email?.toLowerCase().includes(q)
    )
  }

  const visibleActive = (statusFilter === 'all' || statusFilter === 'active') ? filteredBySearch(activePlayers) : []
  const visibleAtRisk = (statusFilter === 'all' || statusFilter === 'at-risk') ? filteredBySearch(atRiskPlayers) : []
  const visibleLapsed = (statusFilter === 'all' || statusFilter === 'lapsed') ? filteredBySearch(lapsedPlayers) : []
  const visibleNew = (statusFilter === 'all' || statusFilter === 'new') ? filteredBySearch(newPlayers) : []

  function getInsight() {
    if (players.length === 0) return null
    if (atRiskPlayers.length === 0 && lapsedPlayers.length === 0) {
      return { text: 'All clients active — strong retention this month', color: '#00FF9F', symbol: '✦' }
    }
    if (lapsedPlayers.length > 0) {
      return { text: `${lapsedPlayers.length} client${lapsedPlayers.length !== 1 ? 's' : ''} lapsed — revenue recovery needed`, color: '#E03131', symbol: '!' }
    }
    return { text: `${atRiskPlayers.length} client${atRiskPlayers.length !== 1 ? 's' : ''} at risk — reach out soon`, color: '#F5A623', symbol: '⚠' }
  }
  const insight = getInsight()

  // ── Desktop sub-components ────────────────────────────────────────────
  function StatColumns({ playerId, days, player }: { playerId: string; days: number | null; player: Player }) {
    const dc = getPlayerDrillCounts(player)
    if (dc !== null && (dc.pct === null || dc.pct === undefined || isNaN(dc.pct))) {
      console.warn(`[DrillEngagement] invalid pct for player ${player.id}:`, dc)
    }
    const drillColor = dc ? (dc.pct >= 70 ? '#1dce7c' : dc.pct === 0 ? '#E03131' : '#F5A623') : '#9A9A9F'
    return (
      <div style={{ display: 'flex', gap: '20px', flexShrink: 0 }}>
        <div style={{ textAlign: 'center' as const }}>
          <div style={{ fontSize: '11px', color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Last session</div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>{days !== null ? formatDaysAgo(days) : '—'}</div>
        </div>
        <div style={{ textAlign: 'center' as const }}>
          <div style={{ fontSize: '11px', color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Group</div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>{getGroupSessionCount(playerId)}</div>
        </div>
        <div style={{ textAlign: 'center' as const }}>
          <div style={{ fontSize: '11px', color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Individual</div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>{getIndividualSessionCount(playerId)}</div>
        </div>
        {dc && (
          <div style={{ textAlign: 'center' as const }}>
            <div style={{ fontSize: '11px', color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Drills</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: drillColor }}>{dc.pct}%</div>
          </div>
        )}
      </div>
    )
  }

  function ActionButtons({ player, accentColor }: { player: Player; accentColor: string }) {
    const isExpanded = expandedPlayer === player.id
    return (
      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
        <button
          onClick={() => router.push(`/dashboard/sessions/new?player=${player.id}`)}
          style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(0,255,159,0.4)', background: '#1A1A1C', color: '#9A9A9F', cursor: 'pointer', fontWeight: 500 }}>
          Schedule
        </button>
        <button
          onClick={() => setExpandedPlayer(isExpanded ? null : player.id)}
          style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '8px', border: `1px solid ${accentColor}50`, background: 'transparent', color: '#9A9A9F', cursor: 'pointer' }}>
          {isExpanded ? '▲ Hide' : 'Re-engage'}
        </button>
      </div>
    )
  }

  function PlayerMessageBox({ player, accentColor }: { player: Player; accentColor: string }) {
    const message = aiMessages[player.id]
    const loading = aiLoading[player.id]
    const isCopied = copiedId === player.id
    return (
      <div style={{ padding: '0 20px 16px', borderTop: '1px solid #2A2A2D' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '14px 0 10px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Re-engagement message</div>
          <button
            onClick={() => generateAiMessage(player)}
            disabled={loading}
            style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', border: `1px solid ${accentColor}`, background: 'transparent', color: accentColor, cursor: loading ? 'default' : 'pointer', fontWeight: 600, opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Generating...' : message ? '↺ Regenerate' : '✦ Generate with AI'}
          </button>
        </div>
        {!message && !loading && (
          <div style={{ background: '#0E0E0F', borderRadius: '8px', padding: '12px 14px', fontSize: '13px', color: '#9A9A9F', lineHeight: 1.6, marginBottom: '10px', fontStyle: 'italic' }}>
            Click &ldquo;Generate with AI&rdquo; to create a personalized message based on {player.full_name.split(' ')[0]}&apos;s history
          </div>
        )}
        {loading && (
          <div style={{ background: '#0E0E0F', borderRadius: '8px', padding: '12px 14px', fontSize: '13px', color: '#9A9A9F', lineHeight: 1.6, marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: accentColor, animation: 'pulse 1s infinite' }} />
              Writing a personalized message...
            </div>
          </div>
        )}
        {message && !loading && (
          <div style={{ background: '#0E0E0F', borderRadius: '8px', padding: '12px 14px', fontSize: '13px', color: '#ffffff', lineHeight: 1.6, marginBottom: '10px', border: `1px solid ${accentColor}30` }}>
            {message}
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px' }}>
          {message && (
            <button
              onClick={() => copyMessage(player.id, message)}
              style={{ fontSize: '12px', padding: '7px 14px', borderRadius: '8px', border: 'none', background: isCopied ? '#00FF9F' : accentColor, color: '#0E0E0F', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>
              {isCopied ? '✓ Copied!' : 'Copy message'}
            </button>
          )}
          <button
            onClick={() => router.push(`/dashboard/players/${player.id}/log`)}
            style={{ fontSize: '12px', padding: '7px 14px', borderRadius: '8px', border: '1px solid #2A2A2D', background: 'transparent', color: '#ffffff', cursor: 'pointer' }}>
            Log session
          </button>
          <button
            onClick={() => router.push(`/dashboard/players/${player.id}`)}
            style={{ fontSize: '12px', padding: '7px 14px', borderRadius: '8px', border: '1px solid #2A2A2D', background: 'transparent', color: '#9A9A9F', cursor: 'pointer' }}>
            View profile
          </button>
        </div>
      </div>
    )
  }

  // ── Mobile player card renderer ───────────────────────────────────────
  function renderMobileCard(player: Player, accentColor: string, statusLabel: string, canReengage: boolean) {
    const last = getLastSession(player.id)
    const days = last ? getDaysSince(last.session_date) : null
    const group = getGroup(player.group_id)
    const nextSess = getNextSession(player)
    const sessionCount = getSessionCount(player.id)
    const message = aiMessages[player.id]
    const loading = aiLoading[player.id]
    const isCopied = copiedId === player.id
    const isExpanded = expandedPlayer === player.id
    const parentDisplay = (player as Player & { parent_name?: string }).parent_name || player.parent_email

    return (
      <div key={player.id} style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '14px', overflow: 'hidden', marginBottom: '10px' }}>

        {/* Header row */}
        <div style={{ padding: '14px 14px 12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: `${accentColor}1A`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: accentColor, flexShrink: 0 }}>
            {getInitials(player.full_name)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
              {player.full_name}
            </div>
            <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '1px' }}>
              {group ? group.name : 'Individual · No group'}
            </div>
          </div>
          <div style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '99px', border: `1px solid ${accentColor}`, color: accentColor, flexShrink: 0 }}>
            {statusLabel}
          </div>
        </div>

        {/* Stats row */}
        <div style={{ padding: '10px 14px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderTop: '1px solid #2A2A2D' }}>
          <div>
            <div style={{ fontSize: '9px', color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px' }}>Last Session</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>{days !== null ? formatDaysAgo(days) : 'None yet'}</div>
          </div>
          <div>
            <div style={{ fontSize: '9px', color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px' }}>Next Session</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>{formatNextSession(nextSess)}</div>
          </div>
          <div>
            <div style={{ fontSize: '9px', color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px' }}>Total</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>{sessionCount === 0 ? '0' : `${sessionCount} session${sessionCount !== 1 ? 's' : ''}`}</div>
          </div>
        </div>

        {/* Drill engagement row */}
        {(() => {
          const dc = getPlayerDrillCounts(player)
          if (!dc) return null
          if (dc.pct === null || dc.pct === undefined || isNaN(dc.pct)) {
            console.warn(`[DrillEngagement] invalid pct for player ${player.id}:`, dc)
            return null
          }
          const drillColor = dc.pct >= 70 ? '#1dce7c' : dc.pct === 0 ? '#E03131' : '#F5A623'
          return (
            <div style={{ padding: '8px 14px', borderTop: '1px solid #2A2A2D', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ fontSize: '9px', color: '#9A9A9F', textTransform: 'uppercase' as const, letterSpacing: '0.06em', flexShrink: 0 }}>Drills this week</div>
              <div style={{ flex: 1, height: '4px', borderRadius: '99px', background: '#2A2A2D', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${dc.pct}%`, background: drillColor, borderRadius: '99px' }} />
              </div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: drillColor, flexShrink: 0 }}>{dc.pct}%</div>
            </div>
          )
        })()}

        {/* Parent + email */}
        {parentDisplay && (
          <div style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid #2A2A2D' }}>
            <div style={{ fontSize: '12px', color: '#9A9A9F', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
              Parent: <span style={{ color: '#ffffff' }}>{parentDisplay}</span>
            </div>
            <button
              onClick={() => openEmailModal(player)}
              style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '8px', border: '1px solid #2A2A2D', background: 'transparent', color: '#ffffff', cursor: 'pointer', flexShrink: 0, fontWeight: 500, whiteSpace: 'nowrap' as const }}>
              Send Email
            </button>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ padding: '10px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', borderTop: '1px solid #2A2A2D' }}>
          <button
            onClick={() => router.push(`/dashboard/sessions/new?player=${player.id}`)}
            style={{ padding: '10px 8px', borderRadius: '8px', border: '1px solid #2A2A2D', background: 'transparent', color: '#ffffff', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
            {sessionCount === 0 ? 'Schedule First Session' : 'Schedule Session'}
          </button>
          <button
            onClick={() => router.push(`/dashboard/players/${player.id}`)}
            style={{ padding: '10px', borderRadius: '8px', border: '1px solid #2A2A2D', background: 'transparent', color: '#ffffff', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
            Profile
          </button>
        </div>

        {/* Re-engage expand (at-risk / lapsed) */}
        {canReengage && (
          <>
            <div style={{ padding: '0 14px 10px' }}>
              <button
                onClick={() => setExpandedPlayer(isExpanded ? null : player.id)}
                style={{ width: '100%', padding: '8px', borderRadius: '8px', border: `1px solid ${accentColor}50`, background: 'transparent', color: accentColor, cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                {isExpanded ? '▲ Hide re-engage message' : '✦ Generate re-engage message'}
              </button>
            </div>
            {isExpanded && (
              <div style={{ padding: '0 14px 14px', borderTop: '1px solid #2A2A2D' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '12px 0 8px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Re-engagement message</div>
                  <button
                    onClick={() => generateAiMessage(player)}
                    disabled={loading}
                    style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', border: `1px solid ${accentColor}`, background: 'transparent', color: accentColor, cursor: loading ? 'default' : 'pointer', fontWeight: 600, opacity: loading ? 0.6 : 1 }}>
                    {loading ? 'Generating...' : message ? '↺ Regenerate' : '✦ AI generate'}
                  </button>
                </div>
                {!message && !loading && (
                  <div style={{ background: '#0E0E0F', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#9A9A9F', lineHeight: 1.6, marginBottom: '8px', fontStyle: 'italic' }}>
                    Tap &ldquo;AI generate&rdquo; to write a personalized re-engagement message
                  </div>
                )}
                {loading && (
                  <div style={{ background: '#0E0E0F', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#9A9A9F', lineHeight: 1.6, marginBottom: '8px' }}>
                    Writing a personalized message...
                  </div>
                )}
                {message && !loading && (
                  <>
                    <div style={{ background: '#0E0E0F', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#ffffff', lineHeight: 1.6, marginBottom: '8px', border: `1px solid ${accentColor}30` }}>
                      {message}
                    </div>
                    <button
                      onClick={() => copyMessage(player.id, message)}
                      style={{ fontSize: '12px', padding: '7px 14px', borderRadius: '8px', border: 'none', background: isCopied ? '#00FF9F' : accentColor, color: '#0E0E0F', fontWeight: 600, cursor: 'pointer' }}>
                      {isCopied ? '✓ Copied!' : 'Copy message'}
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  function MobileSectionHeader({ label, count, color }: { label: string; count: number; color: string }) {
    return (
      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }} />
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.08em', flex: 1 }}>{label}</span>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#9A9A9F', background: '#2A2A2D', padding: '2px 8px', borderRadius: '99px' }}>{count}</span>
        </div>
        <div style={{ height: '2px', background: color, borderRadius: '1px', opacity: 0.6 }} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', fontFamily: 'sans-serif', overflowX: 'hidden', maxWidth: '100vw', width: '100%' }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { overflow-x: hidden; max-width: 100vw; background: #0E0E0F; }
        .mobile-players { display: none; }
        .mobile-bottom-nav-clients { display: none; }
        @media (max-width: 640px) {
          .kpi-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .desktop-players { display: none !important; }
          .mobile-players { display: flex !important; flex-direction: column; }
          .mobile-bottom-nav-clients { display: flex !important; }
        }
        @media (min-width: 641px) {
          .mobile-players { display: none !important; }
          .mobile-bottom-nav-clients { display: none !important; }
        }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        select { -webkit-appearance: none; }
      `}</style>

      <NavBar trainerName={profile?.full_name} />

      {/* ═══════════════════════════════════════
          MOBILE LAYOUT
      ═══════════════════════════════════════ */}
      <div className="mobile-players" style={{ flexDirection: 'column', paddingBottom: '88px' }}>

        {/* Header */}
        <div style={{ padding: '20px 16px 8px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#ffffff', margin: 0 }}>My Players</h1>
          {insight && (
            <p style={{ fontSize: '13px', color: insight.color, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>{insight.symbol}</span> {insight.text}
            </p>
          )}
        </div>

        {/* Search + filter */}
        <div style={{ padding: '8px 16px 12px', display: 'flex', gap: '8px' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9A9A9F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search players..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '10px', padding: '10px 12px 10px 34px', fontSize: '14px', color: '#ffffff', outline: 'none' }}
            />
          </div>
          <div style={{ position: 'relative' }}>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '10px', padding: '10px 28px 10px 12px', fontSize: '13px', color: '#ffffff', outline: 'none', cursor: 'pointer', appearance: 'none' }}>
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="at-risk">At Risk</option>
              <option value="lapsed">Lapsed</option>
              <option value="new">New</option>
            </select>
            <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9A9A9F', fontSize: '10px', pointerEvents: 'none' }}>▼</span>
          </div>
        </div>

        {/* KPI cards */}
        <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          {[
            { label: 'Active', count: activePlayers.length, sub: `${formatCurrency(totalActiveMonthly)}/mo revenue`, color: '#00FF9F' },
            { label: 'At Risk', count: atRiskPlayers.length, sub: `${formatCurrency(totalAtRiskRevenue)} at risk`, color: '#F5A623' },
            { label: 'Lapsed', count: lapsedPlayers.length, sub: `${formatCurrency(totalLapsedRevenue)} recoverable`, color: '#E03131' },
            { label: 'New', count: newPlayers.length, sub: 'No sessions yet', color: NEW_COLOR },
          ].map(kpi => (
            <div key={kpi.label} style={{ background: '#1A1A1C', borderRadius: '12px', padding: '14px', borderBottom: `3px solid ${kpi.color}`, border: '1px solid #2A2A2D', borderBottomColor: kpi.color }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: kpi.color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>{kpi.label}</div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#ffffff', lineHeight: 1, marginBottom: '4px' }}>{kpi.count}</div>
              <div style={{ fontSize: '11px', color: '#9A9A9F' }}>{kpi.sub}</div>
            </div>
          ))}
        </div>

        {/* NEW CLIENTS */}
        {visibleNew.length > 0 && (
          <div style={{ padding: '0 16px 16px' }}>
            <MobileSectionHeader label="New Clients" count={visibleNew.length} color={NEW_COLOR} />
            {visibleNew.map(p => renderMobileCard(p, NEW_COLOR, 'New', false))}
          </div>
        )}

        {/* AT RISK */}
        {visibleAtRisk.length > 0 && (
          <div style={{ padding: '0 16px 16px' }}>
            <MobileSectionHeader label="At Risk" count={visibleAtRisk.length} color="#F5A623" />
            {visibleAtRisk.map(p => renderMobileCard(p, '#F5A623', 'At Risk', true))}
          </div>
        )}

        {/* LAPSED */}
        {visibleLapsed.length > 0 && (
          <div style={{ padding: '0 16px 16px' }}>
            <MobileSectionHeader label="Lapsed" count={visibleLapsed.length} color="#E03131" />
            {visibleLapsed.map(p => renderMobileCard(p, '#E03131', 'Lapsed', true))}
          </div>
        )}

        {/* ACTIVE CLIENTS */}
        {visibleActive.length > 0 && (
          <div style={{ padding: '0 16px 16px' }}>
            <MobileSectionHeader label="Active Clients" count={visibleActive.length} color="#00FF9F" />
            {visibleActive.map(p => renderMobileCard(p, '#00FF9F', 'Active', false))}
          </div>
        )}

        {/* Empty state */}
        {visibleNew.length === 0 && visibleAtRisk.length === 0 && visibleLapsed.length === 0 && visibleActive.length === 0 && (
          <div style={{ padding: '40px 16px', textAlign: 'center' }}>
            <p style={{ fontSize: '14px', color: '#9A9A9F', marginBottom: '16px' }}>
              {players.length === 0 ? 'No players yet' : 'No players match your search'}
            </p>
            {players.length === 0 && (
              <button onClick={() => router.push('/dashboard/players/new')} style={{ background: '#00FF9F', color: '#0E0E0F', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>
                Add first player
              </button>
            )}
          </div>
        )}

      </div>

      {/* ═══════════════════════════════════════
          DESKTOP LAYOUT
      ═══════════════════════════════════════ */}
      <div className="desktop-players" style={{ maxWidth: '1100px', margin: '0 auto', padding: '20px 16px', width: '100%' }}>

        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#ffffff', fontFamily: '"Exo 2", sans-serif', marginBottom: '4px' }}>My Players</h1>
          <p style={{ fontSize: '14px', color: '#9A9A9F' }}>{players.length} total clients · Focus on reengagement to protect your revenue</p>
        </div>

        {/* KPI ROW */}
        <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px', marginBottom: '28px' }}>
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '18px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: '#00FF9F', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Active</div>
            <div style={{ fontFamily: 'monospace', fontSize: '28px', fontWeight: 700, color: '#ffffff', lineHeight: 1 }}>{activePlayers.length}</div>
            <div style={{ fontSize: '11px', color: '#9A9A9F', marginTop: '6px' }}>{formatCurrency(totalActiveMonthly)}/mo est. revenue</div>
          </div>
          <div style={{ background: '#1A1A1C', border: '1px solid rgba(245,166,35,0.2)', borderRadius: '12px', padding: '18px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: '#F5A623', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>At risk</div>
            <div style={{ fontFamily: 'monospace', fontSize: '28px', fontWeight: 700, color: '#ffffff', lineHeight: 1 }}>{atRiskPlayers.length}</div>
            <div style={{ fontSize: '11px', color: '#9A9A9F', marginTop: '6px' }}>{formatCurrency(totalAtRiskRevenue)} at risk</div>
          </div>
          <div style={{ background: '#1A1A1C', border: '1px solid rgba(224,49,49,0.2)', borderRadius: '12px', padding: '18px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: '#E03131', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Lapsed</div>
            <div style={{ fontFamily: 'monospace', fontSize: '28px', fontWeight: 700, color: '#ffffff', lineHeight: 1 }}>{lapsedPlayers.length}</div>
            <div style={{ fontSize: '11px', color: '#9A9A9F', marginTop: '6px' }}>{formatCurrency(totalLapsedRevenue)}/mo recoverable</div>
          </div>
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '18px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>New</div>
            <div style={{ fontFamily: 'monospace', fontSize: '28px', fontWeight: 700, color: '#ffffff', lineHeight: 1 }}>{newPlayers.length}</div>
            <div style={{ fontSize: '11px', color: '#9A9A9F', marginTop: '6px' }}>No sessions yet</div>
          </div>
        </div>

        {/* AT RISK */}
        {atRiskPlayers.length > 0 && (
          <div style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F5A623' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#F5A623', textTransform: 'uppercase', letterSpacing: '0.08em' }}>At risk — act now</span>
              <span style={{ fontSize: '12px', color: '#9A9A9F' }}>Haven&apos;t trained in 30–60 days</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {atRiskPlayers.map(player => {
                const last = getLastSession(player.id)
                const days = last ? getDaysSince(last.session_date) : null
                const group = getGroup(player.group_id)
                return (
                  <div key={player.id} style={{ background: '#1A1A1C', border: '1px solid rgba(245,166,35,0.25)', borderRadius: '12px', overflow: 'hidden' }}>
                    <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' as const }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(245,166,35,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600, color: '#F5A623', flexShrink: 0 }}>{getInitials(player.full_name)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div onClick={() => router.push(`/dashboard/players/${player.id}`)} style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.2)' }}>{player.full_name}</div>
                        <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>{group ? group.name : 'Individual'}</div>
                      </div>
                      <StatColumns playerId={player.id} days={days} player={player} />
                      <ActionButtons player={player} accentColor="#F5A623" />
                    </div>
                    {expandedPlayer === player.id && <PlayerMessageBox player={player} accentColor="#F5A623" />}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* LAPSED */}
        {lapsedPlayers.length > 0 && (
          <div style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#E03131' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#E03131', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Lapsed — revenue lost</span>
              <span style={{ fontSize: '12px', color: '#9A9A9F' }}>No sessions in 60+ days</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {lapsedPlayers.map(player => {
                const last = getLastSession(player.id)
                const days = last ? getDaysSince(last.session_date) : null
                const monthlyRecovery = getMonthlyRecoveryRevenue(player)
                const group = getGroup(player.group_id)
                return (
                  <div key={player.id} style={{ background: '#1A1A1C', border: '1px solid rgba(224,49,49,0.25)', borderRadius: '12px', overflow: 'hidden' }}>
                    <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' as const }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(224,49,49,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600, color: '#E03131', flexShrink: 0 }}>{getInitials(player.full_name)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div onClick={() => router.push(`/dashboard/players/${player.id}`)} style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.2)' }}>{player.full_name}</div>
                        <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>{group ? group.name : 'Individual'} · {formatCurrency(monthlyRecovery)}/mo potential recovery</div>
                      </div>
                      <StatColumns playerId={player.id} days={days} player={player} />
                      <ActionButtons player={player} accentColor="#E03131" />
                    </div>
                    {expandedPlayer === player.id && <PlayerMessageBox player={player} accentColor="#E03131" />}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ACTIVE */}
        {activePlayers.length > 0 && (
          <div style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00FF9F' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#00FF9F', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Active clients</span>
              <span style={{ fontSize: '12px', color: '#9A9A9F' }}>Trained in the last 30 days</span>
            </div>
            <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', overflow: 'hidden' }}>
              {activePlayers.map((player, i) => {
                const last = getLastSession(player.id)
                const days = last ? getDaysSince(last.session_date) : null
                const group = getGroup(player.group_id)
                return (
                  <div key={player.id} style={{ overflow: 'hidden' }}>
                    <div style={{ padding: '14px 20px', borderBottom: expandedPlayer === player.id || i < activePlayers.length - 1 ? '1px solid #2A2A2D' : 'none', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' as const }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(0,255,159,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, color: '#00FF9F', flexShrink: 0 }}>{getInitials(player.full_name)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div onClick={() => router.push(`/dashboard/players/${player.id}`)} style={{ fontSize: '14px', fontWeight: 500, color: '#ffffff', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.2)' }}>{player.full_name}</div>
                        <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>{group ? group.name : 'Individual'}</div>
                      </div>
                      <StatColumns playerId={player.id} days={days} player={player} />
                      <ActionButtons player={player} accentColor="#00FF9F" />
                    </div>
                    {expandedPlayer === player.id && <PlayerMessageBox player={player} accentColor="#00FF9F" />}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* NEW */}
        {newPlayers.length > 0 && (
          <div style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#9A9A9F' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.08em' }}>New — no sessions yet</span>
            </div>
            <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', overflow: 'hidden' }}>
              {newPlayers.map((player, i) => {
                const group = getGroup(player.group_id)
                return (
                  <div key={player.id} style={{ overflow: 'hidden' }}>
                    <div style={{ padding: '14px 20px', borderBottom: expandedPlayer === player.id || i < newPlayers.length - 1 ? '1px solid #2A2A2D' : 'none', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' as const }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#2A2A2D', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, color: '#9A9A9F', flexShrink: 0 }}>{getInitials(player.full_name)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div onClick={() => router.push(`/dashboard/players/${player.id}`)} style={{ fontSize: '14px', fontWeight: 500, color: '#ffffff', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.2)' }}>{player.full_name}</div>
                        <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>{group ? group.name : 'Individual'} · No sessions yet</div>
                      </div>
                      <StatColumns playerId={player.id} days={null} player={player} />
                      <ActionButtons player={player} accentColor="#9A9A9F" />
                    </div>
                    {expandedPlayer === player.id && <PlayerMessageBox player={player} accentColor="#9A9A9F" />}
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </div>

      {/* ═══════════════════════════════════════
          EMAIL COMPOSE MODAL
      ═══════════════════════════════════════ */}
      {emailingPlayer && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}
          onClick={e => { if (e.target === e.currentTarget) closeEmailModal() }}>
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '480px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>
                  Email re: {emailingPlayer.full_name.split(' ')[0]}
                </div>
                <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '3px' }}>
                  To: {emailingPlayer.parent_email}
                </div>
              </div>
              <button
                onClick={closeEmailModal}
                style={{ background: 'none', border: 'none', color: '#9A9A9F', cursor: 'pointer', fontSize: '22px', lineHeight: 1, padding: '0 0 0 12px', flexShrink: 0 }}>
                ×
              </button>
            </div>

            {/* Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input
                type="text"
                placeholder={`Update from ${profile?.full_name || 'your trainer'}`}
                value={emailSubject}
                onChange={e => setEmailSubject(e.target.value)}
                style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }}
              />
              <textarea
                autoFocus
                placeholder="Write your message..."
                value={emailBody}
                onChange={e => setEmailBody(e.target.value)}
                rows={6}
                style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%', resize: 'vertical' as const, fontFamily: 'sans-serif' }}
              />

              {emailError && (
                <div style={{ fontSize: '13px', color: '#E03131', padding: '8px 12px', background: 'rgba(224,49,49,0.08)', border: '1px solid rgba(224,49,49,0.2)', borderRadius: '8px' }}>
                  {emailError}
                </div>
              )}

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                <button
                  onClick={closeEmailModal}
                  style={{ flex: 1, background: 'transparent', color: '#9A9A9F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '12px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button
                  onClick={sendEmail}
                  disabled={sendingEmail || emailSent || !emailBody.trim()}
                  style={{ flex: 2, background: emailSent ? 'rgba(0,255,159,0.15)' : emailBody.trim() ? '#00FF9F' : '#2A2A2D', color: emailSent ? '#00FF9F' : emailBody.trim() ? '#0E0E0F' : '#9A9A9F', border: emailSent ? '1px solid rgba(0,255,159,0.3)' : 'none', borderRadius: '8px', padding: '12px', fontSize: '14px', fontWeight: 700, cursor: emailBody.trim() && !sendingEmail && !emailSent ? 'pointer' : 'default', transition: 'background 0.15s' }}>
                  {emailSent ? '✓ Email sent' : sendingEmail ? 'Sending...' : 'Send email'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          MOBILE BOTTOM NAV
      ═══════════════════════════════════════ */}
      <div className="mobile-bottom-nav-clients" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: '72px', background: '#0E0E0F', borderTop: '1px solid #2A2A2D', zIndex: 200, alignItems: 'stretch' }}>
        {([
          { label: 'Hub', path: '/dashboard', active: false, icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          )},
          { label: 'Players', path: '/dashboard/clients', active: true, icon: (
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

    </div>
  )
}
