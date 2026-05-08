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
    const {
      trainer_id,
      parent_name, parent_email, parent_phone,
      player_name, player_age, player_position, player_goals,
      session_type, message,
      is_returning,
      existing_player_id,
    } = body

    if (!trainer_id || !parent_name || !parent_email || !parent_phone || !player_name || !player_age) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: trainer } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name')
      .eq('id', trainer_id)
      .single()

    if (!trainer) {
      return NextResponse.json({ error: 'Trainer not found' }, { status: 404 })
    }

    const trainerFirstName = trainer.full_name.split(' ')[0]
    const dashboardUrl = 'https://skillpathiq.com/dashboard'

    // Duplicate detection — only when is_returning is not explicitly set
    if (is_returning === undefined) {
      const { data: existingPlayers } = await supabaseAdmin
        .from('players')
        .select('id, full_name')
        .eq('trainer_id', trainer_id)
        .ilike('full_name', player_name.trim())

      if (existingPlayers && existingPlayers.length > 0) {
        const match = existingPlayers[0]
        return NextResponse.json({
          needs_confirm: true,
          player_name: match.full_name,
          player_id: match.id,
        })
      }
    }

    const dashFooter = `<a href="${dashboardUrl}" style="color: #00CC7A; text-decoration: none; font-weight: 600;">View in dashboard →</a> · Sent via SkillPathIQ`
    const parentFooter = `Sent via <a href="https://skillpathiq.com" style="color: #00CC7A; text-decoration: none; font-weight: 600;">SkillPathIQ</a>`

    if (is_returning === true) {
      // Returning player — insert booking_request, don't create new player
      const linkedPlayerId = existing_player_id || null

      const { error: insertError } = await supabaseAdmin.from('booking_requests').insert({
        trainer_id,
        request_type: 'returning_player',
        player_id: linkedPlayerId,
        parent_name,
        parent_email,
        parent_phone,
        player_name,
        player_age,
        player_position: player_position || null,
        player_goals: player_goals || null,
        preferred_session_type: session_type || 'individual',
        message: message || null,
      })

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }

      const playerProfileUrl = linkedPlayerId
        ? `https://skillpathiq.com/dashboard/players/${linkedPlayerId}`
        : null

      const trainerBody = [
        `Hi ${trainerFirstName},`,
        ``,
        `─────────────────────────────`,
        `RETURNING PLAYER — SESSION INTAKE`,
        `─────────────────────────────`,
        ``,
        `${player_name} just submitted their intake form after booking via Calendly.`,
        ``,
        `Player: ${player_name}, age ${player_age}`,
        player_position ? `Position: ${player_position}` : null,
        `Session type: ${session_type === 'group' ? 'Group' : '1-on-1'}`,
        player_goals ? `Goals: ${player_goals}` : null,
        message ? `\nMessage: ${message}` : null,
        ``,
        `Parent contact: ${parent_name} · ${parent_email}`,
        `Phone: ${parent_phone}`,
        playerProfileUrl ? `\nView player profile: ${playerProfileUrl}` : null,
        ``,
        `Log in to your dashboard to follow up.`,
      ].filter(l => l !== null).join('\n')

      await resend.emails.send({
        from: 'SkillPathIQ <noreply@skillpathiq.app>',
        to: [trainer.email],
        subject: `Session intake from returning player — ${player_name}`,
        html: emailHtml(trainerBody, dashFooter),
      }).catch(() => {})

      const parentBody = `Hi ${parent_name},\n\nThanks — we've sent ${player_name}'s info to ${trainer.full_name}. See you on the court!`
      await resend.emails.send({
        from: 'SkillPathIQ <noreply@skillpathiq.app>',
        to: [parent_email],
        replyTo: trainer.email,
        subject: `Player profile received — ${trainer.full_name}`,
        html: emailHtml(parentBody, parentFooter),
      }).catch(() => {})

      return NextResponse.json({ success: true })
    }

    // New player — create player record
    const initials = player_name.trim().split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

    const { data: newPlayer, error: playerError } = await supabaseAdmin.from('players').insert({
      trainer_id,
      full_name: player_name.trim(),
      parent_email,
      parent_name,
      parent_phone,
      contact_type: 'parent',
      avatar_initials: initials,
      archived: false,
    }).select('id').single()

    if (playerError) {
      return NextResponse.json({ error: playerError.message }, { status: 500 })
    }

    const playerProfileUrl = `https://skillpathiq.com/dashboard/players/${newPlayer.id}`

    const trainerBody = [
      `Hi ${trainerFirstName},`,
      ``,
      `A new player just filled out their intake form after booking via Calendly.`,
      ``,
      `Player: ${player_name}, age ${player_age}`,
      player_position ? `Position: ${player_position}` : null,
      `Session type: ${session_type === 'group' ? 'Group' : '1-on-1'}`,
      player_goals ? `Goals: ${player_goals}` : null,
      message ? `\nMessage: ${message}` : null,
      ``,
      `Parent contact: ${parent_name} · ${parent_email}`,
      `Phone: ${parent_phone}`,
      ``,
      `View ${player_name}'s profile: ${playerProfileUrl}`,
      ``,
      `Log in to your dashboard to get started.`,
    ].filter(l => l !== null).join('\n')

    await resend.emails.send({
      from: 'SkillPathIQ <noreply@skillpathiq.app>',
      to: [trainer.email],
      subject: `New player intake from Calendly — ${player_name}`,
      html: emailHtml(trainerBody, dashFooter),
    }).catch(() => {})

    const parentBody = `Hi ${parent_name},\n\nThanks — we've sent ${player_name}'s info to ${trainer.full_name}. See you on the court!`
    await resend.emails.send({
      from: 'SkillPathIQ <noreply@skillpathiq.app>',
      to: [parent_email],
      replyTo: trainer.email,
      subject: `Player profile received — ${trainer.full_name}`,
      html: emailHtml(parentBody, parentFooter),
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
