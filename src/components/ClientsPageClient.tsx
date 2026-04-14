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

  function getReengageMessage(player: Player) {
    const last = getLastSession(player.id)
    const days = last ? getDaysSince(last.session_date) : null
    const firstName = player.full_name.split(' ')[0]
    if (days === null) return `Hey! Just wanted to reach out about getting ${firstName} started with some training sessions. When works best for you?`
    if (days < 45) return `Hey! It's been a few weeks since ${firstName}'s last session. Want to get something on the schedule this week?`
    return `Hey! It's been a while since we've worked with ${firstName}. I have some availability coming up — would love to get back to work and keep the momentum going!`
  }

  function copyReengage(player: Player) {
    navigator.clipboard.writeText(getReengageMessage(player))
  }

  const activePlayers = players.filter(p => getStatus(p.id) === 'active')
  const atRiskPlayers = players.filter(p => getStatus(p.id) === 'at-risk')
  const lapsedPlayers = players.filter(p => getStatus(p.id) === 'lapsed')
  const newPlayers = players.filter(p => getStatus(p.id) === 'new')

  const totalAtRiskRevenue = atRiskPlayers.reduce((sum, p) => sum + getPlayerRate(p), 0)
  const totalLapsedRevenue = lapsedPlayers.reduce((sum, p) => sum + getEstimatedLostRevenue(p), 0)
  const totalActiveMonthly = activePlayers.reduce((sum, p) => sum + getPlayerRate(p), 0)

  const urgentPlayers = [...atRiskPlayers, ...lapsedPlayers].sort((a, b) => {
    const aLast = getLastSession(a.id)
    const bLast = getLastSession(b.id)
    if (!aLast) return -1
    if (!bLast) return 1
    return new Date(aLast.session_date).getTime() - new Date(bLast.session_date).getTime()
  })

  return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', fontFamily: 'sans-serif', overflowX: 'hidden', maxWidth: '100vw', width: '100%' }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { overflow-x: hidden; max-width: 100vw; background: #0E0E0F; }
        @media (max-width: 640px) {
          .kpi-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>

      <NavBar trainerName={profile?.full_name} />

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '20px 16px', width: '100%' }}>

        {/* HEADER */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#ffffff', fontFamily: '"Exo 2", sans-serif', marginBottom: '4px' }}>My Players</h1>
          <p style={{ fontSize: '14px', color: '#9A9A9F' }}>{players.length} total clients · Focus on reengagement to protect your revenue</p>
        </div>

        {/* KPI ROW */}
        <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px', marginBottom: '28px' }}>
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '18px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Active clients</div>
            <div style={{ fontFamily: 'monospace', fontSize: '32px', fontWeight: 700, color: '#00FF9F', lineHeight: 1 }}>{activePlayers.length}</div>
            <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '6px' }}>{formatCurrency(totalActiveMonthly)}/mo est.</div>
          </div>
          <div style={{ background: '#1A1A1C', border: '1px solid rgba(245,166,35,0.3)', borderRadius: '12px', padding: '18px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: '#F5A623', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>At risk</div>
            <div style={{ fontFamily: 'monospace', fontSize: '32px', fontWeight: 700, color: '#F5A623', lineHeight: 1 }}>{atRiskPlayers.length}</div>
            <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '6px' }}>{formatCurrency(totalAtRiskRevenue)}/mo at risk</div>
          </div>
          <div style={{ background: '#1A1A1C', border: '1px solid rgba(224,49,49,0.3)', borderRadius: '12px', padding: '18px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: '#E03131', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Lapsed</div>
            <div style={{ fontFamily: 'monospace', fontSize: '32px', fontWeight: 700, color: '#E03131', lineHeight: 1 }}>{lapsedPlayers.length}</div>
            <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '6px' }}>{formatCurrency(totalLapsedRevenue)} lost est.</div>
          </div>
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '18px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>New clients</div>
            <div style={{ fontFamily: 'monospace', fontSize: '32px', fontWeight: 700, color: '#ffffff', lineHeight: 1 }}>{newPlayers.length}</div>
            <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '6px' }}>No sessions yet</div>
          </div>
        </div>

        {/* URGENT ACTION BANNER */}
        {urgentPlayers.length > 0 && (
          <div style={{ background: 'rgba(224,49,49,0.06)', border: '1px solid rgba(224,49,49,0.25)', borderRadius: '12px', padding: '16px 20px', marginBottom: '28px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' as const }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff', marginBottom: '2px' }}>
                {urgentPlayers.length} client{urgentPlayers.length !== 1 ? 's' : ''} need{urgentPlayers.length === 1 ? 's' : ''} attention
              </div>
              <div style={{ fontSize: '13px', color: '#9A9A9F' }}>
                Reaching out today could recover {formatCurrency(totalAtRiskRevenue + totalLapsedRevenue)} in potential revenue
              </div>
            </div>
            <button
              onClick={() => {
                const msg = urgentPlayers.slice(0, 3).map(p => `${p.full_name}: ${getReengageMessage(p)}`).join('\n\n')
                navigator.clipboard.writeText(msg)
              }}
              style={{ background: '#E03131', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '9px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
              Copy all reengagement messages
            </button>
          </div>
        )}

        {/* AT RISK SECTION */}
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
                const rate = getPlayerRate(player)
                const group = getGroup(player.group_id)
                const isExpanded = expandedPlayer === player.id
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
                          {group ? group.name : 'Individual'} · Last seen {days !== null ? formatDaysAgo(days) : 'never'} · {getSessionCount(player.id)} sessions total
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#F5A623' }}>{formatCurrency(rate)}/session</div>
                        <div style={{ fontSize: '11px', color: '#9A9A9F', marginTop: '2px' }}>at risk</div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                        <button onClick={() => copyReengage(player)} style={{ fontSize: '12px', padding: '7px 14px', borderRadius: '8px', border: 'none', background: '#F5A623', color: '#0E0E0F', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
                          Copy message
                        </button>
                        <button onClick={() => setExpandedPlayer(isExpanded ? null : player.id)} style={{ fontSize: '12px', padding: '7px 14px', borderRadius: '8px', border: '1px solid #2A2A2D', background: 'transparent', color: '#9A9A9F', cursor: 'pointer' }}>
                          {isExpanded ? '▲' : '▼'}
                        </button>
                      </div>
                    </div>
                    {isExpanded && (
                      <div style={{ padding: '0 20px 16px', borderTop: '1px solid #2A2A2D' }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '14px 0 8px' }}>Suggested reengagement message</div>
                        <div style={{ background: '#0E0E0F', borderRadius: '8px', padding: '12px 14px', fontSize: '13px', color: '#ffffff', lineHeight: 1.6, marginBottom: '10px' }}>
                          {getReengageMessage(player)}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => copyReengage(player)} style={{ fontSize: '12px', padding: '7px 14px', borderRadius: '8px', border: 'none', background: '#F5A623', color: '#0E0E0F', fontWeight: 600, cursor: 'pointer' }}>Copy message</button>
                          <button onClick={() => router.push(`/dashboard/players/${player.id}/log`)} style={{ fontSize: '12px', padding: '7px 14px', borderRadius: '8px', border: '1px solid #2A2A2D', background: 'transparent', color: '#ffffff', cursor: 'pointer' }}>Log session</button>
                          <button onClick={() => router.push(`/dashboard/players/${player.id}`)} style={{ fontSize: '12px', padding: '7px 14px', borderRadius: '8px', border: '1px solid #2A2A2D', background: 'transparent', color: '#9A9A9F', cursor: 'pointer' }}>View profile</button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* LAPSED SECTION */}
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
                const weeks = getWeeksLapsed(player.id)
                const rate = getPlayerRate(player)
                const lostRevenue = getEstimatedLostRevenue(player)
                const group = getGroup(player.group_id)
                const isExpanded = expandedPlayer === player.id
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
                          {group ? group.name : 'Individual'} · Last seen {days !== null ? formatDaysAgo(days) : 'never'} · {weeks !== null ? `${weeks} weeks inactive` : ''}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#E03131' }}>{formatCurrency(lostRevenue)}</div>
                        <div style={{ fontSize: '11px', color: '#9A9A9F', marginTop: '2px' }}>est. lost revenue</div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                        <button onClick={() => copyReengage(player)} style={{ fontSize: '12px', padding: '7px 14px', borderRadius: '8px', border: 'none', background: '#E03131', color: '#ffffff', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' as const }}>Copy message</button>
                        <button onClick={() => setExpandedPlayer(isExpanded ? null : player.id)} style={{ fontSize: '12px', padding: '7px 14px', borderRadius: '8px', border: '1px solid #2A2A2D', background: 'transparent', color: '#9A9A9F', cursor: 'pointer' }}>
                          {isExpanded ? '▲' : '▼'}
                        </button>
                      </div>
                    </div>
                    {isExpanded && (
                      <div style={{ padding: '0 20px 16px', borderTop: '1px solid #2A2A2D' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', margin: '14px 0' }}>
                          {[
                            { label: 'Sessions total', value: getSessionCount(player.id).toString() },
                            { label: 'Rate/session', value: formatCurrency(rate) },
                            { label: 'Est. lost', value: formatCurrency(lostRevenue) },
                          ].map(s => (
                            <div key={s.label} style={{ background: '#0E0E0F', borderRadius: '8px', padding: '10px 12px' }}>
                              <div style={{ fontSize: '10px', color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>{s.label}</div>
                              <div style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>{s.value}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Suggested reengagement message</div>
                        <div style={{ background: '#0E0E0F', borderRadius: '8px', padding: '12px 14px', fontSize: '13px', color: '#ffffff', lineHeight: 1.6, marginBottom: '10px' }}>
                          {getReengageMessage(player)}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => copyReengage(player)} style={{ fontSize: '12px', padding: '7px 14px', borderRadius: '8px', border: 'none', background: '#E03131', color: '#ffffff', fontWeight: 600, cursor: 'pointer' }}>Copy message</button>
                          <button onClick={() => router.push(`/dashboard/players/${player.id}/log`)} style={{ fontSize: '12px', padding: '7px 14px', borderRadius: '8px', border: '1px solid #2A2A2D', background: 'transparent', color: '#ffffff', cursor: 'pointer' }}>Log session</button>
                          <button onClick={() => router.push(`/dashboard/players/${player.id}`)} style={{ fontSize: '12px', padding: '7px 14px', borderRadius: '8px', border: '1px solid #2A2A2D', background: 'transparent', color: '#9A9A9F', cursor: 'pointer' }}>View profile</button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ACTIVE SECTION */}
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
                const rate = getPlayerRate(player)
                const group = getGroup(player.group_id)
                return (
                  <div key={player.id} style={{ padding: '14px 20px', borderBottom: i < activePlayers.length - 1 ? '1px solid #2A2A2D' : 'none', display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(0,255,159,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, color: '#00FF9F', flexShrink: 0 }}>
                      {getInitials(player.full_name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div onClick={() => router.push(`/dashboard/players/${player.id}`)} style={{ fontSize: '14px', fontWeight: 500, color: '#ffffff', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.2)' }}>
                        {player.full_name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>
                        {group ? group.name : 'Individual'} · Last seen {days !== null ? formatDaysAgo(days) : 'never'}
                      </div>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#00FF9F', flexShrink: 0 }}>{formatCurrency(rate)}/session</div>
                    <button onClick={() => router.push(`/dashboard/players/${player.id}/log`)} style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '8px', border: '1px solid #2A2A2D', background: 'transparent', color: '#9A9A9F', cursor: 'pointer', flexShrink: 0 }}>
                      + Log session
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* NEW PLAYERS */}
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
                  <div key={player.id} style={{ padding: '14px 20px', borderBottom: i < newPlayers.length - 1 ? '1px solid #2A2A2D' : 'none', display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#2A2A2D', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, color: '#9A9A9F', flexShrink: 0 }}>
                      {getInitials(player.full_name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div onClick={() => router.push(`/dashboard/players/${player.id}`)} style={{ fontSize: '14px', fontWeight: 500, color: '#ffffff', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.2)' }}>
                        {player.full_name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>
                        {group ? group.name : 'Individual'} · Added {new Date(player.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                    <button onClick={() => router.push(`/dashboard/players/${player.id}/log`)} style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '8px', border: 'none', background: '#00FF9F', color: '#0E0E0F', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                      Log first session
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {players.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>👥</div>
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#ffffff', marginBottom: '8px' }}>No clients yet</h2>
            <p style={{ fontSize: '14px', color: '#9A9A9F', marginBottom: '24px' }}>Add your first player to start tracking client health</p>
            <button onClick={() => router.push('/dashboard/players/new')} style={{ background: '#00FF9F', color: '#0E0E0F', border: 'none', borderRadius: '8px', padding: '12px 24px', fontSize: '15px', fontWeight: 700, cursor: 'pointer' }}>
              Add first client
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
