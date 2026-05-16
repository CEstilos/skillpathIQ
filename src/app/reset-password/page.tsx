'use client'

import { useState, useEffect } from 'react'
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
  const [exchanging, setExchanging] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const errorCode = params.get('error_code')
    const code = params.get('code')

    if (errorCode) {
      setError('This link has expired.')
      setExchanging(false)
      return
    }

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) setError('This link has expired.')
        setExchanging(false)
      })
    } else {
      // No code — link may already have been used or is malformed
      setError('Invalid or expired reset link.')
      setExchanging(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
        ) : exchanging ? (
          <div>
            <p style={{ fontSize: '14px', color: '#9A9A9F' }}>Verifying your link…</p>
          </div>
        ) : error && !error.includes('characters') && !error.includes('match') ? (
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 600, color: '#ffffff', marginBottom: '12px' }}>Link expired</h1>
            <p style={{ fontSize: '14px', color: '#9A9A9F', marginBottom: '24px' }}>{error}</p>
            <Link
              href="/forgot-password"
              style={{ display: 'inline-block', background: '#00FF9F', color: '#0E0E0F', textDecoration: 'none', borderRadius: '8px', padding: '11px 20px', fontSize: '14px', fontWeight: 600 }}
            >
              Request a new link
            </Link>
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
                  {error}
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
