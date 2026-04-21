'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import NavBar from '@/components/NavBar'

interface Profile {
  id: string
  full_name: string
  email: string
  individual_rate: number | null
  group_rate: number | null
  welcome_message: string | null
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
