import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { NextResponse, NextRequest } from 'next/server'

function emailHtml(body: string) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff;">
      <div style="background: #0E0E0F; padding: 20px 32px; border-radius: 12px 12px 0 0; text-align: center;">
        <img src="https://skillpathiq.com/logo.png" alt="SkillPathIQ" style="height: 28px; width: auto; max-width: 160px;" />
      </div>
      <div style="padding: 32px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px;">
        <div style="font-size: 15px; color: #1a1a1a; line-height: 1.8; white-space: pre-wrap; margin-bottom: 28px;">${body}</div>
        <div style="border-top: 1px solid #e5e5e5; padding-top: 20px;">
          <p style="font-size: 12px; color: #999999; margin: 0;">Sent via <a href="https://skillpathiq.com" style="color: #00CC7A; text-decoration: none; font-weight: 600;">SkillPathIQ</a></p>
        </div>
      </div>
    </div>
  `
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  // Validate next param — only allow internal paths
  const redirectTo = next?.startsWith('/') ? next : '/dashboard'
  const isRecovery = redirectTo === '/reset-password'

  if (code) {
    const supabase = await createServerSupabaseClient()
    const { data: { session } } = await supabase.auth.exchangeCodeForSession(code)

    // Skip welcome email for password recovery flows
    if (session?.user && !isRecovery) {
      try {
        const supabaseAdmin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false } }
        )

        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('id, full_name, email, onboarding_emails_sent')
          .eq('id', session.user.id)
          .single()

        if (profile && !profile.onboarding_emails_sent?.welcome) {
          const firstName = (profile.full_name || 'there').split(' ')[0]
          const dashUrl = 'https://skillpathiq.com/dashboard'

          const body = [
            `Hi ${firstName},`,
            ``,
            `Welcome to SkillPathIQ — you're all set up. Here's where to start:`,
            ``,
            `1. Add your first player → ${dashUrl}/players/new`,
            `2. Set up your public profile → ${dashUrl}/settings`,
            `3. Get your booking link → ${dashUrl}/settings`,
            ``,
            `Once you're set up, parents can find you, request sessions, and you can track everything from one place.`,
            ``,
            `— The SkillPathIQ team`,
          ].join('\n')

          const resend = new Resend(process.env.RESEND_API_KEY)
          await resend.emails.send({
            from: 'SkillPathIQ <noreply@skillpathiq.app>',
            to: [profile.email],
            subject: `You're in — here's where to start`,
            html: emailHtml(body),
          }).catch(() => {})

          await Promise.resolve(
            supabaseAdmin
              .from('profiles')
              .update({ onboarding_emails_sent: { ...(profile.onboarding_emails_sent || {}), welcome: true } })
              .eq('id', profile.id)
          ).catch(() => {})
        }
      } catch {
        // don't block redirect on email failure
      }
    }
  }

  return NextResponse.redirect(`${origin}${redirectTo}`)
}
