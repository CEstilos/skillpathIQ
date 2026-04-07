'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'

function NewPlayerForm() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const groupId = searchParams.get('group')

  const [fullName, setFullName] = useState('')
  const [parentEmail, setParentEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  function getInitials(name) {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??'
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const { error } = await supabase.from('players').insert({
      trainer_id: user.id,
      group_id: groupId,
      full_name: fullName,
      parent_email: parentEmail,
      avatar_initials: getInitials(fullName),
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', fontFamily: 'sans-serif' }}>
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', height: '60px', borderBottom: '1px solid #2A2A2D' }}>
        <div style={{ fontFamily: 'monospace', fontSize: '20px', fontWeight: 700, color: '#ffffff', letterSpacing: '2px' }}>
          SkillPath<span style={{ color: '#F4581A' }}>IQ</span>
        </div>
        <Link href="/dashboard" style={{ fontSize: '13px', color: '#6B6B72', textDecoration: 'none' }}>← Back to dashboard</Link>
      </nav>

      <div style={{ maxWidth: '480px', margin: '48px auto', padding: '0 16px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>Add a player</h1>
        <p style={{ fontSize: '14px', color: '#6B6B72', marginBottom: '32px' }}>Add a player to your group to start tracking their progress</p>

        {/* PREVIEW AVATAR */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '16px 20px', marginBottom: '28px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(244,88,26,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 600, color: '#F4581A', flexShrink: 0 }}>
            {fullName ? getInitials(fullName) : '??'}
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 500, color: fullName ? '#ffffff' : '#6B6B72' }}>
              {fullName || 'Player name'}
            </div>
            <div style={{ fontSize: '12px', color: '#6B6B72', marginTop: '2px' }}>
              {parentEmail || 'Parent email'}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', color: '#a0a0a8', fontWeight: 500 }}>Player full name</label>
            <input
              style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }}
              type="text"
              placeholder="e.g. Marcus Johnson"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', color: '#a0a0a8', fontWeight: 500 }}>Parent email <span style={{ color: '#6B6B72', fontWeight: 400 }}>(optional)</span></label>
            <input
              style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }}
              type="email"
              placeholder="parent@example.com"
              value={parentEmail}
              onChange={e => setParentEmail(e.target.value)}
            />
            <span style={{ fontSize: '12px', color: '#6B6B72' }}>Used for weekly progress reports</span>
          </div>

          {error && (
            <p style={{ fontSize: '13px', color: '#E03131', background: '#1f0f0f', border: '1px solid #3a1a1a', borderRadius: '8px', padding: '10px 14px' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ background: '#F4581A', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', marginTop: '4px' }}>
            {loading ? 'Adding player...' : 'Add player'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function NewPlayerPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0E0E0F' }} />}>
      <NewPlayerForm />
    </Suspense>
  )
}
