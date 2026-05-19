'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import NavBar from '@/components/NavBar'

interface Group {
  id: string
  name: string
  sport: string
  session_day: string
  session_time: string
  location?: string | null
  trainer_id: string
  window_id?: string | null
  description?: string | null
}

interface AvailabilityWindow {
  id: string
  day_of_week: string
  start_time: string
  end_time: string
  session_type: string
  display_label: string | null
  max_capacity: number | null
}

interface BookingRequest {
  id: string
  trainer_id: string
  request_type: string
  player_id: string | null
  parent_name: string
  parent_email: string
  parent_phone: string | null
  player_name: string
  player_age: number | null
  player_gender: string | null
  player_experience: string | null
  additional_info: string | null
  preferred_session_type: string
  preferred_availability_text: string | null
  message: string | null
  status: string
  preferred_slots: Array<{ rank: number; window_id: string; slot_time: string }> | null
}

interface ConfirmedPlayer {
  id: string
  full_name: string
  avatar_initials: string | null
  parent_email: string | null
}

interface RosterPlayer {
  id: string
  full_name: string
  parent_email: string | null
  avatar_initials: string | null
  birth_year: number | null
  player_gender: string | null
  player_experience: string | null
  total_attended: number
  last_attended: string | null
}

interface SessionHistoryItem {
  id: string
  session_date: string
  attended_count: number
  total_count: number
}

interface Session {
  id: string
  title: string
  session_date: string
  session_time: string
  status: string
  group_id: string | null
  rescheduled_date?: string | null
}

interface AllPlayer {
  id: string
  full_name: string
  parent_email: string | null
  avatar_initials?: string | null
  group_ids: string[]
}

interface DrillWeek { id: string; title: string; week_start: string; group_id: string | null }
interface Drill { id: string; title: string; description: string; drill_week_id: string; sort_order: number }
interface Completion { player_id: string; drill_id: string }

interface Props {
  group: Group
  allWindows: AvailabilityWindow[]
  linkedWindow: AvailabilityWindow | null
  bookingRequest: BookingRequest | null
  confirmedPlayers: ConfirmedPlayer[]
  rosterPlayers: RosterPlayer[]
  sessionHistory: SessionHistoryItem[]
  maxCapacity: number | null
  sessions: Session[]
  allPlayers: AllPlayer[]
  drillWeeks: DrillWeek[]
  drills: Drill[]
  completions: Completion[]
  trainerName?: string
  trainerEmail?: string
  trainerProfile: { full_name: string; email: string; location: string | null }
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

function formatShortDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatTime(t: string) {
  if (!t) return ''
  if (t.toLowerCase().includes('am') || t.toLowerCase().includes('pm')) return t
  const [h, mi] = t.split(':')
  const hour = parseInt(h)
  return `${hour % 12 || 12}:${mi}${hour >= 12 ? 'pm' : 'am'}`
}

function formatHourRange(start: string, end: string) {
  return `${formatTime(start)}–${formatTime(end)}`
}

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??'
}

function genderLabel(g: string | null) {
  if (g === 'male') return 'Boy'
  if (g === 'female') return 'Girl'
  return null
}

function experienceLabel(e: string | null) {
  if (e === 'beginner') return 'Beginner'
  if (e === 'rec_league') return 'Rec League'
  if (e === 'bantam_club') return 'Bantam/Club'
  return null
}

