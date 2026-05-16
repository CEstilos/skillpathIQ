'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

// SETUP: In Supabase Dashboard → Authentication → URL Configuration → Redirect URLs,
// add https://skillpathiq.com/reset-password (and http://localhost:3000/reset-password
// for local dev). Without this the email link will redirect to the site root.

export default function ForgotPasswordPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // redirectTo must be in Supabase's redirect URL allowlist
    const redirectTo = `${window.location.origin}/reset-password`
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })

    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    setSent(true)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '16px', padding: '40px', width: '100%', maxWidth: '420px' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="SkillPathIQ" style={{ height: '32px', width: 'auto', marginBottom: '24px' }} />

        {sent ? (
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 600, color: '#ffffff', marginBottom: '12px' }}>Check your email</h1>
            <p style={{ fontSize: '14px', color: '#9A9A9F', lineHeight: 1.6 }}>
              If an account exists for that address you&apos;ll receive a reset link shortly.
            </p>
          </div>
        ) : (
          <>
            <h1 style={{ fontSize: '22px', fontWeight: 600, color: '#ffffff', marginBottom: '6px' }}>Reset your password</h1>
            <p style={{ fontSize: '14px', color: '#9A9A9F', marginBottom: '28px' }}>Enter your email and we&apos;ll send you a reset link.</p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', color: '#a0a0a8' }}>Email</label>
                <input
                  style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }}
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
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
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>
          </>
        )}

        <p style={{ fontSize: '13px', color: '#9A9A9F', textAlign: 'center', marginTop: '24px' }}>
          <Link href="/auth/login" style={{ color: '#9A9A9F', textDecoration: 'none' }}>← Back to login</Link>
        </p>
      </div>
    </div>
  )
}
