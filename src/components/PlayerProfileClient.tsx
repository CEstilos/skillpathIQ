'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'


interface Player { id: string; full_name: string; parent_email: string; group_id: string | null; created_at: string; custom_rate: number | null }
interface Session { id: string; player_id: string; session_date: string; session_type: string; notes: string | null }
interface DrillWeek { id: string; title: string; week_start: string; player_id: string | null; group_id: string | null }
interface Drill { id: string; title: string; reps: string; description: string; drill_week_id: string; sort_order: number }
interface Completion { id: string; drill_id: string; player_id: string }
interface Group { id: string; name: string; sport: string }

interface Props {
  player: Player
  sessions: Session[]
  drillWeeks: DrillWeek[]
  drills: Drill[]
  completions: Completion[]
  group: Group | null
}

export default function PlayerProfileClient({ player, sessions, drillWeeks, drills, completions, group }: Props) {
  const router = useRouter()
  const [linkShared, setLinkShared] = useState(false)

  function handleShareLink() {
    const url = `${window.location.origin}/player?id=${player.id}`
    if (navigator.share) {
      navigator.share({
        title: `${player.full_name}'s drill work`,
        text: `Hey! Here's your SkillPathIQ drill link — tap it to see your assigned drills and check them off as you complete them.`,
        url,
      }).catch(() => {
        navigator.clipboard.writeText(url)
        setLinkShared(true)
        setTimeout(() => setLinkShared(false), 2000)
      })
    } else {
      navigator.clipboard.writeText(url)
      setLinkShared(true)
      setTimeout(() => setLinkShared(false), 2000)
    }
  }
  function getInitials(name: string) {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??'
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  function getDaysSince(dateStr: string) {
    return Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
  }

  function formatDaysAgo(days: number) {
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) !== 1 ? 's' : ''} ago`
    return `${Math.floor(days / 30)} month${Math.floor(days / 30) !== 1 ? 's' : ''} ago`
  }

  function getDrillsForWeek(weekId: string) {
    return drills.filter(d => d.drill_week_id === weekId)
  }

  function getCompletionsForWeek(weekId: string) {
    const weekDrills = getDrillsForWeek(weekId)
    return completions.filter(c => weekDrills.some(d => d.id === c.drill_id))
  }

  function getCompletionPct(weekId: string) {
    const weekDrills = getDrillsForWeek(weekId)
    if (!weekDrills.length) return 0
    const done = getCompletionsForWeek(weekId).length
    return Math.round((done / weekDrills.length) * 100)
  }

  function getStatus() {
    if (!sessions.length) return 'new'
    const days = getDaysSince(sessions[0].session_date)
    if (days <= 14) return 'active'
    if (days <= 30) return 'at-risk'
    return 'lapsed'
  }

  function getStatusStyle(status: string) {
    switch (status) {
      case 'active': return { color: '#00FF9F', bg: 'rgba(0,255,159,0.12)', label: 'Active' }
      case 'at-risk': return { color: '#F5A623', bg: 'rgba(245,166,35,0.15)', label: 'At risk' }
      case 'lapsed': return { color: '#E03131', bg: 'rgba(224,49,49,0.15)', label: 'Lapsed' }
      default: return { color: '#9A9A9F', bg: 'rgba(154,154,159,0.15)', label: 'New' }
    }
  }

  const status = getStatus()
  const statusStyle = getStatusStyle(status)
  const lastSession = sessions[0] || null
  const currentWeek = drillWeeks[0] || null
  const memberSince = formatDate(player.created_at)

  return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', fontFamily: 'sans-serif' }}>

      <style>{`
        * { box-sizing: border-box; }
        html, body { overflow-x: hidden; max-width: 100vw; }
        @media (max-width: 640px) {
          .profile-grid { grid-template-columns: 1fr !important; }
          .stat-row { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>

      {/* NAV */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', height: '56px', borderBottom: '1px solid #2A2A2D', background: '#0E0E0F', position: 'sticky', top: 0, zIndex: 100, width: '100%' }}>
      <img
  src="/logo.png"
  alt="SkillPathIQ"
  onClick={() => router.push('/dashboard')}
  style={{ height: '65px', width: 'auto', cursor: 'pointer', flexShrink: 0 }}
/>
        <button onClick={() => router.push('/dashboard')} style={{ fontSize: '13px', color: '#9A9A9F', background: 'none', border: 'none', cursor: 'pointer' }}>← Training Hub</button>
      </nav>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px 16px' }}>

        {/* PLAYER HEADER */}
        <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '16px', padding: '24px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(0,255,159,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 700, color: '#00FF9F', flexShrink: 0 }}>
                {getInitials(player.full_name)}
              </div>
              <div>
                <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#ffffff', fontFamily: '"Exo 2", sans-serif', margin: 0 }}>{player.full_name}</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                  {group && <span style={{ fontSize: '12px', background: '#2A2A2D', color: '#9A9A9F', padding: '2px 8px', borderRadius: '6px' }}>{group.name}</span>}
                  {!group && <span style={{ fontSize: '12px', color: '#9A9A9F' }}>Individual</span>}
                  {player.parent_email && <span style={{ fontSize: '12px', color: '#9A9A9F' }}>{player.parent_email}</span>}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
  <span style={{ fontSize: '12px', fontWeight: 600, padding: '5px 12px', borderRadius: '99px', background: statusStyle.bg, color: statusStyle.color }}>{statusStyle.label}</span>
  <button
    onClick={() => router.push(`/dashboard/players/${player.id}/log`)}
    style={{ background: '#00FF9F', color: '#0E0E0F', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
    + Log session
  </button>
  <button
    onClick={handleShareLink}
    style={{ background: 'transparent', color: linkShared ? '#00FF9F' : '#9A9A9F', border: `1px solid ${linkShared ? '#00FF9F' : '#2A2A2D'}`, borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>
    {linkShared ? '✓ Link copied!' : 'Share drill link'}
  </button>
</div>
          </div>
        </div>

        {/* STAT ROW */}
        <div className="stat-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px', marginBottom: '20px' }}>
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '18px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Total sessions</div>
            <div style={{ fontFamily: 'monospace', fontSize: '32px', fontWeight: 700, color: '#ffffff', lineHeight: 1 }}>{sessions.length}</div>
            <div style={{ fontSize: '11px', color: '#9A9A9F', marginTop: '6px' }}>All time</div>
          </div>
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '18px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Last session</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: lastSession ? '#ffffff' : '#9A9A9F', lineHeight: 1.2 }}>
              {lastSession ? formatDaysAgo(getDaysSince(lastSession.session_date)) : 'No sessions'}
            </div>
            {lastSession && <div style={{ fontSize: '11px', color: '#9A9A9F', marginTop: '6px' }}>{formatDate(lastSession.session_date)}</div>}
          </div>
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '18px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Member since</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', lineHeight: 1.2 }}>{memberSince}</div>
            <div style={{ fontSize: '11px', color: '#9A9A9F', marginTop: '6px' }}>{drillWeeks.length} drill week{drillWeeks.length !== 1 ? 's' : ''} assigned</div>
          </div>
        </div>

        <div className="profile-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>

          {/* DRILL WORK */}
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>Drill work</div>

            {drillWeeks.length === 0 ? (
              <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
                <p style={{ fontSize: '13px', color: '#9A9A9F', marginBottom: '12px' }}>No drill work assigned yet</p>
                <button onClick={() => router.push(`/dashboard/drills/new?player=${player.id}`)} style={{ background: '#00FF9F', color: '#0E0E0F', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                  Assign drill work
                </button>
              </div>
            ) : (
              drillWeeks.map((week, wi) => {
                const weekDrills = getDrillsForWeek(week.id)
                const weekCompletions = getCompletionsForWeek(week.id)
                const pct = getCompletionPct(week.id)
                const isCurrentWeek = wi === 0
                return (
                  <div key={week.id} style={{ background: '#1A1A1C', border: `1px solid ${isCurrentWeek ? 'rgba(0,255,159,0.3)' : '#2A2A2D'}`, borderRadius: '12px', padding: '16px', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff' }}>{week.title}</div>
                        <div style={{ fontSize: '11px', color: '#9A9A9F', marginTop: '2px' }}>Week of {formatDate(week.week_start)}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '18px', fontFamily: 'monospace', fontWeight: 700, color: pct === 100 ? '#00FF9F' : '#ffffff' }}>{pct}%</div>
                        <div style={{ fontSize: '11px', color: '#9A9A9F' }}>{weekCompletions.length}/{weekDrills.length} done</div>
                      </div>
                    </div>
                    <div style={{ height: '4px', background: '#2A2A2D', borderRadius: '99px', overflow: 'hidden', marginBottom: '12px' }}>
                      <div style={{ height: '100%', width: pct + '%', background: pct === 100 ? '#00FF9F' : '#00FF9F', borderRadius: '99px', opacity: pct === 100 ? 1 : 0.5 }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {weekDrills.map(drill => {
                        const done = completions.some(c => c.drill_id === drill.id)
                        return (
                          <div key={drill.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: done ? '#00FF9F' : '#2A2A2D', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {done && (
                                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                                  <polyline points="1,4 3,6 7,2" stroke="#0E0E0F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </div>
                            <span style={{ fontSize: '12px', color: done ? '#9A9A9F' : '#ffffff', textDecoration: done ? 'line-through' : 'none' }}>{drill.title}</span>
                            {drill.reps && <span style={{ fontSize: '11px', color: '#9A9A9F', marginLeft: 'auto', whiteSpace: 'nowrap' }}>{drill.reps}</span>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* SESSION HISTORY */}
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>Session history</div>

            {sessions.length === 0 ? (
              <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
                <p style={{ fontSize: '13px', color: '#9A9A9F', marginBottom: '12px' }}>No sessions logged yet</p>
                <button onClick={() => router.push(`/dashboard/players/${player.id}/log`)} style={{ background: '#00FF9F', color: '#0E0E0F', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                  Log first session
                </button>
              </div>
            ) : (
              <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', overflow: 'hidden' }}>
                {sessions.slice(0, 10).map((session, i) => {
                  const isLast = i === Math.min(sessions.length, 10) - 1
                  return (
                    <div key={session.id} style={{ padding: '12px 16px', borderBottom: isLast ? 'none' : '1px solid #2A2A2D' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: session.notes ? '4px' : '0' }}>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: '#ffffff' }}>{formatDate(session.session_date)}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '99px', background: session.session_type === 'group' ? 'rgba(245,166,35,0.15)' : 'rgba(0,255,159,0.12)', color: session.session_type === 'group' ? '#F5A623' : '#00FF9F', fontWeight: 600, textTransform: 'capitalize' }}>
                            {session.session_type}
                          </span>
                          <span style={{ fontSize: '11px', color: '#9A9A9F' }}>{formatDaysAgo(getDaysSince(session.session_date))}</span>
                        </div>
                      </div>
                      {session.notes && (
                        <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '3px' }}>{session.notes}</div>
                      )}
                    </div>
                  )
                })}
                {sessions.length > 10 && (
                  <div style={{ padding: '10px 16px', textAlign: 'center', borderTop: '1px solid #2A2A2D' }}>
                    <span style={{ fontSize: '12px', color: '#9A9A9F' }}>{sessions.length - 10} more sessions</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
