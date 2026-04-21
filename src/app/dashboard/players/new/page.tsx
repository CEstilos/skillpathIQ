'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface Group { id: string; name: string }

function NewPlayerForm() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedGroup = searchParams.get('group')

  const [fullName, setFullName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactType, setContactType] = useState<'parent' | 'player'>('parent')
  const [groupId, setGroupId] = useState(preselectedGroup || '')
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadGroups() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('groups').select('*').eq('trainer_id', user.id)
      setGroups(data || [])
    }
    loadGroups()
  }, [])

  function getInitials(name: string) {
    return name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '??'
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const { data: newPlayer, error } = await supabase.from('players').insert({
      trainer_id: user.id,
      group_id: groupId || null,
      full_name: fullName,
      parent_email: contactEmail || null,
      contact_type: contactType,
      avatar_initials: getInitials(fullName),
    }).select().single()

    if (error) { setError(error.message); setLoading(false); return }

    // Send welcome email if contact email and trainer has a welcome message
    if (contactEmail && newPlayer) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('welcome_message, full_name')
        .eq('id', user.id)
        .single()

      if (profileData?.welcome_message) {
        const playerUrl = `${window.location.origin}/player?id=${newPlayer.id}`
        const firstName = fullName.split(' ')[0]
        const isPlayer = contactType === 'player'
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: contactEmail,
            subject: isPlayer
              ? `Welcome to ${profileData.full_name?.split(' ')[0] || 'your trainer'}'s training program!`
              : `Welcome — ${firstName} has joined ${profileData.full_name?.split(' ')[0] || 'your trainer'}'s training program!`,
            body: profileData.welcome_message,
            playerName: firstName,
            playerUrl,
          }),
        })
      }
    }

    router.push('/dashboard')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', fontFamily: 'sans-serif' }}>
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', height: '60px', borderBottom: '1px solid #2A2A2D' }}>
        <img src="/logo.png" alt="SkillPathIQ" onClick={() => router.push('/dashboard')} style={{ height: '65px', width: 'auto', cursor: 'pointer', flexShrink: 0 }} />
        <Link href="/dashboard" style={{ fontSize: '13px', color: '#9A9A9F', textDecoration: 'none' }}>← Back</Link>
      </nav>
      <div style={{ maxWidth: '480px', margin: '48px auto', padding: '0 16px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#ffffff', fontFamily: '"Exo 2", sans-serif', marginBottom: '8px' }}>Add a player</h1>
        <p style={{ fontSize: '14px', color: '#9A9A9F', marginBottom: '32px' }}>Group is optional — individual players work just as well</p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '16px 20px', marginBottom: '28px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(0,255,159,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 600, color: '#00FF9F', flexShrink: 0 }}>
            {fullName ? getInitials(fullName) : '??'}
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 500, color: fullName ? '#ffffff' : '#9A9A9F' }}>{fullName || 'Player name'}</div>
            <div style={{ fontSize: '12px', color: '#9A9A9F', marginTop: '2px' }}>{groupId ? groups.find(g => g.id === groupId)?.name : 'Individual'}</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', color: '#a0a0a8', fontWeight: 500 }}>Player full name</label>
            <input style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }} type="text" placeholder="e.g. Marcus Johnson" value={fullName} onChange={e => setFullName(e.target.value)} required />
          </div>

          {/* CONTACT TYPE TOGGLE */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', color: '#a0a0a8', fontWeight: 500 }}>Who receives session updates?</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['parent', 'player'] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setContactType(type)}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', border: `1px solid ${contactType === type ? 'rgba(0,255,159,0.4)' : '#2A2A2D'}`, background: contactType === type ? 'rgba(0,255,159,0.08)' : 'transparent', color: contactType === type ? '#00FF9F' : '#9A9A9F', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                  {type === 'parent' ? '👪 Parent / Guardian' : '🏃 Player directly'}
                </button>
              ))}
            </div>
            <div style={{ fontSize: '12px', color: '#9A9A9F' }}>
              {contactType === 'parent' ? 'Session recaps and drill updates go to the parent' : 'Session recaps and drill updates go directly to the athlete'}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', color: '#a0a0a8', fontWeight: 500 }}>
              {contactType === 'parent' ? 'Parent / guardian email' : 'Player email'}
            </label>
            <input
              style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }}
              type="email"
              placeholder={contactType === 'parent' ? 'parent@example.com' : 'player@example.com'}
              value={contactEmail}
              onChange={e => setContactEmail(e.target.value)}
              required
            />
            <div style={{ fontSize: '12px', color: '#9A9A9F' }}>Used to send session updates, drill assignments, and the player profile link</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', color: '#a0a0a8', fontWeight: 500 }}>Group <span style={{ color: '#9A9A9F', fontWeight: 400 }}>(optional)</span></label>
            <select style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '8px', padding: '11px 14px', fontSize: '14px', color: '#ffffff', outline: 'none', width: '100%' }} value={groupId} onChange={e => setGroupId(e.target.value)}>
              <option value="">Individual (no group)</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>

          {error && <p style={{ fontSize: '13px', color: '#E03131', background: '#1f0f0f', border: '1px solid #3a1a1a', borderRadius: '8px', padding: '10px 14px' }}>{error}</p>}

          <button type="submit" disabled={loading} style={{ background: '#00FF9F', color: '#0E0E0F', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', marginTop: '4px' }}>
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
