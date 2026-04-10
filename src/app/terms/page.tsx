import Link from 'next/link'

export default function TermsPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#ffffff', fontFamily: 'sans-serif' }}>

      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', height: '64px', borderBottom: '1px solid #f0f0f0', background: '#ffffff' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontFamily: 'monospace', fontSize: '18px', fontWeight: 700, color: '#0E0E0F', letterSpacing: '2px' }}>
            SkillPath<span style={{ color: '#00FF9F' }}>IQ</span>
          </span>
        </Link>
        <Link href="/" style={{ fontSize: '14px', color: '#6B6B72', textDecoration: 'none' }}>← Back to home</Link>
      </nav>

      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '64px 24px' }}>
        <h1 style={{ fontFamily: '"Exo 2", sans-serif', fontSize: '36px', fontWeight: 700, color: '#0E0E0F', marginBottom: '8px' }}>Terms of Service</h1>
        <p style={{ fontSize: '14px', color: '#9A9A9F', marginBottom: '48px' }}>Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>

        {[
          {
            title: '1. Acceptance of terms',
            body: 'By creating an account and using SkillPathIQ you agree to these Terms of Service. If you do not agree, please do not use the service.',
          },
          {
            title: '2. Description of service',
            body: 'SkillPathIQ is a platform for independent sports trainers to manage players, log training sessions, assign drill work, and track their training business. The service is provided as-is during an early access period.',
          },
          {
            title: '3. Early access and pricing',
            body: 'SkillPathIQ is currently free during our early access period. We reserve the right to introduce paid plans at any time. We will provide all users with at least 30 days notice before requiring payment. Trainers who join during early access will receive preferential pricing when paid plans are introduced.',
          },
          {
            title: '4. Your data',
            body: 'You own your data. We do not sell your data to third parties. Player and parent information you enter is stored securely and used only to provide the service. You can request a data export or account deletion at any time by contacting support@skillpathiq.com.',
          },
          {
            title: '5. Player and parent data',
            body: 'By using SkillPathIQ you confirm that you have appropriate consent from players and parents to store their information in the platform. You are responsible for ensuring you have the right to share any personal information you enter.',
          },
          {
            title: '6. Acceptable use',
            body: 'You agree to use SkillPathIQ only for lawful purposes related to sports training and coaching. You may not use the service to harass, harm, or collect data on minors without appropriate consent.',
          },
          {
            title: '7. Account security',
            body: 'You are responsible for maintaining the security of your account credentials. Please use a strong password and do not share your login details. Notify us immediately at support@skillpathiq.com if you believe your account has been compromised.',
          },
          {
            title: '8. Termination',
            body: 'We reserve the right to suspend or terminate accounts that violate these terms. You may cancel your account at any time by contacting support@skillpathiq.com.',
          },
          {
            title: '9. Limitation of liability',
            body: 'SkillPathIQ is provided as-is without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of the service.',
          },
          {
            title: '10. Changes to these terms',
            body: 'We may update these terms from time to time. We will notify users of material changes via email. Continued use of the service after changes constitutes acceptance of the new terms.',
          },
          {
            title: '11. Contact',
            body: 'Questions about these terms? Email us at support@skillpathiq.com.',
          },
        ].map(section => (
          <div key={section.title} style={{ marginBottom: '32px' }}>
            <h2 style={{ fontFamily: '"Exo 2", sans-serif', fontSize: '18px', fontWeight: 700, color: '#0E0E0F', marginBottom: '10px' }}>{section.title}</h2>
            <p style={{ fontSize: '15px', color: '#555', lineHeight: 1.7 }}>{section.body}</p>
          </div>
        ))}
      </div>

      <div style={{ background: '#0E0E0F', borderTop: '1px solid #2A2A2D', padding: '32px 24px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <span style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: 700, color: '#ffffff', letterSpacing: '2px' }}>
            SkillPath<span style={{ color: '#00FF9F' }}>IQ</span>
          </span>
          <div style={{ display: 'flex', gap: '24px' }}>
            <Link href="/" style={{ fontSize: '13px', color: '#9A9A9F', textDecoration: 'none' }}>Home</Link>
            <Link href="/pricing" style={{ fontSize: '13px', color: '#9A9A9F', textDecoration: 'none' }}>Pricing</Link>
            <a href="mailto:support@skillpathiq.com" style={{ fontSize: '13px', color: '#9A9A9F', textDecoration: 'none' }}>Contact</a>
          </div>
          <p style={{ fontSize: '13px', color: '#6B6B72' }}>© {new Date().getFullYear()} SkillPathIQ. All rights reserved.</p>
        </div>
      </div>
    </div>
  )
}
