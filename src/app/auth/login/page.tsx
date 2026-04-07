'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    router.push('/dashboard')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '16px', padding: '40px', width: '100%', maxWidth: '420px' }}>
        <div style={{ fontFamily: 'monospace', fontSize: '22px', fontWeight: 700, color: '#ffffff', letterSpacing: '2px', marginBottom: '24px' }}>
          SkillPath<span style={{ color: '#F4581A' }}>IQ</span>
        </div>
        <h1 style={{ fontSize: '22px', fontWeight: 600, color: '#ffffff', marginBottom: '6px' }}>Welcome back</h1>
        <p style={{ fontSize: '14px', color: '#6B6B72', marginBottom: '28px' }}>Sign in to your trainer account</p>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', color: '#a0a0a8' }}>Email</label>
            <input style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }} type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', color: '#a0a0a8' }}>Password</label>
            <input style={{ background: '#0E0E0F', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }} type="password" placeholder="Your password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          {error && <p style={{ fontSize: '13px', color: '#E03131', background: '#1f0f0f', border: '1px solid #3a1a1a', borderRadius: '8px', padding: '10px 14px' }}>{error}</p>}
          <button style={{ background: '#F4581A', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }} type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <p style={{ fontSize: '13px', color: '#6B6B72', textAlign: 'center', marginTop: '20px' }}>
          Don&apos;t have an account? <Link href="/auth/signup" style={{ color: '#F4581A', textDecoration: 'none' }}>Sign up free</Link>
        </p>
      </div>
    </div>
  )
}
