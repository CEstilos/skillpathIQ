'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import NavBar from '@/components/NavBar'

interface Group {
  id: string; name: string; sport: string; session_day: string; session_time: string; location?: string | null; trainer_id: string
}
interface Player {
  id: string; full_name: string; group_id: string | null; parent_email: string | null; avatar_initials?: string | null
}
interface Session {
  id: string; title: string; session_date: string; session_time: string; status: string; group_id: string | null; rescheduled_date?: string | null
}
interface DrillWeek { id: string; title: string; week_start: string; group_id: string | null }
interface Drill { id: string; title: string; description: string; drill_week_id: string; sort_order: number }
interface Completion { player_id: string; drill_id: string }

interface Props {
  group: Group
  players: Player[]
  allPlayers: Player[]
  sessions: Session[]
  drillWeeks: DrillWeek[]
  drills: Drill[]
  completions: Completion[]
  trainerName?: string
  trainerEmail?: string
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
  const [h, mi] = t.split(':')
  const hour = parseInt(h)
  return `${hour % 12 || 12}:${mi}${hour >= 12 ? 'pm' : 'am'}`
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??'
}

export default function GroupDetailClient({ group: initialGroup, players: initialPlayers, allPlayers, sessions, drillWeeks, drills, completions, trainerName, trainerEmail }: Props) {
  const router = useRouter()
  const supabase = createClient()

  // Group state
  const [group, setGroup] = useState(initialGroup)
  const [editMode, setEditMode] = useState(false)
  const [editName, setEditName] = useState(initialGroup.name)
  const [editLocation, setEditLocation] = useState(initialGroup.location || '')
  const [editSessionDay, setEditSessionDay] = useState(initialGroup.session_day || '')
  const [editSessionTime, setEditSessionTime] = useState(initialGroup.session_time || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Player state
  const [localPlayers, setLocalPlayers] = useState(initialPlayers)
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [search, setSearch] = useState('')
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [newPlayerEmail, setNewPlayerEmail] = useState('')
  const [addingNewPlayer, setAddingNewPlayer] = useState(false)

  // Email state
  const [showEmailComposer, setShowEmailComposer] = useState(false)
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [emailRecipients, setEmailRecipients] = useState<string[]>(
    initialPlayers.filter(p => p.parent_email).map(p => p.id)
  )
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailResults, setEmailResults] = useState<{ id: string; name: string; success: boolean }[]>([])

  // Computed
  const today = new Date().toISOString().split('T')[0]
  const groupPlayerIds = localPlayers.map(p => p.id)
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

  const avgDrillPct = groupPlayerIds.length === 0 || drills.length === 0 ? 0 :
    Math.round(groupPlayerIds.reduce((sum, id) => sum + getPlayerDrillPct(id), 0) / groupPlayerIds.length)

  function getDrillCompletion(drillId: string) {
    const done = completions.filter(c => c.drill_id === drillId && groupPlayerIds.includes(c.player_id)).length
    return { done, total: groupPlayerIds.length }
  }

  const availablePlayers = allPlayers.filter(p =>
    p.group_id !== group.id &&
    (search === '' || p.full_name.toLowerCase().includes(search.toLowerCase()))
  )

  // Handlers
  async function handleSave() {
    setSaving(true); setSaveError(null)
    const { error } = await supabase.from('groups').update({
      name: editName.trim() || group.name,
      location: editLocation.trim() || null,
      session_day: editSessionDay || null,
      session_time: editSessionTime.trim() || null,
    }).eq('id', group.id)
    if (error) { setSaveError(error.message); setSaving(false); return }
    setGroup(g => ({ ...g, name: editName.trim() || g.name, location: editLocation.trim() || null, session_day: editSessionDay, session_time: editSessionTime }))
    setSaved(true); setSaving(false); setEditMode(false)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleCancelEdit() {
    setEditName(group.name)
    setEditLocation(group.location || '')
    setEditSessionDay(group.session_day || '')
    setEditSessionTime(group.session_time || '')
    setEditMode(false); setSaveError(null)
  }

  async function handleRemovePlayer(player: Player) {
    setRemovingId(player.id)
    const { error } = await supabase.from('players').update({ group_id: null }).eq('id', player.id)
    if (!error) setLocalPlayers(prev => prev.filter(p => p.id !== player.id))
    setRemovingId(null)
  }

  async function handleAddExistingPlayer(player: Player) {
    const { error } = await supabase.from('players').update({ group_id: group.id }).eq('id', player.id)
    if (!error) {
      setLocalPlayers(prev => [...prev, { ...player, group_id: group.id }].sort((a, b) => a.full_name.localeCompare(b.full_name)))
      setSearch('')
    }
  }

  async function handleAddNewPlayer() {
    if (!newPlayerName.trim() || !newPlayerEmail.trim()) return
    setAddingNewPlayer(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data, error } = await supabase.from('players').insert({
      trainer_id: user.id,
      group_id: group.id,
      full_name: newPlayerName.trim(),
      parent_email: newPlayerEmail.trim(),
      avatar_initials: newPlayerName.trim().split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2),
    }).select().single()
    if (!error && data) {
      setLocalPlayers(prev => [...prev, data].sort((a, b) => a.full_name.localeCompare(b.full_name)))
      setNewPlayerName(''); setNewPlayerEmail(''); setShowAddPlayer(false)
    }
    setAddingNewPlayer(false)
  }

  async function handleSendEmail() {
    setSendingEmail(true); setEmailResults([])
    const results: { id: string; name: string; success: boolean }[] = []
    const recipients = localPlayers.filter(p => emailRecipients.includes(p.id) && p.parent_email)
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

  const inputStyle = { background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '9px 12px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }
  const labelStyle = { fontSize: '12px', color: '#9A9A9F', fontWeight: 600 as const, textTransform: 'uppercase' as const, letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }

  return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', fontFamily: 'sans-serif', overflowX: 'hidden' }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #0E0E0F; overflow-x: hidden; }
        .group-detail-bottom-nav { display: none; }
        @media (max-width: 640px) {
          .group-detail-bottom-nav { display: flex !important; }
        }
        @media (min-width: 641px) {
          .group-detail-bottom-nav { display: none !important; }
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

        {/* STATS ROW */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' as const }}>
          {[
            { label: 'Players', value: String(localPlayers.length), color: '#ffffff' },
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
            {localPlayers.filter(p => p.parent_email).length === 0 ? (
              <p style={{ fontSize: '13px', color: '#9A9A9F' }}>No contact emails on file. Add emails to players first.</p>
            ) : (
              <>
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ fontSize: '11px', color: '#9A9A9F', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Recipients</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '6px' }}>
                    {localPlayers.filter(p => p.parent_email).map(player => (
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

        {/* NEXT SESSION CARD */}
        {nextSession && (
          <div style={{ background: '#1A1A1C', border: '1px solid rgba(0,255,159,0.2)', borderRadius: '12px', padding: '16px 20px', marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: GREEN, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: '8px' }}>Next Session</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', marginBottom: '4px' }}>
              {nextSession.title || 'Untitled session'}
            </div>
            <div style={{ fontSize: '13px', color: '#9A9A9F', marginBottom: '14px' }}>
              {formatDate(nextSession.rescheduled_date || nextSession.session_date)}
              {nextSession.session_time && ` · ${formatTime(nextSession.session_time)}`}
              {group.location && ` · ${group.location}`}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => router.push(`/dashboard/sessions/${nextSession.id}`)}
                style={{ flex: 1, background: 'transparent', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '8px', fontSize: '13px', color: '#9A9A9F', fontWeight: 600, cursor: 'pointer' }}>
                Modify
              </button>
              <button onClick={() => router.push(`/dashboard/sessions/${nextSession.id}/log`)}
                style={{ flex: 1, background: GREEN, border: 'none', borderRadius: '8px', padding: '8px', fontSize: '13px', color: '#0E0E0F', fontWeight: 700, cursor: 'pointer' }}>
                Log Session
              </button>
            </div>
          </div>
        )}

        {/* PLAYERS SECTION */}
        <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #2A2A2D', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
              Players ({localPlayers.length})
            </div>
            <button onClick={() => setShowAddPlayer(!showAddPlayer)}
              style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '6px', background: showAddPlayer ? 'rgba(0,255,159,0.1)' : GREEN, color: showAddPlayer ? GREEN : '#0E0E0F', border: showAddPlayer ? '1px solid rgba(0,255,159,0.3)' : 'none', fontWeight: 700, cursor: 'pointer' }}>
              + Add player
            </button>
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
                          {player.group_id && <div style={{ fontSize: '11px', color: '#9A9A9F' }}>In another group</div>}
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
            </div>
          )}

          {/* PLAYER LIST */}
          {localPlayers.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center' as const }}>
              <p style={{ fontSize: '14px', color: '#9A9A9F' }}>No players in this group yet</p>
            </div>
          ) : (
            localPlayers.map((player, i) => {
              const pct = getPlayerDrillPct(player.id)
              return (
                <div key={player.id} style={{ padding: '12px 20px', borderBottom: i < localPlayers.length - 1 ? '1px solid #2A2A2D' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(0,255,159,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, color: GREEN, flexShrink: 0 }}>
                      {player.avatar_initials || getInitials(player.full_name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div onClick={() => router.push(`/dashboard/players/${player.id}`)}
                        style={{ fontSize: '14px', fontWeight: 500, color: '#ffffff', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.2)', marginBottom: drills.length > 0 ? '6px' : 0 }}>
                        {player.full_name}
                      </div>
                      {drills.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ flex: 1, height: '4px', background: '#2A2A2D', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: pctColor(pct), borderRadius: '2px', transition: 'width 0.3s' }} />
                          </div>
                          <span style={{ fontSize: '11px', color: pctColor(pct), fontWeight: 600, minWidth: '28px', textAlign: 'right' as const }}>{pct}%</span>
                        </div>
                      )}
                    </div>
                    <button onClick={() => handleRemovePlayer(player)} disabled={removingId === player.id}
                      style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '6px', border: '1px solid rgba(224,49,49,0.3)', background: 'transparent', color: RED, cursor: 'pointer', flexShrink: 0 }}>
                      {removingId === player.id ? '...' : '−'}
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* ASSIGNED DRILLS SECTION */}
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

          {drillWeeks.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center' as const }}>
              <p style={{ fontSize: '14px', color: '#9A9A9F' }}>No drills assigned yet</p>
            </div>
          ) : (
            drillWeeks.map((week, wi) => {
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
            })
          )}
        </div>
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
