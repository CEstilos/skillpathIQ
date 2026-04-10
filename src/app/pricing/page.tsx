import Link from 'next/link'

export default function PricingPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#ffffff', fontFamily: 'sans-serif' }}>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @media (max-width: 640px) {
          .pricing-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* NAV */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', height: '64px', borderBottom: '1px solid #f0f0f0', background: '#ffffff', position: 'sticky', top: 0, zIndex: 100 }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontFamily: 'monospace', fontSize: '18px', fontWeight: 700, color: '#0E0E0F', letterSpacing: '2px' }}>
            SkillPath<span style={{ color: '#00FF9F' }}>IQ</span>
          </span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <Link href="/" style={{ fontSize: '14px', color: '#6B6B72', textDecoration: 'none' }}>Home</Link>
          <Link href="/auth/login" style={{ fontSize: '14px', color: '#6B6B72', textDecoration: 'none' }}>Sign in</Link>
          <Link href="/auth/signup" style={{ background: '#00FF9F', color: '#0E0E0F', padding: '8px 18px', borderRadius: '8px', fontSize: '14px', fontWeight: 700, textDecoration: 'none' }}>Get early access</Link>
        </div>
      </nav>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '80px 24px' }}>

        {/* HEADER */}
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>
          <div style={{ display: 'inline-block', background: 'rgba(0,255,159,0.1)', border: '1px solid rgba(0,255,159,0.3)', borderRadius: '99px', padding: '6px 16px', fontSize: '13px', fontWeight: 600, color: '#00AA6D', marginBottom: '20px' }}>
            Currently free during early access
          </div>
          <h1 style={{ fontFamily: '"Exo 2", sans-serif', fontSize: '42px', fontWeight: 800, color: '#0E0E0F', marginBottom: '16px', letterSpacing: '-0.5px' }}>
            Simple, honest pricing
          </h1>
          <p style={{ fontSize: '18px', color: '#6B6B72', lineHeight: 1.6, maxWidth: '480px', margin: '0 auto' }}>
            Free while we&apos;re in early access. When we launch paid plans, founding trainers lock in a permanent discount.
          </p>
        </div>

        {/* PRICING CARDS */}
        <div className="pricing-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '56px' }}>

          {/* STARTER */}
          <div style={{ background: '#ffffff', border: '1px solid #e5e5e5', borderRadius: '16px', padding: '32px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#6B6B72', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Starter</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '8px' }}>
              <span style={{ fontFamily: '"Exo 2", sans-serif', fontSize: '42px', fontWeight: 800, color: '#0E0E0F' }}>$19</span>
              <span style={{ fontSize: '16px', color: '#6B6B72' }}>/month</span>
            </div>
            <p style={{ fontSize: '14px', color: '#6B6B72', marginBottom: '28px', lineHeight: 1.5 }}>For trainers just getting started with a small roster</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
              {[
                '1 training group',
                'Up to 8 players',
                'Session logging',
                'Drill assignment',
                'Player checklists',
                'Parent reports',
                'Client retention dashboard',
              ].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ color: '#00AA6D', fontSize: '14px', flexShrink: 0 }}>✓</span>
                  <span style={{ fontSize: '14px', color: '#333' }}>{f}</span>
                </div>
              ))}
            </div>
            <Link href="/auth/signup" style={{ display: 'block', textAlign: 'center', background: '#f5f5f5', color: '#0E0E0F', padding: '12px', borderRadius: '8px', fontSize: '14px', fontWeight: 700, textDecoration: 'none' }}>
              Get early access free
            </Link>
          </div>

          {/* PRO */}
          <div style={{ background: '#0E0E0F', border: '2px solid #00FF9F', borderRadius: '16px', padding: '32px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: '#00FF9F', color: '#0E0E0F', fontSize: '11px', fontWeight: 700, padding: '4px 14px', borderRadius: '99px', whiteSpace: 'nowrap' }}>
              MOST POPULAR
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#9A9A9F', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Pro</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '8px' }}>
              <span style={{ fontFamily: '"Exo 2", sans-serif', fontSize: '42px', fontWeight: 800, color: '#ffffff' }}>$39</span>
              <span style={{ fontSize: '16px', color: '#9A9A9F' }}>/month</span>
            </div>
            <p style={{ fontSize: '14px', color: '#9A9A9F', marginBottom: '28px', lineHeight: 1.5 }}>For serious trainers running a full training business</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
              {[
                'Unlimited groups',
                'Unlimited players',
                'Everything in Starter',
                'My Numbers business dashboard',
                'Revenue tracking',
                'Rolling 30-day comparisons',
                'Re-engage messaging',
                'Player profiles with full history',
                'Priority support',
              ].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ color: '#00FF9F', fontSize: '14px', flexShrink: 0 }}>✓</span>
                  <span style={{ fontSize: '14px', color: '#ffffff' }}>{f}</span>
                </div>
              ))}
            </div>
            <Link href="/auth/signup" style={{ display: 'block', textAlign: 'center', background: '#00FF9F', color: '#0E0E0F', padding: '12px', borderRadius: '8px', fontSize: '14px', fontWeight: 700, textDecoration: 'none' }}>
              Get early access free
            </Link>
          </div>
        </div>

        {/* EARLY ACCESS BANNER */}
        <div style={{ background: 'rgba(0,255,159,0.06)', border: '1px solid rgba(0,255,159,0.2)', borderRadius: '16px', padding: '32px', textAlign: 'center', marginBottom: '48px' }}>
          <h3 style={{ fontFamily: '"Exo 2", sans-serif', fontSize: '20px', fontWeight: 700, color: '#0E0E0F', marginBottom: '10px' }}>
            Sign up now and lock in founding trainer pricing
          </h3>
          <p style={{ fontSize: '15px', color: '#6B6B72', lineHeight: 1.6, maxWidth: '480px', margin: '0 auto 20px' }}>
            SkillPathIQ is free during early access. Trainers who join now will receive a permanent discount when paid plans launch. No credit card required.
          </p>
          <Link href="/auth/signup" style={{ display: 'inline-block', background: '#00FF9F', color: '#0E0E0F', padding: '14px 32px', borderRadius: '10px', fontSize: '15px', fontWeight: 700, textDecoration: 'none' }}>
            Get early access — it&apos;s free
          </Link>
        </div>

        {/* FAQ */}
        <div>
          <h2 style={{ fontFamily: '"Exo 2", sans-serif', fontSize: '24px', fontWeight: 700, color: '#0E0E0F', marginBottom: '24px', textAlign: 'center' }}>Common questions</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[
              { q: 'When will paid plans launch?', a: 'We\'re currently in early access. We\'ll give all users at least 30 days notice before introducing paid plans.' },
              { q: 'What happens to my data if I don\'t upgrade?', a: 'Your data is always yours. If you choose not to upgrade when paid plans launch we\'ll give you a way to export everything.' },
              { q: 'Can I cancel anytime?', a: 'Yes — no contracts, no commitments. Cancel anytime from your account settings.' },
              { q: 'Do you offer discounts for gyms or facilities with multiple trainers?', a: 'Yes — reach out to support@skillpathiq.com and we\'ll work something out.' },
              { q: 'What sports does SkillPathIQ support?', a: 'Basketball, football, baseball, softball, golf, soccer, tennis, volleyball, and more. The platform works for any sport with independent trainers.' },
            ].map(faq => (
              <div key={faq.q} style={{ background: '#f8f8f8', borderRadius: '12px', padding: '20px' }}>
                <div style={{ fontSize: '15px', fontWeight: 600, color: '#0E0E0F', marginBottom: '8px' }}>{faq.q}</div>
                <div style={{ fontSize: '14px', color: '#6B6B72', lineHeight: 1.6 }}>{faq.a}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ background: '#0E0E0F', borderTop: '1px solid #2A2A2D', padding: '32px 24px', marginTop: '80px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <span style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: 700, color: '#ffffff', letterSpacing: '2px' }}>
            SkillPath<span style={{ color: '#00FF9F' }}>IQ</span>
          </span>
          <div style={{ display: 'flex', gap: '24px' }}>
            <Link href="/auth/signup" style={{ fontSize: '13px', color: '#9A9A9F', textDecoration: 'none' }}>Sign up</Link>
            <Link href="/auth/login" style={{ fontSize: '13px', color: '#9A9A9F', textDecoration: 'none' }}>Sign in</Link>
            <Link href="/terms" style={{ fontSize: '13px', color: '#9A9A9F', textDecoration: 'none' }}>Terms</Link>
            <a href="mailto:support@skillpathiq.com" style={{ fontSize: '13px', color: '#9A9A9F', textDecoration: 'none' }}>Contact</a>
          </div>
          <p style={{ fontSize: '13px', color: '#6B6B72' }}>© {new Date().getFullYear()} SkillPathIQ. All rights reserved.</p>
        </div>
      </div>
    </div>
  )
}
