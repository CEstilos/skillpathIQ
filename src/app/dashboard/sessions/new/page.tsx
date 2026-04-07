'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface Player { id: string; full_name: string; group_id: string | null }
interface Group { id: string; name: string }

function NewSessionForm() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedPlayer = searchParams.get('player')

  const [players, setPlayers] = useState<Player[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>(preselectedPlayer ? [preselectedPlayer] : [])
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [filterGroup, setFilterGroup] = useState<string>('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: playersData } = await supabase.from('players').select('*').eq('trainer_id', user.id).order('full_name')
      const { data: groupsData } = await supabase.from('groups').select('*').eq('trainer_id', user.id)
      setPlayers(playersData || [])
      setGroups(groupsData || [])
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
  }

  function getInitials(name: string) {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??'
  }

  const filteredPlayers = players.filter(p => {
    if (filterGroup === 'all') return true
    if (filterGroup === 'individual') return !p.group_id
    return p.group_id === filterGroup
  })

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
    }))

    const { error } = await supabase.from('sessions').insert(sessionRows)
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/dashboard')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', fontFamily: 'sans-serif' }}>
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', height: '60px', borderBottom: '1px solid #2A2A2D' }}>
        <div style={{ fontFamily: 'monospace', fontSize: '20px', fontWeight: 700, color: '#ffffff', letterSpacing: '2px' }}>
          SkillPath<span style={{ color: '#F4581A' }}>IQ</span>
        </div>
        <Link href="/dashboard" style={{ fontSize: '13px', color: '#6B6B72', textDecoration: 'none' }}>← Back</Link>
      </nav>

      <div style={{ maxWidth: '560px', margin: '48px auto', padding: '0 16px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>Log a session</h1>
        <p style={{ fontSize: '14px', color: '#6B6B72', marginBottom: '32px' }}>Record who you trained and when</p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* DATE */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', color: '#a0a0a8', fontWeight: 500 }}>Session date</label>
            <input style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }} type="date" value={sessionDate} onChange={e => setSessionDate(e.target.value)} required />
          </div>

          {/* PLAYER SELECTION */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '13px', color: '#a0a0a8', fontWeight: 500 }}>Who did you train? <span style={{ color: '#F4581A' }}>*</span></label>
              <span style={{ fontSize: '12px', color: '#6B6B72' }}>{selectedPlayers.length} selected</span>
            </div>

            {/* GROUP QUICK SELECT */}
            {groups.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', color: '#6B6B72', alignSelf: 'center' }}>Quick select:</span>
                {groups.map(g => (
                  <button key={g.id} type="button" onClick={() => selectGroup(g.id)} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', border: '1px solid #2A2A2D', background: 'transparent', color: '#F4581A', cursor: 'pointer' }}>
                    {g.name}
                  </button>
                ))}
              </div>
            )}

            {/* FILTER TABS */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}>
              {[{ key: 'all', label: 'All' }, { key: 'individual', label: 'Individual' }, ...groups.map(g => ({ key: g.id, label: g.name }))].map(f => (
                <button key={f.key} type="button" onClick={() => setFilterGroup(f.key)} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', border: '1px solid #2A2A2D', background: filterGroup === f.key ? '#2A2A2D' : 'transparent', color: filterGroup === f.key ? '#ffffff' : '#6B6B72', cursor: 'pointer' }}>
                  {f.label}
                </button>
              ))}
            </div>

            {/* PLAYER CHECKBOXES */}
            <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', overflow: 'hidden' }}>
              {filteredPlayers.map((player, i) => {
                const isSelected = selectedPlayers.includes(player.id)
                const isLast = i === filteredPlayers.length - 1
                return (
                  <div key={player.id} onClick={() => togglePlayer(player.id)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: isLast ? 'none' : '1px solid #2A2A2D', cursor: 'pointer', background: isSelected ? 'rgba(244,88,26,0.08)' : 'transparent', transition: 'background 0.1s' }}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '4px', border: isSelected ? 'none' : '1.5px solid #6B6B72', background: isSelected ? '#F4581A' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                      {isSelected && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <polyline points="1.5,5 4,7.5 8.5,2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(244,88,26,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600, color: '#F4581A', flexShrink: 0 }}>
                      {getInitials(player.full_name)}
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: isSelected ? '#ffffff' : '#a0a0a8' }}>{player.full_name}</div>
                  </div>
                )
              })}
              {filteredPlayers.length === 0 && (
                <div style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: '#6B6B72' }}>No players found</div>
              )}
            </div>
          </div>

          {/* NOTES */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', color: '#a0a0a8', fontWeight: 500 }}>Session notes <span style={{ color: '#6B6B72', fontWeight: 400 }}>(optional)</span></label>
            <textarea style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%', minHeight: '80px', resize: 'vertical', fontFamily: 'sans-serif' }} placeholder="e.g. Ball handling, crossovers, free throws..." value={notes} onChange={e => setNotes(e.target.value)} />
            <span style={{ fontSize: '12px', color: '#6B6B72' }}>What did you work on?</span>
          </div>

          {error && <p style={{ fontSize: '13px', color: '#E03131', background: '#1f0f0f', border: '1px solid #3a1a1a', borderRadius: '8px', padding: '10px 14px' }}>{error}</p>}

          <button type="submit" disabled={loading} style={{ background: '#F4581A', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}>
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
