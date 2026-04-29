'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import NavBar from '@/components/NavBar'

interface Group {
  id: string; name: string; sport: string; session_day: string; session_time: string; location?: string | null; trainer_id: string
}
interface Player { id: string; full_name: string; group_id: string | null }
interface Session { id: string; group_id: string | null; session_date: string; session_time: string; status: string; title: string; rescheduled_date?: string | null }
interface DrillWeek { id: string; group_id: string | null }
interface Drill { id: string; drill_week_id: string }
interface Completion { player_id: string; drill_id: string }

interface Props {
  profile: { full_name: string } | null
  groups: Group[]
  players: Player[]
  sessions: Session[]
  drillWeeks: DrillWeek[]
  drills: Drill[]
  completions: Completion[]
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const GREEN = '#00FF9F'
const AMBER = '#FFB800'
const RED = '#E03131'

function pctColor(pct: number) {
  if (pct >= 67) return GREEN
  if (pct >= 33) return AMBER
  return RED
}

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatTime(t: string) {
  if (!t) return ''
  if (t.toLowerCase().includes('am') || t.toLowerCase().includes('pm')) return t
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  return `${hour % 12 || 12}:${m}${hour >= 12 ? 'pm' : 'am'}`
}

export default function GroupsListClient({ profile, groups: initialGroups, players, sessions, drillWeeks, drills, completions }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [groups, setGroups] = useState(initialGroups)
  const [showModal, setShowModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newLocation, setNewLocation] = useState('')
  const [newDay, setNewDay] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const today = new Date().toISOString().split('T')[0]

  function getGroupStats(group: Group) {
    const groupPlayers = players.filter(p => p.group_id === group.id)
    const playerCount = groupPlayers.length

    const groupDrillWeekIds = drillWeeks.filter(w => w.group_id === group.id).map(w => w.id)
    const groupDrills = drills.filter(d => groupDrillWeekIds.includes(d.drill_week_id))
    const groupDrillIds = groupDrills.map(d => d.id)

    let avgDrillPct = 0
    if (groupDrills.length > 0 && groupPlayers.length > 0) {
      const perPlayer = groupPlayers.map(p => {
        const done = completions.filter(c => c.player_id === p.id && groupDrillIds.includes(c.drill_id)).length
        return done / groupDrills.length * 100
      })
      avgDrillPct = Math.round(perPlayer.reduce((s, v) => s + v, 0) / perPlayer.length)
    }

    const groupSessions = sessions.filter(s => s.group_id === group.id)
    const totalLogged = groupSessions.filter(s => s.status === 'logged').length

    const nextSession = groupSessions
      .filter(s => (s.rescheduled_date || s.session_date) >= today)
      .sort((a, b) => (a.rescheduled_date || a.session_date).localeCompare(b.rescheduled_date || b.session_date))[0] || null

    return { playerCount, avgDrillPct, totalLogged, nextSession }
  }

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    setCreateError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const { data, error } = await supabase
      .from('groups')
      .insert({
        trainer_id: user.id,
        name: newName.trim(),
        location: newLocation.trim() || null,
        session_day: newDay || null,
        sport: 'basketball',
      })
      .select().single()

    if (error) { setCreateError(error.message); setCreating(false); return }
    setGroups(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    setShowModal(false)
    setNewName(''); setNewLocation(''); setNewDay('')
    setCreating(false)
    router.push(`/dashboard/groups/${data.id}`)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', fontFamily: 'sans-serif', overflowX: 'hidden' }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #0E0E0F; overflow-x: hidden; }
        .groups-bottom-nav { display: none; }
        @media (max-width: 640px) {
          .groups-bottom-nav { display: flex !important; }
        }
        @media (min-width: 641px) {
          .groups-bottom-nav { display: none !important; }
        }
      `}</style>

      <NavBar trainerName={profile?.full_name} />

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '24px 16px 100px' }}>

        {/* HEADER */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <h1 style={{ fontFamily: '"Exo 2", sans-serif', fontSize: '26px', fontWeight: 700, color: '#ffffff' }}>My Groups</h1>
          <button
            onClick={() => setShowModal(true)}
            style={{ background: GREEN, color: '#0E0E0F', border: 'none', borderRadius: '8px', padding: '9px 16px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
            + New group
          </button>
        </div>

        {/* GROUP CARDS */}
        {groups.length === 0 ? (
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '48px 24px', textAlign: 'center' as const }}>
            <p style={{ fontSize: '15px', color: '#9A9A9F', marginBottom: '16px' }}>No groups yet</p>
            <button
              onClick={() => setShowModal(true)}
              style={{ background: GREEN, color: '#0E0E0F', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
              Create your first group
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {groups.map(group => {
              const { playerCount, avgDrillPct, totalLogged, nextSession } = getGroupStats(group)
              const hasDrills = drillWeeks.some(w => w.group_id === group.id)
              return (
                <div
                  key={group.id}
                  onClick={() => router.push(`/dashboard/groups/${group.id}`)}
                  style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '18px 20px', cursor: 'pointer', transition: 'border-color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(0,255,159,0.3)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#2A2A2D')}>

                  {/* NAME + SPORT */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', marginBottom: '2px' }}>{group.name}</div>
                      {group.location && (
                        <div style={{ fontSize: '12px', color: '#9A9A9F', marginBottom: '2px' }}>📍 {group.location}</div>
                      )}
                      {(group.session_day || group.session_time) && (
                        <div style={{ fontSize: '12px', color: '#9A9A9F' }}>
                          {[group.session_day, group.session_time ? formatTime(group.session_time) : ''].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9A9A9F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </div>

                  {/* STATS ROW */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '12px', flexWrap: 'wrap' as const }}>
                    <span style={{ fontSize: '12px', color: '#9A9A9F' }}>
                      <span style={{ color: '#ffffff', fontWeight: 600 }}>{playerCount}</span> player{playerCount !== 1 ? 's' : ''}
                    </span>
                    {hasDrills && (
                      <span style={{ fontSize: '12px', color: '#9A9A9F' }}>
                        <span style={{ color: pctColor(avgDrillPct), fontWeight: 600 }}>{avgDrillPct}%</span> avg drills
                      </span>
                    )}
                    <span style={{ fontSize: '12px', color: '#9A9A9F' }}>
                      <span style={{ color: '#ffffff', fontWeight: 600 }}>{totalLogged}</span> sessions logged
                    </span>
                  </div>

                  {/* NEXT SESSION */}
                  {nextSession && (
                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #2A2A2D', fontSize: '12px', color: '#9A9A9F' }}>
                      Next: <span style={{ color: GREEN, fontWeight: 600 }}>{formatDate(nextSession.rescheduled_date || nextSession.session_date)}</span>
                      {nextSession.session_time && <span> · {formatTime(nextSession.session_time)}</span>}
                      {nextSession.title && <span> · {nextSession.title}</span>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* CREATE MODAL */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '440px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', fontFamily: '"Exo 2", sans-serif' }}>Create a group</div>
              <button onClick={() => { setShowModal(false); setCreateError(null) }} style={{ background: 'none', border: 'none', color: '#9A9A9F', cursor: 'pointer', fontSize: '22px', lineHeight: 1 }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#9A9A9F', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>Group name *</label>
                <input
                  autoFocus
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Elite U12, Monday Group"
                  style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#9A9A9F', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>Location</label>
                <input
                  value={newLocation}
                  onChange={e => setNewLocation(e.target.value)}
                  placeholder="e.g. Springfield Sports Center"
                  style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#9A9A9F', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>Session day</label>
                <select
                  value={newDay}
                  onChange={e => setNewDay(e.target.value)}
                  style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', color: newDay ? '#ffffff' : '#9A9A9F', outline: 'none', width: '100%' }}>
                  <option value="">No day set</option>
                  {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>

            {createError && <p style={{ fontSize: '13px', color: RED, marginTop: '10px' }}>{createError}</p>}

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                style={{ flex: 1, background: newName.trim() ? GREEN : '#2A2A2D', color: newName.trim() ? '#0E0E0F' : '#9A9A9F', border: 'none', borderRadius: '8px', padding: '11px', fontSize: '14px', fontWeight: 700, cursor: newName.trim() ? 'pointer' : 'default' }}>
                {creating ? 'Creating...' : 'Create group'}
              </button>
              <button
                onClick={() => { setShowModal(false); setCreateError(null) }}
                style={{ padding: '11px 16px', borderRadius: '8px', border: '1px solid #2A2A2D', background: 'transparent', color: '#9A9A9F', fontSize: '14px', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE BOTTOM NAV */}
      <div className="groups-bottom-nav" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: '72px', background: '#0E0E0F', borderTop: '1px solid #2A2A2D', zIndex: 200, alignItems: 'stretch' }}>
        {([
          { label: 'Hub', path: '/dashboard', active: false, icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          )},
          { label: 'Players', path: '/dashboard/clients', active: false, icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
          )},
          { label: 'Groups', path: '/dashboard/groups', active: true, icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
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
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px', background: 'none', border: 'none', cursor: 'pointer', color: tab.active ? GREEN : '#9A9A9F', padding: '8px 0' }}>
            {tab.icon}
            <span style={{ fontSize: '10px', fontWeight: tab.active ? 700 : 400 }}>{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
