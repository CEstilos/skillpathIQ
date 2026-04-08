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
  const [menuOpen, setMenuOpen] = useState(false)
  const [search, setSearch] = useState('')

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

  function formatDaysAgo(days: number | null) {
    if (days === null) return 'No sessions yet'
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days}d ago`
    if (days < 30) return `${Math.floor(days / 7)}w ago`
    return `${Math.floor(days / 30)}mo ago`
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
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', height: '56px', borderBottom: '1px solid #2A2A2D', background: '#0E0E0F', position: 'sticky', top: 0, zIndex: 100, width: '100%', maxWidth: '100vw' }}>
      <img
  src="/logo.png"
  alt="SkillPathIQ"
  onClick={() => router.push('/dashboard')}
  style={{ height: '32px', width: 'auto', cursor: 'pointer', flexShrink: 0 }}
/>

        {/* DESKTOP NAV */}
        <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button style={{ fontSize: '15px', color: '#ffffff', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Training Hub</button>
<button onClick={() => router.push('/dashboard/business')} style={{ fontSize: '15px', color: '#9A9A9F', background: 'none', border: 'none', cursor: 'pointer' }}>My Numbers</button>
<button onClick={() => router.push('/dashboard/settings')} style={{ fontSize: '13px', color: '#9A9A9F', background: 'none', border: 'none', cursor: 'pointer' }}>Settings</button>
          <span style={{ fontSize: '13px', color: '#9A9A9F' }}>{profile?.full_name}</span>
          <button onClick={handleSignOut} style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '6px', border: '1px solid #2A2A2D', background: 'transparent', color: '#9A9A9F', cursor: 'pointer' }}>
            Log out
          </button>
        </div>

        {/* MOBILE HAMBURGER */}
        <button className="nav-menu-btn" onClick={() => setMenuOpen(!menuOpen)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', flexDirection: 'column', gap: '5px', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '20px', height: '2px', background: '#ffffff', borderRadius: '2px' }} />
          <div style={{ width: '20px', height: '2px', background: '#ffffff', borderRadius: '2px' }} />
          <div style={{ width: '20px', height: '2px', background: '#ffffff', borderRadius: '2px' }} />
        </button>
      </nav>

      {/* MOBILE MENU DROPDOWN */}
      {menuOpen && (
        <div className="mobile-menu" style={{ background: '#1A1A1C', borderBottom: '1px solid #2A2A2D', padding: '8px 0', width: '100%' }}>
          <button onClick={() => { setMenuOpen(false) }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 20px', background: 'none', border: 'none', color: '#ffffff', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
            Dashboard
          </button>
          <button onClick={() => { router.push('/dashboard/business'); setMenuOpen(false) }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 20px', background: 'none', border: 'none', color: '#9A9A9F', fontSize: '14px', cursor: 'pointer' }}>
  Business
</button>
<button onClick={() => { router.push('/dashboard/settings'); setMenuOpen(false) }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 20px', background: 'none', border: 'none', color: '#9A9A9F', fontSize: '14px', cursor: 'pointer' }}>
  Settings
</button>
          <div style={{ padding: '12px 20px', fontSize: '13px', color: '#9A9A9F', borderTop: '1px solid #2A2A2D', marginTop: '4px' }}>
            {profile?.full_name}
          </div>
          <button onClick={handleSignOut} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 20px', background: 'none', border: 'none', color: '#E03131', fontSize: '14px', cursor: 'pointer' }}>
            Log out
          </button>
        </div>
      )}

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '20px 16px', width: '100%' }}>

        {/* PAGE HEADER */}
        <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <h1 style={{ fontFamily: 'monospace', fontSize: '28px', fontWeight: 700, color: '#ffffff', letterSpacing: '1px', margin: 0 }}>Training Hub</h1>
            <p style={{ fontSize: '13px', color: '#9A9A9F', marginTop: '4px' }}>
              {players.length === 0 ? 'Add your first player' : `${players.length} player${players.length !== 1 ? 's' : ''} · ${groups.length} group${groups.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <div className="header-buttons" style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => router.push('/dashboard/sessions/new')} style={{ background: 'transparent', color: '#ffffff', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '9px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              + Log session
            </button>
            <button onClick={() => router.push('/dashboard/players/new')} style={{ background: '#00FF9F', color: '#0E0E0F', border: 'none', borderRadius: '8px', padding: '9px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              + Add player
            </button>
          </div>
        </div>

        {/* STAT ROW */}
        <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '10px', marginBottom: '20px' }}>
          {[
            { label: 'Total', value: players.length, color: '#ffffff' },
            { label: 'Active', value: activeCount, color: '#00FF9F' },
            { label: 'At risk', value: atRiskCount, color: '#F5A623' },
            { label: 'Lapsed', value: lapsedCount, color: '#E03131' },
          ].map(s => (
            <div key={s.label} style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '10px', padding: '14px' }}>
              <div style={{ fontSize: '10px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>{s.label}</div>
              <div style={{ fontFamily: 'monospace', fontSize: '28px', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
            </div>
          ))}
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
                      <div style={{ fontSize: '14px', fontWeight: 500, color: '#ffffff' }}>{player.full_name}</div>
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
  <button onClick={() => router.push(`/dashboard/sessions/new?player=${player.id}`)} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', border: '1px solid #2A2A2D', background: 'transparent', color: '#ffffff', cursor: 'pointer', whiteSpace: 'nowrap', textAlign: 'left' }}>+ Session</button>
  <button onClick={() => copyPlayerLink(player.id)} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', border: `1px solid ${isCopied ? '#00FF9F' : '#2A2A2D'}`, background: 'transparent', color: isCopied ? '#00FF9F' : '#9A9A9F', cursor: 'pointer', whiteSpace: 'nowrap', textAlign: 'left' }}>{isCopied ? '✓ Copied!' : 'Player link'}</button>
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
                        <div style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff' }}>{player.full_name}</div>
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
                    <button onClick={() => router.push(`/dashboard/sessions/new?player=${player.id}`)} style={{ flex: 1, padding: '9px', borderRadius: '8px', border: '1px solid #2A2A2D', background: 'transparent', color: '#ffffff', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                      + Log session
                    </button>
                    <button onClick={() => copyPlayerLink(player.id)} style={{ flex: 1, padding: '9px', borderRadius: '8px', border: `1px solid ${isCopied ? '#00FF9F' : '#2A2A2D'}`, background: 'transparent', color: isCopied ? '#00FF9F' : '#9A9A9F', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                      {isCopied ? '✓ Copied!' : 'Copy drill link'}
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
