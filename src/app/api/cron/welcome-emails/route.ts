import { NextResponse, NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const DEPLOYMENT_CUTOFF = '2026-05-08'

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
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  const resend = new Resend(process.env.RESEND_API_KEY)

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email, created_at, onboarding_emails_sent')
    .gte('created_at', DEPLOYMENT_CUTOFF)

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ sent: 0 })
  }

  const now = new Date()
  let sent = 0

  for (const profile of profiles) {
    const createdAt = new Date(profile.created_at)
    const daysSince = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
    const emailsSent = profile.onboarding_emails_sent || {}
    const firstName = (profile.full_name || 'there').split(' ')[0]
    const dashUrl = 'https://skillpathiq.com/dashboard'

    if (daysSince >= 2 && !emailsSent.day2) {
      const { count } = await supabase
        .from('players')
        .select('id', { count: 'exact', head: true })
        .eq('trainer_id', profile.id)

      if ((count ?? 0) === 0) {
        const body = [
          `Hi ${firstName},`,
          ``,
          `You signed up for SkillPathIQ but haven't added any players yet.`,
          ``,
          `It only takes 60 seconds — just a name and an email is all you need to get started.`,
          ``,
          `Add your first player → ${dashUrl}/players/new`,
          ``,
          `— The SkillPathIQ team`,
        ].join('\n')

        await resend.emails.send({
          from: 'SkillPathIQ <noreply@skillpathiq.app>',
          to: [profile.email],
          subject: `Your roster is empty — fix that in 60 seconds`,
          html: emailHtml(body),
        }).catch(() => {})

        await supabase
          .from('profiles')
          .update({ onboarding_emails_sent: { ...emailsSent, day2: true } })
          .eq('id', profile.id)

        sent++
      } else {
        await supabase
          .from('profiles')
          .update({ onboarding_emails_sent: { ...emailsSent, day2: true } })
          .eq('id', profile.id)
      }
    }

    if (daysSince >= 5 && !emailsSent.day5) {
      const { count } = await supabase
        .from('sessions')
        .select('id', { count: 'exact', head: true })
        .eq('trainer_id', profile.id)
        .not('player_id', 'is', null)

      if ((count ?? 0) === 0) {
        const body = [
          `Hi ${firstName},`,
          ``,
          `You've added players but haven't logged any sessions yet.`,
          ``,
          `Log your first session to start tracking your activity, revenue, and player retention.`,
          ``,
          `Log a session → ${dashUrl}/clients`,
          ``,
          `— The SkillPathIQ team`,
        ].join('\n')

        await resend.emails.send({
          from: 'SkillPathIQ <noreply@skillpathiq.app>',
          to: [profile.email],
          subject: `Log your first session to see your numbers`,
          html: emailHtml(body),
        }).catch(() => {})

        await supabase
          .from('profiles')
          .update({ onboarding_emails_sent: { ...emailsSent, day2: emailsSent.day2 ?? false, day5: true } })
          .eq('id', profile.id)

        sent++
      } else {
        await supabase
          .from('profiles')
          .update({ onboarding_emails_sent: { ...emailsSent, day2: emailsSent.day2 ?? false, day5: true } })
          .eq('id', profile.id)
      }
    }
  }

  return NextResponse.json({ sent, processed: profiles.length })
}
