'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface Player { id: string; full_name: string; group_id: string | null; custom_rate: number | null }
interface Group { id: string; name: string }
interface Profile { individual_rate: number | null; group_rate: number | null }

function NewSessionForm() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedPlayer = searchParams.get('player')

  const [players, setPlayers] = useState<Player[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>(preselectedPlayer ? [preselectedPlayer] : [])
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [sessionType, setSessionType] = useState<'individual' | 'group'>('individual')
  const [filterGroup, setFilterGroup] = useState<string>('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: playersData } = await supabase.from('players').select('*').eq('trainer_id', user.id).order('full_name')
      const { data: groupsData } = await supabase.from('groups').select('*').eq('trainer_id', user.id)
      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setPlayers(playersData || [])
      setGroups(groupsData || [])
      setProfile(profileData)
    }
    loadData()
  }, [])

  function togglePlayer(id: string) {
    setSelectedPlayers(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  function selectGroup(groupId: string) {
    const groupPlayerIds = players.filter(p => p.group_id === groupId).map(p => p.id)
    setSelectedPlayers(groupPlayerIds)
    setSessionType('group')
  }

  function getInitials(name: string) {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??'
  }

  function getEstimatedRevenue() {
    if (!profile) return null
    if (sessionType === 'group') return profile.group_rate || 0
    const total = selectedPlayers.reduce((sum, playerId) => {
      const player = players.find(p => p.id === playerId)
      const rate = player?.custom_rate || profile.individual_rate || 0
      return sum + rate
    }, 0)
    return total
  }

  const filteredPlayers = players.filter(p => {
    if (filterGroup === 'all') return true
    if (filterGroup === 'individual') return !p.group_id
    return p.group_id === filterGroup
  })

  const estimatedRevenue = getEstimatedRevenue()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedPlayers.length) { setError('Select at least one player'); return }
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const sessionRows = selectedPlayers.map(playerId => ({
      trainer_id: user.id,
      player_id: playerId,
      session_date: sessionDate,
      notes: notes || null,
      session_type: sessionType,
      rate_override: null,
    }))

    const { error } = await supabase.from('sessions').insert(sessionRows)
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/dashboard')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', fontFamily: 'sans-serif' }}>
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', height: '60px', borderBottom: '1px solid #2A2A2D' }}>
      <img
  src="/logo.png"
  alt="SkillPathIQ"
  onClick={() => router.push('/dashboard')}
  style={{ height: '65px', width: 'auto', cursor: 'pointer', flexShrink: 0 }}
