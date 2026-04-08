'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

const CATEGORIES = ['Ball handling', 'Shooting', 'Passing', 'Footwork', 'Defense', 'Conditioning']

interface Drill {
  title: string
  description: string
  reps: string
  category: string
}

interface Player { id: string; full_name: string; group_id: string | null }
interface Group { id: string; name: string }

function NewDrillWeekForm() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedGroup = searchParams.get('group')
  const preselectedPlayer = searchParams.get('player')

  const [assignTo, setAssignTo] = useState<'group' | 'individual'>(
    preselectedPlayer ? 'individual' : 'group'
  )
  const [selectedGroup, setSelectedGroup] = useState(preselectedGroup || '')
  const [selectedPlayer, setSelectedPlayer] = useState(preselectedPlayer || '')
  const [players, setPlayers] = useState<Player[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [title, setTitle] = useState('')
  const [weekStart, setWeekStart] = useState(() => {
    const today = new Date()
    const day = today.getDay()
    const monday = new Date(today)
    monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1))
    return monday.toISOString().split('T')[0]
  })
  const [drills, setDrills] = useState<Drill[]>([
    { title: '', description: '', reps: '', category: 'Ball handling' },
  ])
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

  function addDrill() {
    if (drills.length >= 7) return
    setDrills([...drills, { title: '', description: '', reps: '', category: 'Ball handling' }])
  }

  function removeDrill(index: number) {
    if (drills.length === 1) return
    setDrills(drills.filter((_, i) => i !== index))
  }

  function updateDrill(index: number, field: string, value: string) {
    const updated = [...drills]
    updated[index] = { ...updated[index], [field]: value }
    setDrills(updated)
  }

  function getInitials(name: string) {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??'
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (assignTo === 'group' && !selectedGroup) { setError('Please select a group'); return }
    if (assignTo === 'individual' && !selectedPlayer) { setError('Please select a player'); return }
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const { data: week, error: weekError } = await supabase
      .from('drill_weeks')
      .insert({
        trainer_id: user.id,
        group_id: assignTo === 'group' ? selectedGroup : null,
        player_id: assignTo === 'individual' ? selectedPlayer : null,
        title,
        week_start: weekStart,
      })
      .select()
      .single()

    if (weekError) { setError(weekError.message); setLoading(false); return }

    const drillRows = drills
      .filter(d => d.title.trim())
      .map((d, i) => ({
        drill_week_id: week.id,
        trainer_id: user.id,
        title: d.title,
        description: d.description,
        reps: d.reps,
        category: d.category.toLowerCase(),
        sort_order: i,
      }))

    const { error: drillsError } = await supabase.from('drills').insert(drillRows)
    if (drillsError) { setError(drillsError.message); setLoading(false); return }

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

      <div style={{ maxWidth: '640px', margin: '48px auto', padding: '0 16px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#ffffff', fontFamily: '"Exo 2", sans-serif', marginBottom: '8px' }}>Assign drills</h1>
        <p style={{ fontSize: '14px', color: '#9A9A9F', marginBottom: '32px' }}>Assign to a group or an individual player</p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* ASSIGN TO */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ fontSize: '13px', color: '#9A9A9F', fontWeight: 500 }}>Assign to</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              {(['group', 'individual'] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setAssignTo(type)}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '10px',
                    border: `1px solid ${assignTo === type ? '#00FF9F' : '#2A2A2D'}`,
                    background: assignTo === type ? 'rgba(0,255,159,0.08)' : '#1A1A1C',
                    color: assignTo === type ? '#00FF9F' : '#9A9A9F',
                    fontSize: '14px', fontWeight: 500, cursor: 'pointer',
                    transition: 'all 0.15s', textTransform: 'capitalize',
                  }}>
                  {type === 'group' ? 'A group' : 'Individual player'}
                </button>
              ))}
            </div>
          </div>

          {/* GROUP SELECTOR */}
          {assignTo === 'group' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', color: '#9A9A9F', fontWeight: 500 }}>Select group</label>
              {groups.length === 0 ? (
                <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
                  <p style={{ fontSize: '13px', color: '#9A9A9F', marginBottom: '10px' }}>No groups yet</p>
                  <button type="button" onClick={() => router.push('/dashboard/groups/new')} style={{ fontSize: '13px', color: '#00FF9F', background: 'none', border: 'none', cursor: 'pointer' }}>+ Create a group →</button>
                </div>
              ) : (
                <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '10px', overflow: 'hidden' }}>
                  {groups.map((g, i) => {
                    const isSelected = selectedGroup === g.id
                    const isLast = i === groups.length - 1
                    return (
                      <div key={g.id} onClick={() => setSelectedGroup(g.id)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: isLast ? 'none' : '1px solid #2A2A2D', cursor: 'pointer', background: isSelected ? 'rgba(0,255,159,0.06)' : 'transparent', transition: 'background 0.1s' }}>
                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: isSelected ? 'none' : '1.5px solid #9A9A9F', background: isSelected ? '#00FF9F' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                          {isSelected && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0E0E0F' }} />}
                        </div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 500, color: isSelected ? '#ffffff' : '#9A9A9F' }}>{g.name}</div>
                          <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '1px' }}>
                            {players.filter(p => p.group_id === g.id).length} players
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* INDIVIDUAL PLAYER SELECTOR */}
          {assignTo === 'individual' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', color: '#9A9A9F', fontWeight: 500 }}>Select player</label>
              <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '10px', overflow: 'hidden' }}>
                {players.map((player, i) => {
                  const isSelected = selectedPlayer === player.id
                  const isLast = i === players.length - 1
                  return (
                    <div key={player.id} onClick={() => setSelectedPlayer(player.id)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: isLast ? 'none' : '1px solid #2A2A2D', cursor: 'pointer', background: isSelected ? 'rgba(0,255,159,0.06)' : 'transparent', transition: 'background 0.1s' }}>
                      <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: isSelected ? 'none' : '1.5px solid #9A9A9F', background: isSelected ? '#00FF9F' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                        {isSelected && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0E0E0F' }} />}
                      </div>
                      <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'rgba(0,255,159,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, color: '#00FF9F', flexShrink: 0 }}>
                        {getInitials(player.full_name)}
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 500, color: isSelected ? '#ffffff' : '#9A9A9F' }}>{player.full_name}</div>
                        {player.group_id && (
                          <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '1px' }}>
                            {groups.find(g => g.id === player.group_id)?.name || 'Group'}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
                {players.length === 0 && (
                  <div style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: '#9A9A9F' }}>No players yet</div>
                )}
              </div>
            </div>
          )}

          {/* WEEK DETAILS */}
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Week details</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', color: '#9A9A9F', fontWeight: 500 }}>Week focus</label>
              <input style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }} type="text" placeholder="e.g. Ball handling focus, Shooting week" value={title} onChange={e => setTitle(e.target.value)} required />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', color: '#9A9A9F', fontWeight: 500 }}>Week starting</label>
              <input style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }} type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)} required />
            </div>
          </div>

          {/* DRILLS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Drills ({drills.length}/7)
            </div>
            {drills.map((drill, index) => (
              <div key={index} style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#00FF9F' }}>Drill {index + 1}</span>
                  {drills.length > 1 && (
                    <button type="button" onClick={() => removeDrill(index)} style={{ fontSize: '12px', color: '#9A9A9F', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 2 }}>
                    <label style={{ fontSize: '12px', color: '#9A9A9F' }}>Drill name</label>
                    <input style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }} type="text" placeholder="e.g. Two-ball dribble" value={drill.title} onChange={e => updateDrill(index, 'title', e.target.value)} required />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                    <label style={{ fontSize: '12px', color: '#9A9A9F' }}>Category</label>
                    <select style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }} value={drill.category} onChange={e => updateDrill(index, 'category', e.target.value)}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', color: '#9A9A9F' }}>Description <span style={{ color: '#9A9A9F' }}>(optional)</span></label>
                  <input style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }} type="text" placeholder="Brief instructions for the player" value={drill.description} onChange={e => updateDrill(index, 'description', e.target.value)} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', color: '#9A9A9F' }}>Reps / sets</label>
                  <input style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }} type="text" placeholder="e.g. 3 sets · 45 seconds each" value={drill.reps} onChange={e => updateDrill(index, 'reps', e.target.value)} />
                </div>
              </div>
            ))}
            {drills.length < 7 && (
              <button type="button" onClick={addDrill} style={{ background: 'transparent', border: '1px dashed #2A2A2D', borderRadius: '12px', padding: '14px', fontSize: '14px', color: '#9A9A9F', cursor: 'pointer', textAlign: 'center' }}>
                + Add another drill
              </button>
            )}
          </div>

          {error && <p style={{ fontSize: '13px', color: '#E03131', background: '#1f0f0f', border: '1px solid #3a1a1a', borderRadius: '8px', padding: '10px 14px' }}>{error}</p>}

          <button type="submit" disabled={loading} style={{ background: '#00FF9F', color: '#0E0E0F', border: 'none', borderRadius: '8px', padding: '14px', fontSize: '15px', fontWeight: 700, cursor: 'pointer' }}>
            {loading ? 'Assigning drill work...' : 'Assign drill work'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function NewDrillWeekPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0E0E0F' }} />}>
      <NewDrillWeekForm />
    </Suspense>
  )
}
