'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import NavBar from '@/components/NavBar'

interface Profile { id: string; full_name: string; individual_rate: number | null; group_rate: number | null }
interface Player { id: string; full_name: string; parent_email: string; group_id: string | null; created_at: string; custom_rate: number | null }
interface Session { id: string; player_id: string; session_date: string; session_type: string; rate_override: number | null }
interface Group { id: string; name: string; sport: string }

interface Props {
  profile: Profile | null
  players: Player[]
  sessions: Session[]
  groups: Group[]
}

export default function ClientsPageClient({ profile, players, sessions, groups }: Props) {
  const router = useRouter()
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null)
  const [aiMessages, setAiMessages] = useState<Record<string, string>>({})
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

  function getLastSession(playerId: string) {
    const ps = sessions.filter(s => s.player_id === playerId)
    return ps.length ? ps[0] : null
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

  function getWeeksLapsed(playerId: string) {
    const last = getLastSession(playerId)
    if (!last) return null
    return Math.floor(getDaysSince(last.session_date) / 7)
  }

  function getEstimatedLostRevenue(player: Player) {
    const rate = getPlayerRate(player)
    const weeks = getWeeksLapsed(player.id) || 0
    return rate * Math.max(0, weeks - 4)
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
  const totalLapsedRevenue = lapsedPlayers.reduce((sum, p) => sum + getEstimatedLostRevenue(p), 0)
  const totalActiveMonthly = activePlayers.reduce((sum, p) => sum + getPlayerRate(p), 0)

  function StatColumns({ playerId, days }: { playerId: string; days: number | null }) {
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
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Re-engagement message
          </div>
          <button
            onClick={() => generateAiMessage(player)}
            disabled={loading}
            style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', border: `1px solid ${accentColor}`, background: 'transparent', color: accentColor, cursor: loading ? 'default' : 'pointer', fontWeight: 600, opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Generating...' : message ? '↺ Regenerate' : '✦ Generate with AI'}
          </button>
        </div>

        {!message && !loading && (
          <div style={{ background: '#0E0E0F', borderRadius: '8px', padding: '12px 14px', fontSize: '13px', color: '#9A9A9F', lineHeight: 1.6, marginBottom: '10px', fontStyle: 'italic' }}>
            Click "Generate with AI" to create a personalized message based on {player.full_name.split(' ')[0]}&apos;s history
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

  return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', fontFamily: 'sans-serif', overflowX: 'hidden', maxWidth: '100vw', width: '100%' }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { overflow-x: hidden; max-width: 100vw; background: #0E0E0F; }
        @media (max-width: 640px) { .kpi-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>

      <NavBar trainerName={profile?.full_name} />

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '20px 16px', width: '100%' }}>

        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#ffffff', fontFamily: '"Exo 2", sans-serif', marginBottom: '4px' }}>My Players</h1>
          <p style={{ fontSize: '14px', color: '#9A9A9F' }}>{players.length} total clients · Focus on reengagement to protect your revenue</p>
        </div>

        {/* KPI ROW */}
        <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px', marginBottom: '28px' }}>
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '18px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: '#00FF9F', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Active</div>
            <div style={{ fontFamily: 'monospace', fontSize: '28px', fontWeight: 700, color: '#ffffff', lineHeight: 1 }}>{activePlayers.length}</div>
            <div style={{ fontSize: '11px', color: '#9A9A9F', marginTop: '6px' }}>{formatCurrency(totalActiveMonthly)}/session avg</div>
          </div>
          <div style={{ background: '#1A1A1C', border: '1px solid rgba(245,166,35,0.2)', borderRadius: '12px', padding: '18px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: '#F5A623', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>At risk</div>
            <div style={{ fontFamily: 'monospace', fontSize: '28px', fontWeight: 700, color: '#ffffff', lineHeight: 1 }}>{atRiskPlayers.length}</div>
            <div style={{ fontSize: '11px', color: '#9A9A9F', marginTop: '6px' }}>{formatCurrency(totalAtRiskRevenue)} at risk</div>
          </div>
          <div style={{ background: '#1A1A1C', border: '1px solid rgba(224,49,49,0.2)', borderRadius: '12px', padding: '18px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: '#E03131', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Lapsed</div>
            <div style={{ fontFamily: 'monospace', fontSize: '28px', fontWeight: 700, color: '#ffffff', lineHeight: 1 }}>{lapsedPlayers.length}</div>
            <div style={{ fontSize: '11px', color: '#9A9A9F', marginTop: '6px' }}>{formatCurrency(totalLapsedRevenue)} lost</div>
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
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(245,166,35,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600, color: '#F5A623', flexShrink: 0 }}>
                        {getInitials(player.full_name)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div onClick={() => router.push(`/dashboard/players/${player.id}`)} style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.2)' }}>
                          {player.full_name}
                        </div>
                        <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>
                          {group ? group.name : 'Individual'}
                        </div>
                      </div>
                      <StatColumns playerId={player.id} days={days} />
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
                const lostRevenue = getEstimatedLostRevenue(player)
                const group = getGroup(player.group_id)
                return (
                  <div key={player.id} style={{ background: '#1A1A1C', border: '1px solid rgba(224,49,49,0.25)', borderRadius: '12px', overflow: 'hidden' }}>
                    <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' as const }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(224,49,49,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600, color: '#E03131', flexShrink: 0 }}>
                        {getInitials(player.full_name)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div onClick={() => router.push(`/dashboard/players/${player.id}`)} style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.2)' }}>
                          {player.full_name}
                        </div>
                        <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>
                          {group ? group.name : 'Individual'} · {formatCurrency(lostRevenue)} est. lost
                        </div>
                      </div>
                      <StatColumns playerId={player.id} days={days} />
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
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(0,255,159,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, color: '#00FF9F', flexShrink: 0 }}>
                        {getInitials(player.full_name)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div onClick={() => router.push(`/dashboard/players/${player.id}`)} style={{ fontSize: '14px', fontWeight: 500, color: '#ffffff', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.2)' }}>
                          {player.full_name}
                        </div>
                        <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>
                          {group ? group.name : 'Individual'}
                        </div>
                      </div>
                      <StatColumns playerId={player.id} days={days} />
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
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#2A2A2D', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, color: '#9A9A9F', flexShrink: 0 }}>
                        {getInitials(player.full_name)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div onClick={() => router.push(`/dashboard/players/${player.id}`)} style={{ fontSize: '14px', fontWeight: 500, color: '#ffffff', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.2)' }}>
                          {player.full_name}
                        </div>
                        <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>
                          {group ? group.name : 'Individual'} · No sessions yet
                        </div>
                      </div>
                      <StatColumns playerId={player.id} days={null} />
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
    </div>
  )
}
