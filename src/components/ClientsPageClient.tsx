'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Profile { id: string; full_name: string; email: string }
interface Player { id: string; full_name: string; parent_email: string; group_id: string | null; created_at: string }
interface Group { id: string; name: string; sport: string }
interface Session { id: string; player_id: string; session_date: string; notes: string | null }

interface Props {
  profile: Profile | null
  players: Player[]
  groups: Group[]
  sessions: Session[]
}

type StatusFilter = 'all' | 'active' | 'at-risk' | 'lapsed'

export default function ClientsPageClient({ profile, players, groups, sessions }: Props) {
  const router = useRouter()
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [reengagedId, setReengagedId] = useState<string | null>(null)

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

  function getStatus(playerId: string): 'active' | 'at-risk' | 'lapsed' | 'new' {
    const last = getLastSession(playerId)
    const days = getDaysSince(last?.session_date || null)
    if (days === null) return 'new'
    if (days <= 14) return 'active'
    if (days <= 30) return 'at-risk'
    return 'lapsed'
  }

  function getStatusStyle(status: string) {
    switch (status) {
      case 'active': return { bg: 'rgba(0,255,159,0.12)', color: '#00FF9F', label: 'Active' }
      case 'at-risk': return { bg: 'rgba(245,166,35,0.15)', color: '#F5A623', label: 'At risk' }
      case 'lapsed': return { bg: 'rgba(224,49,49,0.15)', color: '#E03131', label: 'Lapsed' }
      default: return { bg: 'rgba(107,107,114,0.15)', color: '#9A9A9F', label: 'New' }
    }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return 'Never'
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  function formatDaysAgo(days: number | null) {
    if (days === null) return 'No sessions yet'
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) !== 1 ? 's' : ''} ago`
    return `${Math.floor(days / 30)} month${Math.floor(days / 30) !== 1 ? 's' : ''} ago`
  }

  function getInitials(name: string) {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??'
  }

  function copyReengageMessage(player: Player) {
    const firstName = player.full_name.split(' ')[0]
    const message = `Hey! Just wanted to check in on ${firstName} — we haven't trained together in a little while and I'd love to get them back on the court. Let me know if you want to schedule a session soon!`
    navigator.clipboard.writeText(message).then(() => {
      setReengagedId(player.id)
      setTimeout(() => setReengagedId(null), 2000)
    })
  }

  const enrichedPlayers = players.map(p => ({
    ...p,
    status: getStatus(p.id),
    lastSession: getLastSession(p.id),
    daysAgo: getDaysSince(getLastSession(p.id)?.session_date || null),
    group: getGroup(p.group_id),
  }))

  const filtered = enrichedPlayers.filter(p => {
    const matchesFilter = filter === 'all' || p.status === filter
    const matchesSearch = p.full_name.toLowerCase().includes(search.toLowerCase()) ||
      p.parent_email?.toLowerCase().includes(search.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const counts = {
    all: enrichedPlayers.length,
    active: enrichedPlayers.filter(p => p.status === 'active').length,
    'at-risk': enrichedPlayers.filter(p => p.status === 'at-risk').length,
    lapsed: enrichedPlayers.filter(p => p.status === 'lapsed').length,
  }

  const filterOptions: { key: StatusFilter; label: string; color: string }[] = [
    { key: 'all', label: `All (${counts.all})`, color: '#ffffff' },
    { key: 'active', label: `Active (${counts.active})`, color: '#00FF9F' },
    { key: 'at-risk', label: `At risk (${counts['at-risk']})`, color: '#F5A623' },
    { key: 'lapsed', label: `Lapsed (${counts.lapsed})`, color: '#E03131' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', fontFamily: 'sans-serif' }}>

      {/* NAV */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', height: '60px', borderBottom: '1px solid #2A2A2D', background: '#0E0E0F', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ fontFamily: 'monospace', fontSize: '20px', fontWeight: 700, color: '#ffffff', letterSpacing: '2px' }}>
          SkillPath<span style={{ color: '#00FF9F' }}>IQ</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button onClick={() => router.push('/dashboard')} style={{ fontSize: '13px', color: '#9A9A9F', background: 'none', border: 'none', cursor: 'pointer' }}>Dashboard</button>
          <button style={{ fontSize: '13px', color: '#ffffff', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>Clients</button>
          <span style={{ fontSize: '14px', color: '#9A9A9F' }}>{profile?.full_name}</span>
        </div>
      </nav>

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '32px' }}>

        {/* PAGE HEADER */}
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontFamily: 'monospace', fontSize: '32px', fontWeight: 700, color: '#ffffff', letterSpacing: '1px', margin: 0 }}>Clients</h1>
          <p style={{ fontSize: '14px', color: '#9A9A9F', marginTop: '6px' }}>Every player you have trained and their current status</p>
        </div>

        {/* STAT ROW */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '16px', marginBottom: '28px' }}>
          {[
            { label: 'Total clients', value: counts.all, color: '#ffffff' },
            { label: 'Active', value: counts.active, color: '#00FF9F' },
            { label: 'At risk', value: counts['at-risk'], color: '#F5A623' },
            { label: 'Lapsed', value: counts.lapsed, color: '#E03131' },
          ].map(s => (
            <div key={s.label} style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>{s.label}</div>
              <div style={{ fontFamily: 'monospace', fontSize: '36px', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* FILTERS + SEARCH */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {filterOptions.map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)} style={{ padding: '7px 16px', borderRadius: '8px', border: `1px solid ${filter === f.key ? f.color : '#2A2A2D'}`, background: filter === f.key ? f.color + '18' : 'transparent', color: filter === f.key ? f.color : '#9A9A9F', fontSize: '13px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}>
                {f.label}
              </button>
            ))}
          </div>
          <input type="text" placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', color: '#ffffff', outline: 'none', width: '240px' }} />
        </div>

        {/* CLIENT LIST */}
        <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr 1fr 1.5fr', gap: '16px', padding: '12px 20px', borderBottom: '1px solid #2A2A2D' }}>
            {['Player', 'Group', 'Last session', 'Days ago', 'Status'].map(h => (
              <div key={h} style={{ fontSize: '11px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: '14px', color: '#9A9A9F' }}>
                {players.length === 0 ? 'No clients yet — add players to get started.' : 'No clients match your current filter.'}
              </p>
            </div>
          ) : (
            filtered.map((player, i) => {
              const statusStyle = getStatusStyle(player.status)
              const isLast = i === filtered.length - 1
              return (
                <div key={player.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr 1fr 1.5fr', gap: '16px', padding: '14px 20px', borderBottom: isLast ? 'none' : '1px solid #2A2A2D', alignItems: 'center' }}>

                  {/* PLAYER */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(0,255,159,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, color: '#00FF9F', flexShrink: 0 }}>
                      {getInitials(player.full_name)}
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 500, color: '#ffffff' }}>{player.full_name}</div>
                      <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>{player.parent_email || 'No parent email'}</div>
                    </div>
                  </div>

                  {/* GROUP */}
                  <div>
                    {player.group ? (
                      <span style={{ background: '#2A2A2D', padding: '3px 8px', borderRadius: '6px', fontSize: '12px', color: '#a0a0a8' }}>{player.group.name}</span>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#9A9A9F' }}>Individual</span>
                    )}
                  </div>

                  {/* LAST SESSION DATE */}
                  <div>
                    <div style={{ fontSize: '13px', color: '#a0a0a8' }}>{formatDate(player.lastSession?.session_date || null)}</div>
                    {player.lastSession?.notes && (
                      <div style={{ fontSize: '11px', color: '#9A9A9F', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>{player.lastSession.notes}</div>
                    )}
                  </div>

                  {/* DAYS AGO */}
                  <div style={{ fontSize: '13px', color: player.daysAgo !== null && player.daysAgo > 30 ? '#E03131' : '#a0a0a8' }}>
                    {formatDaysAgo(player.daysAgo)}
                  </div>

                  {/* STATUS + RE-ENGAGE */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '99px', background: statusStyle.bg, color: statusStyle.color, whiteSpace: 'nowrap' }}>
                      {statusStyle.label}
                    </span>
                    {(player.status === 'lapsed' || player.status === 'at-risk') && (
                      <button onClick={() => copyReengageMessage(player)} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '99px', border: `1px solid ${reengagedId === player.id ? '#00FF9F' : '#2A2A2D'}`, background: 'transparent', color: reengagedId === player.id ? '#00FF9F' : '#9A9A9F', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
                        {reengagedId === player.id ? '✓ Copied!' : 'Re-engage'}
                      </button>
                    )}
                    <button onClick={() => router.push(`/dashboard/sessions/new?player=${player.id}`)} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '99px', border: '1px solid #2A2A2D', background: 'transparent', color: '#9A9A9F', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      + Session
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* LAPSED CALLOUT */}
        {counts.lapsed > 0 && (
          <div style={{ background: 'rgba(224,49,49,0.08)', border: '1px solid rgba(224,49,49,0.3)', borderRadius: '12px', padding: '16px 20px', marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#E03131', marginBottom: '4px' }}>
                {counts.lapsed} client{counts.lapsed !== 1 ? 's' : ''} haven&apos;t trained in over 30 days
              </div>
              <div style={{ fontSize: '13px', color: '#9A9A9F' }}>Reach out now to bring them back before they churn</div>
            </div>
            <button onClick={() => setFilter('lapsed')} style={{ background: '#E03131', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              View lapsed
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
