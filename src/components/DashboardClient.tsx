'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function DashboardClient({ profile, groups, players, completions, drillWeeks, drills }) {
  const supabase = createClient()
  const router = useRouter()
  const [activeGroup, setActiveGroup] = useState(groups?.[0]?.id || null)

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const currentGroup = groups?.find(g => g.id === activeGroup)
  const groupPlayers = players?.filter(p => p.group_id === activeGroup) || []

  function getCompletionCount(playerId) {
    return completions?.filter(c => c.player_id === playerId).length || 0
  }

  function getTotalDrills() {
    const currentWeek = drillWeeks?.find(w => w.group_id === activeGroup)
    if (!currentWeek) return 0
    return drills?.filter(d => d.drill_week_id === currentWeek.id).length || 0
  }

  function getCompletionPct(playerId) {
    const done = getCompletionCount(playerId)
    const total = getTotalDrills()
    return total > 0 ? Math.round((done / total) * 100) : 0
  }

  function getInitials(name) {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'XX'
  }

  const totalCompletions = groupPlayers.reduce((sum, p) => sum + getCompletionCount(p.id), 0)
  const totalPossible = groupPlayers.length * getTotalDrills()
  const overallPct = totalPossible > 0 ? Math.round((totalCompletions / totalPossible) * 100) : 0

  return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', fontFamily: 'sans-serif' }}>

      {/* NAV */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', height: '60px', borderBottom: '1px solid #2A2A2D', background: '#0E0E0F', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ fontFamily: 'monospace', fontSize: '20px', fontWeight: 700, color: '#ffffff', letterSpacing: '2px' }}>
          SkillPath<span style={{ color: '#F4581A' }}>IQ</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
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
            <h1 style={{ fontFamily: 'monospace', fontSize: '32px', fontWeight: 700, color: '#ffffff', letterSpacing: '1px', margin: 0 }}>
              Dashboard
            </h1>
            <p style={{ fontSize: '14px', color: '#6B6B72', marginTop: '6px' }}>
              {groups?.length === 0 ? 'Get started by creating your first group' : `${groups?.length} group${groups?.length !== 1 ? 's' : ''} · ${players?.length} player${players?.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button
            onClick={() => router.push('/dashboard/groups/new')}
            style={{ background: '#F4581A', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
            + New group
          </button>
        </div>

        {groups?.length === 0 ? (
          /* EMPTY STATE */
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏀</div>
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#ffffff', marginBottom: '8px' }}>No groups yet</h2>
            <p style={{ fontSize: '14px', color: '#6B6B72', marginBottom: '24px' }}>Create your first training group to get started</p>
            <button
              onClick={() => router.push('/dashboard/groups/new')}
              style={{ background: '#F4581A', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '12px 24px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}>
              Create your first group
            </button>
          </div>
        ) : (
          <>
            {/* GROUP TABS */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
              {groups?.map(g => (
                <button
                  key={g.id}
                  onClick={() => setActiveGroup(g.id)}
                  style={{
                    padding: '8px 18px', borderRadius: '8px', border: '1px solid #2A2A2D',
                    background: activeGroup === g.id ? '#F4581A' : 'transparent',
                    color: activeGroup === g.id ? '#ffffff' : '#6B6B72',
                    fontSize: '14px', fontWeight: 500, cursor: 'pointer'
                  }}>
                  {g.name}
                </button>
              ))}
            </div>

            {/* STAT ROW */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '16px', marginBottom: '28px' }}>
              {[
                { label: 'Players', value: groupPlayers.length, color: '#ffffff' },
                { label: 'Completion rate', value: overallPct + '%', color: '#F4581A' },
                { label: 'Total completions', value: totalCompletions, color: '#1DB87A' },
                { label: 'Session day', value: currentGroup?.session_day || '—', color: '#ffffff' },
              ].map(s => (
                <div key={s.label} style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '20px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#6B6B72', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>{s.label}</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '36px', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* MAIN GRID */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px' }}>

              {/* PLAYER LIST */}
              <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '16px', overflow: 'hidden' }}>
                <div style={{ padding: '18px 20px', borderBottom: '1px solid #2A2A2D', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Players</span>
                  <button
                    onClick={() => router.push(`/dashboard/players/new?group=${activeGroup}`)}
                    style={{ fontSize: '12px', color: '#F4581A', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
                    + Add player
                  </button>
                </div>

                {groupPlayers.length === 0 ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                    <p style={{ fontSize: '14px', color: '#6B6B72', marginBottom: '16px' }}>No players in this group yet</p>
                    <button
                      onClick={() => router.push(`/dashboard/players/new?group=${activeGroup}`)}
                      style={{ background: '#F4581A', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                      Add first player
                    </button>
                  </div>
                ) : (
                  groupPlayers.map(player => {
                    const pct = getCompletionPct(player.id)
                    const done = getCompletionCount(player.id)
                    const total = getTotalDrills()
                    const color = pct === 100 ? '#1DB87A' : pct >= 40 ? '#F5A623' : '#E03131'
                    return (
                      <div key={player.id} style={{ padding: '14px 20px', borderBottom: '1px solid #2A2A2D', display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(244,88,26,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600, color: '#F4581A', flexShrink: 0 }}>
                          {getInitials(player.full_name)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '14px', fontWeight: 500, color: '#ffffff' }}>{player.full_name}</div>
                          <div style={{ fontSize: '12px', color: '#6B6B72', marginTop: '2px' }}>{player.parent_email || 'No parent email'}</div>
                        </div>
                        <div style={{ flex: 1.5 }}>
                          <div style={{ height: '5px', background: '#2A2A2D', borderRadius: '99px', overflow: 'hidden', marginBottom: '4px' }}>
                            <div style={{ height: '100%', width: pct + '%', background: color, borderRadius: '99px', transition: 'width 0.3s' }} />
                          </div>
                          <div style={{ fontSize: '11px', color: '#6B6B72' }}>{done} / {total} drills</div>
                        </div>
                        <div style={{ fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '99px', background: color + '20', color: color, whiteSpace: 'nowrap' }}>
                          {pct === 100 ? 'Done' : pct > 0 ? 'In progress' : 'Not started'}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* GROUP INFO */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '16px', padding: '20px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '16px' }}>Group info</div>
                  {[
                    { label: 'Sport', value: currentGroup?.sport || '—' },
                    { label: 'Session day', value: currentGroup?.session_day || '—' },
                    { label: 'Session time', value: currentGroup?.session_time || '—' },
                  ].map(row => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #2A2A2D' }}>
                      <span style={{ fontSize: '13px', color: '#6B6B72' }}>{row.label}</span>
                      <span style={{ fontSize: '13px', color: '#ffffff', textTransform: 'capitalize' }}>{row.value}</span>
                    </div>
                  ))}
                </div>

                <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '16px', padding: '20px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '16px' }}>Quick actions</div>
                  {[
                    { label: '+ Assign drill week', path: `/dashboard/drills/new?group=${activeGroup}` },
                    { label: '+ Add player', path: `/dashboard/players/new?group=${activeGroup}` },
                    { label: 'View parent reports', path: `/dashboard/reports?group=${activeGroup}` },
                  ].map(action => (
                    <button
                      key={action.label}
                      onClick={() => router.push(action.path)}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 0', borderBottom: '1px solid #2A2A2D', background: 'none', border: 'none', borderBottom: '1px solid #2A2A2D', color: '#F4581A', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