export default function GroupDetailClient({
  group: initialGroup,
  allWindows,
  linkedWindow: initialLinkedWindow,
  bookingRequest,
  confirmedPlayers: initialConfirmed,
  rosterPlayers: initialRoster,
  sessionHistory,
  maxCapacity,
  sessions,
  allPlayers,
  drillWeeks,
  drills,
  completions,
  trainerName,
  trainerProfile,
}: Props) {
  const router = useRouter()
  const supabase = createClient()

  // Group state
  const [group, setGroup] = useState(initialGroup)
  const [linkedWindow, setLinkedWindow] = useState<AvailabilityWindow | null>(initialLinkedWindow)
  const [editMode, setEditMode] = useState(false)
  const [editName, setEditName] = useState(initialGroup.name)
  const [editLocation, setEditLocation] = useState(initialGroup.location || '')
  const [editSessionDay, setEditSessionDay] = useState(initialGroup.session_day || '')
  const [editSessionTime, setEditSessionTime] = useState(initialGroup.session_time || '')
  const [editWindowId, setEditWindowId] = useState(initialGroup.window_id || '')
  const [editDescription, setEditDescription] = useState(initialGroup.description || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Banner state
  const [bannerLoading, setBannerLoading] = useState<'add' | 'decline' | null>(null)
  const [bannerError, setBannerError] = useState<string | null>(null)
  const [bannerDismissed, setBannerDismissed] = useState(false)

  // Confirmed players state
  const [localConfirmed, setLocalConfirmed] = useState<ConfirmedPlayer[]>(initialConfirmed)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  // Roster state
  const [localRoster, setLocalRoster] = useState<RosterPlayer[]>(initialRoster)
  const [sortBy, setSortBy] = useState<'attended' | 'name'>('attended')
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [search, setSearch] = useState('')
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [newPlayerEmail, setNewPlayerEmail] = useState('')
  const [addingNewPlayer, setAddingNewPlayer] = useState(false)
  const [addPlayerError, setAddPlayerError] = useState<string | null>(null)

  // Session history collapse
  const [historyOpen, setHistoryOpen] = useState(false)

  // Toast
  const [toast, setToast] = useState<string | null>(null)

  // Email state
  const [showEmailComposer, setShowEmailComposer] = useState(false)
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [emailRecipients, setEmailRecipients] = useState<string[]>(
    initialRoster.filter(p => p.parent_email).map(p => p.id)
  )
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailResults, setEmailResults] = useState<{ id: string; name: string; success: boolean }[]>([])

  // Show toast helper
  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  // Computed
  const today = new Date().toISOString().split('T')[0]
  const drillIds = drills.map(d => d.id)

  const nextSession = sessions
    .filter(s => (s.rescheduled_date || s.session_date) >= today)
    .sort((a, b) => (a.rescheduled_date || a.session_date).localeCompare(b.rescheduled_date || b.session_date))[0] || null

  const totalSessionsLogged = sessions.filter(s => s.status === 'logged').length

  function getPlayerDrillPct(playerId: string) {
    if (drills.length === 0) return 0
    const done = completions.filter(c => c.player_id === playerId && drillIds.includes(c.drill_id)).length
    return Math.round(done / drills.length * 100)
  }

  const groupPlayerIds = localRoster.map(p => p.id)
  const avgDrillPct = groupPlayerIds.length === 0 || drills.length === 0 ? 0 :
    Math.round(groupPlayerIds.reduce((sum, id) => sum + getPlayerDrillPct(id), 0) / groupPlayerIds.length)

  function getDrillCompletion(drillId: string) {
    const done = completions.filter(c => c.drill_id === drillId && groupPlayerIds.includes(c.player_id)).length
    return { done, total: groupPlayerIds.length }
  }

  const availablePlayers = allPlayers.filter(p =>
    !p.group_ids.includes(group.id) &&
    !localRoster.some(r => r.id === p.id) &&
    (search === '' || p.full_name.toLowerCase().includes(search.toLowerCase()))
  )

  const sortedRoster = [...localRoster].sort((a, b) => {
    if (sortBy === 'attended') {
      if (b.total_attended !== a.total_attended) return b.total_attended - a.total_attended
      return a.full_name.localeCompare(b.full_name)
    }
    return a.full_name.localeCompare(b.full_name)
  })

  const confirmedIds = new Set(localConfirmed.map(p => p.id))
  const atCapacity = maxCapacity !== null && localConfirmed.length >= maxCapacity

  // Save group changes
  async function handleSave() {
    setSaving(true); setSaveError(null)
    const updatePayload: Record<string, unknown> = {
      name: editName.trim() || group.name,
      location: editLocation.trim() || null,
      session_day: editSessionDay || null,
      session_time: editSessionTime.trim() || null,
      window_id: editWindowId || null,
      description: editDescription.trim() || null,
    }
    const { error } = await supabase.from('groups').update(updatePayload).eq('id', group.id)
    if (error) { setSaveError(error.message); setSaving(false); return }
    const newWindow = editWindowId ? allWindows.find(w => w.id === editWindowId) || null : null
    setGroup(g => ({
      ...g,
      name: editName.trim() || g.name,
      location: editLocation.trim() || null,
      session_day: editSessionDay,
      session_time: editSessionTime,
      window_id: editWindowId || null,
      description: editDescription.trim() || null,
    }))
    setLinkedWindow(newWindow)
    setSaved(true); setSaving(false); setEditMode(false)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleCancelEdit() {
    setEditName(group.name)
    setEditLocation(group.location || '')
    setEditSessionDay(group.session_day || '')
    setEditSessionTime(group.session_time || '')
    setEditWindowId(group.window_id || '')
    setEditDescription(group.description || '')
    setEditMode(false); setSaveError(null)
  }

  // Banner handlers
  async function handleAddToGroup() {
    if (!bookingRequest) return
    setBannerLoading('add'); setBannerError(null)
    try {
      const res = await fetch(`/api/groups/${group.id}/confirm-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_request_id: bookingRequest.id }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setBannerError(data.error || 'Failed to add player')
        setBannerLoading(null)
        return
      }
      const newPlayer = data.player as { id: string; full_name: string; parent_email: string | null; avatar_initials: string | null; birth_year: number | null; player_gender: string | null; player_experience: string | null }
      const rosterEntry: RosterPlayer = {
        id: newPlayer.id,
        full_name: newPlayer.full_name,
        parent_email: newPlayer.parent_email,
        avatar_initials: newPlayer.avatar_initials,
        birth_year: newPlayer.birth_year,
        player_gender: newPlayer.player_gender,
        player_experience: newPlayer.player_experience,
        total_attended: 0,
        last_attended: null,
      }
      setLocalRoster(prev => [...prev, rosterEntry])
      setLocalConfirmed(prev => [...prev, {
        id: newPlayer.id,
        full_name: newPlayer.full_name,
        avatar_initials: newPlayer.avatar_initials,
        parent_email: newPlayer.parent_email,
      }])
      setBannerDismissed(true)
      setBannerLoading(null)
      showToast('Added to group ✓')
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Failed to add player')
      setBannerLoading(null)
    }
  }

  async function handleDeclineRequest() {
    if (!bookingRequest) return
    setBannerLoading('decline'); setBannerError(null)
    try {
      const res = await fetch(`/api/groups/${group.id}/decline-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_request_id: bookingRequest.id }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setBannerError(data.error || 'Failed to decline')
        setBannerLoading(null)
        return
      }
      setBannerDismissed(true)
      setBannerLoading(null)
      showToast('Request declined')
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Failed to decline')
      setBannerLoading(null)
    }
  }

  // Confirm/unconfirm
  async function handleConfirmPlayer(player: RosterPlayer) {
    if (atCapacity) return
    setConfirmingId(player.id); setConfirmError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setConfirmingId(null); return }
    const { error } = await supabase
      .from('group_confirmed_players')
      .insert({ group_id: group.id, player_id: player.id, confirmed_by_trainer_id: user.id })
    if (error) {
      setConfirmError(error.message)
      setConfirmingId(null)
      return
    }
    setLocalConfirmed(prev => [...prev, {
      id: player.id,
      full_name: player.full_name,
      avatar_initials: player.avatar_initials,
      parent_email: player.parent_email,
    }])
    setConfirmingId(null)
  }

  async function handleUnconfirmPlayer(playerId: string) {
    setConfirmingId(playerId); setConfirmError(null)
    const { error } = await supabase
      .from('group_confirmed_players')
      .delete()
      .eq('group_id', group.id)
      .eq('player_id', playerId)
    if (error) {
      setConfirmError(error.message)
      setConfirmingId(null)
      return
    }
    setLocalConfirmed(prev => prev.filter(p => p.id !== playerId))
    setConfirmingId(null)
  }

  async function handleRemovePlayer(player: RosterPlayer) {
    setRemovingId(player.id)
    const { error } = await supabase.from('group_members').delete().eq('group_id', group.id).eq('player_id', player.id)
    if (!error) {
      setLocalRoster(prev => prev.filter(p => p.id !== player.id))
      setLocalConfirmed(prev => prev.filter(p => p.id !== player.id))
    }
    setRemovingId(null)
  }

  async function handleAddExistingPlayer(player: AllPlayer) {
    setAddPlayerError(null)
    const { error } = await supabase.from('group_members').insert({ group_id: group.id, player_id: player.id })
    if (error) {
      setAddPlayerError(error.message)
      return
    }
    const newEntry: RosterPlayer = {
      id: player.id,
      full_name: player.full_name,
      parent_email: player.parent_email,
      avatar_initials: player.avatar_initials || null,
      birth_year: null,
      player_gender: null,
      player_experience: null,
      total_attended: 0,
      last_attended: null,
    }
    setLocalRoster(prev => [...prev, newEntry].sort((a, b) => a.full_name.localeCompare(b.full_name)))
    setSearch('')
  }

  async function handleAddNewPlayer() {
    if (!newPlayerName.trim() || !newPlayerEmail.trim()) return
    setAddingNewPlayer(true)
    setAddPlayerError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setAddingNewPlayer(false); return }
    const initials = newPlayerName.trim().split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    const { data, error: playerError } = await supabase.from('players').insert({
      trainer_id: user.id,
      full_name: newPlayerName.trim(),
      parent_email: newPlayerEmail.trim(),
      avatar_initials: initials,
    }).select().single()
    if (playerError || !data) {
      setAddPlayerError(playerError?.message || 'Failed to create player')
      setAddingNewPlayer(false)
      return
    }
    const { error: memberError } = await supabase.from('group_members').insert({ group_id: group.id, player_id: data.id })
    if (memberError) {
      setAddPlayerError(memberError.message)
      setAddingNewPlayer(false)
      return
    }
    const newEntry: RosterPlayer = {
      id: data.id,
      full_name: data.full_name,
      parent_email: data.parent_email,
      avatar_initials: data.avatar_initials,
      birth_year: data.birth_year || null,
      player_gender: data.player_gender || null,
      player_experience: data.player_experience || null,
      total_attended: 0,
      last_attended: null,
    }
    setLocalRoster(prev => [...prev, newEntry].sort((a, b) => a.full_name.localeCompare(b.full_name)))
    setNewPlayerName(''); setNewPlayerEmail(''); setShowAddPlayer(false)
    setAddingNewPlayer(false)
  }

  async function handleSendEmail() {
    setSendingEmail(true); setEmailResults([])
    const results: { id: string; name: string; success: boolean }[] = []
    const recipients = localRoster.filter(p => emailRecipients.includes(p.id) && p.parent_email)
    for (const player of recipients) {
      try {
        const res = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: player.parent_email,
            subject: emailSubject || `Update from ${group.name}`,
            body: emailBody,
            playerName: player.full_name.split(' ')[0],
            playerUrl: `${window.location.origin}/player?id=${player.id}`,
          }),
        })
        const data = await res.json()
        results.push({ id: player.id, name: player.full_name, success: !data.error })
      } catch {
        results.push({ id: player.id, name: player.full_name, success: false })
      }
    }
    setEmailResults(results); setSendingEmail(false)
    if (results.every(r => r.success)) { setEmailBody(''); setEmailSubject('') }
  }

  // Sync email recipients when roster changes
  useEffect(() => {
    setEmailRecipients(localRoster.filter(p => p.parent_email).map(p => p.id))
  }, [localRoster])

  const inputStyle = { background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '9px 12px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }
  const labelStyle = { fontSize: '12px', color: '#9A9A9F', fontWeight: 600 as const, textTransform: 'uppercase' as const, letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }

  const showBanner = bookingRequest && !bannerDismissed

  return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', fontFamily: 'sans-serif', overflowX: 'hidden' }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #0E0E0F; overflow-x: hidden; }
        .group-detail-bottom-nav { display: none; }
        @media (max-width: 640px) {
          .group-detail-bottom-nav { display: flex !important; }
          .roster-row-stats-desktop { display: none !important; }
          .roster-row-stats-mobile { display: flex !important; }
        }
        @media (min-width: 641px) {
          .group-detail-bottom-nav { display: none !important; }
          .roster-row-stats-mobile { display: none !important; }
          .roster-row-stats-desktop { display: flex !important; }
        }
      `}</style>

      <NavBar trainerName={trainerName} />

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '24px 16px 100px', width: '100%' }}>

        {/* HEADER */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {editMode ? (
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  style={{ ...inputStyle, fontSize: '22px', fontWeight: 700, fontFamily: '"Exo 2", sans-serif', marginBottom: '8px' }}
                />
              ) : (
                <h1 style={{ fontFamily: '"Exo 2", sans-serif', fontSize: '26px', fontWeight: 700, color: '#ffffff', marginBottom: '4px' }}>{group.name}</h1>
              )}
              {!editMode && linkedWindow && (
                <div style={{ fontSize: '13px', color: '#9A9A9F', marginBottom: '4px' }}>
                  {capitalize(linkedWindow.day_of_week)} · {formatHourRange(linkedWindow.start_time, linkedWindow.end_time)} · {linkedWindow.session_type === 'group' ? 'Group' : 'Group/Individual'}
                </div>
              )}
              {!editMode && (
                <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px', alignItems: 'center' }}>
                  {group.location && <span style={{ fontSize: '13px', color: '#9A9A9F' }}>📍 {group.location}</span>}
                  {(group.session_day || group.session_time) && (
                    <span style={{ fontSize: '13px', color: '#9A9A9F' }}>
                      {[group.session_day, group.session_time ? formatTime(group.session_time) : ''].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </div>
              )}
              {!editMode && group.description && (
                <div style={{ fontSize: '13px', color: '#9A9A9F', fontStyle: 'italic' as const, marginTop: '6px' }}>{group.description}</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              {editMode ? (
                <>
                  <button onClick={handleSave} disabled={saving} style={{ background: GREEN, color: '#0E0E0F', border: 'none', borderRadius: '8px', padding: '7px 14px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={handleCancelEdit} style={{ background: 'transparent', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '7px 14px', fontSize: '13px', color: '#9A9A9F', cursor: 'pointer' }}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setEditMode(true)} style={{ background: 'transparent', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '7px 14px', fontSize: '13px', color: '#9A9A9F', cursor: 'pointer' }}>
                    Edit
                  </button>
                  <button onClick={() => router.push('/dashboard/groups')} style={{ background: 'transparent', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '7px 14px', fontSize: '13px', color: '#9A9A9F', cursor: 'pointer' }}>
                    ← Back
                  </button>
                </>
              )}
            </div>
          </div>

          {/* INLINE EDIT FIELDS */}
          {editMode && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '14px', background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '16px' }}>
              <div>
                <label style={labelStyle}>Location</label>
                <input value={editLocation} onChange={e => setEditLocation(e.target.value)} placeholder="e.g. Springfield Sports Center" style={inputStyle} />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Session day</label>
                  <select value={editSessionDay} onChange={e => setEditSessionDay(e.target.value)} style={{ ...inputStyle, color: editSessionDay ? '#ffffff' : '#9A9A9F' }}>
                    <option value="">No day set</option>
                    {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Session time</label>
                  <input value={editSessionTime} onChange={e => setEditSessionTime(e.target.value)} placeholder="e.g. 4:00pm" style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Linked availability window</label>
                <select value={editWindowId} onChange={e => setEditWindowId(e.target.value)} style={{ ...inputStyle, color: editWindowId ? '#ffffff' : '#9A9A9F' }}>
                  <option value="">None (no window linked)</option>
                  {allWindows.map(w => (
                    <option key={w.id} value={w.id}>
                      {capitalize(w.day_of_week)} · {formatHourRange(w.start_time, w.end_time)} · {w.session_type === 'group' ? 'Group' : 'Group/Individual'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Group notes</label>
                <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} placeholder="e.g. Competitive 10U boys, Tuesday evenings"
                  style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' as const, fontFamily: 'sans-serif' }} />
              </div>
              {saveError && <p style={{ fontSize: '13px', color: RED }}>{saveError}</p>}
            </div>
          )}
        </div>

        {/* SAVED TOAST */}
        {saved && (
          <div style={{ background: 'rgba(0,255,159,0.1)', border: '1px solid rgba(0,255,159,0.3)', borderRadius: '10px', padding: '10px 16px', marginBottom: '16px', fontSize: '14px', color: GREEN, fontWeight: 500 }}>
            ✓ Group saved
          </div>
        )}

        {/* TOAST */}
        {toast && (
          <div style={{ position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)', background: '#1A1A1C', border: '1px solid rgba(0,255,159,0.4)', borderRadius: '10px', padding: '10px 16px', fontSize: '14px', color: GREEN, fontWeight: 600, zIndex: 300, boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
            {toast}
          </div>
        )}

        {/* PENDING REQUEST BANNER */}
        {showBanner && bookingRequest && (
          <div style={{
            borderLeft: `4px solid ${GREEN}`,
            background: 'rgba(0,255,159,0.04)',
            border: '1px solid rgba(0,255,159,0.2)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '20px',
          }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: GREEN, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: '10px' }}>
              Pending Request
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', marginBottom: '4px' }}>
              {bookingRequest.player_name}
              <span style={{ fontSize: '13px', fontWeight: 400, color: '#9A9A9F', marginLeft: '6px' }}>
                {[
                  bookingRequest.player_age ? `age ${bookingRequest.player_age}` : null,
                  genderLabel(bookingRequest.player_gender),
                  experienceLabel(bookingRequest.player_experience),
                ].filter(Boolean).join(' · ')}
              </span>
            </div>
            <div style={{ fontSize: '13px', color: '#9A9A9F', marginBottom: '6px' }}>
              Parent: {bookingRequest.parent_name} · {bookingRequest.parent_email}{bookingRequest.parent_phone ? ` · ${bookingRequest.parent_phone}` : ''}
            </div>
            {bookingRequest.preferred_availability_text && (
              <div style={{ fontSize: '13px', color: '#9A9A9F', marginBottom: '6px', whiteSpace: 'pre-wrap' as const }}>
                {bookingRequest.preferred_availability_text}
              </div>
            )}
            {bookingRequest.message && (
              <div style={{ fontSize: '13px', color: '#9A9A9F', fontStyle: 'italic' as const, marginBottom: '10px' }}>
                &ldquo;{bookingRequest.message}&rdquo;
              </div>
            )}
            {bookingRequest.additional_info && (
              <div style={{ fontSize: '13px', color: '#9A9A9F', marginBottom: '10px' }}>
                {bookingRequest.additional_info}
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' as const }}>
              <button
                onClick={handleAddToGroup}
                disabled={bannerLoading !== null}
                style={{ background: GREEN, color: '#0E0E0F', border: 'none', borderRadius: '8px', padding: '9px 16px', fontSize: '13px', fontWeight: 700, cursor: bannerLoading ? 'default' : 'pointer' }}>
                {bannerLoading === 'add' ? 'Adding...' : 'Add to Group'}
              </button>
              <button
                onClick={handleDeclineRequest}
                disabled={bannerLoading !== null}
                style={{ background: 'transparent', color: '#9A9A9F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '9px 16px', fontSize: '13px', fontWeight: 600, cursor: bannerLoading ? 'default' : 'pointer' }}>
                {bannerLoading === 'decline' ? 'Declining...' : 'Decline'}
              </button>
            </div>
            {bannerError && (
              <p style={{ fontSize: '13px', color: RED, marginTop: '10px' }}>{bannerError}</p>
            )}
          </div>
        )}

        {/* CONFIRMED FOR NEXT SESSION CARD */}
        <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '16px 20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap' as const, gap: '8px' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: GREEN, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: '2px' }}>
                Next Session
              </div>
              <div style={{ fontSize: '14px', color: '#ffffff', fontWeight: 600 }}>
                {nextSession
                  ? `${formatDate(nextSession.rescheduled_date || nextSession.session_date)}${nextSession.session_time ? ` · ${formatTime(nextSession.session_time)}` : ''}`
                  : 'No session scheduled yet'}
              </div>
            </div>
            {maxCapacity !== null && (
              <div style={{
                fontSize: '12px', fontWeight: 700,
                padding: '4px 10px', borderRadius: '99px',
                background: atCapacity ? 'rgba(255,184,0,0.12)' : 'rgba(0,255,159,0.10)',
                color: atCapacity ? AMBER : GREEN,
              }}>
                {atCapacity ? 'Full' : `${localConfirmed.length} / ${maxCapacity} confirmed`}
              </div>
            )}
          </div>

          <div style={{ height: '1px', background: '#2A2A2D', margin: '4px 0 14px' }} />

          {localConfirmed.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#9A9A9F', marginBottom: '14px' }}>
              No players confirmed yet. Tap a player in the roster to confirm.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
              {localConfirmed.map(player => (
                <div key={player.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: '#0E0E0F', borderRadius: '8px', border: '1px solid #2A2A2D' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(0,255,159,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600, color: GREEN, flexShrink: 0 }}>
                    {player.avatar_initials || getInitials(player.full_name)}
                  </div>
                  <span style={{ fontSize: '13px', color: '#ffffff', flex: 1, fontWeight: 500 }}>{player.full_name}</span>
                  <button
                    onClick={() => handleUnconfirmPlayer(player.id)}
                    disabled={confirmingId === player.id}
                    style={{ fontSize: '14px', padding: '2px 8px', borderRadius: '6px', border: 'none', background: 'transparent', color: '#9A9A9F', cursor: confirmingId === player.id ? 'default' : 'pointer', lineHeight: 1 }}
                    title="Remove from confirmed"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {confirmError && (
            <p style={{ fontSize: '12px', color: RED, marginBottom: '10px' }}>{confirmError}</p>
          )}

          <button
            onClick={() => router.push(`/dashboard/sessions/new?group=${group.id}`)}
            style={{ width: '100%', background: GREEN, color: '#0E0E0F', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
            Log Session
          </button>
        </div>

        {/* STATS ROW */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' as const }}>
          {[
            { label: 'Players', value: String(localRoster.length), color: '#ffffff' },
            ...(drills.length > 0 ? [{ label: 'Avg drills', value: `${avgDrillPct}%`, color: pctColor(avgDrillPct) }] : []),
            { label: 'Sessions logged', value: String(totalSessionsLogged), color: '#ffffff' },
          ].map(stat => (
            <div key={stat.label} style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '10px', padding: '12px 16px', flex: '1', minWidth: '100px' }}>
              <div style={{ fontSize: '20px', fontWeight: 700, color: stat.color, fontFamily: '"Exo 2", sans-serif' }}>{stat.value}</div>
              <div style={{ fontSize: '11px', color: '#9A9A9F', marginTop: '2px', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* ACTION ROW */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' as const }}>
          <button
            onClick={() => router.push(`/dashboard/sessions/new?group=${group.id}`)}
            style={{ flex: 1, minWidth: '120px', background: '#1A1A1C', border: '1px solid rgba(0,255,159,0.4)', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: '#ffffff', cursor: 'pointer', textAlign: 'center' as const }}>
            + Schedule Session
          </button>
          <button
            onClick={() => router.push(`/dashboard/drills/new?group=${group.id}`)}
            style={{ flex: 1, minWidth: '120px', background: '#1A1A1C', border: '1px solid rgba(0,255,159,0.4)', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: '#ffffff', cursor: 'pointer', textAlign: 'center' as const }}>
            Assign Drills
          </button>
          <button
            onClick={() => setShowEmailComposer(!showEmailComposer)}
            style={{ flex: 1, minWidth: '120px', background: showEmailComposer ? 'rgba(0,255,159,0.1)' : '#1A1A1C', border: '1px solid rgba(0,255,159,0.4)', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', fontWeight: 600, color: showEmailComposer ? GREEN : '#ffffff', cursor: 'pointer', textAlign: 'center' as const }}>
            Email Group
          </button>
        </div>

        {/* EMAIL COMPOSER */}
        {showEmailComposer && (
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
            {localRoster.filter(p => p.parent_email).length === 0 ? (
              <p style={{ fontSize: '13px', color: '#9A9A9F' }}>No contact emails on file. Add emails to players first.</p>
            ) : (
              <>
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ fontSize: '11px', color: '#9A9A9F', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Recipients</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '6px' }}>
                    {localRoster.filter(p => p.parent_email).map(player => (
                      <div key={player.id}
                        onClick={() => setEmailRecipients(prev => prev.includes(player.id) ? prev.filter(id => id !== player.id) : [...prev, player.id])}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: emailRecipients.includes(player.id) ? 'rgba(0,255,159,0.1)' : '#0E0E0F', border: `1px solid ${emailRecipients.includes(player.id) ? 'rgba(0,255,159,0.3)' : '#2A2A2D'}`, borderRadius: '99px', padding: '4px 10px', cursor: 'pointer' }}>
                        <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: emailRecipients.includes(player.id) ? GREEN : '#2A2A2D', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {emailRecipients.includes(player.id) && <svg width="7" height="7" viewBox="0 0 8 8" fill="none"><polyline points="1,4 3,6 7,2" stroke="#0E0E0F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                        </div>
                        <span style={{ fontSize: '12px', color: emailRecipients.includes(player.id) ? GREEN : '#9A9A9F', fontWeight: 500 }}>{player.full_name}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <input type="text" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} placeholder={`Subject: Update from ${group.name}`} style={{ ...inputStyle, marginBottom: '8px' }} />
                <textarea value={emailBody} onChange={e => setEmailBody(e.target.value)} placeholder="Write your update, schedule reminders..." rows={4} style={{ ...inputStyle, resize: 'vertical' as const, fontFamily: 'sans-serif', marginBottom: '10px' }} />
                {emailResults.length > 0 && (
                  <div style={{ marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {emailResults.map(r => (
                      <div key={r.id} style={{ display: 'flex', gap: '8px', fontSize: '12px', alignItems: 'center' }}>
                        <span style={{ color: r.success ? GREEN : RED }}>{r.success ? '✓' : '✕'}</span>
                        <span style={{ color: '#9A9A9F' }}>{r.name}</span>
                        <span style={{ color: r.success ? GREEN : RED }}>{r.success ? 'Sent' : 'Failed'}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={handleSendEmail} disabled={sendingEmail || emailRecipients.length === 0 || !emailBody.trim()}
                    style={{ flex: 1, background: emailRecipients.length > 0 && emailBody.trim() ? GREEN : '#2A2A2D', color: emailRecipients.length > 0 && emailBody.trim() ? '#0E0E0F' : '#9A9A9F', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '13px', fontWeight: 700, cursor: emailRecipients.length > 0 && emailBody.trim() ? 'pointer' : 'default' }}>
                    {sendingEmail ? 'Sending...' : `Send to ${emailRecipients.length} parent${emailRecipients.length !== 1 ? 's' : ''}`}
                  </button>
                  <button onClick={() => { setShowEmailComposer(false); setEmailBody(''); setEmailSubject(''); setEmailResults([]) }}
                    style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #2A2A2D', background: 'transparent', color: '#9A9A9F', fontSize: '13px', cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ROSTER SECTION */}
        <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #2A2A2D', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' as const }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
              Group Roster ({localRoster.length})
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={() => setSortBy(sortBy === 'attended' ? 'name' : 'attended')}
                style={{ fontSize: '11px', padding: '5px 10px', borderRadius: '6px', background: 'transparent', color: '#9A9A9F', border: '1px solid #2A2A2D', cursor: 'pointer' }}>
                Sort: {sortBy === 'attended' ? 'Most sessions' : 'A–Z'}
              </button>
              <button onClick={() => { setShowAddPlayer(!showAddPlayer); setAddPlayerError(null) }}
                style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '6px', background: showAddPlayer ? 'rgba(0,255,159,0.1)' : GREEN, color: showAddPlayer ? GREEN : '#0E0E0F', border: showAddPlayer ? '1px solid rgba(0,255,159,0.3)' : 'none', fontWeight: 700, cursor: 'pointer' }}>
                + Add Player
              </button>
            </div>
          </div>

          {/* ADD PLAYER PANEL */}
          {showAddPlayer && (
            <div style={{ padding: '14px 20px', background: '#0E0E0F', borderBottom: '1px solid #2A2A2D' }}>
              <div style={{ background: '#1A1A1C', borderRadius: '10px', padding: '14px', marginBottom: '14px', border: '1px solid #2A2A2D' }}>
                <div style={{ fontSize: '11px', color: '#9A9A9F', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Create new player</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input type="text" placeholder="Player full name" value={newPlayerName} onChange={e => setNewPlayerName(e.target.value)} style={inputStyle} />
                  <input type="email" placeholder="Contact email" value={newPlayerEmail} onChange={e => setNewPlayerEmail(e.target.value)} style={inputStyle} />
                  <button onClick={handleAddNewPlayer} disabled={addingNewPlayer || !newPlayerName.trim() || !newPlayerEmail.trim()}
                    style={{ background: newPlayerName.trim() && newPlayerEmail.trim() ? GREEN : '#2A2A2D', color: newPlayerName.trim() && newPlayerEmail.trim() ? '#0E0E0F' : '#9A9A9F', border: 'none', borderRadius: '8px', padding: '9px', fontSize: '13px', fontWeight: 700, cursor: newPlayerName.trim() && newPlayerEmail.trim() ? 'pointer' : 'default' }}>
                    {addingNewPlayer ? 'Adding...' : 'Add new player'}
                  </button>
                </div>
              </div>

              {availablePlayers.length > 0 && (
                <>
                  <div style={{ fontSize: '11px', color: '#9A9A9F', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Add existing player</div>
                  <input type="text" placeholder="Search players..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, marginBottom: '8px' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' as const }}>
                    {availablePlayers.map(player => (
                      <div key={player.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: '#1A1A1C', borderRadius: '8px', border: '1px solid #2A2A2D' }}>
                        <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(0,255,159,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600, color: GREEN, flexShrink: 0 }}>
                          {getInitials(player.full_name)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', color: '#ffffff', fontWeight: 500 }}>{player.full_name}</div>
                          {player.group_ids.length > 0 && <div style={{ fontSize: '11px', color: '#9A9A9F' }}>In another group</div>}
                        </div>
                        <button onClick={() => handleAddExistingPlayer(player)}
                          style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', border: 'none', background: GREEN, color: '#0E0E0F', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                          Add
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {availablePlayers.length === 0 && search && (
                <p style={{ fontSize: '13px', color: '#9A9A9F' }}>No players found</p>
              )}
              {addPlayerError && (
                <p style={{ fontSize: '13px', color: RED, background: '#1f0f0f', border: '1px solid #3a1a1a', borderRadius: '8px', padding: '10px 14px', marginTop: '8px' }}>
                  {addPlayerError}
                </p>
              )}
            </div>
          )}

          {/* PLAYER LIST */}
          {sortedRoster.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center' as const }}>
              <p style={{ fontSize: '14px', color: '#9A9A9F' }}>No players in this group yet</p>
            </div>
          ) : (
            sortedRoster.map((player, i) => {
              const isConfirmed = confirmedIds.has(player.id)
              const age = player.birth_year ? new Date().getFullYear() - player.birth_year : null
              const meta = [
                age ? `${age} y/o` : null,
                genderLabel(player.player_gender),
                experienceLabel(player.player_experience),
              ].filter(Boolean).join(' · ')
              const lastAttended = player.last_attended ? formatShortDate(player.last_attended) : 'Never'
              const disabled = atCapacity && !isConfirmed
              return (
                <div key={player.id} style={{ padding: '12px 20px', borderBottom: i < sortedRoster.length - 1 ? '1px solid #2A2A2D' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(0,255,159,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, color: GREEN, flexShrink: 0 }}>
                      {player.avatar_initials || getInitials(player.full_name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div onClick={() => router.push(`/dashboard/players/${player.id}`)}
                        style={{ fontSize: '14px', fontWeight: 500, color: '#ffffff', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.2)', marginBottom: '2px' }}>
                        {player.full_name}
                      </div>
                      {meta && <div style={{ fontSize: '12px', color: '#9A9A9F' }}>{meta}</div>}
                      {/* Mobile stats */}
                      <div className="roster-row-stats-mobile" style={{ display: 'none', flexWrap: 'wrap' as const, gap: '10px', marginTop: '4px' }}>
                        <span style={{ fontSize: '11px', color: '#9A9A9F' }}>{player.total_attended} session{player.total_attended === 1 ? '' : 's'}</span>
                        <span style={{ fontSize: '11px', color: '#9A9A9F' }}>Last: {lastAttended}</span>
                      </div>
                    </div>
                    {/* Desktop stats */}
                    <div className="roster-row-stats-desktop" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', flexShrink: 0, minWidth: '100px' }}>
                      <span style={{ fontSize: '12px', color: '#ffffff', fontWeight: 600 }}>{player.total_attended} session{player.total_attended === 1 ? '' : 's'}</span>
                      <span style={{ fontSize: '11px', color: '#9A9A9F' }}>Last: {lastAttended}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                      {isConfirmed ? (
                        <button
                          onClick={() => handleUnconfirmPlayer(player.id)}
                          disabled={confirmingId === player.id}
                          style={{ fontSize: '11px', padding: '5px 10px', borderRadius: '6px', border: '1px solid #2A2A2D', background: 'transparent', color: '#9A9A9F', cursor: confirmingId === player.id ? 'default' : 'pointer', fontWeight: 600 }}>
                          {confirmingId === player.id ? '...' : 'Confirmed ✓'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleConfirmPlayer(player)}
                          disabled={confirmingId === player.id || disabled}
                          title={disabled ? 'Group is full' : undefined}
                          style={{ fontSize: '11px', padding: '5px 10px', borderRadius: '6px', border: 'none', background: disabled ? '#2A2A2D' : GREEN, color: disabled ? '#9A9A9F' : '#0E0E0F', cursor: confirmingId === player.id || disabled ? 'default' : 'pointer', fontWeight: 700 }}>
                          {confirmingId === player.id ? '...' : 'Confirm ✓'}
                        </button>
                      )}
                      <button onClick={() => handleRemovePlayer(player)} disabled={removingId === player.id}
                        style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(224,49,49,0.3)', background: 'transparent', color: RED, cursor: removingId === player.id ? 'default' : 'pointer' }}>
                        {removingId === player.id ? '...' : '× Remove'}
                      </button>
                    </div>
                  </div>
                  {drills.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                      <div style={{ flex: 1, height: '4px', background: '#2A2A2D', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ width: `${getPlayerDrillPct(player.id)}%`, height: '100%', background: pctColor(getPlayerDrillPct(player.id)), borderRadius: '2px', transition: 'width 0.3s' }} />
                      </div>
                      <span style={{ fontSize: '11px', color: pctColor(getPlayerDrillPct(player.id)), fontWeight: 600, minWidth: '28px', textAlign: 'right' as const }}>{getPlayerDrillPct(player.id)}%</span>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* SESSION HISTORY SECTION */}
        <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px' }}>
          <button
            onClick={() => setHistoryOpen(!historyOpen)}
            style={{ width: '100%', padding: '14px 20px', background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', color: '#ffffff', fontWeight: 600 }}>
            <span style={{ fontSize: '12px', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
              Session History ({sessionHistory.length} session{sessionHistory.length === 1 ? '' : 's'})
            </span>
            <span style={{ color: '#9A9A9F', fontSize: '12px' }}>{historyOpen ? '▾' : '▸'}</span>
          </button>
          {historyOpen && sessionHistory.length === 0 && (
            <div style={{ padding: '14px 20px', borderTop: '1px solid #2A2A2D' }}>
              <p style={{ fontSize: '13px', color: '#9A9A9F' }}>No logged sessions yet.</p>
            </div>
          )}
          {historyOpen && sessionHistory.map((s, i) => (
            <div key={s.id} style={{ padding: '12px 20px', borderTop: i === 0 ? '1px solid #2A2A2D' : '1px solid rgba(42,42,45,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', color: '#ffffff', fontWeight: 500 }}>{formatDate(s.session_date)}</span>
              <span style={{ fontSize: '12px', color: '#9A9A9F' }}>
                {s.attended_count} of {s.total_count} attended
              </span>
            </div>
          ))}
        </div>

        {/* ASSIGNED DRILLS SECTION */}
        {(drillWeeks.length > 0 || drills.length > 0) && (
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px' }}>
            <div style={{ padding: '14px 20px', borderBottom: drillWeeks.length > 0 ? '1px solid #2A2A2D' : undefined, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
                  Assigned Drills
                </div>
                {drills.length > 0 && (
                  <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>
                    Avg completion: <span style={{ color: pctColor(avgDrillPct), fontWeight: 600 }}>{avgDrillPct}%</span>
                  </div>
                )}
              </div>
              <button onClick={() => router.push(`/dashboard/drills/new?group=${group.id}`)}
                style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '6px', background: GREEN, color: '#0E0E0F', border: 'none', fontWeight: 700, cursor: 'pointer' }}>
                + Assign
              </button>
            </div>

            {drillWeeks.map((week, wi) => {
              const weekDrills = drills.filter(d => d.drill_week_id === week.id)
              if (weekDrills.length === 0) return null
              return (
                <div key={week.id} style={{ borderBottom: wi < drillWeeks.length - 1 ? '1px solid #2A2A2D' : 'none' }}>
                  <div style={{ padding: '10px 20px 6px', fontSize: '11px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
                    {week.title || 'Drill week'}
                    {week.week_start && <span style={{ fontWeight: 400, marginLeft: '6px' }}>· {formatDate(week.week_start)}</span>}
                  </div>
                  {weekDrills.map((drill, di) => {
                    const { done, total } = getDrillCompletion(drill.id)
                    const pct = total > 0 ? Math.round(done / total * 100) : 0
                    return (
                      <div key={drill.id} style={{ padding: '8px 20px', borderTop: di > 0 ? '1px solid rgba(42,42,45,0.5)' : undefined }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', color: '#ffffff', fontWeight: 500, marginBottom: '4px' }}>{drill.title}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ flex: 1, height: '4px', background: '#2A2A2D', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{ width: `${pct}%`, height: '100%', background: pctColor(pct), borderRadius: '2px' }} />
                              </div>
                              <span style={{ fontSize: '11px', color: pctColor(pct), fontWeight: 600, minWidth: '50px', textAlign: 'right' as const }}>{done}/{total} done</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}

        {/* Trainer profile footer hint (use prop to avoid unused warning) */}
        <div style={{ display: 'none' }}>{trainerProfile.full_name}</div>
      </div>

      {/* MOBILE BOTTOM NAV */}
      <div className="group-detail-bottom-nav" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: '72px', background: '#0E0E0F', borderTop: '1px solid #2A2A2D', zIndex: 200, alignItems: 'stretch' }}>
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
