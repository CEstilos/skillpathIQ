import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

function emailHtml(body: string, footer: string) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff;">
      <div style="background: #0E0E0F; padding: 20px 32px; border-radius: 12px 12px 0 0; text-align: center;">
        <img src="https://skillpathiq.com/logo.png" alt="SkillPathIQ" style="height: 28px; width: auto; max-width: 160px;" />
      </div>
      <div style="padding: 32px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px;">
        <div style="font-size: 15px; color: #1a1a1a; line-height: 1.8; white-space: pre-wrap; margin-bottom: 28px;">${body}</div>
        <div style="border-top: 1px solid #e5e5e5; padding-top: 20px;">
          <p style="font-size: 12px; color: #999999; margin: 0;">${footer}</p>
        </div>
      </div>
    </div>
  `
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  const resend = new Resend(process.env.RESEND_API_KEY)

  const today = new Date().toISOString().split('T')[0]
  const thirtyDaysFromNow = new Date()
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
  const thirtyDaysFromNowStr = thirtyDaysFromNow.toISOString().split('T')[0]

  // Step 1: Expire packages where expiry_date < today
  const { data: toExpire } = await supabaseAdmin
    .from('player_packages')
    .select('id')
    .eq('status', 'active')
    .lt('expiry_date', today)
    .not('expiry_date', 'is', null)

  if (toExpire && toExpire.length > 0) {
    await supabaseAdmin
      .from('player_packages')
      .update({ status: 'expired' })
      .in('id', toExpire.map(p => p.id))
  }

  // Step 2: Send expiry reminders for packages expiring within 30 days
  const { data: expiringPackages } = await supabaseAdmin
    .from('player_packages')
    .select('*, trainer_packages(name, session_count)')
    .eq('status', 'active')
    .eq('expiry_reminder_sent', false)
    .gte('expiry_date', today)
    .lte('expiry_date', thirtyDaysFromNowStr)
    .not('expiry_date', 'is', null)

  let remindersCount = 0

  for (const pkg of (expiringPackages || [])) {
    try {
      // Fetch player
      const { data: player } = await supabaseAdmin
        .from('players')
        .select('full_name, parent_email, parent_name')
        .eq('id', pkg.player_id)
        .single()

      if (!player) continue

      // Fetch trainer
      const { data: trainer } = await supabaseAdmin
        .from('profiles')
        .select('full_name, email')
        .eq('id', pkg.trainer_id)
        .single()

      if (!trainer) continue

      const packageName = pkg.trainer_packages?.name || 'Package'
      const trainerFirstName = trainer.full_name.split(' ')[0]
      const playerFirstName = player.full_name.split(' ')[0]
      const expiryDate = new Date(pkg.expiry_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      const dashboardUrl = 'https://skillpathiq.com/dashboard'

      // Email to trainer
      const trainerBody = [
        `Hi ${trainerFirstName},`,
        ``,
        `${player.full_name}'s ${packageName} package is expiring on ${expiryDate}.`,
        ``,
        `They have ${pkg.sessions_remaining} session${pkg.sessions_remaining !== 1 ? 's' : ''} remaining.`,
        ``,
        `You may want to reach out about renewal.`,
      ].join('\n')

      await resend.emails.send({
        from: 'SkillPathIQ <noreply@skillpathiq.app>',
        to: [trainer.email],
        subject: `Package expiring soon: ${player.full_name} — ${packageName}`,
        html: emailHtml(
          trainerBody,
          `<a href="${dashboardUrl}" style="color: #00CC7A; text-decoration: none; font-weight: 600;">View in dashboard →</a> · Sent via SkillPathIQ`
        ),
      }).catch(() => {})

      // Email to parent
      if (player.parent_email) {
        const parentBody = [
          `Hi${player.parent_name ? ` ${player.parent_name}` : ''},`,
          ``,
          `${playerFirstName}'s ${packageName} package with ${trainer.full_name} expires on ${expiryDate}.`,
          ``,
          `${playerFirstName} has ${pkg.sessions_remaining} session${pkg.sessions_remaining !== 1 ? 's' : ''} remaining.`,
          ``,
          `Contact ${trainerFirstName} to renew and keep the training momentum going.`,
          ``,
          `— SkillPathIQ`,
        ].join('\n')

        await resend.emails.send({
          from: 'SkillPathIQ <noreply@skillpathiq.app>',
          to: [player.parent_email],
          replyTo: trainer.email,
          subject: `${playerFirstName}'s training package expires soon`,
          html: emailHtml(
            parentBody,
            `Sent via <a href="https://skillpathiq.com" style="color: #00CC7A; text-decoration: none; font-weight: 600;">SkillPathIQ</a>`
          ),
        }).catch(() => {})
      }

      // Mark reminder sent
      await supabaseAdmin
        .from('player_packages')
        .update({ expiry_reminder_sent: true })
        .eq('id', pkg.id)

      remindersCount++
    } catch {
      // Continue with next package
    }
  }

  return NextResponse.json({
    success: true,
    expired: toExpire?.length || 0,
    reminders_sent: remindersCount,
  })
}
