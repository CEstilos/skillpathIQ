'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function SignupPage() {
  const router = useRouter()
  const supabase = createClient()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const fullName = `${firstName.trim()} ${lastName.trim()}`
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (error) { setError(error.message); setLoading(false); return }
    setLoading(false)
    setConfirmed(true)
  }

  if (confirmed) return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '420px', width: '100%', textAlign: 'center' }}>
        <img src="/logo-dark.png" alt="SkillPathIQ" style={{ height: '36px', width: 'auto', marginBottom: '32px' }} />
        <div style={{ fontSize: '40px', marginBottom: '16px' }}>📬</div>
        <h1 style={{ fontFamily: '"Exo 2", sans-serif', fontSize: '24px', fontWeight: 700, color: '#ffffff', marginBottom: '10px' }}>
          Check your email
        </h1>
        <p style={{ fontSize: '15px', color: '#9A9A9F', lineHeight: 1.7, marginBottom: '8px' }}>
          Next step — confirm your email address.
        </p>
        <p style={{ fontSize: '14px', color: '#9A9A9F', lineHeight: 1.7, marginBottom: '32px' }}>
          We sent a confirmation link to <span style={{ color: '#ffffff', fontWeight: 500 }}>{email}</span>. Click the link in that email to activate your account and get started.
        </p>
        <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '16px 20px', marginBottom: '24px', textAlign: 'left' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Didn't get the email?</div>
          <p style={{ fontSize: '13px', color: '#9A9A9F', lineHeight: 1.6 }}>Check your spam folder. If it's not there, try signing up again with the same email address.</p>
        </div>
        <button
          onClick={() => router.push('/auth/login')}
          style={{ width: '100%', background: '#00FF9F', color: '#0E0E0F', border: 'none', borderRadius: '10px', padding: '13px', fontSize: '15px', fontWeight: 700, cursor: 'pointer' }}>
          Go to sign in
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '16px', padding: '40px', width: '100%', maxWidth: '420px' }}>
        <div style={{ fontFamily: 'monospace', fontSize: '22px', fontWeight: 700, color: '#ffffff', letterSpacing: '2px', marginBottom: '24px' }}>
          SkillPath<span style={{ color: '#00FF9F' }}>IQ</span>
        </div>
        <h1 style={{ fontSize: '22px', fontWeight: 600, color: '#ffffff', marginBottom: '6px' }}>Create your account</h1>
        <p style={{ fontSize: '14px', color: '#9A9A9F', marginBottom: '28px' }}>Start tracking your players progress</p>
        <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
              <label style={{ fontSize: '13px', color: '#9A9A9F' }}>First name</label>
              <input style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }} type="text" placeholder="Jordan" value={firstName} onChange={e => setFirstName(e.target.value)} required />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
              <label style={{ fontSize: '13px', color: '#9A9A9F' }}>Last name</label>
              <input style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }} type="text" placeholder="Taylor" value={lastName} onChange={e => setLastName(e.target.value)} required />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', color: '#9A9A9F' }}>Email</label>
            <input style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }} type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', color: '#9A9A9F' }}>Password</label>
            <input style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }} type="password" placeholder="Min. 8 characters" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
          </div>
          {error && <p style={{ fontSize: '13px', color: '#E03131', background: '#1f0f0f', border: '1px solid #3a1a1a', borderRadius: '8px', padding: '10px 14px' }}>{error}</p>}
          <button style={{ background: '#00FF9F', color: '#0E0E0F', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '15px', fontWeight: 700, cursor: 'pointer' }} type="submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>
        <p style={{ fontSize: '13px', color: '#9A9A9F', textAlign: 'center', marginTop: '20px' }}>
          Already have an account? <Link href="/auth/login" style={{ color: '#00FF9F', textDecoration: 'none' }}>Sign in</Link>
        </p>
        <p style={{ fontSize: '11px', color: '#6B6B72', textAlign: 'center', marginTop: '12px', lineHeight: 1.5 }}>
          Free during early access · Paid plans coming soon · <Link href="/terms" style={{ color: '#6B6B72' }}>Terms of service</Link>
        </p>
      </div>
    </div>
  )
}
