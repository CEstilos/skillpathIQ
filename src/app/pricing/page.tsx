import Link from 'next/link'

export default function PricingPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#ffffff', fontFamily: 'sans-serif' }}>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>

      {/* NAV */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', height: '64px', borderBottom: '1px solid #f0f0f0', background: '#ffffff', position: 'sticky', top: 0, zIndex: 100 }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <img src="/logo-dark.png" alt="SkillPathIQ" style={{ height: '50px', width: 'auto' }} />
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Link href="/" style={{ fontSize: '14px', color: '#6B6B72', textDecoration: 'none' }}>Home</Link>
          <Link href="/auth/login" style={{ fontSize: '14px', color: '#6B6B72', textDecoration: 'none' }}>Sign in</Link>
          <Link href="/auth/signup" style={{ background: '#00FF9F', color: '#0E0E0F', padding: '8px 18px', borderRadius: '8px', fontSize: '14px', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>Get early access</Link>
        </div>
      </nav>

      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>

        {/* EARLY ACCESS BADGE */}
        <div style={{ display: 'inline-block', background: 'rgba(0,255,159,0.1)', border: '1px solid rgba(0,255,159,0.3)', borderRadius: '99px', padding: '6px 16px', fontSize: '13px', fontWeight: 600, color: '#00AA6D', marginBottom: '24px' }}>
          Early access — currently free
        </div>

        <h1 style={{ fontFamily: '"Exo 2", sans-serif', fontSize: '42px', fontWeight: 800, color: '#0E0E0F', marginBottom: '20px', letterSpacing: '-0.5px' }}>
          Free while we build it together
        </h1>

        <p style={{ fontSize: '18px', color: '#6B6B72', lineHeight: 1.7, maxWidth: '520px', margin: '0 auto 48px' }}>
          SkillPathIQ is completely free during our early access period. We&apos;re focused on building the best possible tool for independent sports trainers — and we want your feedback to shape it.
        </p>

        {/* SINGLE CARD */}
        <div style={{ background: '#0E0E0F', border: '2px solid #00FF9F', borderRadius: '20px', padding: '40px', marginBottom: '48px' }}>
          <div style={{ fontFamily: '"Exo 2", sans-serif', fontSize: '52px', fontWeight: 800, color: '#00FF9F', marginBottom: '8px' }}>$0</div>
          <div style={{ fontSize: '18px', color: '#9A9A9F', marginBottom: '28px' }}>during early access · no credit card required</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px', textAlign: 'left' }}>
            {[
              'Unlimited players and groups',
              'Session logging with notes',
              'Drill assignment and player checklists',
              'Client retention dashboard',
              'Revenue tracking and business insights',
              'Parent reports',
              'Player profiles with full history',
              'Multi-sport support',
            ].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ color: '#00FF9F', fontSize: '16px', flexShrink: 0 }}>✓</span>
                <span style={{ fontSize: '15px', color: '#ffffff' }}>{f}</span>
              </div>
            ))}
          </div>
          <Link href="/auth/signup" style={{ display: 'block', textAlign: 'center', background: '#00FF9F', color: '#0E0E0F', padding: '14px', borderRadius: '10px', fontSize: '16px', fontWeight: 700, textDecoration: 'none' }}>
            Get early access — it&apos;s free
          </Link>
        </div>

        {/* FOUNDING TRAINER NOTE */}
        <div style={{ background: '#f8f8f8', borderRadius: '16px', padding: '32px', marginBottom: '48px' }}>
          <h3 style={{ fontFamily: '"Exo 2", sans-serif', fontSize: '20px', fontWeight: 700, color: '#0E0E0F', marginBottom: '12px' }}>
            What about when paid plans launch?
          </h3>
          <p style={{ fontSize: '15px', color: '#6B6B72', lineHeight: 1.7 }}>
            When we introduce paid plans we&apos;ll give everyone at least 30 days notice. Trainers who join during early access will receive a permanent founding member discount as a thank you for helping shape the product. We&apos;ll always be transparent about pricing before anything changes.
          </p>
        </div>

        {/* FAQ */}
        <div style={{ textAlign: 'left' }}>
          <h2 style={{ fontFamily: '"Exo 2", sans-serif', fontSize: '24px', fontWeight: 700, color: '#0E0E0F', marginBottom: '24px', textAlign: 'center' }}>Common questions</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[
              { q: 'How long is early access free?', a: 'We haven\'t set a specific end date. We\'ll give all users at least 30 days notice before introducing paid plans.' },
              { q: 'Do I need a credit card to sign up?', a: 'No — early access is completely free with no payment information required.' },
              { q: 'What happens to my data if I don\'t upgrade later?', a: 'Your data is always yours. If you choose not to upgrade we\'ll give you a way to export everything.' },
              { q: 'Do you offer discounts for gyms with multiple trainers?', a: 'Yes — reach out to support@skillpathiq.com and we\'ll work something out.' },
              { q: 'What sports does SkillPathIQ support?', a: 'Basketball, football, baseball, softball, golf, soccer, tennis, volleyball, and more.' },
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
        <img src="/logo.png" alt="SkillPathIQ" style={{ height: '40px', width: 'auto' }} />
          <div style={{ display: 'flex', gap: '24px' }}>
            <Link href="/" style={{ fontSize: '13px', color: '#9A9A9F', textDecoration: 'none' }}>Home</Link>
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
