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
      <img src="/logo-dark.png" alt="SkillPathIQ" style={{ height: '250px', width: 'auto' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
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
          Now in early access · Free for founding trainers
        </div>

        <h1 className="hero-title fade-up-2" style={{ fontFamily: '"Exo 2", sans-serif', fontSize: '56px', fontWeight: 800, color: '#0E0E0F', lineHeight: 1.1, marginBottom: '24px', letterSpacing: '-0.5px' }}>
          Track your players.<br />Grow your training business.
        </h1>

        <p className="fade-up-3" style={{ fontSize: '20px', color: '#6B6B72', lineHeight: 1.6, maxWidth: '640px', margin: '0 auto 40px' }}>
          SkillPathIQ helps independent sports trainers manage players, log sessions, track revenue, and never lose a client to silence again.
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
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <p style={{ textAlign: 'center', fontSize: '13px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '32px' }}>Everything in one place</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

          {/* TRAINING HUB PREVIEW */}
          <div style={{ background: '#1A1A1C', borderRadius: '12px', border: '1px solid #2A2A2D', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #2A2A2D', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Training Hub</span>
              <span style={{ fontSize: '10px', color: '#00FF9F', fontWeight: 600 }}>🏀 Live</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', padding: '12px' }}>
              {[
                { label: 'Active', value: '8', color: '#00FF9F' },
                { label: 'At risk', value: '3', color: '#F5A623' },
              ].map(s => (
                <div key={s.label} style={{ background: '#0E0E0F', borderRadius: '8px', padding: '10px' }}>
                  <div style={{ fontSize: '9px', color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>{s.label}</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '22px', fontWeight: 700, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[
                { initials: 'MJ', name: 'Marcus J.', status: 'Active', color: '#00FF9F', bg: 'rgba(0,255,159,0.12)' },
                { initials: 'AL', name: 'Aiden L.', status: 'Active', color: '#00FF9F', bg: 'rgba(0,255,159,0.12)' },
                { initials: 'KR', name: 'Kayla R.', status: 'At risk', color: '#F5A623', bg: 'rgba(245,166,35,0.15)' },
              ].map(p => (
                <div key={p.initials} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#0E0E0F', borderRadius: '8px', padding: '8px 10px' }}>
                  <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'rgba(0,255,159,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: '#00FF9F', flexShrink: 0 }}>{p.initials}</div>
                  <div style={{ flex: 1, fontSize: '11px', fontWeight: 500, color: '#ffffff' }}>{p.name}</div>
                  <span style={{ fontSize: '9px', fontWeight: 600, padding: '2px 7px', borderRadius: '99px', background: p.bg, color: p.color }}>{p.status}</span>
                </div>
              ))}
            </div>
          </div>

          {/* MY NUMBERS PREVIEW */}
          <div style={{ background: '#1A1A1C', borderRadius: '12px', border: '1px solid #2A2A2D', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #2A2A2D', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.08em' }}>My Numbers</span>
              <span style={{ fontSize: '10px', color: '#00FF9F', fontWeight: 600 }}>This month</span>
            </div>
            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { label: 'New players', value: '4', change: '+2 vs last month', color: '#ffffff' },
                { label: 'Active players', value: '8', change: '+1 vs prev 30d', color: '#00FF9F' },
                { label: 'Est. revenue', value: '$840', change: '+12% vs last month', color: '#ffffff' },
              ].map(s => (
                <div key={s.label} style={{ background: '#0E0E0F', borderRadius: '8px', padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '9px', color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px' }}>{s.label}</div>
                    <div style={{ fontFamily: 'monospace', fontSize: '20px', fontWeight: 700, color: s.color }}>{s.value}</div>
                  </div>
                  <div style={{ fontSize: '10px', color: '#00FF9F', fontWeight: 600, textAlign: 'right' }}>{s.change}</div>
                </div>
              ))}
              <div style={{ background: '#0E0E0F', borderRadius: '8px', padding: '10px 12px' }}>
                <div style={{ fontSize: '9px', color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Sessions — last 6 months</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '32px' }}>
                  {[2, 4, 3, 6, 5, 8].map((h, i) => (
                    <div key={i} style={{ flex: 1, background: i === 5 ? '#00FF9F' : 'rgba(0,255,159,0.3)', borderRadius: '2px 2px 0 0', height: `${(h / 8) * 100}%` }} />
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>
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
        <img src="/logo.png" alt="SkillPathIQ" style={{ height: '40px', width: 'auto' }} />
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