/>
        <Link href="/dashboard" style={{ fontSize: '13px', color: '#9A9A9F', textDecoration: 'none' }}>← Back</Link>
      </nav>

      <div style={{ maxWidth: '560px', margin: '48px auto', padding: '0 16px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#ffffff', fontFamily: '"Exo 2", sans-serif', marginBottom: '8px' }}>Log a session</h1>
        <p style={{ fontSize: '14px', color: '#9A9A9F', marginBottom: '32px' }}>Record who you trained and when</p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* DATE */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', color: '#9A9A9F', fontWeight: 500 }}>Session date</label>
            <input style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }} type="date" value={sessionDate} onChange={e => setSessionDate(e.target.value)} required />
          </div>

          {/* SESSION TYPE */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', color: '#9A9A9F', fontWeight: 500 }}>Session type</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              {(['individual', 'group'] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSessionType(type)}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '10px',
                    border: `1px solid ${sessionType === type ? '#00FF9F' : '#2A2A2D'}`,
                    background: sessionType === type ? 'rgba(0,255,159,0.08)' : '#1A1A1C',
                    color: sessionType === type ? '#00FF9F' : '#9A9A9F',
                    fontSize: '14px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
                    textTransform: 'capitalize',
                  }}>
                  {type}
                  {profile && (
                    <div style={{ fontSize: '11px', marginTop: '4px', color: sessionType === type ? '#00FF9F' : '#9A9A9F', opacity: 0.8 }}>
                      ${type === 'individual' ? (profile.individual_rate || 0) : (profile.group_rate || 0)}/session
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* PLAYER SELECTION */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '13px', color: '#9A9A9F', fontWeight: 500 }}>Who did you train? <span style={{ color: '#00FF9F' }}>*</span></label>
              <span style={{ fontSize: '12px', color: '#9A9A9F' }}>{selectedPlayers.length} selected</span>
            </div>

            {groups.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', color: '#9A9A9F', alignSelf: 'center' }}>Quick select:</span>
                {groups.map(g => (
                  <button key={g.id} type="button" onClick={() => selectGroup(g.id)} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', border: '1px solid #2A2A2D', background: 'transparent', color: '#00FF9F', cursor: 'pointer' }}>
                    {g.name}
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
              {[{ key: 'all', label: 'All' }, { key: 'individual', label: 'Individual' }, ...groups.map(g => ({ key: g.id, label: g.name }))].map(f => (
                <button key={f.key} type="button" onClick={() => setFilterGroup(f.key)} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', border: '1px solid #2A2A2D', background: filterGroup === f.key ? '#2A2A2D' : 'transparent', color: filterGroup === f.key ? '#ffffff' : '#9A9A9F', cursor: 'pointer' }}>
                  {f.label}
                </button>
              ))}
            </div>

            <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', overflow: 'hidden' }}>
              {filteredPlayers.map((player, i) => {
                const isSelected = selectedPlayers.includes(player.id)
                const isLast = i === filteredPlayers.length - 1
                return (
                  <div key={player.id} onClick={() => togglePlayer(player.id)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: isLast ? 'none' : '1px solid #2A2A2D', cursor: 'pointer', background: isSelected ? 'rgba(0,255,159,0.06)' : 'transparent', transition: 'background 0.1s' }}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '4px', border: isSelected ? 'none' : '1.5px solid #9A9A9F', background: isSelected ? '#00FF9F' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                      {isSelected && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <polyline points="1.5,5 4,7.5 8.5,2.5" stroke="#0E0E0F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(0,255,159,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600, color: '#00FF9F', flexShrink: 0 }}>
                      {getInitials(player.full_name)}
                    </div>
                    <div style={{ flex: 1, fontSize: '14px', fontWeight: 500, color: isSelected ? '#ffffff' : '#9A9A9F' }}>{player.full_name}</div>
                    {player.custom_rate && sessionType === 'individual' && (
                      <div style={{ fontSize: '12px', color: '#00FF9F' }}>${player.custom_rate}</div>
                    )}
                  </div>
                )
              })}
              {filteredPlayers.length === 0 && (
                <div style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: '#9A9A9F' }}>No players found</div>
              )}
            </div>
          </div>

          {/* REVENUE ESTIMATE */}
          {estimatedRevenue !== null && selectedPlayers.length > 0 && (
            <div style={{ background: 'rgba(0,255,159,0.06)', border: '1px solid rgba(0,255,159,0.2)', borderRadius: '10px', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#9A9A9F', marginBottom: '2px' }}>Estimated session revenue</div>
                <div style={{ fontSize: '22px', fontFamily: 'monospace', fontWeight: 700, color: '#00FF9F' }}>${estimatedRevenue.toFixed(2)}</div>
              </div>
              <div style={{ fontSize: '12px', color: '#9A9A9F', textAlign: 'right' }}>
                {sessionType === 'group' ? 'Group rate (flat)' : `${selectedPlayers.length} player${selectedPlayers.length !== 1 ? 's' : ''} × individual rate`}
              </div>
            </div>
          )}

          {/* NOTES */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', color: '#9A9A9F', fontWeight: 500 }}>Session notes <span style={{ color: '#9A9A9F', fontWeight: 400 }}>(optional)</span></label>
            <textarea style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%', minHeight: '80px', resize: 'vertical', fontFamily: 'sans-serif' }} placeholder="e.g. Ball handling, crossovers, free throws..." value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          {error && <p style={{ fontSize: '13px', color: '#E03131', background: '#1f0f0f', border: '1px solid #3a1a1a', borderRadius: '8px', padding: '10px 14px' }}>{error}</p>}

          <button type="submit" disabled={loading} style={{ background: '#00FF9F', color: '#0E0E0F', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '15px', fontWeight: 700, cursor: 'pointer' }}>
            {loading ? 'Logging session...' : `Log session${selectedPlayers.length > 1 ? ` for ${selectedPlayers.length} players` : ''}`}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function NewSessionPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0E0E0F' }} />}>
      <NewSessionForm />
    </Suspense>
  )
}
