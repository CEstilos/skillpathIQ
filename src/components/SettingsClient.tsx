'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'


interface Profile {
  id: string
  full_name: string
  email: string
  individual_rate: number | null
  group_rate: number | null
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


  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    async function handlePasswordChange() {
      setPasswordError(null)
      if (newPassword.length < 8) {
        setPasswordError('Password must be at least 8 characters')
        return
      }
      if (newPassword !== confirmPassword) {
        setPasswordError('Passwords do not match')
        return
      }
      setPasswordLoading(true)
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) {
        setPasswordError(error.message)
        setPasswordLoading(false)
        return
      }
      setPasswordSaved(true)
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordSaved(false), 3000)
      setPasswordLoading(false)
    }

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

  return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', fontFamily: 'sans-serif' }}>
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', height: '56px', borderBottom: '1px solid #2A2A2D', background: '#0E0E0F' }}>
        <span style={{ fontFamily: 'monospace', fontSize: '18px', fontWeight: 700, color: '#ffffff', letterSpacing: '2px' }}>
          SkillPath<span style={{ color: '#00FF9F' }}>IQ</span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
  <button onClick={() => router.push('/dashboard')} style={{ fontSize: '15px', color: '#9A9A9F', background: 'none', border: 'none', borderBottom: '2px solid transparent', paddingBottom: '4px', cursor: 'pointer' }}>Training Hub</button>
  <button onClick={() => router.push('/dashboard/business')} style={{ fontSize: '15px', color: '#9A9A9F', background: 'none', border: 'none', borderBottom: '2px solid transparent', paddingBottom: '4px', cursor: 'pointer' }}>My Numbers</button>
  <button style={{ fontSize: '13px', color: '#ffffff', background: 'none', border: 'none', borderBottom: '2px solid #00FF9F', paddingBottom: '4px', cursor: 'pointer', fontWeight: 600 }}>Settings</button>
</div>
      </nav>

      <div style={{ maxWidth: '480px', margin: '48px auto', padding: '0 16px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>Settings</h1>
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
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={individualRate}
                  onChange={e => setIndividualRate(e.target.value)}
                />
                <span style={{ padding: '11px 14px', fontSize: '13px', color: '#9A9A9F' }}>per session</span>
              </div>
              <span style={{ fontSize: '12px', color: '#9A9A9F' }}>Applied to 1-on-1 training sessions</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', color: '#9A9A9F', fontWeight: 500 }}>Group session rate</label>
              <div style={{ display: 'flex', alignItems: 'center', background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', overflow: 'hidden' }}>
                <span style={{ padding: '11px 14px', fontSize: '14px', color: '#9A9A9F', borderRight: '1px solid #2A2A2D' }}>$</span>
                <input
                  style={{ flex: 1, background: 'transparent', border: 'none', padding: '11px 14px', fontSize: '14px', color: '#ffffff', outline: 'none' }}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={groupRate}
                  onChange={e => setGroupRate(e.target.value)}
                />
                <span style={{ padding: '11px 14px', fontSize: '13px', color: '#9A9A9F' }}>per session</span>
              </div>
              <span style={{ fontSize: '12px', color: '#9A9A9F' }}>Flat rate applied to group training sessions</span>
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
  <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Change password</div>

  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
    <label style={{ fontSize: '13px', color: '#9A9A9F', fontWeight: 500 }}>New password</label>
    <input
      style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }}
      type="password"
      placeholder="Min. 8 characters"
      value={newPassword}
      onChange={e => setNewPassword(e.target.value)}
      minLength={8}
    />
  </div>

  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
    <label style={{ fontSize: '13px', color: '#9A9A9F', fontWeight: 500 }}>Confirm new password</label>
    <input
      style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }}
      type="password"
      placeholder="Repeat new password"
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
            style={{ background: '#00FF9F', color: '#0E0E0F', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '15px', fontWeight: 700, cursor: 'pointer' }}>
            {saved ? '✓ Saved!' : loading ? 'Saving...' : 'Save settings'}
          </button>
        </form>
      </div>
    </div>
  )
}
