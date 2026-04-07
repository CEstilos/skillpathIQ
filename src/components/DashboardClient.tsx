'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface Profile { id: string; full_name: string; email: string }
interface Player { id: string; full_name: string; parent_email: string; group_id: string | null; trainer_id: string; created_at: string }
interface Group { id: string; name: string; sport: string; session_day: string; session_time: string }
interface Session { id: string; player_id: string; session_date: string; notes: string | null }
interface DrillWeek { id: string; group_id: string | null; player_id: string | null; title: string; week_start: string }
interface Drill { id: string; drill_week_id: string; title: string }
interface Completion { id: string; player_id: string; drill_id: string }

interface Props {
  profile: Profile | null
  players: Player[]
  groups: Group[]
  sessions: Session[]
  drillWeeks: DrillWeek[]
  drills: Drill[]
  completions: Completion[]
}

export default function DashboardClient({ profile, players, groups, sessions, drillWeeks, drills, completions }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/auth/login')
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
    const diff = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
    return diff
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
      case 'active': return { color: '#1DB87A', bg: 'rgba(29,184,122,0.15)', label: 'Active' }
      case 'at-risk': return { color: '#F5A623', bg: 'rgba(245,166,35,0.15)', label: 'At risk' }
      case 'lapsed': return { color: '#E03131', bg: 'rgba(224,49,49,0.15)', label: 'Lapsed' }
      default: return { color: '#6B6B72', bg: 'rgba(107,107,114,0.15)', label: 'New' }
    }
  }

  function getInitials(name: string) {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??'
  }

  function formatDaysAgo(days: number | null) {
    if (days === null) return 'No sessions yet'
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    if (days < 30) return `${Math.floor(days / 7)}w ago`
    return `${Math.floor(days / 30)}mo ago`
  }

  function getCurrentDrillWeek(player: Player) {
    if (player.group_id) {
      return drillWeeks.find(w => w.group_id === player.group_id) || null
    }
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
    if (activeFilter === 'all') return true
    if (activeFilter === 'individual') return !p.group_id
    return p.group_id === activeFilter
  })

  const activeCount = players.filter(p => getStatus(p.id) === 'active').length
  const atRiskCount = players.filter(p => getStatus(p.id) === 'at-risk').length
  const lapsedCount = players.filter(p => getStatus(p.id) === 'lapsed').length

  return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', fontFamily: 'sans-serif' }}>

      {/* NAV */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', height: '60px', borderBottom: '1px solid #2A2A2D', background: '#0E0E0F', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ fontFamily: 'monospace', fontSize: '20px', fontWeight: 700, color: '#ffffff', letterSpacing: '2px' }}>
          SkillPath<span style={{ color: '#F4581A' }}>IQ</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button style={{ fontSize: '13px', color: '#ffffff', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>Dashboard</button>
          <button onClick={() => router.push('/dashboard/clients')} style={{ fontSize: '13px', color: '#6B6B72', background: 'none', border: 'none', cursor: 'pointer' }}>Clients</button>
          <span style={{ fontSize: '14px', color: '#6B6B72' }}>{profile?.full_name}</span>
          <button onClick={handleSignOut} style={{ fontSize: '13px', padding: '6px 14px', borderRadius: '8px', border: '1px solid #2A2A2D', background: 'transparent', color: '#6B6B72', cursor: 'pointer' }}>
            Sign out
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px' }}>

        {/* PAGE HEADER */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
          <div>
            <h1 style={{ fontFamily: 'monospace', fontSize: '32px', fontWeight: 700, color: '#ffffff', letterSpacing: '1px', margin: 0 }}>Dashboard</h1>
            <p style={{ fontSize: '14px', color: '#6B6B72', marginTop: '6px' }}>
              {players.length === 0 ? 'Add your first player to get started' : `${players.length} player${players.length !== 1 ? 's' : ''} · ${groups.length} group${groups.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => router.push('/dashboard/sessions/new')} style={{ background: 'transparent', color: '#ffffff', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
              + Log session
            </button>
            <button onClick={() => router.push('/dashboard/players/new')} style={{ background: '#F4581A', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
              + Add player
            </button>
          </div>
        </div>

        {/* STAT ROW */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '16px', marginBottom: '28px' }}>
          {[
            { label: 'Total players', value: players.length, color: '#ffffff' },
            { label: 'Active', value: activeCount, color: '#1DB87A' },
            { label: 'At risk', value: atRiskCount, color: '#F5A623' },
            { label: 'Lapsed', value: lapsedCount, color: '#E03131' },
          ].map(s => (
            <div key={s.label} style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#6B6B72', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>{s.label}</div>
              <div style={{ fontFamily: 'monospace', fontSize: '36px', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* FILTER TABS */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button onClick={() => setActiveFilter('all')} style={{ padding: '7px 16px', borderRadius: '8px', border: '1px solid #2A2A2D', background: activeFilter === 'all' ? '#F4581A' : 'transparent', color: activeFilter === 'all' ? '#ffffff' : '#6B6B72', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
            All ({players.length})
          </button>
          <button onClick={() => setActiveFilter('individual')} style={{ padding: '7px 16px', borderRadius: '8px', border: '1px solid #2A2A2D', background: activeFilter === 'individual' ? '#F4581A' : 'transparent', color: activeFilter === 'individual' ? '#ffffff' : '#6B6B72', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
            Individual ({players.filter(p => !p.group_id).length})
          </button>
          {groups.map(g => (
            <button key={g.id} onClick={() => setActiveFilter(g.id)} style={{ padding: '7px 16px', borderRadius: '8px', border: '1px solid #2A2A2D', background: activeFilter === g.id ? '#F4581A' : 'transparent', color: activeFilter === g.id ? '#ffffff' : '#6B6B72', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
              {g.name} ({players.filter(p => p.group_id === g.id).length})
            </button>
          ))}
          <button onClick={() => router.push('/dashboard/groups/new')} style={{ padding: '7px 16px', borderRadius: '8px', border: '1px dashed #2A2A2D', background: 'transparent', color: '#6B6B72', fontSize: '13px', cursor: 'pointer' }}>
            + New group
          </button>
        </div>

        {/* PLAYER TABLE */}
        <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #2A2A2D', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {activeFilter === 'all' ? 'All players' : activeFilter === 'individual' ? 'Individual players' : groups.find(g => g.id === activeFilter)?.name || 'Players'}
            </span>
            <button onClick={() => router.push(`/dashboard/drills/new${activeFilter !== 'all' && activeFilter !== 'individual' ? `?group=${activeFilter}` : ''}`)} style={{ fontSize: '12px', color: '#F4581A', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
              + Assign drills
            </button>
          </div>

          {/* TABLE HEADER */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '16px', padding: '10px 20px', borderBottom: '1px solid #2A2A2D' }}>
            {['Player', 'Group', 'Last session', 'Drills', 'Status'].map(h => (
              <div key={h} style={{ fontSize: '11px', fontWeight: 600, color: '#6B6B72', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
            ))}
          </div>

          {filteredPlayers.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: '14px', color: '#6B6B72', marginBottom: '16px' }}>
                {players.length === 0 ? 'No players yet' : 'No players in this filter'}
              </p>
              <button onClick={() => router.push('/dashboard/players/new')} style={{ background: '#F4581A', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                Add first player
              </button>
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
                <div key={player.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '16px', padding: '14px 20px', borderBottom: isLast ? 'none' : '1px solid #2A2A2D', alignItems: 'center' }}>

                  {/* PLAYER */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(244,88,26,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, color: '#F4581A', flexShrink: 0 }}>
                      {getInitials(player.full_name)}
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 500, color: '#ffffff' }}>{player.full_name}</div>
                      <div style={{ fontSize: '12px', color: '#6B6B72', marginTop: '2px' }}>{player.parent_email || 'No parent email'}</div>
                    </div>
                  </div>

                  {/* GROUP */}
                  <div>
                    {group ? (
                      <span style={{ background: '#2A2A2D', padding: '3px 8px', borderRadius: '6px', fontSize: '12px', color: '#a0a0a8' }}>{group.name}</span>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#6B6B72' }}>Individual</span>
                    )}
                  </div>

                  {/* LAST SESSION */}
                  <div style={{ fontSize: '13px', color: days !== null && days > 30 ? '#E03131' : '#a0a0a8' }}>
                    {formatDaysAgo(days)}
                    {lastSession?.notes && (
                      <div style={{ fontSize: '11px', color: '#6B6B72', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>{lastSession.notes}</div>
                    )}
                  </div>

                  {/* DRILL COMPLETION */}
                  <div>
                    {pct !== null ? (
                      <div>
                        <div style={{ height: '4px', background: '#2A2A2D', borderRadius: '99px', overflow: 'hidden', marginBottom: '4px', width: '80px' }}>
                          <div style={{ height: '100%', width: pct + '%', background: pct === 100 ? '#1DB87A' : '#F4581A', borderRadius: '99px' }} />
                        </div>
                        <div style={{ fontSize: '11px', color: '#6B6B72' }}>{pct}% done</div>
                      </div>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#6B6B72' }}>No drills</span>
                    )}
                  </div>

                  {/* STATUS + ACTIONS */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '99px', background: statusStyle.bg, color: statusStyle.color, whiteSpace: 'nowrap' }}>
                      {statusStyle.label}
                    </span>
                    <button onClick={() => copyPlayerLink(player.id)} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '99px', border: `1px solid ${isCopied ? '#1DB87A' : '#2A2A2D'}`, background: 'transparent', color: isCopied ? '#1DB87A' : '#6B6B72', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      {isCopied ? '✓' : 'Link'}
                    </button>
                    <button onClick={() => router.push(`/dashboard/sessions/new?player=${player.id}`)} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '99px', border: '1px solid #2A2A2D', background: 'transparent', color: '#6B6B72', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      + Session
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
