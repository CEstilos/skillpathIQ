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

const PLAYER_COUNTS = [
  { value: '1-5', label: '1–5 players' },
  { value: '6-15', label: '6–15 players' },
  { value: '16-30', label: '16–30 players' },
  { value: '30+', label: '30+ players' },
]

const CHALLENGES = [
  { value: 'engagement', label: 'Keeping players engaged between sessions' },
  { value: 'retention', label: 'Retaining clients and reducing churn' },
  { value: 'communication', label: 'Communicating progress to parents' },
  { value: 'organization', label: 'Staying organized across multiple players' },
]

type Step = 'sport' | 'players' | 'challenge' | 'result'

export default function OnboardingPage() {
  const supabase = createClient()
  const router = useRouter()

  const [step, setStep] = useState<Step>('sport')
  const [sport, setSport] = useState('')
  const [playerCount, setPlayerCount] = useState('')
  const [challenge, setChallenge] = useState('')
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [welcomeMessage, setWelcomeMessage] = useState('')
  const [quickStartTip, setQuickStartTip] = useState('')
  const [copied, setCopied] = useState(false)
  const [trainerName, setTrainerName] = useState('')

  async function handleSportContinue() {
    if (!sport) { setError('Please select a sport to continue'); return }
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    setTrainerName(profile?.full_name?.split(' ')[0] || 'Coach')

    await supabase.from('profiles').update({ primary_sport: sport }).eq('id', user.id)

    setStep('players')
  }

  async function handlePlayersContinue() {
    if (!playerCount) { setError('Please select how many players you train'); return }
    setError(null)
    setStep('challenge')
  }

  async function handleChallengeContinue() {
    if (!challenge) { setError('Please select your biggest challenge'); return }
    setError(null)
    setAiLoading(true)
    setStep('result')

    const challengeLabels: Record<string, string> = {
      engagement: 'keeping players engaged between sessions',
      retention: 'retaining clients and reducing churn',
      communication: 'communicating progress to parents',
      organization: 'staying organized across multiple players',
    }

    const sportEmojis: Record<string, string> = {
      basketball: '🏀', football: '🏈', baseball: '⚾', softball: '🥎',
      golf: '⛳', soccer: '⚽', tennis: '🎾', volleyball: '🏐', other: '🏆'
    }

    const prompt = `You are helping a youth sports trainer get started with SkillPathIQ, a player accountability and client retention platform.

Trainer name: ${trainerName}
Sport: ${sport}
Number of players: ${playerCount}
Biggest challenge: ${challengeLabels[challenge]}

Generate two things:

1. A SHORT welcome text message (2-3 sentences) the trainer can send RIGHT NOW to their existing players/parents to introduce SkillPathIQ. It should:
- Come from the trainer personally, not from a company
- Mention they just started using a new tool to keep players accountable between sessions
- Feel warm and natural, not corporate
- NOT mention pricing or features in detail
- End by telling them to expect a personal link soon

2. A single personalized quick-start tip (1-2 sentences) specific to their challenge of ${challengeLabels[challenge]} that they can act on today.

Return ONLY valid JSON in this exact format, no markdown:
{"welcomeMessage": "...", "quickStartTip": "..."}`

    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      const data = await response.json()
      const raw = data.content?.find((b: { type: string; text: string }) => b.type === 'text')?.text?.trim()
      const clean = raw?.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)

      setWelcomeMessage(parsed.welcomeMessage)
      setQuickStartTip(parsed.quickStartTip)
    } catch (err) {
      setWelcomeMessage(`Hey! I just started using a new tool called SkillPathIQ to help keep my players accountable between sessions. I'll be sending you a personal link soon so you can track drills and stay connected with what we're working on.`)
      setQuickStartTip(`Start by adding your first player and assigning them a drill checklist — it takes less than 2 minutes and gives parents immediate visibility into their child's training.`)
    } finally {
      setAiLoading(false)
    }
  }

  function copyWelcomeMessage() {
    navigator.clipboard.writeText(welcomeMessage)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const stepNumber = { sport: 1, players: 2, challenge: 3, result: 4 }[step]
  const totalSteps = 3

  return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', fontFamily: 'sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ maxWidth: '520px', width: '100%' }}>

        {/* LOGO */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img src="/logo-dark.png" alt="SkillPathIQ" style={{ height: '36px', width: 'auto' }} />
        </div>

        {/* PROGRESS */}
        {step !== 'result' && (
          <div style={{ display: 'flex', gap: '6px', marginBottom: '32px' }}>
            {[1, 2, 3].map(n => (
              <div key={n} style={{ flex: 1, height: '3px', borderRadius: '99px', background: n <= stepNumber ? '#00FF9F' : '#2A2A2D', transition: 'background 0.3s' }} />
            ))}
          </div>
        )}

        {/* STEP 1 — SPORT */}
        {step === 'sport' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <h1 style={{ fontFamily: '"Exo 2", sans-serif', fontSize: '26px', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>
                What sport do you train?
              </h1>
              <p style={{ fontSize: '14px', color: '#9A9A9F' }}>We'll personalize your experience around your sport.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '24px' }}>
              {SPORTS.map(s => (
                <button key={s.value} onClick={() => setSport(s.value)} style={{ background: sport === s.value ? 'rgba(0,255,159,0.1)' : '#1A1A1C', border: `1px solid ${sport === s.value ? '#00FF9F' : '#2A2A2D'}`, borderRadius: '12px', padding: '16px 12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', transition: 'all 0.15s' }}>
                  <span style={{ fontSize: '28px' }}>{s.emoji}</span>
                  <span style={{ fontSize: '13px', fontWeight: 500, color: sport === s.value ? '#00FF9F' : '#ffffff' }}>{s.label}</span>
                </button>
              ))}
            </div>

            {error && <p style={{ fontSize: '13px', color: '#E03131', background: '#1f0f0f', border: '1px solid #3a1a1a', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px' }}>{error}</p>}

            <button onClick={handleSportContinue} disabled={!sport} style={{ width: '100%', background: sport ? '#00FF9F' : '#2A2A2D', color: sport ? '#0E0E0F' : '#9A9A9F', border: 'none', borderRadius: '10px', padding: '14px', fontSize: '15px', fontWeight: 700, cursor: sport ? 'pointer' : 'default', transition: 'all 0.15s' }}>
              Continue →
            </button>
          </>
        )}

        {/* STEP 2 — PLAYER COUNT */}
        {step === 'players' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <h1 style={{ fontFamily: '"Exo 2", sans-serif', fontSize: '26px', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>
                How many players do you currently train?
              </h1>
              <p style={{ fontSize: '14px', color: '#9A9A9F' }}>This helps us tailor your dashboard.</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
              {PLAYER_COUNTS.map(p => (
                <button key={p.value} onClick={() => setPlayerCount(p.value)} style={{ background: playerCount === p.value ? 'rgba(0,255,159,0.1)' : '#1A1A1C', border: `1px solid ${playerCount === p.value ? '#00FF9F' : '#2A2A2D'}`, borderRadius: '12px', padding: '16px 20px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.15s' }}>
                  <span style={{ fontSize: '15px', fontWeight: 500, color: playerCount === p.value ? '#00FF9F' : '#ffffff' }}>{p.label}</span>
                  {playerCount === p.value && <span style={{ color: '#00FF9F', fontSize: '16px' }}>✓</span>}
                </button>
              ))}
            </div>

            {error && <p style={{ fontSize: '13px', color: '#E03131', background: '#1f0f0f', border: '1px solid #3a1a1a', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px' }}>{error}</p>}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setStep('sport')} style={{ flex: 1, background: 'transparent', color: '#9A9A9F', border: '1px solid #2A2A2D', borderRadius: '10px', padding: '14px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}>← Back</button>
              <button onClick={handlePlayersContinue} disabled={!playerCount} style={{ flex: 2, background: playerCount ? '#00FF9F' : '#2A2A2D', color: playerCount ? '#0E0E0F' : '#9A9A9F', border: 'none', borderRadius: '10px', padding: '14px', fontSize: '15px', fontWeight: 700, cursor: playerCount ? 'pointer' : 'default', transition: 'all 0.15s' }}>
                Continue →
              </button>
            </div>
          </>
        )}

        {/* STEP 3 — CHALLENGE */}
        {step === 'challenge' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <h1 style={{ fontFamily: '"Exo 2", sans-serif', fontSize: '26px', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>
                What's your biggest challenge right now?
              </h1>
              <p style={{ fontSize: '14px', color: '#9A9A9F' }}>We'll generate a personalized tip and welcome message for you.</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
              {CHALLENGES.map(c => (
                <button key={c.value} onClick={() => setChallenge(c.value)} style={{ background: challenge === c.value ? 'rgba(0,255,159,0.1)' : '#1A1A1C', border: `1px solid ${challenge === c.value ? '#00FF9F' : '#2A2A2D'}`, borderRadius: '12px', padding: '16px 20px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.15s' }}>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: challenge === c.value ? '#00FF9F' : '#ffffff', lineHeight: 1.4 }}>{c.label}</span>
                  {challenge === c.value && <span style={{ color: '#00FF9F', fontSize: '16px', flexShrink: 0, marginLeft: '12px' }}>✓</span>}
                </button>
              ))}
            </div>

            {error && <p style={{ fontSize: '13px', color: '#E03131', background: '#1f0f0f', border: '1px solid #3a1a1a', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px' }}>{error}</p>}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setStep('players')} style={{ flex: 1, background: 'transparent', color: '#9A9A9F', border: '1px solid #2A2A2D', borderRadius: '10px', padding: '14px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}>← Back</button>
              <button onClick={handleChallengeContinue} disabled={!challenge} style={{ flex: 2, background: challenge ? '#00FF9F' : '#2A2A2D', color: challenge ? '#0E0E0F' : '#9A9A9F', border: 'none', borderRadius: '10px', padding: '14px', fontSize: '15px', fontWeight: 700, cursor: challenge ? 'pointer' : 'default', transition: 'all 0.15s' }}>
                {challenge ? 'Generate my setup →' : 'Continue →'}
              </button>
            </div>
          </>
        )}

        {/* STEP 4 — AI RESULT */}
        {step === 'result' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              {aiLoading ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '16px' }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00FF9F', animation: `bounce 0.8s ease-in-out ${i * 0.15}s infinite` }} />
                    ))}
                  </div>
                  <h1 style={{ fontFamily: '"Exo 2", sans-serif', fontSize: '22px', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>
                    Setting up your account...
                  </h1>
                  <p style={{ fontSize: '14px', color: '#9A9A9F' }}>Personalizing your experience based on your answers</p>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>✦</div>
                  <h1 style={{ fontFamily: '"Exo 2", sans-serif', fontSize: '24px', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>
                    You're all set, {trainerName}
                  </h1>
                  <p style={{ fontSize: '14px', color: '#9A9A9F' }}>Here's your personalized quick start</p>
                </>
              )}
            </div>

            {!aiLoading && (
              <>
                {/* QUICK START TIP */}
                <div style={{ background: 'rgba(0,255,159,0.06)', border: '1px solid rgba(0,255,159,0.25)', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#00FF9F', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>Your quick-start tip</div>
                  <p style={{ fontSize: '14px', color: '#ffffff', lineHeight: 1.6 }}>{quickStartTip}</p>
                </div>

                {/* WELCOME MESSAGE */}
                <div style={{ background: '#1A1A1C', border: '1px solid #2A2A2D', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Send this to your players now</div>
                    <button
                      onClick={copyWelcomeMessage}
                      style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '6px', border: 'none', background: copied ? '#00FF9F' : '#2A2A2D', color: copied ? '#0E0E0F' : '#ffffff', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>
                      {copied ? '✓ Copied!' : 'Copy'}
                    </button>
                  </div>
                  <p style={{ fontSize: '14px', color: '#ffffff', lineHeight: 1.7 }}>{welcomeMessage}</p>
                </div>

                <button
                  onClick={() => router.push('/dashboard')}
                  style={{ width: '100%', background: '#00FF9F', color: '#0E0E0F', border: 'none', borderRadius: '10px', padding: '14px', fontSize: '15px', fontWeight: 700, cursor: 'pointer' }}>
                  Go to my dashboard →
                </button>

                <p style={{ fontSize: '12px', color: '#9A9A9F', textAlign: 'center', marginTop: '12px' }}>
                  You can access this welcome message anytime from your dashboard
                </p>
              </>
            )}
          </>
        )}

      </div>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  )
}
