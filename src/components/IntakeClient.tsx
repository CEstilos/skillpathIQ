'use client'

import { useState } from 'react'

const GREEN = '#00FF9F'

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

interface IntakeForm {
  parentName: string
  parentEmail: string
  parentPhone: string
  playerName: string
  playerAge: string
  playerPosition: string
  playerGoals: string
  sessionType: 'individual' | 'group'
  message: string
}

export default function IntakeClient({
  trainer,
}: {
  trainer: { id: string; full_name: string }
}) {
  const trainerFirstName = trainer.full_name.split(' ')[0]

  const [form, setForm] = useState<IntakeForm>({
    parentName: '',
    parentEmail: '',
    parentPhone: '',
    playerName: '',
    playerAge: '',
    playerPosition: '',
    playerGoals: '',
    sessionType: 'individual',
    message: '',
  })

  const [step, setStep] = useState<'form' | 'duplicate_check' | 'success'>('form')
  const [duplicateInfo, setDuplicateInfo] = useState<{ player_name: string; player_id: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(field: keyof IntakeForm, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function submitIntake(isReturning?: boolean, existingPlayerId?: string) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainer_id: trainer.id,
          parent_name: form.parentName.trim(),
          parent_email: form.parentEmail.trim(),
          parent_phone: form.parentPhone.trim(),
          player_name: form.playerName.trim(),
          player_age: parseInt(form.playerAge),
          player_position: form.playerPosition.trim() || null,
          player_goals: form.playerGoals.trim() || null,
          session_type: form.sessionType,
          message: form.message.trim() || null,
          ...(isReturning !== undefined && { is_returning: isReturning }),
          ...(existingPlayerId && { existing_player_id: existingPlayerId }),
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Something went wrong. Please try again.')
        return
      }
      if (data.needs_confirm) {
        setDuplicateInfo({ player_name: data.player_name, player_id: data.player_id })
        setStep('duplicate_check')
        return
      }
      setStep('success')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.parentName.trim() || !form.parentEmail.trim() || !form.parentPhone.trim()) {
      setError('Please fill in all required fields.')
      return
    }
    if (!form.playerName.trim()) {
      setError('Player name is required.')
      return
    }
    if (!form.playerAge || parseInt(form.playerAge) < 1) {
      setError('Player age is required.')
      return
    }
    submitIntake()
  }

  if (step === 'success') {
    return (
      <div style={{ minHeight: '100vh', background: '#0E0E0F', fontFamily: 'sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <style>{`* { box-sizing: border-box; margin: 0; padding: 0; } html, body { background: #0E0E0F; }`}</style>
        <div style={{ maxWidth: '480px', width: '100%', textAlign: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-dark.png" alt="SkillPathIQ" style={{ height: '28px', width: 'auto', marginBottom: '32px' }} />
          <div style={{ background: 'rgba(0,255,159,0.06)', border: '1px solid rgba(0,255,159,0.25)', borderRadius: '16px', padding: '40px 24px' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>✓</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#ffffff', marginBottom: '10px' }}>You&apos;re all set!</div>
            <p style={{ fontSize: '15px', color: '#9A9A9F', lineHeight: 1.6 }}>
              {trainerFirstName} has your player&apos;s info and will be in touch.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'duplicate_check' && duplicateInfo) {
    return (
      <div style={{ minHeight: '100vh', background: '#0E0E0F', fontFamily: 'sans-serif', padding: '24px 16px' }}>
        <style>{`* { box-sizing: border-box; margin: 0; padding: 0; } html, body { background: #0E0E0F; }`}</style>
        <div style={{ maxWidth: '480px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-dark.png" alt="SkillPathIQ" style={{ height: '28px', width: 'auto' }} />
          </div>
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '16px', padding: '28px 24px' }}>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', marginBottom: '10px' }}>Already in the system?</div>
            <p style={{ fontSize: '14px', color: '#9A9A9F', lineHeight: 1.6, marginBottom: '24px' }}>
              It looks like <strong style={{ color: '#ffffff' }}>{duplicateInfo.player_name}</strong> may already be in {trainerFirstName}&apos;s system. Is this a returning player?
            </p>
            {error && (
              <div style={{ background: 'rgba(224,49,49,0.08)', border: '1px solid rgba(224,49,49,0.25)', borderRadius: '10px', padding: '12px 14px', fontSize: '14px', color: '#E03131', marginBottom: '16px' }}>
                {error}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={() => submitIntake(true, duplicateInfo.player_id)}
                disabled={loading}
                style={{ width: '100%', padding: '14px', background: GREEN, color: '#0E0E0F', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Submitting…' : 'Yes, returning player'}
              </button>
              <button
                onClick={() => submitIntake(false)}
                disabled={loading}
                style={{ width: '100%', padding: '14px', background: 'transparent', color: '#9A9A9F', border: '1px solid #2A2A2D', borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
                No, create new profile
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', fontFamily: 'sans-serif', padding: '24px 16px' }}>
      <style>{`* { box-sizing: border-box; margin: 0; padding: 0; } html, body { background: #0E0E0F; }`}</style>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>

        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-dark.png" alt="SkillPathIQ" style={{ height: '28px', width: 'auto' }} />
        </div>

        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>Almost done!</h1>
          <p style={{ fontSize: '14px', color: '#9A9A9F', lineHeight: 1.6 }}>
            You&apos;re booked with {trainer.full_name}. Just fill in your player&apos;s details and you&apos;re all set.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* YOUR INFO */}
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Your info</div>
            <div>
              <label style={labelStyle}>Your name <span style={{ color: '#E03131' }}>*</span></label>
              <input style={inputStyle} type="text" placeholder="Jane Smith" value={form.parentName} onChange={e => set('parentName', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Email address <span style={{ color: '#E03131' }}>*</span></label>
              <input style={inputStyle} type="email" placeholder="jane@email.com" value={form.parentEmail} onChange={e => set('parentEmail', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Phone number <span style={{ color: '#E03131' }}>*</span></label>
              <input style={inputStyle} type="tel" placeholder="(555) 000-0000" value={form.parentPhone} onChange={e => set('parentPhone', e.target.value)} />
            </div>
          </div>

          {/* PLAYER INFO */}
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Player info</div>
            <div>
              <label style={labelStyle}>Player name <span style={{ color: '#E03131' }}>*</span></label>
              <input style={inputStyle} type="text" placeholder="Alex Smith" value={form.playerName} onChange={e => set('playerName', e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Age <span style={{ color: '#E03131' }}>*</span></label>
                <input style={inputStyle} type="number" min="1" max="99" placeholder="12" value={form.playerAge} onChange={e => set('playerAge', e.target.value)} />
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

          {/* SESSION TYPE */}
          <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Session preference</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {(['individual', 'group'] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => set('sessionType', type)}
                  style={{
                    padding: '12px', borderRadius: '10px', border: `1px solid ${form.sessionType === type ? 'rgba(0,255,159,0.4)' : '#2A2A2D'}`,
                    background: form.sessionType === type ? 'rgba(0,255,159,0.08)' : 'transparent',
                    color: form.sessionType === type ? GREEN : '#9A9A9F',
                    fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                  }}>
                  {type === 'individual' ? '1-on-1' : 'Group'}
                </button>
              ))}
            </div>
            <div>
              <label style={labelStyle}>Message to trainer <span style={{ fontSize: '11px', fontWeight: 400, color: '#555558' }}>(optional)</span></label>
              <textarea
                style={{ ...inputStyle, minHeight: '72px', resize: 'vertical' as const, lineHeight: 1.6 }}
                placeholder="Anything else your trainer should know..."
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
            {loading ? 'Submitting…' : 'Submit'}
          </button>

          <p style={{ fontSize: '12px', color: '#555558', textAlign: 'center' }}>
            Powered by <span style={{ color: '#9A9A9F' }}>SkillPathIQ</span>
          </p>
        </form>

        <div style={{ height: '40px' }} />
      </div>
    </div>
  )
}
