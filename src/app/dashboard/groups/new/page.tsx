'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface AvailabilityWindow {
  id: string
  day_of_week: string
  start_time: string
  end_time: string
  session_type: string
  display_label: string | null
}

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }
function formatTime(t: string) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${hour}:${m.toString().padStart(2, '0')}${ampm}`
}

export default function NewGroupPage() {
  const supabase = createClient()
  const router = useRouter()
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [sport, setSport] = useState('basketball')
  const [sessionDay, setSessionDay] = useState('')
  const [sessionTime, setSessionTime] = useState('')
  const [windowId, setWindowId] = useState('')
  const [description, setDescription] = useState('')
  const [windows, setWindows] = useState<AvailabilityWindow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function loadWindows() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('trainer_availability_windows')
        .select('id, day_of_week, start_time, end_time, session_type, display_label')
        .eq('trainer_id', user.id)
        .in('session_type', ['group', 'both'])
        .order('sort_order', { ascending: true })
      if (!cancelled) setWindows((data as AvailabilityWindow[] | null) || [])
    }
    loadWindows()
    return () => { cancelled = true }
  }, [supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }
    const { error } = await supabase.from('groups').insert({
      trainer_id: user.id,
      name,
      location: location.trim() || null,
      sport,
      session_day: sessionDay,
      session_time: sessionTime,
      window_id: windowId || null,
      description: description.trim() || null,
    })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/dashboard/groups')
  }

  const inputStyle = { background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }

  return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', fontFamily: 'sans-serif' }}>
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', height: '60px', borderBottom: '1px solid #2A2A2D' }}>
      <img
  src="/logo.png"
  alt="SkillPathIQ"
  onClick={() => router.push('/dashboard')}
  style={{ height: '65px', width: 'auto', cursor: 'pointer', flexShrink: 0 }}
/>
        <Link href="/dashboard" style={{ fontSize: '13px', color: '#9A9A9F', textDecoration: 'none' }}>← Back to dashboard</Link>
      </nav>
      <div style={{ maxWidth: '480px', margin: '48px auto', padding: '0 16px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#ffffff', fontFamily: '"Exo 2", sans-serif', marginBottom: '8px' }}>Create a group</h1>
        <p style={{ fontSize: '14px', color: '#9A9A9F', marginBottom: '32px' }}>A group is a set of players you train together</p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', color: '#a0a0a8', fontWeight: 500 }}>Group name</label>
            <input style={inputStyle} type="text" placeholder="e.g. Monday Group, Elite 6th Grade" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', color: '#a0a0a8', fontWeight: 500 }}>Location</label>
            <input style={inputStyle} type="text" placeholder="e.g. Springfield Sports Center, Gym B" value={location} onChange={e => setLocation(e.target.value)} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', color: '#a0a0a8', fontWeight: 500 }}>Sport</label>
            <select style={inputStyle} value={sport} onChange={e => setSport(e.target.value)}>
            <option value="basketball">Basketball</option>
<option value="golf">Golf</option>
<option value="baseball">Baseball</option>
<option value="softball">Softball</option>
<option value="soccer">Soccer</option>
<option value="football">Football</option>
<option value="tennis">Tennis</option>
<option value="volleyball">Volleyball</option>
<option value="other">Other</option>
            </select>
          </div>
          {windows.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', color: '#a0a0a8', fontWeight: 500 }}>
                Linked availability window <span style={{ color: '#555558' }}>(optional)</span>
              </label>
              <p style={{ fontSize: '12px', color: '#9A9A9F', marginBottom: '2px' }}>Connect this group to a scheduling window so booking requests route here automatically.</p>
              <select style={inputStyle} value={windowId} onChange={e => setWindowId(e.target.value)}>
                <option value="">None (no window linked)</option>
                {windows.map(w => (
                  <option key={w.id} value={w.id}>
                    {capitalize(w.day_of_week)} · {formatTime(w.start_time)}–{formatTime(w.end_time)} · {w.session_type === 'group' ? 'Group' : 'Group/Individual'}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', color: '#a0a0a8', fontWeight: 500 }}>
              Group notes <span style={{ color: '#555558' }}>(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Competitive 10U boys, Tuesday evenings"
              style={{ ...inputStyle, minHeight: '80px', resize: 'vertical', fontFamily: 'sans-serif' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
              <label style={{ fontSize: '13px', color: '#a0a0a8', fontWeight: 500 }}>Session day</label>
              <select style={inputStyle} value={sessionDay} onChange={e => setSessionDay(e.target.value)}>
                <option value="">Select day</option>
                <option value="Monday">Monday</option>
                <option value="Tuesday">Tuesday</option>
                <option value="Wednesday">Wednesday</option>
                <option value="Thursday">Thursday</option>
                <option value="Friday">Friday</option>
                <option value="Saturday">Saturday</option>
                <option value="Sunday">Sunday</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
              <label style={{ fontSize: '13px', color: '#a0a0a8', fontWeight: 500 }}>Session time</label>
              <input style={inputStyle} type="text" placeholder="e.g. 4:00pm" value={sessionTime} onChange={e => setSessionTime(e.target.value)} />
            </div>
          </div>
          {error && <p style={{ fontSize: '13px', color: '#E03131', background: '#1f0f0f', border: '1px solid #3a1a1a', borderRadius: '8px', padding: '10px 14px' }}>{error}</p>}
          <button type="submit" disabled={loading} style={{ background: '#00FF9F', color: '#0E0E0F', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', marginTop: '4px' }}>
            {loading ? 'Creating...' : 'Create group'}
          </button>
        </form>
      </div>
    </div>
  )
}
