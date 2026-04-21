import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <div style={{ minHeight: '100vh', background: '#ffffff', fontFamily: 'sans-serif', overflowX: 'hidden' }}>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @import url('https://fonts.googleapis.com/css2?family=Exo+2:wght@600;700;800&display=swap');
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fadeUp 0.6s ease forwards; }
        .fade-up-2 { animation: fadeUp 0.6s ease 0.15s forwards; opacity: 0; }
        .fade-up-3 { animation: fadeUp 0.6s ease 0.3s forwards; opacity: 0; }
        @media (max-width: 640px) {
          .hero-title { font-size: 36px !important; }
          .feature-grid { grid-template-columns: 1fr !important; }
          .nav-cta { display: none !important; }
          .hero-buttons { flex-direction: column !important; }
          .hero-buttons a { width: 100% !important; text-align: center !important; }
          .footer-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
          .nav-links a { font-size: 12px !important; }
          .nav-links { gap: 10px !important; }
          .preview-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* NAV */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: '64px', borderBottom: '1px solid #f0f0f0', background: '#ffffff', position: 'sticky', top: 0, zIndex: 100, width: '100%', boxSizing: 'border-box' }}>
        <img src="/logo-dark.png" alt="SkillPathIQ" style={{ height: '195px', width: 'auto' }} />
        <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <a href="#features" style={{ fontSize: '14px', color: '#6B6B72', textDecoration: 'none' }}>Features</a>
          <a href="#how-it-works" style={{ fontSize: '14px', color: '#6B6B72', textDecoration: 'none' }}>How it works</a>
          <Link href="/pricing" style={{ fontSize: '14px', color: '#6B6B72', textDecoration: 'none' }}>Pricing</Link>
          <Link href="/auth/login" style={{ fontSize: '14px', color: '#6B6B72', textDecoration: 'none' }}>Sign in</Link>
          <Link href="/auth/signup" className="nav-cta" style={{ background: '#00FF9F', color: '#0E0E0F', padding: '8px 18px', borderRadius: '8px', fontSize: '14px', fontWeight: 700, textDecoration: 'none' }}>Get early access</Link>
        </div>
      </nav>

      {/* HERO */}
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '80px 24px 64px', textAlign: 'center' }}>
        <div className="fade-up" style={{ display: 'inline-block', background: 'rgba(0,255,159,0.1)', border: '1px solid rgba(0,255,159,0.3)', borderRadius: '99px', padding: '6px 16px', fontSize: '13px', fontWeight: 600, color: '#00AA6D', marginBottom: '24px' }}>
          Now in early access · Free for a limited number of early users
        </div>

        <h1 className="hero-title fade-up-2" style={{ fontFamily: '"Exo 2", sans-serif', fontSize: '56px', fontWeight: 800, color: '#0E0E0F', lineHeight: 1.1, marginBottom: '24px', letterSpacing: '-0.5px' }}>
          Keep parents in the loop.<br />Keep clients coming back.
        </h1>

        <p className="fade-up-3" style={{ fontSize: '20px', color: '#6B6B72', lineHeight: 1.6, maxWidth: '640px', margin: '0 auto 40px' }}>
          SkillPathIQ helps independent sports trainers send AI-powered parent updates, assign homework drills, and track their business — all in under 60 seconds per session.
        </p>

        <div className="hero-buttons fade-up-3" style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/auth/signup" style={{ background: '#00FF9F', color: '#0E0E0F', padding: '14px 32px', borderRadius: '10px', fontSize: '16px', fontWeight: 700, textDecoration: 'none', display: 'inline-block' }}>
            Get early access — it&apos;s free
          </Link>
          <a href="#features" style={{ background: '#f5f5f5', color: '#0E0E0F', padding: '14px 32px', borderRadius: '10px', fontSize: '16px', fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}>
            See how it works
          </a>
        </div>

        <p style={{ fontSize: '13px', color: '#9A9A9F', marginTop: '16px' }}>No credit card required · Free for founding trainers</p>
      </div>

      {/* APP PREVIEW */}
      <div style={{ background: '#0E0E0F', padding: '48px 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <p style={{ textAlign: 'center', fontSize: '13px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '32px' }}>Everything in one place</p>
          <div className="preview-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>

            {/* TRAINING HUB PREVIEW */}
            <div style={{ background: '#1A1A1C', borderRadius: '12px', border: '1px solid #2A2A2D', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #2A2A2D', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Training Hub</span>
                <span style={{ fontSize: '10px', color: '#00FF9F', fontWeight: 600 }}>Today</span>
              </div>
              <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ background: 'rgba(0,255,159,0.05)', border: '1px solid rgba(0,255,159,0.2)', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '10px', color: '#00FF9F', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Today&apos;s sessions</div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff', marginBottom: '2px' }}>Monday Group</div>
                  <div style={{ fontSize: '10px', color: '#9A9A9F' }}>4:00pm · 4 players</div>
                  <div style={{ marginTop: '8px', display: 'flex', gap: '6px' }}>
                    <div style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '6px', background: '#00FF9F', color: '#0E0E0F', fontWeight: 700 }}>Log session</div>
                  </div>
                </div>
                <div style={{ background: '#0E0E0F', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '10px', color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>My Players</div>
                  {[
                    { initials: 'MJ', name: 'Marcus J.', status: 'Active', color: '#00FF9F', bg: 'rgba(0,255,159,0.12)' },
                    { initials: 'AL', name: 'Aiden L.', status: 'Active', color: '#00FF9F', bg: 'rgba(0,255,159,0.12)' },
                    { initials: 'KR', name: 'Kayla R.', status: 'At risk', color: '#F5A623', bg: 'rgba(245,166,35,0.15)' },
                  ].map(p => (
                    <div key={p.initials} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: p.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 700, color: p.color, flexShrink: 0 }}>{p.initials}</div>
                      <div style={{ flex: 1, fontSize: '11px', fontWeight: 500, color: '#ffffff' }}>{p.name}</div>
                      <span style={{ fontSize: '9px', fontWeight: 600, padding: '2px 6px', borderRadius: '99px', background: p.bg, color: p.color }}>{p.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* SESSION LOG + AI PREVIEW */}
            <div style={{ background: '#1A1A1C', borderRadius: '12px', border: '1px solid #2A2A2D', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #2A2A2D', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Session Log + AI</span>
                <span style={{ fontSize: '10px', color: '#00FF9F', fontWeight: 600 }}>✦ AI</span>
              </div>
              <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ background: '#0E0E0F', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '10px', color: '#9A9A9F', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Skills covered</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {['Ball handling', 'Crossover', 'Finishing'].map(s => (
                      <span key={s} style={{ fontSize: '9px', padding: '3px 7px', borderRadius: '99px', background: 'rgba(0,255,159,0.1)', border: '1px solid rgba(0,255,159,0.3)', color: '#00FF9F' }}>{s}</span>
                    ))}
                  </div>
                </div>
                <div style={{ background: 'rgba(0,255,159,0.05)', border: '1px solid rgba(0,255,159,0.2)', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '10px', color: '#00FF9F', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>✦ Parent summary</div>
                  <div style={{ fontSize: '10px', color: '#ffffff', lineHeight: 1.6 }}>Marcus had a strong session today. His crossover is really coming along and he finished consistently at the rim. Great focus throughout — keep working on the left hand this week!</div>
                </div>
                <div style={{ background: '#0E0E0F', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '10px', color: '#9A9A9F', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Homework drills</div>
                  {['Left hand dribbling — 3 sets · 45 sec', 'Cone crossover series — 5 reps', 'Wall finishing drill — 2 sets'].map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#2A2A2D', flexShrink: 0 }} />
                      <span style={{ fontSize: '10px', color: '#9A9A9F' }}>{d}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* MY PLAYERS + NUMBERS PREVIEW */}
            <div style={{ background: '#1A1A1C', borderRadius: '12px', border: '1px solid #2A2A2D', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #2A2A2D', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Analytics</span>
                <span style={{ fontSize: '10px', color: '#00FF9F', fontWeight: 600 }}>This month</span>
              </div>
              <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                  {[
                    { label: 'Active', value: '8', color: '#00FF9F' },
                    { label: 'At risk', value: '3', color: '#F5A623' },
                    { label: 'Est. revenue', value: '$840', color: '#ffffff' },
                    { label: 'Sessions', value: '24', color: '#ffffff' },
                  ].map(s => (
                    <div key={s.label} style={{ background: '#0E0E0F', borderRadius: '8px', padding: '8px 10px' }}>
                      <div style={{ fontSize: '9px', color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px' }}>{s.label}</div>
                      <div style={{ fontFamily: 'monospace', fontSize: '18px', fontWeight: 700, color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ background: '#0E0E0F', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '10px', color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>My Players — CRM</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {[
                      { name: 'Marcus J.', status: 'Active', days: '2d ago', color: '#00FF9F' },
                      { name: 'Kayla R.', status: 'At risk', days: '38d ago', color: '#F5A623' },
                      { name: 'Tyler S.', status: 'Lapsed', days: '72d ago', color: '#E03131' },
                    ].map(p => (
                      <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                        <span style={{ fontSize: '10px', color: '#ffffff', flex: 1 }}>{p.name}</span>
                        <span style={{ fontSize: '9px', color: '#9A9A9F' }}>{p.days}</span>
                        <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '4px', background: p.color === '#00FF9F' ? 'rgba(0,255,159,0.12)' : p.color === '#F5A623' ? 'rgba(245,166,35,0.15)' : 'rgba(224,49,49,0.15)', color: p.color }}>{p.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* FEATURES */}
      <div id="features" style={{ maxWidth: '1000px', margin: '0 auto', padding: '80px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>
          <h2 style={{ fontFamily: '"Exo 2", sans-serif', fontSize: '36px', fontWeight: 700, color: '#0E0E0F', marginBottom: '12px' }}>
            Built for how trainers actually work.
          </h2>
          <p style={{ fontSize: '16px', color: '#6B6B72', maxWidth: '500px', margin: '0 auto' }}>
            Every feature is designed to save time, improve parent communication, and keep clients coming back.
          </p>
        </div>
        <div className="feature-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
          {[
            {
              icon: '⚡',
              title: 'AI session recaps in seconds',
              desc: 'Tap the skills you worked on, add a quick note, and AI writes a personalized parent update and assigns age-appropriate homework drills — all in under 60 seconds.',
            },
            {
              icon: '📬',
              title: 'Parent communication built in',
              desc: 'Send AI-generated parent emails directly from the app after every session. Individual players, full groups, or broadcast to all active parents at once.',
            },
            {
              icon: '📊',
              title: 'Client retention analytics',
              desc: 'See every client\'s status — active, at risk, or lapsed — with one-tap re-engagement messages ready to send before you lose them for good.',
            },
            {
              icon: '🏋️',
              title: 'Homework drill assignments',
              desc: 'AI suggests drills based on what was covered in the session. Players check them off on their personal profile link — you see completion in real time.',
            },
            {
              icon: '💰',
              title: 'Revenue tracking',
              desc: 'Set your individual and group session rates. SkillPathIQ automatically estimates your monthly revenue based on logged sessions — no spreadsheet needed.',
            },
            {
              icon: '📅',
              title: 'Session scheduling',
              desc: 'Schedule one-off and recurring sessions for individuals and groups. See everything in your Training Hub with smart logging reminders when sessions go unlogged.',
            },
          ].map(f => (
            <div key={f.title} style={{ background: 'rgba(0,255,159,0.04)', border: '1px solid rgba(0,255,159,0.15)', borderRadius: '16px', padding: '28px' }}>
              <div style={{ fontSize: '28px', marginBottom: '16px' }}>{f.icon}</div>
              <h3 style={{ fontFamily: '"Exo 2", sans-serif', fontSize: '17px', fontWeight: 700, color: '#0E0E0F', marginBottom: '10px' }}>{f.title}</h3>
              <p style={{ fontSize: '14px', color: '#6B6B72', lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div id="how-it-works" style={{ background: '#f8f8f8', padding: '80px 24px' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontFamily: '"Exo 2", sans-serif', fontSize: '36px', fontWeight: 700, color: '#0E0E0F', marginBottom: '12px' }}>
            Up and running in minutes
          </h2>
          <p style={{ fontSize: '16px', color: '#6B6B72', marginBottom: '48px' }}>No complicated setup. No onboarding call. Just sign up and start logging.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'left' }}>
            {[
              { step: '01', title: 'Add your players and groups', desc: 'Add players individually or organize them into training groups. Set their age, skill level, and parent email so AI can personalize everything.' },
              { step: '02', title: 'Log sessions — let AI do the rest', desc: 'Tap the skills you worked on, hit generate, and AI writes a personalized parent recap and assigns homework drills in seconds. No typing required.' },
              { step: '03', title: 'Send updates and watch retention improve', desc: 'Email parents directly from the app. Players check off their homework on a shareable profile link. You see who\'s engaged, who\'s at risk, and who needs a follow-up.' },
            ].map(s => (
              <div key={s.step} style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', background: '#ffffff', borderRadius: '12px', padding: '24px', border: '1px solid #f0f0f0' }}>
                <div style={{ fontFamily: '"Exo 2", sans-serif', fontSize: '28px', fontWeight: 800, color: '#00FF9F', flexShrink: 0, lineHeight: 1 }}>{s.step}</div>
                <div>
                  <div style={{ fontFamily: '"Exo 2", sans-serif', fontSize: '16px', fontWeight: 700, color: '#0E0E0F', marginBottom: '6px' }}>{s.title}</div>
                  <div style={{ fontSize: '14px', color: '#6B6B72', lineHeight: 1.6 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* QUOTE */}
      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ background: '#f8f8f8', borderRadius: '16px', padding: '40px', border: '1px solid #f0f0f0' }}>
          <div style={{ fontSize: '32px', marginBottom: '16px' }}>🏀</div>
          <p style={{ fontSize: '18px', color: '#0E0E0F', fontWeight: 600, lineHeight: 1.5, marginBottom: '12px' }}>
            &ldquo;Parents used to ask me what their kid worked on. Now they already know — and they love it.&rdquo;
          </p>
          <p style={{ fontSize: '14px', color: '#9A9A9F' }}>Independent basketball trainer · Salt Lake City, UT</p>
        </div>
      </div>

      {/* CTA */}
      <div style={{ background: '#0E0E0F', padding: '80px 24px', textAlign: 'center' }}>
        <h2 style={{ fontFamily: '"Exo 2", sans-serif', fontSize: '36px', fontWeight: 800, color: '#ffffff', marginBottom: '16px' }}>
          Your clients deserve better follow-up.<br />So does your business.
        </h2>
        <p style={{ fontSize: '18px', color: '#9A9A9F', marginBottom: '36px', maxWidth: '480px', margin: '0 auto 36px' }}>
          Join as a founding trainer and get free access while we build it out together.
        </p>
        <Link href="/auth/signup" style={{ background: '#00FF9F', color: '#0E0E0F', padding: '16px 40px', borderRadius: '10px', fontSize: '17px', fontWeight: 700, textDecoration: 'none', display: 'inline-block' }}>
          Get early access — it&apos;s free
        </Link>
        <p style={{ fontSize: '13px', color: '#6B6B72', marginTop: '12px' }}>No credit card · No trial clock · Free for a limited number of early users</p>
      </div>

      {/* FOOTER */}
      <div style={{ background: '#0E0E0F', borderTop: '1px solid #2A2A2D', padding: '32px 24px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <img src="/logo.png" alt="SkillPathIQ" style={{ height: '32px', width: 'auto' }} />
          <div style={{ display: 'flex', gap: '24px' }}>
            <Link href="/auth/signup" style={{ fontSize: '13px', color: '#9A9A9F', textDecoration: 'none' }}>Sign up</Link>
            <Link href="/auth/login" style={{ fontSize: '13px', color: '#9A9A9F', textDecoration: 'none' }}>Sign in</Link>
            <Link href="/pricing" style={{ fontSize: '13px', color: '#9A9A9F', textDecoration: 'none' }}>Pricing</Link>
            <Link href="/terms" style={{ fontSize: '13px', color: '#9A9A9F', textDecoration: 'none' }}>Terms</Link>
            <a href="mailto:support@skillpathiq.com" style={{ fontSize: '13px', color: '#9A9A9F', textDecoration: 'none' }}>Contact</a>
          </div>
          <p style={{ fontSize: '13px', color: '#6B6B72' }}>© {new Date().getFullYear()} SkillPathIQ. All rights reserved.</p>
        </div>
      </div>

    </div>
  )
}
