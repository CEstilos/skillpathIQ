'use client'

import { useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

const CATEGORIES = ['Ball handling', 'Shooting', 'Passing', 'Footwork', 'Defense', 'Conditioning']

function NewDrillWeekForm() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const groupId = searchParams.get('group')

  const [title, setTitle] = useState('')
  const [weekStart, setWeekStart] = useState(() => {
    const today = new Date()
    const day = today.getDay()
    const monday = new Date(today)
    monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1))
    return monday.toISOString().split('T')[0]
  })
  const [drills, setDrills] = useState([
    { title: '', description: '', reps: '', category: 'Ball handling' },
  ])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  function addDrill() {
    if (drills.length >= 7) return
    setDrills([...drills, { title: '', description: '', reps: '', category: 'Ball handling' }])
  }

  function removeDrill(index) {
    if (drills.length === 1) return
    setDrills(drills.filter((_, i) => i !== index))
  }

  function updateDrill(index, field, value) {
    const updated = [...drills]
    updated[index][field] = value
    setDrills(updated)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const { data: week, error: weekError } = await supabase
      .from('drill_weeks')
      .insert({
        trainer_id: user.id,
        group_id: groupId,
        title,
        week_start: weekStart,
      })
      .select()
      .single()

    if (weekError) {
      setError(weekError.message)
      setLoading(false)
      return
    }

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

    const { error: drillsError } = await supabase
      .from('drills')
      .insert(drillRows)

    if (drillsError) {
      setError(drillsError.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', fontFamily: 'sans-serif' }}>
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', height: '60px', borderBottom: '1px solid #2A2A2D' }}>
        <div style={{ fontFamily: 'monospace', fontSize: '20px', fontWeight: 700, color: '#ffffff', letterSpacing: '2px' }}>
          SkillPath<span style={{ color: '#F4581A' }}>IQ</span>
        </div>
        <Link href="/dashboard" style={{ fontSize: '13px', color: '#6B6B72', textDecoration: 'none' }}>← Back to dashboard</Link>
      </nav>

      <div style={{ maxWidth: '640px', margin: '48px auto', padding: '0 16px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>Assign drill week</h1>
        <p style={{ fontSize: '14px', color: '#6B6B72', marginBottom: '32px' }}>Create this week's drills for your players to complete between sessions</p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* WEEK INFO */}
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Week details</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', color: '#a0a0a8', fontWeight: 500 }}>Week focus</label>
              <input
                style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }}
                type="text"
                placeholder="e.g. Ball handling focus, Shooting week"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', color: '#a0a0a8', fontWeight: 500 }}>Week starting</label>
              <input
                style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }}
                type="date"
                value={weekStart}
                onChange={e => setWeekStart(e.target.value)}
                required
              />
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
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#F4581A' }}>Drill {index + 1}</span>
                  {drills.length > 1 && (
                    <button type="button" onClick={() => removeDrill(index)} style={{ fontSize: '12px', color: '#6B6B72', background: 'none', border: 'none', cursor: 'pointer' }}>
                      Remove
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 2 }}>
                    <label style={{ fontSize: '12px', color: '#a0a0a8' }}>Drill name</label>
                    <input
                      style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }}
                      type="text"
                      placeholder="e.g. Two-ball dribble"
                      value={drill.title}
                      onChange={e => updateDrill(index, 'title', e.target.value)}
                      required
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                    <label style={{ fontSize: '12px', color: '#a0a0a8' }}>Category</label>
                    <select
                      style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }}
                      value={drill.category}
                      onChange={e => updateDrill(index, 'category', e.target.value)}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', color: '#a0a0a8' }}>Description <span style={{ color: '#6B6B72' }}>(optional)</span></label>
                  <input
                    style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }}
                    type="text"
                    placeholder="Brief instructions for the player"
                    value={drill.description}
                    onChange={e => updateDrill(index, 'description', e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', color: '#a0a0a8' }}>Reps / sets</label>
                  <input
                    style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }}
                    type="text"
                    placeholder="e.g. 3 sets · 45 seconds each"
                    value={drill.reps}
                    onChange={e => updateDrill(index, 'reps', e.target.value)}
                  />
                </div>
              </div>
            ))}

            {drills.length < 7 && (
              <button
                type="button"
                onClick={addDrill}
                style={{ background: 'transparent', border: '1px dashed #2A2A2D', borderRadius: '12px', padding: '14px', fontSize: '14px', color: '#6B6B72', cursor: 'pointer', textAlign: 'center' }}>
                + Add another drill
              </button>
            )}
          </div>

          {error && (
            <p style={{ fontSize: '13px', color: '#E03131', background: '#1f0f0f', border: '1px solid #3a1a1a', borderRadius: '8px', padding: '10px 14px' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ background: '#F4581A', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '14px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}>
            {loading ? 'Assigning drills...' : 'Assign drill week'}
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
