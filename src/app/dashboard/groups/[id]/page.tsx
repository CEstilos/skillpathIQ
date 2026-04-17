'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import NavBar from '@/components/NavBar'

interface Group {
  id: string
  name: string
  sport: string
  session_day: string
  session_time: string
  trainer_id: string
}

interface Player {
  id: string
  full_name: string
  parent_email: string
  group_id: string | null
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const SPORTS = ['basketball', 'soccer', 'football', 'baseball', 'softball', 'golf', 'tennis', 'volleyball', 'other']

export default function GroupEditPage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useParams()
  const groupId = params.id as string

  const [group, setGroup] = useState<Group | null>(null)
  const [groupPlayers, setGroupPlayers] = useState<Player[]>([])
  const [allPlayers, setAllPlayers] = useState<Player[]>([])
  const [profile, setProfile] = useState<{ full_name: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [newPlayerEmail, setNewPlayerEmail] = useState('')
  const [addingPlayer, setAddingPlayer] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showEmailComposer, setShowEmailComposer] = useState(false)
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [emailRecipients, setEmailRecipients] = useState<string[]>([])
  const [sendingGroupEmail, setSendingGroupEmail] = useState(false)
  const [emailResults, setEmailResults] = useState<{ playerId: string; playerName: string; success: boolean }[]>([])
  const [name, setName] = useState('')
  const [sport, setSport] = useState('')
  const [sessionDay, setSessionDay] = useState('')
  const [sessionTime, setSessionTime] = useState('')

  useEffect(() => { loadData() }, [groupId])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const { data: profileData } = await supabase
      .from('profiles').select('full_name').eq('id', user.id).single()
    setProfile(profileData)

    const { data: groupData } = await supabase
      .from('groups').select('*').eq('id', groupId).single()
    if (!groupData) { router.push('/dashboard'); return }

    setGroup(groupData)
    setName(groupData.name)
    setSport(groupData.sport || 'basketball')
    setSessionDay(groupData.session_day || '')
    setSessionTime(groupData.session_time || '')

    const { data: playersInGroup } = await supabase
      .from('players').select('*').eq('group_id', groupId)
      .order('full_name', { ascending: true })
    setGroupPlayers(playersInGroup || [])
    setEmailRecipients(playersInGroup?.filter(p => p.parent_email).map(p => p.id) || [])

    const { data: allPlayersData } = await supabase
      .from('players').select('*').eq('trainer_id', user.id)
      .order('full_name', { ascending: true })
    setAllPlayers(allPlayersData || [])

    setLoading(false)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const { error } = await supabase
      .from('groups')
      .update({ name, sport, session_day: sessionDay, session_time: sessionTime })
      .eq('id', groupId)
    if (error) { setError(error.message); setSaving(false); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setSaving(false)
  }

  async function handleAddExistingPlayer(player: Player) {
    const { error } = await supabase
      .from('players').update({ group_id: groupId }).eq('id', player.id)
    if (!error) {
      setGroupPlayers(prev => [...prev, { ...player, group_id: groupId }].sort((a, b) => a.full_name.localeCompare(b.full_name)))
      setAllPlayers(prev => prev.map(p => p.id === player.id ? { ...p, group_id: groupId } : p))
    }
  }

  async function handleAddNewPlayer() {
    if (!newPlayerName.trim()) return
    setAddingPlayer(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('players')
      .insert({
        trainer_id: user.id,
        group_id: groupId,
        full_name: newPlayerName.trim(),
        parent_email: newPlayerEmail.trim() || null,
        avatar_initials: newPlayerName.trim().split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2),
      })
      .select()
      .single()

    if (!error && data) {
      setGroupPlayers(prev => [...prev, data].sort((a, b) => a.full_name.localeCompare(b.full_name)))
      setAllPlayers(prev => [...prev, data])
      setNewPlayerName('')
      setNewPlayerEmail('')
      setShowAddPlayer(false)
    }
    setAddingPlayer(false)
  }

