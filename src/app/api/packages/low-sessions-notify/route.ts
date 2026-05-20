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

export async function POST(request: Request) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )
    const resend = new Resend(process.env.RESEND_API_KEY)

    const body = await request.json()
    const { player_package_id } = body

    if (!player_package_id) {
      return NextResponse.json({ error: 'Missing player_package_id' }, { status: 400 })
    }

    // Fetch player package with related data
    const { data: pkg } = await supabaseAdmin
      .from('player_packages')
      .select('*, trainer_packages(name, session_count)')
      .eq('id', player_package_id)
      .single()

    if (!pkg) return NextResponse.json({ error: 'Package not found' }, { status: 404 })

    // Fetch player
    const { data: player } = await supabaseAdmin
      .from('players')
      .select('full_name, parent_email, parent_name')
      .eq('id', pkg.player_id)
      .single()

    if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 })

    // Fetch trainer
    const { data: trainer } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email')
      .eq('id', pkg.trainer_id)
      .single()

    if (!trainer) return NextResponse.json({ error: 'Trainer not found' }, { status: 404 })

    const packageName = pkg.trainer_packages?.name || 'Package'
    const trainerFirstName = trainer.full_name.split(' ')[0]
    const playerFirstName = player.full_name.split(' ')[0]
    const dashboardUrl = 'https://skillpathiq.com/dashboard'

    // Email to trainer
    const trainerBody = [
      `Hi ${trainerFirstName},`,
      ``,
      `${player.full_name} has 1 session remaining on their ${packageName} package.`,
      ``,
      `You may want to reach out to ${player.parent_name || 'the parent'} about renewing their package.`,
      ``,
      `Log in to your dashboard to view their profile.`,
    ].join('\n')

    await resend.emails.send({
      from: 'SkillPathIQ <noreply@skillpathiq.app>',
      to: [trainer.email],
      subject: `Low sessions: ${player.full_name} has 1 session remaining`,
      html: emailHtml(
        trainerBody,
        `<a href="${dashboardUrl}" style="color: #00CC7A; text-decoration: none; font-weight: 600;">View in dashboard →</a> · Sent via SkillPathIQ`
      ),
    }).catch(() => {})

    // Email to parent (if email exists)
    if (player.parent_email) {
      const parentBody = [
        `Hi${player.parent_name ? ` ${player.parent_name}` : ''},`,
        ``,
        `${playerFirstName} has 1 session remaining on their ${packageName} package with ${trainer.full_name}.`,
        ``,
        `To continue training, contact ${trainerFirstName} to purchase a new package.`,
        ``,
        `— SkillPathIQ`,
      ].join('\n')

      await resend.emails.send({
        from: 'SkillPathIQ <noreply@skillpathiq.app>',
        to: [player.parent_email],
        replyTo: trainer.email,
        subject: `${playerFirstName}'s training package — 1 session remaining`,
        html: emailHtml(
          parentBody,
          `Sent via <a href="https://skillpathiq.com" style="color: #00CC7A; text-decoration: none; font-weight: 600;">SkillPathIQ</a>`
        ),
      }).catch(() => {})
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
