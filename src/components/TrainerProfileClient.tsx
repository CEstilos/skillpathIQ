'use client'

import { useState } from 'react'

const GREEN = '#00FF9F'

interface Trainer {
  id: string
  full_name: string
  bio: string | null
  sport: string | null
  location: string | null
  profile_photo_url: string | null
  individual_rate: number | null
  group_rate: number | null
}

export default function TrainerProfileClient({ trainer }: { trainer: Trainer }) {
  const [form, setForm] = useState({
    parentName: '',
    parentEmail: '',
    parentPhone: '',
    playerName: '',
    playerAge: '',
    playerPosition: '',
    playerGoals: '',
    sessionType: 'individual' as 'individual' | 'group',
    message: '',
  })
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function getInitials(name: string) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.parentName.trim() || !form.parentEmail.trim() || !form.playerName.trim()) {
      setError('Please fill in all required fields.')
      return
    }
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/booking-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainer_id: trainer.id,
          trainer_name: trainer.full_name,
          parent_name: form.parentName.trim(),
          parent_email: form.parentEmail.trim(),
          parent_phone: form.parentPhone.trim() || null,
          player_name: form.playerName.trim(),
          player_age: form.playerAge ? parseInt(form.playerAge) : null,
          player_position: form.playerPosition.trim() || null,
          player_goals: form.playerGoals.trim() || null,
          preferred_session_type: form.sessionType,
          message: form.message.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Something went wrong. Please try again.')
        setLoading(false)
        return
      }
      setSubmitted(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    background: '#1A1A1C',
    border: '1px solid #2A2A2D',
    borderRadius: '10px',
    padding: '12px 14px',
    fontSize: '15px',
    color: '#ffffff',
    outline: 'none',
    width: '100%',
    fontFamily: 'sans-serif',
  }

  const labelStyle = {
    fontSize: '13px',
    fontWeight: 600 as const,
    color: '#9A9A9F',
    marginBottom: '6px',
    display: 'block' as const,
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', fontFamily: 'sans-serif', overflowX: 'hidden' }}>
      <style>{`* { box-sizing: border-box; margin: 0; padding: 0; } html, body { background: #0E0E0F; overflow-x: hidden; }`}</style>

      {/* TOP BAR */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #1A1A1C' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: GREEN, letterSpacing: '0.04em' }}>SkillPathIQ</span>
      </div>

      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '32px 16px 64px' }}>

        {/* TRAINER HEADER */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '32px' }}>
          {trainer.profile_photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={trainer.profile_photo_url} alt={trainer.full_name} style={{ width: '88px', height: '88px', borderRadius: '50%', objectFit: 'cover', marginBottom: '16px' }} />
          ) : (
            <div style={{ width: '88px', height: '88px', borderRadius: '50%', background: 'rgba(0,255,159,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: 700, color: GREEN, marginBottom: '16px' }}>
              {getInitials(trainer.full_name)}
            </div>
          )}
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>{trainer.full_name}</h1>
          {(trainer.sport || trainer.location) && (
            <p style={{ fontSize: '14px', color: '#9A9A9F' }}>
              {[trainer.sport, trainer.location].filter(Boolean).join(' · ')}
            </p>
          )}
          {trainer.bio && (
            <p style={{ fontSize: '14px', color: '#9A9A9F', lineHeight: 1.7, marginTop: '12px', maxWidth: '440px' }}>
              {trainer.bio}
            </p>
          )}
        </div>

        {/* RATES */}
        {(trainer.individual_rate || trainer.group_rate) && (
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '14px', padding: '18px 20px', marginBottom: '28px', display: 'flex', gap: '0' }}>
            {trainer.individual_rate ? (
              <div style={{ flex: 1, textAlign: 'center', borderRight: trainer.group_rate ? '1px solid #2A2A2D' : 'none', paddingRight: trainer.group_rate ? '16px' : '0' }}>
                <div style={{ fontSize: '11px', color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Individual</div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#ffffff' }}>${trainer.individual_rate}</div>
                <div style={{ fontSize: '11px', color: '#9A9A9F', marginTop: '2px' }}>per session</div>
              </div>
            ) : null}
            {trainer.group_rate ? (
              <div style={{ flex: 1, textAlign: 'center', paddingLeft: trainer.individual_rate ? '16px' : '0' }}>
                <div style={{ fontSize: '11px', color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Group</div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#ffffff' }}>${trainer.group_rate}</div>
                <div style={{ fontSize: '11px', color: '#9A9A9F', marginTop: '2px' }}>per player / session</div>
              </div>
            ) : null}
          </div>
        )}

        {/* BOOKING FORM */}
        {submitted ? (
          <div style={{ background: 'rgba(0,255,159,0.06)', border: '1px solid rgba(0,255,159,0.25)', borderRadius: '16px', padding: '32px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>✓</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>Request sent!</div>
            <p style={{ fontSize: '14px', color: '#9A9A9F', lineHeight: 1.6 }}>
              {trainer.full_name.split(' ')[0]} will be in touch soon.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', marginBottom: '4px' }}>Request a session</div>
              <p style={{ fontSize: '13px', color: '#9A9A9F' }}>Fill out the form below and {trainer.full_name.split(' ')[0]} will be in touch to confirm.</p>
            </div>

            {/* PARENT INFO */}
            <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Your info</div>
              <div>
                <label style={labelStyle}>Your name <span style={{ color: '#E03131' }}>*</span></label>
                <input style={inputStyle} type="text" placeholder="Jane Smith" value={form.parentName} onChange={e => set('parentName', e.target.value)} required />
              </div>
              <div>
                <label style={labelStyle}>Email address <span style={{ color: '#E03131' }}>*</span></label>
                <input style={inputStyle} type="email" placeholder="jane@email.com" value={form.parentEmail} onChange={e => set('parentEmail', e.target.value)} required />
              </div>
              <div>
                <label style={labelStyle}>Phone number <span style={{ fontSize: '11px', fontWeight: 400, color: '#555558' }}>(optional)</span></label>
                <input style={inputStyle} type="tel" placeholder="(555) 000-0000" value={form.parentPhone} onChange={e => set('parentPhone', e.target.value)} />
              </div>
            </div>

            {/* PLAYER INFO */}
            <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Player info</div>
              <div>
                <label style={labelStyle}>Player name <span style={{ color: '#E03131' }}>*</span></label>
                <input style={inputStyle} type="text" placeholder="Alex Smith" value={form.playerName} onChange={e => set('playerName', e.target.value)} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Age <span style={{ fontSize: '11px', fontWeight: 400, color: '#555558' }}>(optional)</span></label>
                  <input style={inputStyle} type="number" min="4" max="25" placeholder="12" value={form.playerAge} onChange={e => set('playerAge', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Position <span style={{ fontSize: '11px', fontWeight: 400, color: '#555558' }}>(optional)</span></label>
                  <input style={inputStyle} type="text" placeholder="Point guard" value={form.playerPosition} onChange={e => set('playerPosition', e.target.value)} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Goals <span style={{ fontSize: '11px', fontWeight: 400, color: '#555558' }}>(optional)</span></label>
                <textarea
                  style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' as const, lineHeight: 1.6 }}
                  placeholder="What do you want your player to work on?"
                  value={form.playerGoals}
                  onChange={e => set('playerGoals', e.target.value)}
                />
              </div>
            </div>

            {/* SESSION PREFERENCE */}
            <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Session preference</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {(['individual', 'group'] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => set('sessionType', type)}
                    style={{
                      padding: '12px',
                      borderRadius: '10px',
                      border: `1px solid ${form.sessionType === type ? 'rgba(0,255,159,0.4)' : '#2A2A2D'}`,
                      background: form.sessionType === type ? 'rgba(0,255,159,0.08)' : 'transparent',
                      color: form.sessionType === type ? GREEN : '#9A9A9F',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textTransform: 'capitalize' as const,
                    }}>
                    {type === 'individual' ? '1-on-1' : 'Group'}
                  </button>
                ))}
              </div>
              <div>
                <label style={labelStyle}>Anything else? <span style={{ fontSize: '11px', fontWeight: 400, color: '#555558' }}>(optional)</span></label>
                <textarea
                  style={{ ...inputStyle, minHeight: '72px', resize: 'vertical' as const, lineHeight: 1.6 }}
                  placeholder="Scheduling preferences, questions, or anything else..."
                  value={form.message}
                  onChange={e => set('message', e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div style={{ background: 'rgba(224,49,49,0.08)', border: '1px solid rgba(224,49,49,0.25)', borderRadius: '10px', padding: '12px 14px', fontSize: '14px', color: '#E03131' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{ background: GREEN, color: '#0E0E0F', border: 'none', borderRadius: '12px', padding: '16px', fontSize: '16px', fontWeight: 700, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1, transition: 'opacity 0.15s' }}>
              {loading ? 'Sending…' : 'Request Session'}
            </button>

            <p style={{ fontSize: '12px', color: '#555558', textAlign: 'center' }}>
              Powered by <span style={{ color: '#9A9A9F' }}>SkillPathIQ</span>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
