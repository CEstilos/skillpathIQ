'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const SPORTS = [
  { value: 'basketball', label: 'Basketball', emoji: '🏀' },
  { value: 'football', label: 'Football', emoji: '🏈' },
  { value: 'baseball', label: 'Baseball', emoji: '⚾' },
  { value: 'softball', label: 'Softball', emoji: '🥎' },
  { value: 'golf', label: 'Golf', emoji: '⛳' },
  { value: 'soccer', label: 'Soccer', emoji: '⚽' },
  { value: 'tennis', label: 'Tennis', emoji: '🎾' },
  { value: 'volleyball', label: 'Volleyball', emoji: '🏐' },
  { value: 'other', label: 'Other', emoji: '🏆' },
]

export default function OnboardingPage() {
  const supabase = createClient()
  const router = useRouter()
  const [selected, setSelected] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleContinue() {
    if (!selected) { setError('Please select a sport to continue'); return }
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const { error } = await supabase
      .from('profiles')
      .update({ primary_sport: selected })
      .eq('id', user.id)

    if (error) { setError(error.message); setLoading(false); return }

    router.push('/dashboard')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', fontFamily: 'sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ maxWidth: '520px', width: '100%' }}>

        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ fontFamily: 'monospace', fontSize: '22px', fontWeight: 700, color: '#ffffff', letterSpacing: '2px', marginBottom: '24px' }}>
            SkillPath<span style={{ color: '#00FF9F' }}>IQ</span>
          </div>
          <h1 style={{ fontFamily: '"Exo 2", sans-serif', fontSize: '28px', fontWeight: 700, color: '#ffffff', marginBottom: '10px' }}>
            What sport do you train?
          </h1>
          <p style={{ fontSize: '14px', color: '#9A9A9F', lineHeight: 1.6 }}>
            We&apos;ll personalize your experience based on your sport. You can always add more sports later.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '24px' }}>
          {SPORTS.map(sport => (
            <button
              key={sport.value}
              onClick={() => setSelected(sport.value)}
              style={{
                background: selected === sport.value ? 'rgba(0,255,159,0.1)' : '#1A1A1C',
                border: `1px solid ${selected === sport.value ? '#00FF9F' : '#2A2A2D'}`,
                borderRadius: '12px',
                padding: '16px 12px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.15s',
              }}>
              <span style={{ fontSize: '28px' }}>{sport.emoji}</span>
              <span style={{ fontSize: '13px', fontWeight: 500, color: selected === sport.value ? '#00FF9F' : '#ffffff' }}>{sport.label}</span>
            </button>
          ))}
        </div>

        {error && (
          <p style={{ fontSize: '13px', color: '#E03131', background: '#1f0f0f', border: '1px solid #3a1a1a', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px' }}>
            {error}
          </p>
        )}

        <button
          onClick={handleContinue}
          disabled={loading || !selected}
          style={{
            width: '100%',
            background: selected ? '#00FF9F' : '#2A2A2D',
            color: selected ? '#0E0E0F' : '#9A9A9F',
            border: 'none',
            borderRadius: '10px',
            padding: '14px',
            fontSize: '15px',
            fontWeight: 700,
            cursor: selected ? 'pointer' : 'default',
            transition: 'all 0.15s',
          }}>
          {loading ? 'Setting up your account...' : 'Continue to SkillPathIQ →'}
        </button>
      </div>
    </div>
  )
}