  async function handleRemovePlayer(player: Player) {
    setRemovingId(player.id)
    const { error } = await supabase
      .from('players').update({ group_id: null }).eq('id', player.id)
    if (!error) {
      setGroupPlayers(prev => prev.filter(p => p.id !== player.id))
      setAllPlayers(prev => prev.map(p => p.id === player.id ? { ...p, group_id: null } : p))
    }
    setRemovingId(null)
  }

  async function handleSendGroupEmail() {
    setSendingGroupEmail(true)
    setEmailResults([])
    const results: { playerId: string; playerName: string; success: boolean }[] = []
    const recipientPlayers = groupPlayers.filter(p => emailRecipients.includes(p.id) && p.parent_email)

    for (const player of recipientPlayers) {
      try {
        const playerUrl = `${window.location.origin}/player?id=${player.id}`
        const response = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: player.parent_email,
            subject: emailSubject || `Update from your trainer`,
            body: emailBody,
            playerName: player.full_name.split(' ')[0],
            playerUrl,
          }),
        })
        const data = await response.json()
        results.push({ playerId: player.id, playerName: player.full_name, success: !data.error })
      } catch {
        results.push({ playerId: player.id, playerName: player.full_name, success: false })
      }
    }

    setEmailResults(results)
    setSendingGroupEmail(false)
    if (results.every(r => r.success)) {
      setEmailBody('')
      setEmailSubject('')
    }
  }

  function getInitials(name: string) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??'
  }

  const availablePlayers = allPlayers.filter(p =>
    p.group_id !== groupId &&
    (search === '' || p.full_name.toLowerCase().includes(search.toLowerCase()))
  )

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#9A9A9F' }}>Loading...</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', fontFamily: 'sans-serif', overflowX: 'hidden', maxWidth: '100vw', width: '100%' }}>
      <style>{`* { box-sizing: border-box; margin: 0; padding: 0; } html, body { background: #0E0E0F; overflow-x: hidden; }`}</style>

      <NavBar trainerName={profile?.full_name} />

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '20px 16px', width: '100%' }}>

        {/* HEADER */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
          <div>
            <h1 style={{ fontFamily: '"Exo 2", sans-serif', fontSize: '26px', fontWeight: 700, color: '#ffffff', marginBottom: '4px' }}>{name || group?.name}</h1>
            <p style={{ fontSize: '13px', color: '#9A9A9F' }}>{groupPlayers.length} player{groupPlayers.length !== 1 ? 's' : ''} · {sport}</p>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            style={{ fontSize: '13px', color: '#9A9A9F', background: 'none', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '7px 14px', cursor: 'pointer' }}>
            ← Back
          </button>
        </div>

        {/* SUCCESS */}
        {saved && (
          <div style={{ background: 'rgba(0,255,159,0.1)', border: '1px solid rgba(0,255,159,0.3)', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', fontSize: '14px', color: '#00FF9F', fontWeight: 500 }}>
            ✓ Group saved
          </div>
        )}

        {/* TWO COLUMN LAYOUT */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px', alignItems: 'start' }}>

          {/* LEFT — GROUP DETAILS */}
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', marginBottom: '16px' }}>GROUP DETAILS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', color: '#9A9A9F', fontWeight: 500 }}>Group name</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', color: '#9A9A9F', fontWeight: 500 }}>Sport</label>
                <select
                  value={sport}
                  onChange={e => setSport(e.target.value)}
                  style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }}>
                  {SPORTS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', color: '#9A9A9F', fontWeight: 500 }}>Session day</label>
                <select
                  value={sessionDay}
                  onChange={e => setSessionDay(e.target.value)}
                  style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }}>
                  <option value="">No day set</option>
                  {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', color: '#9A9A9F', fontWeight: 500 }}>Session time</label>
                <input
                  type="text"
                  value={sessionTime}
                  onChange={e => setSessionTime(e.target.value)}
                  placeholder="e.g. 4:00pm"
                  style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }}
                />
              </div>
            </div>

            {error && <p style={{ fontSize: '13px', color: '#E03131', marginTop: '12px' }}>{error}</p>}

            <button
              onClick={handleSave}
              disabled={saving}
              style={{ marginTop: '16px', background: '#00FF9F', color: '#0E0E0F', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', width: '100%' }}>
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>

          {/* RIGHT — PLAYERS */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>PLAYER LIST</div>
              <button
                onClick={() => setShowEmailComposer(!showEmailComposer)}
                style={{ background: '#00FF9F', color: '#0E0E0F', border: 'none', borderRadius: '8px', padding: '7px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                ✉ Create group email
              </button>
            </div>

            {/* INLINE EMAIL COMPOSER */}
            {showEmailComposer && (
              <div style={{ background: '#1A1A1C', border: '1px solid rgba(0,255,159,0.3)', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
                {groupPlayers.filter(p => p.parent_email).length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#9A9A9F' }}>No parent emails on file. Add parent emails to players first.</p>
                ) : (
                  <>
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '11px', color: '#9A9A9F', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Recipients</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '6px' }}>
                        {groupPlayers.filter(p => p.parent_email).map(player => (
                          <div key={player.id}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: emailRecipients.includes(player.id) ? 'rgba(0,255,159,0.1)' : '#0E0E0F', border: `1px solid ${emailRecipients.includes(player.id) ? 'rgba(0,255,159,0.3)' : '#2A2A2D'}`, borderRadius: '99px', padding: '4px 10px', cursor: 'pointer' }}
                            onClick={() => setEmailRecipients(prev => prev.includes(player.id) ? prev.filter(id => id !== player.id) : [...prev, player.id])}>
                            <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: emailRecipients.includes(player.id) ? '#00FF9F' : '#2A2A2D', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {emailRecipients.includes(player.id) && (
                                <svg width="7" height="7" viewBox="0 0 8 8" fill="none">
                                  <polyline points="1,4 3,6 7,2" stroke="#0E0E0F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </div>
                            <span style={{ fontSize: '12px', color: emailRecipients.includes(player.id) ? '#00FF9F' : '#9A9A9F', fontWeight: 500 }}>{player.full_name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                      <input
                        type="text"
                        value={emailSubject}
                        onChange={e => setEmailSubject(e.target.value)}
                        placeholder={`Subject: Update from ${name || group?.name || 'your trainer'}`}
                        style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: '#ffffff', outline: 'none', width: '100%' }}
                      />
                    </div>
                    <div style={{ marginBottom: '12px' }}>
                      <textarea
                        value={emailBody}
                        onChange={e => setEmailBody(e.target.value)}
                        placeholder="Write your update, upcoming schedule, reminders..."
                        rows={4}
                        style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: '#ffffff', outline: 'none', width: '100%', resize: 'vertical' as const, fontFamily: 'sans-serif' }}
                      />
                    </div>
                    {emailResults.length > 0 && (
                      <div style={{ marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {emailResults.map(r => (
                          <div key={r.playerId} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                            <span style={{ color: r.success ? '#00FF9F' : '#E03131' }}>{r.success ? '✓' : '✕'}</span>
                            <span style={{ color: '#9A9A9F' }}>{r.playerName}</span>
                            <span style={{ color: r.success ? '#00FF9F' : '#E03131' }}>{r.success ? 'Sent' : 'Failed'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={handleSendGroupEmail}
                        disabled={sendingGroupEmail || emailRecipients.length === 0 || !emailBody.trim()}
                        style={{ flex: 1, background: emailRecipients.length > 0 && emailBody.trim() ? '#00FF9F' : '#2A2A2D', color: emailRecipients.length > 0 && emailBody.trim() ? '#0E0E0F' : '#9A9A9F', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '13px', fontWeight: 700, cursor: emailRecipients.length > 0 && emailBody.trim() ? 'pointer' : 'default' }}>
                        {sendingGroupEmail ? 'Sending...' : `Send to ${emailRecipients.length} parent${emailRecipients.length !== 1 ? 's' : ''}`}
                      </button>
                      <button
                        onClick={() => { setEmailBody(''); setEmailSubject(''); setEmailResults([]); setShowEmailComposer(false) }}
                        style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #2A2A2D', background: 'transparent', color: '#9A9A9F', fontSize: '13px', cursor: 'pointer' }}>
                        Cancel
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #2A2A2D' }}>
                <button
                  onClick={() => setShowAddPlayer(!showAddPlayer)}
                  style={{ width: '100%', background: '#00FF9F', color: '#0E0E0F', border: 'none', borderRadius: '8px', padding: '9px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                  + Add player
                </button>
              </div>

            {/* ADD PLAYER PANEL */}
            {showAddPlayer && (
              <div style={{ padding: '16px 20px', background: '#0E0E0F', borderBottom: '1px solid #2A2A2D' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', marginBottom: '12px' }}>Add to this group</div>

                <div style={{ background: '#1A1A1C', borderRadius: '10px', padding: '14px', marginBottom: '14px', border: '1px solid #2A2A2D' }}>
                  <div style={{ fontSize: '12px', color: '#9A9A9F', marginBottom: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Create new player</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="Player full name"
                      value={newPlayerName}
                      onChange={e => setNewPlayerName(e.target.value)}
                      style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: '#ffffff', outline: 'none', width: '100%' }}
                    />
                    <input
                      type="email"
                      placeholder="Parent email (optional)"
                      value={newPlayerEmail}
                      onChange={e => setNewPlayerEmail(e.target.value)}
                      style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: '#ffffff', outline: 'none', width: '100%' }}
                    />
                    <button
                      onClick={handleAddNewPlayer}
                      disabled={addingPlayer || !newPlayerName.trim()}
                      style={{ background: newPlayerName.trim() ? '#00FF9F' : '#2A2A2D', color: newPlayerName.trim() ? '#0E0E0F' : '#9A9A9F', border: 'none', borderRadius: '8px', padding: '9px', fontSize: '13px', fontWeight: 700, cursor: newPlayerName.trim() ? 'pointer' : 'default' }}>
                      {addingPlayer ? 'Adding...' : 'Add new player'}
                    </button>
                  </div>
                </div>

                {availablePlayers.length > 0 && (
                  <div>
                    <div style={{ fontSize: '12px', color: '#9A9A9F', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Add existing player</div>
                    <input
                      type="text"
                      placeholder="Search players..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: '#ffffff', outline: 'none', width: '100%', marginBottom: '8px' }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' as const }}>
                      {availablePlayers.map(player => (
                        <div key={player.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: '#1A1A1C', borderRadius: '8px', border: '1px solid #2A2A2D' }}>
                          <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(0,255,159,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600, color: '#00FF9F', flexShrink: 0 }}>
                            {getInitials(player.full_name)}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', color: '#ffffff', fontWeight: 500 }}>{player.full_name}</div>
                            {player.group_id && <div style={{ fontSize: '11px', color: '#9A9A9F' }}>In another group</div>}
                          </div>
                          <button
                            onClick={() => handleAddExistingPlayer(player)}
                            style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', border: 'none', background: '#00FF9F', color: '#0E0E0F', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                            Add
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* PLAYER LIST */}
            {groupPlayers.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center' as const }}>
                <p style={{ fontSize: '14px', color: '#9A9A9F' }}>No players in this group yet</p>
              </div>
            ) : (
              groupPlayers.map((player, i) => (
                <div key={player.id} style={{ padding: '12px 20px', borderBottom: i < groupPlayers.length - 1 ? '1px solid #2A2A2D' : 'none', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'rgba(0,255,159,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, color: '#00FF9F', flexShrink: 0 }}>
                    {getInitials(player.full_name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      onClick={() => router.push(`/dashboard/players/${player.id}`)}
                      style={{ fontSize: '14px', fontWeight: 500, color: '#ffffff', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.2)' }}>
                      {player.full_name}
                    </div>
                    {player.parent_email && <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>{player.parent_email}</div>}
                  </div>
                  <button
                    onClick={() => handleRemovePlayer(player)}
                    disabled={removingId === player.id}
                    style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '6px', border: '1px solid rgba(224,49,49,0.3)', background: 'transparent', color: '#E03131', cursor: 'pointer', flexShrink: 0 }}>
                    {removingId === player.id ? '...' : 'Remove'}
                  </button>
                </div>
              ))
            )}
          </div>

        </div>

       
        </div>

      </div>
    </div>
  )
}
