import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'

export default async function LandingPage() {
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
        }
      `}</style>

      {/* NAV */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', height: '64px', borderBottom: '1px solid #f0f0f0', background: '#ffffff', position: 'sticky', top: 0, zIndex: 100 }}>
        <span style={{ fontFamily: 'monospace', fontSize: '18px', fontWeight: 700, color: '#0E0E0F', letterSpacing: '2px' }}>
          SkillPath<span style={{ color: '#00FF9F' }}>IQ</span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <a href="#features" style={{ fontSize: '14px', color: '#6B6B72', textDecoration: 'none' }}>Features</a>
          <a href="#how-it-works" style={{ fontSize: '14px', color: '#6B6B72', textDecoration: 'none' }}>How it works</a>
          <Link href="/auth/login" style={{ fontSize: '14px', color: '#6B6B72', textDecoration: 'none' }}>Sign in</Link>
          <Link href="/auth/signup" className="nav-cta" style={{ background: '#00FF9F', color: '#0E0E0F', padding: '8px 18px', borderRadius: '8px', fontSize: '14px', fontWeight: 700, textDecoration: 'none' }}>Get early access</Link>
        </div>
      </nav>

      {/* HERO */}
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '80px 24px 64px', textAlign: 'center' }}>
        <div className="fade-up" style={{ display: 'inline-block', background: 'rgba(0,255,159,0.1)', border: '1px solid rgba(0,255,159,0.3)', borderRadius: '99px', padding: '6px 16px', fontSize: '13px', fontWeight: 600, color: '#00AA6D', marginBottom: '24px' }}>
          Now in early access · Free for founding trainers
        </div>

        <h1 className="hero-title fade-up-2" style={{ fontFamily: '"Exo 2", sans-serif', fontSize: '56px', fontWeight: 800, color: '#0E0E0F', lineHeight: 1.1, marginBottom: '24px', letterSpacing: '-0.5px' }}>
          Track your players.<br />Grow your training business.
        </h1>

        <p className="fade-up-3" style={{ fontSize: '20px', color: '#6B6B72', lineHeight: 1.6, maxWidth: '640px', margin: '0 auto 40px' }}>
          SkillPathIQ helps independent basketball trainers manage players, log sessions, track revenue, and never lose a client to silence again.
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
        <div style={{ maxWidth: '900px', margin: '0 auto', background: '#1A1A1C', borderRadius: '16px', border: '1px solid #2A2A2D', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #2A2A2D', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: 700, color: '#ffffff', letterSpacing: '2px' }}>SkillPath<span style={{ color: '#00FF9F' }}>IQ</span></span>
            <div style={{ display: 'flex', gap: '20px' }}>
              <span style={{ fontSize: '13px', color: '#ffffff', fontWeight: 600, borderBottom: '2px solid #00FF9F', paddingBottom: '2px' }}>Training Hub</span>
              <span style={{ fontSize: '13px', color: '#9A9A9F' }}>My Numbers</span>
              <span style={{ fontSize: '13px', color: '#9A9A9F' }}>Settings</span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', padding: '20px' }}>
            {[
              { label: 'Total', value: '12', color: '#ffffff' },
              { label: 'Active', value: '8', color: '#00FF9F' },
              { label: 'At risk', value: '3', color: '#F5A623' },
              { label: 'Lapsed', value: '1', color: '#E03131' },
            ].map(s => (
              <div key={s.label} style={{ background: '#0E0E0F', borderRadius: '10px', padding: '14px' }}>
                <div style={{ fontSize: '10px', color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>{s.label}</div>
                <div style={{ fontFamily: 'monospace', fontSize: '28px', fontWeight: 700, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
          <div style={{ padding: '0 20px 20px' }}>
            {[
              { name: 'Marcus Johnson', group: 'Monday Group', last: 'Today', status: 'Active', statusColor: '#00FF9F', statusBg: 'rgba(0,255,159,0.12)' },
              { name: 'Aiden Lee', group: 'Individual', last: '3 days ago', status: 'Active', statusColor: '#00FF9F', statusBg: 'rgba(0,255,159,0.12)' },
              { name: 'Kayla Rivera', group: 'Monday Group', last: '22 days ago', status: 'At risk', statusColor: '#F5A623', statusBg: 'rgba(245,166,35,0.15)' },
              { name: 'Tyler Shaw', group: 'Individual', last: '38 days ago', status: 'Lapsed', statusColor: '#E03131', statusBg: 'rgba(224,49,49,0.15)' },
            ].map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: '#0E0E0F', borderRadius: '10px', marginBottom: '8px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(0,255,159,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#00FF9F', flexShrink: 0 }}>
                  {p.name.split(' ').map((n: string) => n[0]).join('')}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>{p.name}</div>
                  <div style={{ fontSize: '11px', color: '#9A9A9F', marginTop: '2px' }}>{p.group}</div>
                </div>
                <div style={{ fontSize: '12px', color: '#9A9A9F' }}>{p.last}</div>
                <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '99px', background: p.statusBg, color: p.statusColor }}>{p.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FEATURES */}
      <div id="features" style={{ maxWidth: '1000px', margin: '0 auto', padding: '80px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>
          <h2 style={{ fontFamily: '"Exo 2", sans-serif', fontSize: '36px', fontWeight: 700, color: '#0E0E0F', marginBottom: '12px' }}>
            Everything a trainer needs. Nothing they don&apos;t.
          </h2>
          <p style={{ fontSize: '16px', color: '#6B6B72', maxWidth: '500px', margin: '0 auto' }}>
            Built specifically for independent basketball trainers running small groups and 1-on-1 sessions.
          </p>
        </div>
        <div className="feature-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
          {[
            { icon: '📋', title: 'Session logging', desc: 'Log every session in seconds. Track individual and group sessions separately with notes on what you worked on. Your full training history in one place.' },
            { icon: '📡', title: 'Client retention', desc: 'See every client you\'ve trained, when you last worked with them, and who\'s going quiet. One tap copies a re-engagement message to send to the parent before you lose them.' },
            { icon: '💰', title: 'Revenue tracking', desc: 'Set your individual and group session rates. SkillPathIQ automatically estimates your monthly and yearly revenue based on your logged sessions — no spreadsheet needed.' },
          ].map(f => (
            <div key={f.title} style={{ background: 'rgba(0,255,159,0.06)', border: '1px solid rgba(0,255,159,0.2)', borderRadius: '16px', padding: '28px' }}>
              <div style={{ fontSize: '28px', marginBottom: '16px' }}>{f.icon}</div>
              <h3 style={{ fontFamily: '"Exo 2", sans-serif', fontSize: '18px', fontWeight: 700, color: '#0E0E0F', marginBottom: '10px' }}>{f.title}</h3>
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
              { step: '01', title: 'Add your players', desc: 'Add players individually or organize them into groups. Individual and group players both work — no rigid structure required.' },
              { step: '02', title: 'Log your sessions', desc: 'After every session, log who you trained, the date, session type, and any notes. Takes less than 30 seconds.' },
              { step: '03', title: 'Watch your business come into focus', desc: 'Your Training Hub shows who\'s active, who\'s at risk, and who needs a follow-up. My Numbers shows your revenue and growth over time.' },
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
            &ldquo;Finally a tool built for trainers like me — not a team management app I have to hack to work for 1-on-1 training.&rdquo;
          </p>
          <p style={{ fontSize: '14px', color: '#9A9A9F' }}>Independent basketball trainer · Salt Lake City, UT</p>
        </div>
      </div>

      {/* CTA */}
      <div style={{ background: '#0E0E0F', padding: '80px 24px', textAlign: 'center' }}>
        <h2 style={{ fontFamily: '"Exo 2", sans-serif', fontSize: '36px', fontWeight: 800, color: '#ffffff', marginBottom: '16px' }}>
          Ready to run your training business smarter?
        </h2>
        <p style={{ fontSize: '18px', color: '#9A9A9F', marginBottom: '36px', maxWidth: '480px', margin: '0 auto 36px' }}>
          Join as a founding trainer and get free access while we build it out together.
        </p>
        <Link href="/auth/signup" style={{ background: '#00FF9F', color: '#0E0E0F', padding: '16px 40px', borderRadius: '10px', fontSize: '17px', fontWeight: 700, textDecoration: 'none', display: 'inline-block' }}>
          Get early access — it&apos;s free
        </Link>
        <p style={{ fontSize: '13px', color: '#6B6B72', marginTop: '12px' }}>No credit card · No trial clock · Cancel anytime</p>
      </div>

      {/* FOOTER */}
      <div style={{ background: '#0E0E0F', borderTop: '1px solid #2A2A2D', padding: '32px 24px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <span style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: 700, color: '#ffffff', letterSpacing: '2px' }}>
            SkillPath<span style={{ color: '#00FF9F' }}>IQ</span>
          </span>
          <div style={{ display: 'flex', gap: '24px' }}>
            <Link href="/auth/signup" style={{ fontSize: '13px', color: '#9A9A9F', textDecoration: 'none' }}>Sign up</Link>
            <Link href="/auth/login" style={{ fontSize: '13px', color: '#9A9A9F', textDecoration: 'none' }}>Sign in</Link>
          </div>
          <p style={{ fontSize: '13px', color: '#6B6B72' }}>© {new Date().getFullYear()} SkillPathIQ. All rights reserved.</p>
        </div>
      </div>

    </div>
  )
}
