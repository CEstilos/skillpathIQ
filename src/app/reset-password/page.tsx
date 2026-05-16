'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const supabase = createClient()
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setError('This link has expired. Request a new one.')
      return
    }

    setDone(true)
    setTimeout(() => router.push('/auth/login'), 2000)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '16px', padding: '40px', width: '100%', maxWidth: '420px' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="SkillPathIQ" style={{ height: '32px', width: 'auto', marginBottom: '24px' }} />

        {done ? (
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 600, color: '#ffffff', marginBottom: '8px' }}>Password updated.</h1>
            <p style={{ fontSize: '14px', color: '#9A9A9F' }}>Redirecting you to login…</p>
          </div>
        ) : (
          <>
            <h1 style={{ fontSize: '22px', fontWeight: 600, color: '#ffffff', marginBottom: '6px' }}>Choose a new password</h1>
            <p style={{ fontSize: '14px', color: '#9A9A9F', marginBottom: '28px' }}>Must be at least 8 characters.</p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', color: '#a0a0a8' }}>New password</label>
                <input
                  style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }}
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', color: '#a0a0a8' }}>Confirm new password</label>
                <input
                  style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }}
                  type="password"
                  placeholder="Same password again"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                />
              </div>

              {error && (
                <p style={{ fontSize: '13px', color: '#E03131', background: '#1f0f0f', border: '1px solid #3a1a1a', borderRadius: '8px', padding: '10px 14px' }}>
                  {error}{' '}
                  {error.includes('expired') && (
                    <Link href="/forgot-password" style={{ color: '#E03131', fontWeight: 600 }}>Request a new one.</Link>
                  )}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{ background: '#00FF9F', color: '#0E0E0F', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '15px', fontWeight: 600, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1 }}
              >
                {loading ? 'Updating…' : 'Update Password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
