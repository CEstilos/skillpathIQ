'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import NavBar from '@/components/NavBar'
import { generateSlots } from '@/lib/generateSlots'

const DAY_ORDER = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${hour}:${m.toString().padStart(2,'0')} ${ampm}`
}

function formatBlackoutDate(d: string) {
  const date = new Date(d + 'T00:00:00')
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function sortWindows(windows: AvailabilityWindow[]) {
  return [...windows].sort((a, b) => {
    const di = DAY_ORDER.indexOf(a.day_of_week) - DAY_ORDER.indexOf(b.day_of_week)
    if (di !== 0) return di
    return a.start_time.localeCompare(b.start_time)
  })
}

interface Profile {
  id: string
  full_name: string
  email: string
  individual_rate: number | null
  group_rate: number | null
  welcome_message: string | null
  username: string | null
  bio: string | null
  sport: string | null
  location: string | null
  profile_photo_url: string | null
  public_profile_enabled: boolean | null
}

interface AvailabilityWindow {
  id: string
  day_of_week: string
  start_time: string
  end_time: string
  session_type: string
  display_label: string | null
  sort_order: number
  duration_minutes: number
  buffer_minutes: number
  max_capacity: number | null
}

interface SessionDuration {
  id: string
  duration_minutes: number
  label: string
}

interface BlackoutDate {
  id: string
  blackout_date: string
  note: string | null
}

export default function SettingsClient({ profile }: { profile: Profile | null }) {
  const supabase = createClient()
  const router = useRouter()
  const [individualRate, setIndividualRate] = useState(profile?.individual_rate?.toString() || '')
  const [groupRate, setGroupRate] = useState(profile?.group_rate?.toString() || '')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [welcomeMessage, setWelcomeMessage] = useState(profile?.welcome_message || '')
  const [welcomeSaved, setWelcomeSaved] = useState(false)
  const [welcomeLoading, setWelcomeLoading] = useState(false)

  const [username, setUsername] = useState(profile?.username || '')
  const [bio, setBio] = useState(profile?.bio || '')
  const [sport, setSport] = useState(profile?.sport || '')
  const [location, setLocation] = useState(profile?.location || '')
  const [publicProfileEnabled, setPublicProfileEnabled] = useState(profile?.public_profile_enabled ?? false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [copiedProfileUrl, setCopiedProfileUrl] = useState(false)

  const [durations, setDurations] = useState<SessionDuration[]>([])
  const [windows, setWindows] = useState<AvailabilityWindow[]>([])
  const [blackouts, setBlackouts] = useState<BlackoutDate[]>([])
  const [newDurationLabel, setNewDurationLabel] = useState('')
  const [addingDuration, setAddingDuration] = useState(false)
  const [durationError, setDurationError] = useState<string | null>(null)
  const [windowFormOpen, setWindowFormOpen] = useState(false)
  const [editingWindowId, setEditingWindowId] = useState<string | null>(null)
  const [windowForm, setWindowForm] = useState({
    day_of_week: 'monday',
    start_time: '',
    end_time: '',
    session_type: 'both',
    display_label: '',
    duration_id: '',
    buffer_minutes: '0',
    max_capacity: '',
  })
  const [savingWindow, setSavingWindow] = useState(false)
  const [windowError, setWindowError] = useState<string | null>(null)

  const [newBlackoutDate, setNewBlackoutDate] = useState('')
  const [newBlackoutNote, setNewBlackoutNote] = useState('')
  const [addingBlackout, setAddingBlackout] = useState(false)
  const [blackoutError, setBlackoutError] = useState<string | null>(null)

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    if (!profile?.id) return
    supabase.from('trainer_availability_windows').select('*').eq('trainer_id', profile.id).order('sort_order')
      .then(({ data }) => setWindows(data || []))
    supabase.from('trainer_session_durations').select('*').eq('trainer_id', profile.id).order('duration_minutes')
      .then(({ data }) => setDurations(data || []))
    supabase.from('trainer_blackout_dates').select('*').eq('trainer_id', profile.id)
      .gte('blackout_date', today).order('blackout_date')
      .then(({ data }) => setBlackouts(data || []))
  }, [profile?.id])

  async function handleAddDuration() {
    if (!newDurationLabel.trim()) return
    if (durations.length >= 5) { setDurationError('Maximum 5 durations'); return }
    setAddingDuration(true)
    setDurationError(null)
    const { data, error } = await supabase.from('trainer_session_durations').insert({
      trainer_id: profile!.id,
      duration_minutes: parseInt(newDurationLabel) || 0,
      label: newDurationLabel.trim(),
    }).select().single()
    setAddingDuration(false)
    if (error) { setDurationError(error.message); return }
    setDurations(prev => [...prev, data])
    setNewDurationLabel('')
  }

  async function handleDeleteDuration(id: string) {
    await supabase.from('trainer_session_durations').delete().eq('id', id)
    setDurations(prev => prev.filter(d => d.id !== id))
  }

  function openAddWindow() {
    setEditingWindowId(null)
    setWindowForm({
      day_of_week: 'monday',
      start_time: '',
      end_time: '',
      session_type: 'both',
      display_label: '',
      duration_id: durations[0]?.id || '',
      buffer_minutes: '0',
      max_capacity: '',
    })
    setWindowError(null)
    setWindowFormOpen(true)
  }

  function openEditWindow(w: AvailabilityWindow) {
    setEditingWindowId(w.id)
    const matchingDuration = durations.find(d => d.duration_minutes === w.duration_minutes)
    setWindowForm({
      day_of_week: w.day_of_week,
      start_time: w.start_time.slice(0, 5),
      end_time: w.end_time.slice(0, 5),
      session_type: w.session_type,
      display_label: w.display_label || '',
      duration_id: matchingDuration?.id || durations[0]?.id || '',
      buffer_minutes: w.buffer_minutes.toString(),
      max_capacity: w.max_capacity?.toString() || '',
    })
    setWindowError(null)
    setWindowFormOpen(true)
  }

  async function handleSaveWindow() {
    if (!windowForm.start_time || !windowForm.end_time) { setWindowError('Start and end time are required'); return }
    if (!windowForm.duration_id) { setWindowError('Select a session duration'); return }
    const selectedDuration = durations.find(d => d.id === windowForm.duration_id)
    if (!selectedDuration) { setWindowError('Selected duration not found'); return }
    const bufferMins = parseInt(windowForm.buffer_minutes) || 0
    const maxCap = (windowForm.session_type !== 'individual' && windowForm.max_capacity)
      ? parseInt(windowForm.max_capacity) || null
      : null

    setSavingWindow(true)
    setWindowError(null)
    const payload = {
      day_of_week: windowForm.day_of_week,
      start_time: windowForm.start_time,
      end_time: windowForm.end_time,
      session_type: windowForm.session_type,
      display_label: windowForm.display_label.trim() || null,
      duration_minutes: selectedDuration.duration_minutes,
      buffer_minutes: bufferMins,
      max_capacity: maxCap,
    }
    if (editingWindowId) {
      const { data, error } = await supabase.from('trainer_availability_windows').update(payload).eq('id', editingWindowId).select().single()
      setSavingWindow(false)
      if (error) { setWindowError(error.message); return }
      setWindows(prev => prev.map(w => w.id === editingWindowId ? data : w))
    } else {
      const { data, error } = await supabase.from('trainer_availability_windows').insert({
        trainer_id: profile!.id,
        ...payload,
        sort_order: windows.length,
      }).select().single()
      setSavingWindow(false)
      if (error) { setWindowError(error.message); return }
      setWindows(prev => [...prev, data])
    }
    setWindowFormOpen(false)
    setEditingWindowId(null)
  }

  async function handleDeleteWindow(id: string) {
    await supabase.from('trainer_availability_windows').delete().eq('id', id)
    setWindows(prev => prev.filter(w => w.id !== id))
  }

  async function handleAddBlackout() {
    if (!newBlackoutDate) return
    setAddingBlackout(true)
    setBlackoutError(null)
    const { data, error } = await supabase.from('trainer_blackout_dates').insert({
      trainer_id: profile!.id,
      blackout_date: newBlackoutDate,
      note: newBlackoutNote.trim() || null,
    }).select().single()
    setAddingBlackout(false)
    if (error) {
      setBlackoutError(error.code === '23505' ? 'That date is already blocked' : error.message)
      return
    }
    setBlackouts(prev => [...prev, data].sort((a, b) => a.blackout_date.localeCompare(b.blackout_date)))
    setNewBlackoutDate('')
    setNewBlackoutNote('')
  }

  async function handleDeleteBlackout(id: string) {
    await supabase.from('trainer_blackout_dates').delete().eq('id', id)
    setBlackouts(prev => prev.filter(b => b.id !== id))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase
      .from('profiles')
      .update({
        individual_rate: parseFloat(individualRate) || 0,
        group_rate: parseFloat(groupRate) || 0,
      })
      .eq('id', profile?.id)

    if (error) { setError(error.message); setLoading(false); return }

    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setLoading(false)
  }

  async function handlePasswordChange() {
    setPasswordError(null)
    if (newPassword.length < 8) { setPasswordError('Password must be at least 8 characters'); return }
    if (newPassword !== confirmPassword) { setPasswordError('Passwords do not match'); return }
    setPasswordLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) { setPasswordError(error.message); setPasswordLoading(false); return }
    setPasswordSaved(true)
    setNewPassword('')
    setConfirmPassword('')
    setTimeout(() => setPasswordSaved(false), 3000)
    setPasswordLoading(false)
  }

  async function handleSaveWelcome() {
    setWelcomeLoading(true)
    await supabase.from('profiles')
      .update({ welcome_message: welcomeMessage })
      .eq('id', profile?.id)
    setWelcomeLoading(false)
    setWelcomeSaved(true)
    setTimeout(() => setWelcomeSaved(false), 2000)
  }

  async function handleSavePublicProfile() {
    setProfileError(null)
    const trimmed = username.trim().toLowerCase()
    if (!trimmed) { setProfileError('Username is required'); return }
    if (!/^[a-z0-9_-]+$/.test(trimmed)) { setProfileError('Username can only contain letters, numbers, hyphens, and underscores'); return }
    setProfileSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        username: trimmed,
        bio: bio.trim() || null,
        sport: sport.trim() || null,
        location: location.trim() || null,
        public_profile_enabled: publicProfileEnabled,
      })
      .eq('id', profile?.id)
    setProfileSaving(false)
    if (error) {
      if (error.message.includes('unique') || error.code === '23505') {
        setProfileError('That username is already taken')
      } else {
        setProfileError(error.message)
      }
      return
    }
    setProfileSaved(true)
    setTimeout(() => setProfileSaved(false), 2500)
  }

  const profileUrl = username.trim() ? `https://skillpathiq.com/t/${username.trim().toLowerCase()}` : null

  return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', fontFamily: 'sans-serif', overflowX: 'hidden', maxWidth: '100vw', width: '100%' }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { overflow-x: hidden; max-width: 100vw; background: #0E0E0F; }
      `}</style>

      <NavBar trainerName={profile?.full_name} />

      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '20px 16px', width: '100%' }}>


          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#ffffff', fontFamily: '"Exo 2", sans-serif', marginBottom: '8px' }}>Settings</h1>
          <p style={{ fontSize: '14px', color: '#9A9A9F', marginBottom: '32px' }}>Set your default session rates for revenue tracking</p>

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Session rates</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', color: '#9A9A9F', fontWeight: 500 }}>Individual session rate</label>
                <div style={{ display: 'flex', alignItems: 'center', background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', overflow: 'hidden' }}>
                  <span style={{ padding: '11px 14px', fontSize: '14px', color: '#9A9A9F', borderRight: '1px solid #2A2A2D' }}>$</span>
                  <input
                    style={{ flex: 1, background: 'transparent', border: 'none', padding: '11px 14px', fontSize: '14px', color: '#ffffff', outline: 'none' }}
                    type="number" min="0" step="0.01" placeholder="0.00"
                    value={individualRate}
                    onChange={e => setIndividualRate(e.target.value)}
                  />
                  <span style={{ padding: '11px 14px', fontSize: '13px', color: '#9A9A9F' }}>per session</span>
                </div>
                <span style={{ fontSize: '12px', color: '#9A9A9F' }}>Applied to 1-on-1 training sessions</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', color: '#9A9A9F', fontWeight: 500 }}>Group session rate <span style={{ fontSize: '11px', color: '#9A9A9F', fontWeight: 400 }}>(per player)</span></label>
                <div style={{ display: 'flex', alignItems: 'center', background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', overflow: 'hidden' }}>
                  <span style={{ padding: '11px 14px', fontSize: '14px', color: '#9A9A9F', borderRight: '1px solid #2A2A2D' }}>$</span>
                  <input
                    style={{ flex: 1, background: 'transparent', border: 'none', padding: '11px 14px', fontSize: '14px', color: '#ffffff', outline: 'none' }}
                    type="number" min="0" step="0.01" placeholder="0.00"
                    value={groupRate}
                    onChange={e => setGroupRate(e.target.value)}
                  />
                  <span style={{ padding: '11px 14px', fontSize: '13px', color: '#9A9A9F' }}>per session</span>
                </div>
                <span style={{ fontSize: '12px', color: '#9A9A9F' }}>Rate per player · multiplied by attendance at each session</span>
              </div>
            </div>

            <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>Account</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #2A2A2D' }}>
                <span style={{ fontSize: '13px', color: '#9A9A9F' }}>Name</span>
                <span style={{ fontSize: '13px', color: '#ffffff' }}>{profile?.full_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                <span style={{ fontSize: '13px', color: '#9A9A9F' }}>Email</span>
                <span style={{ fontSize: '13px', color: '#ffffff' }}>{profile?.email}</span>
              </div>
            </div>

            {error && <p style={{ fontSize: '13px', color: '#E03131', background: '#1f0f0f', border: '1px solid #3a1a1a', borderRadius: '8px', padding: '10px 14px' }}>{error}</p>}
            <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Welcome email</div>
                <div style={{ fontSize: '12px', color: '#9A9A9F' }}>Sent automatically to parents when you add a new player. Leave blank to skip.</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', color: '#9A9A9F', fontWeight: 500 }}>Message</label>
                <textarea
                  value={welcomeMessage}
                  onChange={e => setWelcomeMessage(e.target.value)}
                  placeholder={`Hi! I'm excited to start working with your player. Through SkillPathIQ you'll be able to track their progress, see their drill assignments, and stay updated after every session. I'll send updates after each session — looking forward to getting started!`}
                  rows={6}
                  style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%', resize: 'vertical' as const, fontFamily: 'sans-serif', lineHeight: 1.6 }}
                />
                <div style={{ fontSize: '12px', color: '#9A9A9F' }}>The player&apos;s profile link will be included automatically.</div>
              </div>
              <button
                type="button"
                onClick={handleSaveWelcome}
                disabled={welcomeLoading}
                style={{ background: '#00FF9F', color: '#0E0E0F', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>
                {welcomeSaved ? '✓ Saved!' : welcomeLoading ? 'Saving...' : 'Save welcome message'}
              </button>
            </div>
            {/* PUBLIC PROFILE */}
            <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Public profile</div>
                <div style={{ fontSize: '12px', color: '#9A9A9F' }}>Let parents find and book you at your personal link</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', color: '#9A9A9F', fontWeight: 500 }}>Username <span style={{ color: '#E03131' }}>*</span></label>
                <div style={{ display: 'flex', alignItems: 'center', background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', overflow: 'hidden' }}>
                  <span style={{ padding: '11px 12px', fontSize: '13px', color: '#555558', borderRight: '1px solid #2A2A2D', whiteSpace: 'nowrap' as const }}>skillpathiq.com/t/</span>
                  <input
                    style={{ flex: 1, background: 'transparent', border: 'none', padding: '11px 12px', fontSize: '14px', color: '#ffffff', outline: 'none', minWidth: 0 }}
                    type="text"
                    placeholder="yourname"
                    value={username}
                    onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                  />
                </div>
                <span style={{ fontSize: '12px', color: '#9A9A9F' }}>Letters, numbers, hyphens, underscores only</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', color: '#9A9A9F', fontWeight: 500 }}>Bio <span style={{ fontSize: '11px', fontWeight: 400, color: '#555558' }}>(optional)</span></label>
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="Tell parents about your experience, coaching style, or specialties..."
                  rows={3}
                  style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%', resize: 'vertical' as const, fontFamily: 'sans-serif', lineHeight: 1.6 }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', color: '#9A9A9F', fontWeight: 500 }}>Sport <span style={{ fontSize: '11px', fontWeight: 400, color: '#555558' }}>(optional)</span></label>
                  <input
                    style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }}
                    type="text"
                    placeholder="Basketball"
                    value={sport}
                    onChange={e => setSport(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', color: '#9A9A9F', fontWeight: 500 }}>Location <span style={{ fontSize: '11px', fontWeight: 400, color: '#555558' }}>(optional)</span></label>
                  <input
                    style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }}
                    type="text"
                    placeholder="Chicago, IL"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#0E0E0F', borderRadius: '8px', border: '1px solid #2A2A2D' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>Enable public profile</div>
                  <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>Parents can find and book you via your link</div>
                </div>
                <button
                  type="button"
                  onClick={() => setPublicProfileEnabled(!publicProfileEnabled)}
                  style={{ width: '44px', height: '24px', borderRadius: '12px', border: 'none', background: publicProfileEnabled ? '#00FF9F' : '#2A2A2D', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
                  <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#ffffff', position: 'absolute', top: '3px', left: publicProfileEnabled ? '23px' : '3px', transition: 'left 0.2s' }} />
                </button>
              </div>

              {profileUrl && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '10px 14px' }}>
                  <span style={{ flex: 1, fontSize: '13px', color: '#00FF9F', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{profileUrl}</span>
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard.writeText(profileUrl); setCopiedProfileUrl(true); setTimeout(() => setCopiedProfileUrl(false), 2000) }}
                    style={{ fontSize: '12px', padding: '5px 10px', borderRadius: '6px', border: '1px solid #2A2A2D', background: 'transparent', color: copiedProfileUrl ? '#00FF9F' : '#9A9A9F', cursor: 'pointer', flexShrink: 0, fontWeight: 600 }}>
                    {copiedProfileUrl ? '✓ Copied' : 'Copy'}
                  </button>
                  <a href={profileUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', padding: '5px 10px', borderRadius: '6px', border: '1px solid #2A2A2D', background: 'transparent', color: '#9A9A9F', cursor: 'pointer', flexShrink: 0, fontWeight: 600, textDecoration: 'none' }}>Preview</a>
                </div>
              )}

              {profileError && <p style={{ fontSize: '13px', color: '#E03131', background: '#1f0f0f', border: '1px solid #3a1a1a', borderRadius: '8px', padding: '10px 14px', margin: 0 }}>{profileError}</p>}

              <button
                type="button"
                onClick={handleSavePublicProfile}
                disabled={profileSaving}
                style={{ background: '#00FF9F', color: '#0E0E0F', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>
                {profileSaved ? '✓ Saved!' : profileSaving ? 'Saving...' : 'Save public profile'}
              </button>
            </div>

            {/* AVAILABILITY */}
            <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Availability</div>
                <div style={{ fontSize: '12px', color: '#9A9A9F' }}>Shown on your public profile to help parents choose a time</div>
              </div>

              {/* SESSION DURATIONS */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Session Durations</div>
                {durations.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {durations.map(d => (
                      <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '99px', padding: '5px 12px' }}>
                        <span style={{ fontSize: '13px', color: '#ffffff' }}>{d.label}</span>
                        <button onClick={() => handleDeleteDuration(d.id)} style={{ background: 'none', border: 'none', color: '#9A9A9F', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: '0' }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
                {durations.length < 5 && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder='e.g. "60 min" or "1 hour"'
                      value={newDurationLabel}
                      onChange={e => setNewDurationLabel(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddDuration())}
                      style={{ flex: 1, background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '9px 12px', fontSize: '14px', color: '#ffffff', outline: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={handleAddDuration}
                      disabled={addingDuration || !newDurationLabel.trim()}
                      style={{ background: newDurationLabel.trim() ? '#00FF9F' : '#2A2A2D', color: newDurationLabel.trim() ? '#0E0E0F' : '#9A9A9F', border: 'none', borderRadius: '8px', padding: '9px 16px', fontSize: '13px', fontWeight: 700, cursor: newDurationLabel.trim() ? 'pointer' : 'default' }}>
                      {addingDuration ? '...' : 'Add'}
                    </button>
                  </div>
                )}
                {durationError && <p style={{ fontSize: '12px', color: '#E03131', margin: 0 }}>{durationError}</p>}
              </div>

              {/* AVAILABILITY WINDOWS */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Availability Windows</div>
                  {!windowFormOpen && (
                    <button type="button" onClick={openAddWindow} style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '6px', border: '1px solid rgba(0,255,159,0.3)', background: 'transparent', color: '#00FF9F', cursor: 'pointer', fontWeight: 600 }}>+ Add</button>
                  )}
                </div>

                {sortWindows(windows).map(w => {
                  const slots = generateSlots(w.start_time.slice(0,5), w.end_time.slice(0,5), w.duration_minutes, w.buffer_minutes)
                  const slotPreview = slots.slice(0, 5).map(formatTime).join(' · ')
                  const extra = slots.length > 5 ? ` +${slots.length - 5} more` : ''
                  return editingWindowId === w.id && windowFormOpen ? null : (
                    <div key={w.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', background: '#0E0E0F', borderRadius: '8px', border: '1px solid #2A2A2D' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', textTransform: 'capitalize' }}>{w.day_of_week}</span>
                          <span style={{ fontSize: '12px', color: '#9A9A9F' }}>{formatTime(w.start_time)} – {formatTime(w.end_time)}</span>
                          <span style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '99px', fontWeight: 600, background: w.session_type === 'individual' ? 'rgba(74,158,255,0.15)' : w.session_type === 'group' ? 'rgba(245,166,35,0.15)' : 'rgba(0,255,159,0.12)', color: w.session_type === 'individual' ? '#4A9EFF' : w.session_type === 'group' ? '#F5A623' : '#00FF9F' }}>
                            {w.session_type === 'individual' ? 'Individual' : w.session_type === 'group' ? 'Group' : 'Both'}
                          </span>
                          {w.display_label && <span style={{ fontSize: '12px', color: '#9A9A9F', fontStyle: 'italic' }}>{w.display_label}</span>}
                        </div>
                        {slots.length > 0 && (
                          <div style={{ fontSize: '11px', color: '#555558', marginTop: '4px' }}>
                            {slotPreview}{extra}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button type="button" onClick={() => openEditWindow(w)} style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '6px', border: '1px solid #2A2A2D', background: 'transparent', color: '#9A9A9F', cursor: 'pointer' }}>Edit</button>
                        <button type="button" onClick={() => handleDeleteWindow(w.id)} style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(224,49,49,0.3)', background: 'transparent', color: '#E03131', cursor: 'pointer' }}>Delete</button>
                      </div>
                    </div>
                  )
                })}

                {windowFormOpen && (
                  <div style={{ background: '#0E0E0F', border: '1px solid rgba(0,255,159,0.25)', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{editingWindowId ? 'Edit window' : 'Add window'}</div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '12px', color: '#9A9A9F', display: 'block', marginBottom: '5px' }}>Day</label>
                        <select
                          value={windowForm.day_of_week}
                          onChange={e => setWindowForm(prev => ({ ...prev, day_of_week: e.target.value }))}
                          style={{ width: '100%', background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '7px', padding: '9px 10px', fontSize: '13px', color: '#ffffff', outline: 'none' }}>
                          {['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map(d => (
                            <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', color: '#9A9A9F', display: 'block', marginBottom: '5px' }}>Session type</label>
                        <select
                          value={windowForm.session_type}
                          onChange={e => setWindowForm(prev => ({ ...prev, session_type: e.target.value }))}
                          style={{ width: '100%', background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '7px', padding: '9px 10px', fontSize: '13px', color: '#ffffff', outline: 'none' }}>
                          <option value="both">Both</option>
                          <option value="individual">Individual</option>
                          <option value="group">Group</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '12px', color: '#9A9A9F', display: 'block', marginBottom: '5px' }}>Start time</label>
                        <input type="time" value={windowForm.start_time} onChange={e => setWindowForm(prev => ({ ...prev, start_time: e.target.value }))} style={{ width: '100%', background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '7px', padding: '9px 10px', fontSize: '13px', color: '#ffffff', outline: 'none' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', color: '#9A9A9F', display: 'block', marginBottom: '5px' }}>End time</label>
                        <input type="time" value={windowForm.end_time} onChange={e => setWindowForm(prev => ({ ...prev, end_time: e.target.value }))} style={{ width: '100%', background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '7px', padding: '9px 10px', fontSize: '13px', color: '#ffffff', outline: 'none' }} />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '12px', color: '#9A9A9F', display: 'block', marginBottom: '5px' }}>Session duration <span style={{ color: '#E03131' }}>*</span></label>
                        {durations.length === 0 ? (
                          <div style={{ fontSize: '12px', color: '#9A9A9F', padding: '9px 10px', background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '7px' }}>Add session durations above first</div>
                        ) : (
                          <select
                            value={windowForm.duration_id}
                            onChange={e => setWindowForm(prev => ({ ...prev, duration_id: e.target.value }))}
                            style={{ width: '100%', background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '7px', padding: '9px 10px', fontSize: '13px', color: '#ffffff', outline: 'none' }}>
                            {durations.map(d => (
                              <option key={d.id} value={d.id}>{d.label}</option>
                            ))}
                          </select>
                        )}
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', color: '#9A9A9F', display: 'block', marginBottom: '5px' }}>Buffer between slots</label>
                        <select
                          value={windowForm.buffer_minutes}
                          onChange={e => setWindowForm(prev => ({ ...prev, buffer_minutes: e.target.value }))}
                          style={{ width: '100%', background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '7px', padding: '9px 10px', fontSize: '13px', color: '#ffffff', outline: 'none' }}>
                          <option value="0">None</option>
                          <option value="15">15 min</option>
                          <option value="30">30 min</option>
                        </select>
                      </div>
                    </div>

                    {windowForm.session_type !== 'individual' && (
                      <div>
                        <label style={{ fontSize: '12px', color: '#9A9A9F', display: 'block', marginBottom: '5px' }}>Max group capacity <span style={{ color: '#555558', fontWeight: 400 }}>(optional)</span></label>
                        <input
                          type="number"
                          min="1"
                          placeholder="e.g. 8"
                          value={windowForm.max_capacity}
                          onChange={e => setWindowForm(prev => ({ ...prev, max_capacity: e.target.value }))}
                          style={{ width: '100%', background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '7px', padding: '9px 10px', fontSize: '13px', color: '#ffffff', outline: 'none' }}
                        />
                      </div>
                    )}

                    <div>
                      <label style={{ fontSize: '12px', color: '#9A9A9F', display: 'block', marginBottom: '5px' }}>Label <span style={{ color: '#555558', fontWeight: 400 }}>(optional)</span></label>
                      <input type="text" placeholder='e.g. "Group training only"' value={windowForm.display_label} onChange={e => setWindowForm(prev => ({ ...prev, display_label: e.target.value }))} style={{ width: '100%', background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '7px', padding: '9px 10px', fontSize: '13px', color: '#ffffff', outline: 'none' }} />
                    </div>

                    {windowError && <p style={{ fontSize: '12px', color: '#E03131', margin: 0 }}>{windowError}</p>}

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="button" onClick={handleSaveWindow} disabled={savingWindow || durations.length === 0} style={{ flex: 1, background: durations.length > 0 ? '#00FF9F' : '#2A2A2D', color: durations.length > 0 ? '#0E0E0F' : '#9A9A9F', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '13px', fontWeight: 700, cursor: durations.length > 0 ? 'pointer' : 'default' }}>
                        {savingWindow ? 'Saving...' : editingWindowId ? 'Save changes' : 'Add window'}
                      </button>
                      <button type="button" onClick={() => { setWindowFormOpen(false); setEditingWindowId(null) }} style={{ flex: 1, background: 'transparent', color: '#9A9A9F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '10px', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </div>
                )}

                {windows.length === 0 && !windowFormOpen && (
                  <div style={{ fontSize: '12px', color: '#555558', textAlign: 'center', padding: '12px 0' }}>No availability windows added yet</div>
                )}
              </div>

              {/* BLACKOUT DATES */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Blackout Dates</div>
                <div style={{ fontSize: '12px', color: '#555558' }}>Mark dates when you&apos;re unavailable — those days won&apos;t appear on your profile</div>

                {blackouts.map(b => (
                  <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', background: '#0E0E0F', borderRadius: '8px', border: '1px solid #2A2A2D' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: '13px', color: '#ffffff', fontWeight: 500 }}>{formatBlackoutDate(b.blackout_date)}</span>
                      {b.note && <span style={{ fontSize: '12px', color: '#9A9A9F', marginLeft: '8px' }}>{b.note}</span>}
                    </div>
                    <button type="button" onClick={() => handleDeleteBlackout(b.id)} style={{ background: 'none', border: 'none', color: '#9A9A9F', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: '0', flexShrink: 0 }}>×</button>
                  </div>
                ))}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="date"
                      min={today}
                      value={newBlackoutDate}
                      onChange={e => setNewBlackoutDate(e.target.value)}
                      style={{ flex: 1, background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: newBlackoutDate ? '#ffffff' : '#555558', outline: 'none', colorScheme: 'dark' }}
                    />
                    <input
                      type="text"
                      placeholder="Note (optional)"
                      value={newBlackoutNote}
                      onChange={e => setNewBlackoutNote(e.target.value)}
                      style={{ flex: 1, background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: '#ffffff', outline: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={handleAddBlackout}
                      disabled={addingBlackout || !newBlackoutDate}
                      style={{ background: newBlackoutDate ? '#00FF9F' : '#2A2A2D', color: newBlackoutDate ? '#0E0E0F' : '#9A9A9F', border: 'none', borderRadius: '8px', padding: '9px 14px', fontSize: '13px', fontWeight: 700, cursor: newBlackoutDate ? 'pointer' : 'default', flexShrink: 0 }}>
                      {addingBlackout ? '...' : 'Block'}
                    </button>
                  </div>
                  {blackoutError && <p style={{ fontSize: '12px', color: '#E03131', margin: 0 }}>{blackoutError}</p>}
                </div>
              </div>
            </div>

            <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Change password</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', color: '#9A9A9F', fontWeight: 500 }}>New password</label>
                <input
                  style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }}
                  type="password" placeholder="Min. 8 characters"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  minLength={8}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', color: '#9A9A9F', fontWeight: 500 }}>Confirm new password</label>
                <input
                  style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }}
                  type="password" placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  minLength={8}
                />
              </div>

              {passwordError && <p style={{ fontSize: '13px', color: '#E03131', background: '#1f0f0f', border: '1px solid #3a1a1a', borderRadius: '8px', padding: '10px 14px' }}>{passwordError}</p>}
              {passwordSaved && <p style={{ fontSize: '13px', color: '#00FF9F', background: 'rgba(0,255,159,0.06)', border: '1px solid rgba(0,255,159,0.2)', borderRadius: '8px', padding: '10px 14px' }}>Password updated successfully</p>}

              <button
                type="button"
                onClick={handlePasswordChange}
                disabled={passwordLoading || !newPassword}
                style={{ background: newPassword ? '#00FF9F' : '#2A2A2D', color: newPassword ? '#0E0E0F' : '#9A9A9F', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '15px', fontWeight: 700, cursor: newPassword ? 'pointer' : 'default' }}>
                {passwordSaved ? '✓ Password updated!' : passwordLoading ? 'Updating...' : 'Update password'}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{ background: '#00FF9F', color: '#0E0E0F', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', marginBottom: '32px' }}>
              {saved ? '✓ Saved!' : loading ? 'Saving...' : 'Save settings'}
            </button>

          </form>
        </div>
      </div>

  )
}
