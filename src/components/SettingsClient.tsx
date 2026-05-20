'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import NavBar from '@/components/NavBar'
import { generateSlots } from '@/lib/generateSlots'

const DAY_ORDER = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
const GREEN = '#00FF9F'

type Tab = 'account' | 'public_profile' | 'scheduling' | 'rates'

const TABS: { id: Tab; label: string }[] = [
  { id: 'account', label: 'Account' },
  { id: 'public_profile', label: 'Public Profile' },
  { id: 'scheduling', label: 'Scheduling' },
  { id: 'rates', label: 'My Rates' },
]

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
  calendly_url: string | null
  scheduling_mode: string | null
  venmo_handle: string | null
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
  gender_filter: string | null
  min_age: number | null
  max_age: number | null
  experience_filter: string[] | null
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

interface TrainerPackage {
  id: string
  name: string
  session_count: number
  price: number
  price_per_session: number
  description: string | null
  is_active: boolean
  is_most_popular: boolean
  is_best_value: boolean
  sort_order: number
}

export default function SettingsClient({ profile, packages: initialPackages = [] }: { profile: Profile | null; packages?: TrainerPackage[] }) {
  const supabase = createClient()
  const router = useRouter()

  // ── Tab state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>('account')
  const [tabsDirty, setTabsDirty] = useState<Record<Tab, boolean>>({
    account: false, public_profile: false, scheduling: false, rates: false,
  })

  function markDirty(tab: Tab) {
    setTabsDirty(prev => ({ ...prev, [tab]: true }))
  }
  function markClean(tab: Tab) {
    setTabsDirty(prev => ({ ...prev, [tab]: false }))
  }

  function handleTabClick(tab: Tab) {
    if (tab === activeTab) return
    const isDirty = activeTab === 'account'
      ? newPassword !== ''
      : tabsDirty[activeTab]
    if (isDirty && !confirm('You have unsaved changes. Leave anyway?')) return
    setActiveTab(tab)
  }

  // ── Rates ──────────────────────────────────────────────────────────────────
  const [individualRate, setIndividualRate] = useState(profile?.individual_rate?.toString() || '')
  const [groupRate] = useState(profile?.group_rate?.toString() || '')
  const [ratesLoading, setRatesLoading] = useState(false)
  const [ratesSaved, setRatesSaved] = useState(false)
  const [ratesError, setRatesError] = useState<string | null>(null)

  async function handleSaveRates() {
    setRatesLoading(true)
    setRatesError(null)
    const { error } = await supabase.from('profiles').update({
      individual_rate: parseFloat(individualRate) || 0,
      group_rate: parseFloat(groupRate) || 0,
    }).eq('id', profile?.id)
    setRatesLoading(false)
    if (error) { setRatesError(error.message); return }
    markClean('rates')
    setRatesSaved(true)
    setTimeout(() => setRatesSaved(false), 2000)
  }

  // ── Packages ───────────────────────────────────────────────────────────────
  const [packages, setPackages] = useState<TrainerPackage[]>(initialPackages)
  const [pkgFormOpen, setPkgFormOpen] = useState(false)
  const [editingPkgId, setEditingPkgId] = useState<string | null>(null)
  const [deletingPkgId, setDeletingPkgId] = useState<string | null>(null)
  const [pkgForm, setPkgForm] = useState({ name: '', session_count: '', price: '', description: '' })
  const [pkgFormLoading, setPkgFormLoading] = useState(false)
  const [pkgFormError, setPkgFormError] = useState<string | null>(null)

  const pkgPerSession = pkgForm.session_count && pkgForm.price
    ? (parseFloat(pkgForm.price) / parseInt(pkgForm.session_count)).toFixed(2)
    : null

  function openAddPkg() {
    setEditingPkgId(null)
    setPkgForm({ name: '', session_count: '', price: '', description: '' })
    setPkgFormError(null)
    setPkgFormOpen(true)
  }

  function openEditPkg(pkg: TrainerPackage) {
    setEditingPkgId(pkg.id)
    setPkgForm({
      name: pkg.name,
      session_count: pkg.session_count.toString(),
      price: pkg.price.toString(),
      description: pkg.description || '',
    })
    setPkgFormError(null)
    setPkgFormOpen(true)
  }

  function cancelPkgForm() {
    setPkgFormOpen(false)
    setEditingPkgId(null)
    setPkgFormError(null)
  }

  async function handleSavePkg() {
    if (!pkgForm.name.trim() || !pkgForm.session_count || !pkgForm.price) {
      setPkgFormError('Name, sessions, and price are required')
      return
    }
    setPkgFormLoading(true)
    setPkgFormError(null)
    if (editingPkgId) {
      const res = await fetch(`/api/packages/${editingPkgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: pkgForm.name,
          session_count: pkgForm.session_count,
          price: pkgForm.price,
          description: pkgForm.description || null,
        }),
      })
      const data = await res.json()
      setPkgFormLoading(false)
      if (!res.ok || data.error) { setPkgFormError(data.error || 'Error saving'); return }
      setPackages(prev => prev.map(p => p.id === editingPkgId ? data.package : p))
    } else {
      const res = await fetch('/api/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: pkgForm.name,
          session_count: pkgForm.session_count,
          price: pkgForm.price,
          description: pkgForm.description || null,
        }),
      })
      const data = await res.json()
      setPkgFormLoading(false)
      if (!res.ok || data.error) { setPkgFormError(data.error || 'Error saving'); return }
      setPackages(prev => [...prev, data.package])
    }
    cancelPkgForm()
  }

  async function handleDeletePkg(id: string) {
    const res = await fetch(`/api/packages/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setPackages(prev => prev.filter(p => p.id !== id))
      setDeletingPkgId(null)
    }
  }

  async function handleTogglePkgActive(pkg: TrainerPackage) {
    const res = await fetch(`/api/packages/${pkg.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !pkg.is_active }),
    })
    const data = await res.json()
    if (res.ok && data.package) {
      setPackages(prev => prev.map(p => p.id === pkg.id ? data.package : p))
    }
  }

  async function handleReorderPkg(id: string, direction: 'up' | 'down') {
    const res = await fetch(`/api/packages/${id}/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction }),
    })
    if (res.ok) {
      // Update local order
      setPackages(prev => {
        const arr = [...prev]
        const idx = arr.findIndex(p => p.id === id)
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1
        if (swapIdx < 0 || swapIdx >= arr.length) return arr
        const temp = arr[idx].sort_order
        arr[idx] = { ...arr[idx], sort_order: arr[swapIdx].sort_order }
        arr[swapIdx] = { ...arr[swapIdx], sort_order: temp }
        return [...arr].sort((a, b) => a.sort_order - b.sort_order)
      })
    }
  }

  // ── Password ───────────────────────────────────────────────────────────────
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

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

  // ── Public Profile ─────────────────────────────────────────────────────────
  const [username, setUsername] = useState(profile?.username || '')
  const [bio, setBio] = useState(profile?.bio || '')
  const [sport, setSport] = useState(profile?.sport || '')
  const [location, setLocation] = useState(profile?.location || '')
  const [venmoHandle, setVenmoHandle] = useState(profile?.venmo_handle || '')
  const [publicProfileEnabled, setPublicProfileEnabled] = useState(profile?.public_profile_enabled ?? false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [copiedProfileUrl, setCopiedProfileUrl] = useState(false)

  const [welcomeMessage, setWelcomeMessage] = useState(profile?.welcome_message || '')
  const [welcomeSaved, setWelcomeSaved] = useState(false)
  const [welcomeLoading, setWelcomeLoading] = useState(false)

  async function handleSavePublicProfile() {
    setProfileError(null)
    const trimmed = username.trim().toLowerCase()
    if (!trimmed) { setProfileError('Username is required'); return }
    if (!/^[a-z0-9_-]+$/.test(trimmed)) { setProfileError('Username can only contain letters, numbers, hyphens, and underscores'); return }
    setProfileSaving(true)
    const { error } = await supabase.from('profiles').update({
      username: trimmed,
      bio: bio.trim() || null,
      sport: sport.trim() || null,
      location: location.trim() || null,
      public_profile_enabled: publicProfileEnabled,
      venmo_handle: venmoHandle.trim().replace(/^@/, '') || null,
    }).eq('id', profile?.id)
    setProfileSaving(false)
    if (error) {
      setProfileError(error.message.includes('unique') || error.code === '23505' ? 'That username is already taken' : error.message)
      return
    }
    markClean('public_profile')
    setProfileSaved(true)
    setTimeout(() => setProfileSaved(false), 2500)
  }

  async function handleSaveWelcome() {
    setWelcomeLoading(true)
    await supabase.from('profiles').update({ welcome_message: welcomeMessage }).eq('id', profile?.id)
    setWelcomeLoading(false)
    markClean('public_profile')
    setWelcomeSaved(true)
    setTimeout(() => setWelcomeSaved(false), 2000)
  }

  const profileUrl = username.trim() ? `https://skillpathiq.com/t/${username.trim().toLowerCase()}` : null

  // ── Scheduling ─────────────────────────────────────────────────────────────
  const [schedulingMode, setSchedulingMode] = useState<'skillpathiq' | 'calendly' | 'both'>(
    (profile?.scheduling_mode as 'skillpathiq' | 'calendly' | 'both') || 'skillpathiq'
  )
  const [calendlyUrl, setCalendlyUrl] = useState(profile?.calendly_url || '')
  const [savedCalendlyUrl, setSavedCalendlyUrl] = useState(profile?.calendly_url || '')
  const [calendlyError, setCalendlyError] = useState<string | null>(null)
  const [calendlySaving, setCalendlySaving] = useState(false)
  const [calendlySaved, setCalendlySaved] = useState(false)
  const [copiedIntakeUrl, setCopiedIntakeUrl] = useState(false)

  async function handleSaveScheduling() {
    setCalendlyError(null)
    if (schedulingMode !== 'skillpathiq' && !calendlyUrl.trim().startsWith('https://calendly.com/')) {
      setCalendlyError('URL must start with https://calendly.com/')
      return
    }
    setCalendlySaving(true)
    const { error } = await supabase.from('profiles').update({
      scheduling_mode: schedulingMode,
      calendly_url: schedulingMode !== 'skillpathiq' ? calendlyUrl.trim() : null,
    }).eq('id', profile?.id)
    setCalendlySaving(false)
    if (error) { setCalendlyError(error.message); return }
    setSavedCalendlyUrl(schedulingMode !== 'skillpathiq' ? calendlyUrl.trim() : '')
    markClean('scheduling')
    setCalendlySaved(true)
    setTimeout(() => setCalendlySaved(false), 2500)
  }

  // ── Availability ───────────────────────────────────────────────────────────
  const [durations, setDurations] = useState<SessionDuration[]>([])
  const [windows, setWindows] = useState<AvailabilityWindow[]>([])
  const [blackouts, setBlackouts] = useState<BlackoutDate[]>([])
  const [newDurationLabel, setNewDurationLabel] = useState('')
  const [addingDuration, setAddingDuration] = useState(false)
  const [durationError, setDurationError] = useState<string | null>(null)
  const [windowFormOpen, setWindowFormOpen] = useState(false)
  const [editingWindowId, setEditingWindowId] = useState<string | null>(null)
  const [windowForm, setWindowForm] = useState({
    day_of_week: 'monday', start_time: '', end_time: '',
    session_type: 'both', display_label: '', duration_id: '',
    buffer_minutes: '0', max_capacity: '',
    gender_filter: '', min_age: '', max_age: '',
    experience_filter: [] as string[],
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
    setWindowForm({ day_of_week: 'monday', start_time: '', end_time: '', session_type: 'both', display_label: '', duration_id: durations[0]?.id || '', buffer_minutes: '0', max_capacity: '', gender_filter: '', min_age: '', max_age: '', experience_filter: [] })
    setWindowError(null)
    setWindowFormOpen(true)
  }

  function openEditWindow(w: AvailabilityWindow) {
    setEditingWindowId(w.id)
    const matchingDuration = durations.find(d => d.duration_minutes === w.duration_minutes)
    setWindowForm({
      day_of_week: w.day_of_week, start_time: w.start_time.slice(0, 5), end_time: w.end_time.slice(0, 5),
      session_type: w.session_type, display_label: w.display_label || '',
      duration_id: matchingDuration?.id || durations[0]?.id || '',
      buffer_minutes: w.buffer_minutes.toString(), max_capacity: w.max_capacity?.toString() || '',
      gender_filter: w.gender_filter || '', min_age: w.min_age?.toString() || '', max_age: w.max_age?.toString() || '',
      experience_filter: w.experience_filter || [],
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
    const maxCap = (windowForm.session_type !== 'individual' && windowForm.max_capacity) ? parseInt(windowForm.max_capacity) || null : null
    const minAgeVal = windowForm.min_age ? parseInt(windowForm.min_age) : null
    const maxAgeVal = windowForm.max_age ? parseInt(windowForm.max_age) : null
    if (minAgeVal !== null && maxAgeVal !== null && minAgeVal >= maxAgeVal) {
      setWindowError('Min age must be less than max age')
      setSavingWindow(false)
      return
    }
    setSavingWindow(true)
    setWindowError(null)
    const payload = {
      day_of_week: windowForm.day_of_week, start_time: windowForm.start_time, end_time: windowForm.end_time,
      session_type: windowForm.session_type, display_label: windowForm.display_label.trim() || null,
      duration_minutes: selectedDuration.duration_minutes, buffer_minutes: bufferMins, max_capacity: maxCap,
      gender_filter: windowForm.gender_filter || null,
      min_age: minAgeVal,
      max_age: maxAgeVal,
      experience_filter: windowForm.experience_filter.length > 0 ? windowForm.experience_filter : null,
    }
    if (editingWindowId) {
      const { data, error } = await supabase.from('trainer_availability_windows').update(payload).eq('id', editingWindowId).select().single()
      setSavingWindow(false)
      if (error) { setWindowError(error.message); return }
      setWindows(prev => prev.map(w => w.id === editingWindowId ? data : w))
    } else {
      const { data, error } = await supabase.from('trainer_availability_windows').insert({ trainer_id: profile!.id, ...payload, sort_order: windows.length }).select().single()
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
      trainer_id: profile!.id, blackout_date: newBlackoutDate, note: newBlackoutNote.trim() || null,
    }).select().single()
    setAddingBlackout(false)
    if (error) { setBlackoutError(error.code === '23505' ? 'That date is already blocked' : error.message); return }
    setBlackouts(prev => [...prev, data].sort((a, b) => a.blackout_date.localeCompare(b.blackout_date)))
    setNewBlackoutDate('')
    setNewBlackoutNote('')
  }

  async function handleDeleteBlackout(id: string) {
    await supabase.from('trainer_blackout_dates').delete().eq('id', id)
    setBlackouts(prev => prev.filter(b => b.id !== id))
  }

  // ── Shared input styles ────────────────────────────────────────────────────
  const fieldInput = { background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }
  const card = { background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column' as const, gap: '16px' }
  const sectionLabel = { fontSize: '13px', fontWeight: 600 as const, color: '#ffffff', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }
  const saveBtn = (active: boolean) => ({
    background: active ? GREEN : '#2A2A2D', color: active ? '#0E0E0F' : '#9A9A9F',
    border: 'none', borderRadius: '8px', padding: '10px', fontSize: '14px',
    fontWeight: 700 as const, cursor: active ? 'pointer' as const : 'default' as const,
  })

  return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', fontFamily: 'sans-serif', overflowX: 'hidden', maxWidth: '100vw', width: '100%' }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { overflow-x: hidden; max-width: 100vw; background: #0E0E0F; }
        .tab-strip::-webkit-scrollbar { display: none; }
      `}</style>

      <NavBar trainerName={profile?.full_name} />

      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '20px 16px 48px', width: '100%' }}>

        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#ffffff', fontFamily: '"Exo 2", sans-serif', marginBottom: '24px' }}>Settings</h1>

        {/* TAB STRIP */}
        <div
          className="tab-strip"
          style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid #2A2A2D', marginBottom: '28px', scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              style={{
                flexShrink: 0,
                padding: '10px 16px',
                background: 'none',
                border: 'none',
                borderBottom: `2px solid ${activeTab === tab.id ? GREEN : 'transparent'}`,
                marginBottom: '-1px',
                fontSize: '14px',
                fontWeight: 600,
                color: activeTab === tab.id ? '#ffffff' : '#9A9A9F',
                cursor: 'pointer',
                transition: 'color 0.15s',
                whiteSpace: 'nowrap' as const,
              }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── ACCOUNT TAB ──────────────────────────────────────────────────── */}
        {activeTab === 'account' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            <div style={card}>
              <div style={sectionLabel}>Account</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #2A2A2D' }}>
                <span style={{ fontSize: '13px', color: '#9A9A9F' }}>Name</span>
                <span style={{ fontSize: '13px', color: '#ffffff' }}>{profile?.full_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                <span style={{ fontSize: '13px', color: '#9A9A9F' }}>Email</span>
                <span style={{ fontSize: '13px', color: '#ffffff' }}>{profile?.email}</span>
              </div>
            </div>

            <div style={card}>
              <div style={sectionLabel}>Change password</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', color: '#9A9A9F', fontWeight: 500 }}>New password</label>
                <input
                  style={fieldInput} type="password" placeholder="Min. 8 characters" minLength={8}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', color: '#9A9A9F', fontWeight: 500 }}>Confirm new password</label>
                <input
                  style={fieldInput} type="password" placeholder="Repeat new password" minLength={8}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                />
              </div>
              {passwordError && <p style={{ fontSize: '13px', color: '#E03131', background: '#1f0f0f', border: '1px solid #3a1a1a', borderRadius: '8px', padding: '10px 14px' }}>{passwordError}</p>}
              {passwordSaved && <p style={{ fontSize: '13px', color: GREEN, background: 'rgba(0,255,159,0.06)', border: '1px solid rgba(0,255,159,0.2)', borderRadius: '8px', padding: '10px 14px' }}>Password updated successfully</p>}
              <button
                type="button"
                onClick={handlePasswordChange}
                disabled={passwordLoading || !newPassword}
                style={saveBtn(!!newPassword)}>
                {passwordSaved ? '✓ Updated!' : passwordLoading ? 'Updating...' : 'Update password'}
              </button>
            </div>

          </div>
        )}

        {/* ── PUBLIC PROFILE TAB ───────────────────────────────────────────── */}
        {activeTab === 'public_profile' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            <div style={card}>
              <div>
                <div style={sectionLabel}>Public profile</div>
                <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '4px' }}>Let parents find and book you at your personal link</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', color: '#9A9A9F', fontWeight: 500 }}>Username <span style={{ color: '#E03131' }}>*</span></label>
                <div style={{ display: 'flex', alignItems: 'center', background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', overflow: 'hidden' }}>
                  <span style={{ padding: '11px 12px', fontSize: '13px', color: '#555558', borderRight: '1px solid #2A2A2D', whiteSpace: 'nowrap' as const }}>skillpathiq.com/t/</span>
                  <input
                    style={{ flex: 1, background: 'transparent', border: 'none', padding: '11px 12px', fontSize: '14px', color: '#ffffff', outline: 'none', minWidth: 0 }}
                    type="text" placeholder="yourname"
                    value={username}
                    onChange={e => { setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '')); markDirty('public_profile') }}
                  />
                </div>
                <span style={{ fontSize: '12px', color: '#9A9A9F' }}>Letters, numbers, hyphens, underscores only</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', color: '#9A9A9F', fontWeight: 500 }}>Bio <span style={{ fontSize: '11px', fontWeight: 400, color: '#555558' }}>(optional)</span></label>
                <textarea
                  value={bio}
                  onChange={e => { setBio(e.target.value); markDirty('public_profile') }}
                  placeholder="Tell parents about your experience, coaching style, or specialties..."
                  rows={3}
                  style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%', resize: 'vertical' as const, fontFamily: 'sans-serif', lineHeight: 1.6 }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', color: '#9A9A9F', fontWeight: 500 }}>Sport <span style={{ fontSize: '11px', fontWeight: 400, color: '#555558' }}>(optional)</span></label>
                  <input style={fieldInput} type="text" placeholder="Basketball" value={sport} onChange={e => { setSport(e.target.value); markDirty('public_profile') }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', color: '#9A9A9F', fontWeight: 500 }}>Location <span style={{ fontSize: '11px', fontWeight: 400, color: '#555558' }}>(optional)</span></label>
                  <input style={fieldInput} type="text" placeholder="Chicago, IL" value={location} onChange={e => { setLocation(e.target.value); markDirty('public_profile') }} />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#0E0E0F', borderRadius: '8px', border: '1px solid #2A2A2D' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>Enable public profile</div>
                  <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>Parents can find and book you via your link</div>
                </div>
                <button
                  type="button"
                  onClick={() => { setPublicProfileEnabled(p => !p); markDirty('public_profile') }}
                  style={{ width: '44px', height: '24px', borderRadius: '12px', border: 'none', background: publicProfileEnabled ? GREEN : '#2A2A2D', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
                  <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#ffffff', position: 'absolute', top: '3px', left: publicProfileEnabled ? '23px' : '3px', transition: 'left 0.2s' }} />
                </button>
              </div>

              {profileUrl && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '10px 14px' }}>
                  <span style={{ flex: 1, fontSize: '13px', color: GREEN, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{profileUrl}</span>
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard.writeText(profileUrl); setCopiedProfileUrl(true); setTimeout(() => setCopiedProfileUrl(false), 2000) }}
                    style={{ fontSize: '12px', padding: '5px 10px', borderRadius: '6px', border: '1px solid #2A2A2D', background: 'transparent', color: copiedProfileUrl ? GREEN : '#9A9A9F', cursor: 'pointer', flexShrink: 0, fontWeight: 600 }}>
                    {copiedProfileUrl ? '✓ Copied' : 'Copy'}
                  </button>
                  <a href={profileUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', padding: '5px 10px', borderRadius: '6px', border: '1px solid #2A2A2D', background: 'transparent', color: '#9A9A9F', cursor: 'pointer', flexShrink: 0, fontWeight: 600, textDecoration: 'none' }}>Preview</a>
                </div>
              )}

              {profileError && <p style={{ fontSize: '13px', color: '#E03131', background: '#1f0f0f', border: '1px solid #3a1a1a', borderRadius: '8px', padding: '10px 14px', margin: 0 }}>{profileError}</p>}

              <button type="button" onClick={handleSavePublicProfile} disabled={profileSaving} style={saveBtn(true)}>
                {profileSaved ? '✓ Saved!' : profileSaving ? 'Saving...' : 'Save public profile'}
              </button>
            </div>

            <div style={card}>
              <div style={sectionLabel}>Venmo</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', color: '#9A9A9F', fontWeight: 500 }}>Venmo handle</label>
                <div style={{ display: 'flex', alignItems: 'center', background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', overflow: 'hidden' }}>
                  <span style={{ padding: '11px 10px 11px 14px', fontSize: '14px', color: '#9A9A9F', flexShrink: 0 }}>@</span>
                  <input
                    style={{ flex: 1, background: 'transparent', border: 'none', padding: '11px 14px 11px 0', fontSize: '14px', color: '#ffffff', outline: 'none' }}
                    type="text"
                    placeholder="yourvenmoname"
                    value={venmoHandle}
                    onChange={e => { setVenmoHandle(e.target.value.replace(/^@/, '')); markDirty('public_profile') }}
                  />
                </div>
                <div style={{ fontSize: '12px', color: '#9A9A9F' }}>Parents will see a Pay via Venmo link on your profile. Enter without the @ symbol.</div>
              </div>
            </div>

            <div style={card}>
              <div>
                <div style={sectionLabel}>Welcome email</div>
                <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '4px' }}>Sent automatically to parents when you add a new player. Leave blank to skip.</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', color: '#9A9A9F', fontWeight: 500 }}>Message</label>
                <textarea
                  value={welcomeMessage}
                  onChange={e => { setWelcomeMessage(e.target.value); markDirty('public_profile') }}
                  placeholder={`Hi! I'm excited to start working with your player. Through SkillPathIQ you'll be able to track their progress, see their drill assignments, and stay updated after every session. I'll send updates after each session — looking forward to getting started!`}
                  rows={6}
                  style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%', resize: 'vertical' as const, fontFamily: 'sans-serif', lineHeight: 1.6 }}
                />
                <div style={{ fontSize: '12px', color: '#9A9A9F' }}>The player&apos;s profile link will be included automatically.</div>
              </div>
              <button type="button" onClick={handleSaveWelcome} disabled={welcomeLoading} style={saveBtn(true)}>
                {welcomeSaved ? '✓ Saved!' : welcomeLoading ? 'Saving...' : 'Save welcome message'}
              </button>
            </div>

          </div>
        )}

        {/* ── SCHEDULING TAB ───────────────────────────────────────────────── */}
        {activeTab === 'scheduling' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Scheduling mode + Calendly */}
            <div style={card}>
              <div>
                <div style={sectionLabel}>Scheduling</div>
                <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '4px' }}>Choose how parents book sessions with you</div>
              </div>

              <div>
                <label style={{ fontSize: '13px', color: '#9A9A9F', fontWeight: 500, display: 'block' as const, marginBottom: '8px' }}>Booking method</label>
                <div style={{ display: 'flex', background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', overflow: 'hidden' }}>
                  {([
                    { value: 'skillpathiq', label: 'SkillPathIQ' },
                    { value: 'calendly', label: 'Calendly' },
                    { value: 'both', label: 'Both' },
                  ] as const).map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => { setSchedulingMode(opt.value); setCalendlyError(null); markDirty('scheduling') }}
                      style={{ flex: 1, padding: '9px 8px', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: schedulingMode === opt.value ? GREEN : 'transparent', color: schedulingMode === opt.value ? '#0E0E0F' : '#9A9A9F', transition: 'all 0.15s' }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {schedulingMode !== 'skillpathiq' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', color: '#9A9A9F', fontWeight: 500 }}>Your Calendly link <span style={{ color: '#E03131' }}>*</span></label>
                  <input
                    type="url" placeholder="https://calendly.com/yourname"
                    value={calendlyUrl}
                    onChange={e => { setCalendlyUrl(e.target.value); markDirty('scheduling') }}
                    style={fieldInput}
                  />
                  {calendlyError && <p style={{ fontSize: '12px', color: '#E03131', margin: 0 }}>{calendlyError}</p>}
                </div>
              )}

              {schedulingMode !== 'skillpathiq' && savedCalendlyUrl.startsWith('https://calendly.com/') && username.trim() && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '13px', color: '#9A9A9F', fontWeight: 500 }}>Post-booking intake link</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '10px 14px' }}>
                      <span style={{ flex: 1, fontSize: '13px', color: GREEN, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                        {`https://skillpathiq.com/intake/${username.trim().toLowerCase()}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => { navigator.clipboard.writeText(`https://skillpathiq.com/intake/${username.trim().toLowerCase()}`); setCopiedIntakeUrl(true); setTimeout(() => setCopiedIntakeUrl(false), 2000) }}
                        style={{ fontSize: '12px', padding: '5px 10px', borderRadius: '6px', border: '1px solid #2A2A2D', background: 'transparent', color: copiedIntakeUrl ? GREEN : '#9A9A9F', cursor: 'pointer', flexShrink: 0, fontWeight: 600 }}>
                        {copiedIntakeUrl ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>
                    <p style={{ fontSize: '12px', color: '#555558', margin: 0 }}>
                      Paste this link into Calendly as your confirmation redirect URL. After a parent books via Calendly, they&apos;ll be sent here to complete their player profile.
                    </p>
                  </div>
                  <div style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '14px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#9A9A9F', marginBottom: '10px' }}>How to set this up in Calendly:</div>
                    <ol style={{ paddingLeft: '16px', margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {['Open your Calendly event type', 'Go to Confirmation Page settings', "Select 'Redirect to an external site'", 'Paste the link above'].map((step, i) => (
                        <li key={i} style={{ fontSize: '12px', color: '#555558' }}>{step}</li>
                      ))}
                    </ol>
                  </div>
                </>
              )}

              <button type="button" onClick={handleSaveScheduling} disabled={calendlySaving} style={saveBtn(true)}>
                {calendlySaved ? '✓ Saved!' : calendlySaving ? 'Saving...' : 'Save scheduling'}
              </button>
            </div>

            {/* Availability */}
            <div style={{ ...card, gap: '20px' }}>
              <div>
                <div style={sectionLabel}>Availability</div>
                <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '4px' }}>Shown on your public profile to help parents choose a time</div>
              </div>

              {/* Session Durations */}
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
                      type="text" placeholder='e.g. "60 min" or "1 hour"'
                      value={newDurationLabel}
                      onChange={e => setNewDurationLabel(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddDuration())}
                      style={{ flex: 1, background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '9px 12px', fontSize: '14px', color: '#ffffff', outline: 'none' }}
                    />
                    <button type="button" onClick={handleAddDuration} disabled={addingDuration || !newDurationLabel.trim()} style={{ background: newDurationLabel.trim() ? GREEN : '#2A2A2D', color: newDurationLabel.trim() ? '#0E0E0F' : '#9A9A9F', border: 'none', borderRadius: '8px', padding: '9px 16px', fontSize: '13px', fontWeight: 700, cursor: newDurationLabel.trim() ? 'pointer' : 'default' }}>
                      {addingDuration ? '...' : 'Add'}
                    </button>
                  </div>
                )}
                {durationError && <p style={{ fontSize: '12px', color: '#E03131', margin: 0 }}>{durationError}</p>}
              </div>

              {/* Availability Windows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Availability Windows</div>
                  {!windowFormOpen && (
                    <button type="button" onClick={openAddWindow} style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '6px', border: '1px solid rgba(0,255,159,0.3)', background: 'transparent', color: GREEN, cursor: 'pointer', fontWeight: 600 }}>+ Add</button>
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
                          <span style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '99px', fontWeight: 600, background: w.session_type === 'individual' ? 'rgba(74,158,255,0.15)' : w.session_type === 'group' ? 'rgba(245,166,35,0.15)' : 'rgba(0,255,159,0.12)', color: w.session_type === 'individual' ? '#4A9EFF' : w.session_type === 'group' ? '#F5A623' : GREEN }}>
                            {w.session_type === 'individual' ? 'Individual' : w.session_type === 'group' ? 'Group' : 'Both'}
                          </span>
                          {w.display_label && <span style={{ fontSize: '12px', color: '#9A9A9F', fontStyle: 'italic' }}>{w.display_label}</span>}
                        </div>
                        {(() => {
                          const parts: string[] = []
                          if (w.gender_filter) parts.push(w.gender_filter === 'boys' ? 'Boys' : w.gender_filter === 'girls' ? 'Girls' : 'Mixed')
                          if (w.min_age != null && w.max_age != null) parts.push(`Ages ${w.min_age}–${w.max_age}`)
                          else if (w.min_age != null) parts.push(`${w.min_age}+`)
                          else if (w.max_age != null) parts.push(`U${w.max_age + 1}`)
                          if (w.experience_filter && w.experience_filter.length > 0) {
                            parts.push(w.experience_filter.map(e => e === 'beginner' ? 'Beginner' : e === 'rec_league' ? 'Rec League' : 'Bantam/Club').join(', '))
                          }
                          return parts.length > 0 ? <div style={{ fontSize: '11px', color: '#555558', marginTop: '3px' }}>{parts.join(' · ')}</div> : null
                        })()}
                        {slots.length > 0 && <div style={{ fontSize: '11px', color: '#555558', marginTop: '4px' }}>{slotPreview}{extra}</div>}
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
                        <select value={windowForm.day_of_week} onChange={e => setWindowForm(prev => ({ ...prev, day_of_week: e.target.value }))} style={{ width: '100%', background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '7px', padding: '9px 10px', fontSize: '13px', color: '#ffffff', outline: 'none' }}>
                          {['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', color: '#9A9A9F', display: 'block', marginBottom: '5px' }}>Session type</label>
                        <select value={windowForm.session_type} onChange={e => setWindowForm(prev => ({ ...prev, session_type: e.target.value }))} style={{ width: '100%', background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '7px', padding: '9px 10px', fontSize: '13px', color: '#ffffff', outline: 'none' }}>
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
                          <select value={windowForm.duration_id} onChange={e => setWindowForm(prev => ({ ...prev, duration_id: e.target.value }))} style={{ width: '100%', background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '7px', padding: '9px 10px', fontSize: '13px', color: '#ffffff', outline: 'none' }}>
                            {durations.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                          </select>
                        )}
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', color: '#9A9A9F', display: 'block', marginBottom: '5px' }}>Buffer between slots</label>
                        <select value={windowForm.buffer_minutes} onChange={e => setWindowForm(prev => ({ ...prev, buffer_minutes: e.target.value }))} style={{ width: '100%', background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '7px', padding: '9px 10px', fontSize: '13px', color: '#ffffff', outline: 'none' }}>
                          <option value="0">None</option>
                          <option value="15">15 min</option>
                          <option value="30">30 min</option>
                        </select>
                      </div>
                    </div>
                    {windowForm.session_type !== 'individual' && (
                      <div>
                        <label style={{ fontSize: '12px', color: '#9A9A9F', display: 'block', marginBottom: '5px' }}>Max group capacity <span style={{ color: '#555558', fontWeight: 400 }}>(optional)</span></label>
                        <input type="number" min="1" placeholder="e.g. 8" value={windowForm.max_capacity} onChange={e => setWindowForm(prev => ({ ...prev, max_capacity: e.target.value }))} style={{ width: '100%', background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '7px', padding: '9px 10px', fontSize: '13px', color: '#ffffff', outline: 'none' }} />
                      </div>
                    )}
                    {(windowForm.session_type === 'group' || windowForm.session_type === 'both') && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px', background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '8px' }}>
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Group filters</div>
                          <div style={{ fontSize: '11px', color: '#555558' }}>Optional — restrict this slot to players that meet these criteria.</div>
                        </div>

                        {/* Gender */}
                        <div>
                          <label style={{ fontSize: '12px', color: '#9A9A9F', display: 'block', marginBottom: '5px' }}>Gender</label>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {[{ val: '', label: 'No filter' }, { val: 'boys', label: 'Boys' }, { val: 'girls', label: 'Girls' }, { val: 'mixed', label: 'Mixed' }].map(opt => (
                              <button
                                key={opt.val}
                                type="button"
                                onClick={() => setWindowForm(prev => ({ ...prev, gender_filter: opt.val }))}
                                style={{ padding: '5px 10px', borderRadius: '6px', border: `1px solid ${windowForm.gender_filter === opt.val ? 'rgba(0,255,159,0.4)' : '#2A2A2D'}`, background: windowForm.gender_filter === opt.val ? 'rgba(0,255,159,0.08)' : 'transparent', color: windowForm.gender_filter === opt.val ? '#00FF9F' : '#9A9A9F', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Age range */}
                        <div>
                          <label style={{ fontSize: '12px', color: '#9A9A9F', display: 'block', marginBottom: '5px' }}>Age range</label>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <input type="number" min="1" max="99" placeholder="Min age (e.g. 8)" value={windowForm.min_age} onChange={e => setWindowForm(prev => ({ ...prev, min_age: e.target.value }))} style={{ width: '100%', background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '7px', padding: '9px 10px', fontSize: '13px', color: '#ffffff', outline: 'none' }} />
                            <input type="number" min="1" max="99" placeholder="Max age (e.g. 12)" value={windowForm.max_age} onChange={e => setWindowForm(prev => ({ ...prev, max_age: e.target.value }))} style={{ width: '100%', background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '7px', padding: '9px 10px', fontSize: '13px', color: '#ffffff', outline: 'none' }} />
                          </div>
                        </div>

                        {/* Experience */}
                        <div>
                          <label style={{ fontSize: '12px', color: '#9A9A9F', display: 'block', marginBottom: '4px' }}>Experience level</label>
                          <div style={{ fontSize: '11px', color: '#555558', marginBottom: '6px' }}>Optional — select all that apply</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {([
                              { value: 'beginner', label: 'Beginner' },
                              { value: 'rec_league', label: 'Rec League' },
                              { value: 'bantam_club', label: 'Bantam / Club Team' },
                            ] as const).map(exp => (
                              <label key={exp.value} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={windowForm.experience_filter.includes(exp.value)}
                                  onChange={e => setWindowForm(prev => ({
                                    ...prev,
                                    experience_filter: e.target.checked
                                      ? [...prev.experience_filter, exp.value]
                                      : prev.experience_filter.filter(v => v !== exp.value)
                                  }))}
                                  style={{ accentColor: '#00FF9F', width: '14px', height: '14px' }}
                                />
                                <span style={{ fontSize: '13px', color: '#ffffff' }}>{exp.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    <div>
                      <label style={{ fontSize: '12px', color: '#9A9A9F', display: 'block', marginBottom: '5px' }}>Label <span style={{ color: '#555558', fontWeight: 400 }}>(optional)</span></label>
                      <input type="text" placeholder='e.g. "Group training only"' value={windowForm.display_label} onChange={e => setWindowForm(prev => ({ ...prev, display_label: e.target.value }))} style={{ width: '100%', background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '7px', padding: '9px 10px', fontSize: '13px', color: '#ffffff', outline: 'none' }} />
                    </div>
                    {windowError && <p style={{ fontSize: '12px', color: '#E03131', margin: 0 }}>{windowError}</p>}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="button" onClick={handleSaveWindow} disabled={savingWindow || durations.length === 0} style={{ flex: 1, background: durations.length > 0 ? GREEN : '#2A2A2D', color: durations.length > 0 ? '#0E0E0F' : '#9A9A9F', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '13px', fontWeight: 700, cursor: durations.length > 0 ? 'pointer' : 'default' }}>
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

              {/* Blackout Dates */}
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
                    <input type="date" min={today} value={newBlackoutDate} onChange={e => setNewBlackoutDate(e.target.value)} style={{ flex: 1, background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: newBlackoutDate ? '#ffffff' : '#555558', outline: 'none', colorScheme: 'dark' }} />
                    <input type="text" placeholder="Note (optional)" value={newBlackoutNote} onChange={e => setNewBlackoutNote(e.target.value)} style={{ flex: 1, background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: '#ffffff', outline: 'none' }} />
                    <button type="button" onClick={handleAddBlackout} disabled={addingBlackout || !newBlackoutDate} style={{ background: newBlackoutDate ? GREEN : '#2A2A2D', color: newBlackoutDate ? '#0E0E0F' : '#9A9A9F', border: 'none', borderRadius: '8px', padding: '9px 14px', fontSize: '13px', fontWeight: 700, cursor: newBlackoutDate ? 'pointer' : 'default', flexShrink: 0 }}>
                      {addingBlackout ? '...' : 'Block'}
                    </button>
                  </div>
                  {blackoutError && <p style={{ fontSize: '12px', color: '#E03131', margin: 0 }}>{blackoutError}</p>}
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ── MY RATES TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'rates' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            <div style={card}>
              <div style={sectionLabel}>Session rates</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', color: '#9A9A9F', fontWeight: 500 }}>Individual session rate</label>
                <div style={{ display: 'flex', alignItems: 'center', background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', overflow: 'hidden' }}>
                  <span style={{ padding: '11px 14px', fontSize: '14px', color: '#9A9A9F', borderRight: '1px solid #2A2A2D' }}>$</span>
                  <input
                    style={{ flex: 1, background: 'transparent', border: 'none', padding: '11px 14px', fontSize: '14px', color: '#ffffff', outline: 'none' }}
                    type="number" min="0" step="0.01" placeholder="0.00"
                    value={individualRate}
                    onChange={e => { setIndividualRate(e.target.value); markDirty('rates') }}
                  />
                  <span style={{ padding: '11px 14px', fontSize: '13px', color: '#9A9A9F' }}>per session</span>
                </div>
                <span style={{ fontSize: '12px', color: '#9A9A9F' }}>Applied to 1-on-1 training sessions</span>
              </div>

              {ratesError && <p style={{ fontSize: '13px', color: '#E03131', background: '#1f0f0f', border: '1px solid #3a1a1a', borderRadius: '8px', padding: '10px 14px' }}>{ratesError}</p>}

              <button type="button" onClick={handleSaveRates} disabled={ratesLoading} style={saveBtn(true)}>
                {ratesSaved ? '✓ Saved!' : ratesLoading ? 'Saving...' : 'Save rates'}
              </button>
            </div>

            {/* GROUP TRAINING PACKAGES */}
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={sectionLabel}>Group Training Packages</div>
                {!pkgFormOpen && (
                  <button type="button" onClick={openAddPkg} style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '6px', border: `1px solid rgba(0,255,159,0.3)`, background: 'transparent', color: GREEN, cursor: 'pointer', fontWeight: 600 }}>+ Add Package</button>
                )}
              </div>

              {packages.length === 0 && !pkgFormOpen && (
                <div style={{ fontSize: '13px', color: '#555558', textAlign: 'center', padding: '16px 0' }}>No packages yet. Add one to display on your public profile.</div>
              )}

              {packages.map((pkg, idx) => (
                <div key={pkg.id}>
                  {editingPkgId === pkg.id && pkgFormOpen ? null : (
                    <div style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '10px', padding: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '14px', fontWeight: 600, color: pkg.is_active ? '#ffffff' : '#555558' }}>{pkg.name}</span>
                            {pkg.is_most_popular && <span style={{ fontSize: '10px', fontWeight: 700, color: '#F5A623', background: 'rgba(245,166,35,0.15)', padding: '2px 7px', borderRadius: '99px' }}>POPULAR</span>}
                            {pkg.is_best_value && <span style={{ fontSize: '10px', fontWeight: 700, color: GREEN, background: 'rgba(0,255,159,0.15)', padding: '2px 7px', borderRadius: '99px' }}>BEST VALUE</span>}
                            {!pkg.is_active && <span style={{ fontSize: '10px', fontWeight: 700, color: '#555558', background: 'rgba(255,255,255,0.05)', padding: '2px 7px', borderRadius: '99px' }}>INACTIVE</span>}
                          </div>
                          <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '3px' }}>
                            {pkg.session_count} session{pkg.session_count !== 1 ? 's' : ''} · ${Number(pkg.price).toFixed(2)}
                            {pkg.session_count > 1 && <span style={{ color: '#555558' }}> · ${Number(pkg.price_per_session).toFixed(2)}/session</span>}
                          </div>
                          {pkg.description && <div style={{ fontSize: '12px', color: '#555558', marginTop: '4px', lineHeight: 1.4 }}>{pkg.description}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                          <button type="button" onClick={() => handleReorderPkg(pkg.id, 'up')} disabled={idx === 0} style={{ width: '24px', height: '24px', background: 'none', border: '1px solid #2A2A2D', borderRadius: '4px', color: idx === 0 ? '#333336' : '#9A9A9F', cursor: idx === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', flexShrink: 0 }}>↑</button>
                          <button type="button" onClick={() => handleReorderPkg(pkg.id, 'down')} disabled={idx === packages.length - 1} style={{ width: '24px', height: '24px', background: 'none', border: '1px solid #2A2A2D', borderRadius: '4px', color: idx === packages.length - 1 ? '#333336' : '#9A9A9F', cursor: idx === packages.length - 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', flexShrink: 0 }}>↓</button>
                          {/* Active toggle */}
                          <button type="button" onClick={() => handleTogglePkgActive(pkg)} style={{ width: '36px', height: '20px', borderRadius: '10px', border: 'none', background: pkg.is_active ? GREEN : '#2A2A2D', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
                            <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#ffffff', position: 'absolute', top: '3px', left: pkg.is_active ? '19px' : '3px', transition: 'left 0.2s' }} />
                          </button>
                          <button type="button" onClick={() => openEditPkg(pkg)} style={{ fontSize: '11px', padding: '4px 9px', borderRadius: '6px', border: '1px solid #2A2A2D', background: 'transparent', color: '#9A9A9F', cursor: 'pointer' }}>Edit</button>
                          <button type="button" onClick={() => setDeletingPkgId(deletingPkgId === pkg.id ? null : pkg.id)} style={{ fontSize: '11px', padding: '4px 9px', borderRadius: '6px', border: '1px solid rgba(224,49,49,0.3)', background: 'transparent', color: '#E03131', cursor: 'pointer' }}>Delete</button>
                        </div>
                      </div>
                      {deletingPkgId === pkg.id && (
                        <div style={{ marginTop: '10px', padding: '10px 12px', background: 'rgba(224,49,49,0.06)', border: '1px solid rgba(224,49,49,0.2)', borderRadius: '8px' }}>
                          <div style={{ fontSize: '12px', color: '#E03131', marginBottom: '8px' }}>Delete {pkg.name}? This won&apos;t affect packages already purchased.</div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button type="button" onClick={() => handleDeletePkg(pkg.id)} style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '6px', border: 'none', background: '#E03131', color: '#ffffff', cursor: 'pointer', fontWeight: 600 }}>Delete</button>
                            <button type="button" onClick={() => setDeletingPkgId(null)} style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '6px', border: '1px solid #2A2A2D', background: 'transparent', color: '#9A9A9F', cursor: 'pointer' }}>Cancel</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {pkgFormOpen && (
                <div style={{ background: '#0E0E0F', border: '1px solid rgba(0,255,159,0.25)', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>{editingPkgId ? 'Edit package' : 'Add package'}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', color: '#9A9A9F' }}>Package name <span style={{ color: '#E03131' }}>*</span></label>
                    <input
                      type="text" placeholder="e.g. Standard — 4 Sessions"
                      value={pkgForm.name}
                      onChange={e => setPkgForm(prev => ({ ...prev, name: e.target.value }))}
                      style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '7px', padding: '9px 12px', fontSize: '13px', color: '#ffffff', outline: 'none', width: '100%' }}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '12px', color: '#9A9A9F' }}>Sessions <span style={{ color: '#E03131' }}>*</span></label>
                      <input
                        type="number" min="1" placeholder="4"
                        value={pkgForm.session_count}
                        onChange={e => setPkgForm(prev => ({ ...prev, session_count: e.target.value }))}
                        style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '7px', padding: '9px 12px', fontSize: '13px', color: '#ffffff', outline: 'none', width: '100%' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '12px', color: '#9A9A9F' }}>Total price ($) <span style={{ color: '#E03131' }}>*</span></label>
                      <input
                        type="number" min="0" step="0.01" placeholder="140.00"
                        value={pkgForm.price}
                        onChange={e => setPkgForm(prev => ({ ...prev, price: e.target.value }))}
                        style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '7px', padding: '9px 12px', fontSize: '13px', color: '#ffffff', outline: 'none', width: '100%' }}
                      />
                    </div>
                  </div>
                  {pkgPerSession && (
                    <div style={{ fontSize: '12px', color: '#9A9A9F' }}>${pkgPerSession} per session</div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', color: '#9A9A9F' }}>Description <span style={{ color: '#555558', fontWeight: 400 }}>(optional)</span></label>
                    <textarea
                      placeholder="Brief description shown to parents..."
                      value={pkgForm.description}
                      onChange={e => setPkgForm(prev => ({ ...prev, description: e.target.value }))}
                      rows={2}
                      style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '7px', padding: '9px 12px', fontSize: '13px', color: '#ffffff', outline: 'none', width: '100%', resize: 'vertical' as const, fontFamily: 'sans-serif' }}
                    />
                  </div>
                  {pkgFormError && <p style={{ fontSize: '12px', color: '#E03131', margin: 0 }}>{pkgFormError}</p>}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" onClick={handleSavePkg} disabled={pkgFormLoading} style={{ flex: 1, background: GREEN, color: '#0E0E0F', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                      {pkgFormLoading ? 'Saving...' : editingPkgId ? 'Save changes' : 'Add package'}
                    </button>
                    <button type="button" onClick={cancelPkgForm} style={{ flex: 1, background: 'transparent', color: '#9A9A9F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '10px', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </div>
  )
}
