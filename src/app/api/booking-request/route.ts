import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const RANK_LABELS = ['1st choice', '2nd choice', '3rd choice']

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${hour}:${m.toString().padStart(2,'0')} ${ampm}`
}

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

interface PreferredSlot {
  rank: number
  window_id: string
  slot_time: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildAvailabilityText(supabaseAdmin: any, preferred_slots: PreferredSlot[]): Promise<string | null> {
  if (!preferred_slots || preferred_slots.length === 0) return null

  const windowIds = [...new Set(preferred_slots.map(s => s.window_id))]
  const { data: windowRows } = await supabaseAdmin
    .from('trainer_availability_windows')
    .select('id, day_of_week, session_type, duration_minutes')
    .in('id', windowIds)

  const windowMap = new Map((windowRows || []).map((w: { id: string; day_of_week: string; session_type: string; duration_minutes: number }) => [w.id, w]))

  const lines = preferred_slots
    .sort((a, b) => a.rank - b.rank)
    .map(s => {
      const w = windowMap.get(s.window_id) as { day_of_week: string; session_type: string; duration_minutes: number } | undefined
      if (!w) return null
      const day = w.day_of_week.charAt(0).toUpperCase() + w.day_of_week.slice(1)
      const time = formatTime(s.slot_time)
      const type = w.session_type === 'individual' ? 'Individual' : w.session_type === 'group' ? 'Group' : 'Individual/Group'
      const label = RANK_LABELS[s.rank - 1] || `Choice ${s.rank}`
      return `${label}: ${day} ${time} (${type} · ${w.duration_minutes}min)`
    })
    .filter(Boolean) as string[]

  return lines.length > 0 ? lines.join('\n') : null
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
    request_type = 'new_player',
    player_id,
    parent_name, parent_email, parent_phone,
    player_name, player_age, player_position, player_goals,
    preferred_session_type, message,
    preferred_slots,
  } = body

  if (!trainer_id) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Fetch trainer for email notification
  const { data: trainer } = await supabaseAdmin
    .from('profiles')
    .select('email, full_name')
    .eq('id', trainer_id)
    .single()

  if (!trainer) {
    return NextResponse.json({ error: 'Trainer not found' }, { status: 404 })
  }

  let resolvedParentName: string = parent_name || ''
  let resolvedParentEmail: string = parent_email || ''
  let resolvedParentPhone: string | null = parent_phone || null
  let resolvedPlayerName: string = player_name || ''
  let resolvedPlayerAge: number | null = player_age || null
  let resolvedPlayerId: string | null = player_id || null

  if (request_type === 'returning_player') {
    if (!player_id) {
      return NextResponse.json({ error: 'player_id is required for returning player requests' }, { status: 400 })
    }

    const { data: playerRecord } = await supabaseAdmin
      .from('players')
      .select('id, full_name, birth_year, parent_email, parent_name, parent_phone, archived, trainer_id')
      .eq('id', player_id)
      .single()

    if (!playerRecord || playerRecord.trainer_id !== trainer_id) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }
    if (playerRecord.archived) {
      return NextResponse.json({ error: 'This player profile is inactive' }, { status: 400 })
    }

    resolvedParentName = playerRecord.parent_name || ''
    resolvedParentEmail = playerRecord.parent_email || ''
    resolvedParentPhone = playerRecord.parent_phone || null
    resolvedPlayerName = playerRecord.full_name
    resolvedPlayerId = playerRecord.id
    const birthYear = playerRecord.birth_year
    resolvedPlayerAge = birthYear ? new Date().getFullYear() - birthYear : null
  } else {
    if (!parent_name || !parent_email || !player_name || !player_age) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
  }

  const preferred_availability_text = preferred_slots && Array.isArray(preferred_slots) && preferred_slots.length > 0
    ? await buildAvailabilityText(supabaseAdmin, preferred_slots as PreferredSlot[])
    : null

  // Insert booking request
  const { error: insertError } = await supabaseAdmin
    .from('booking_requests')
    .insert({
      trainer_id,
      request_type,
      player_id: resolvedPlayerId,
      parent_name: resolvedParentName,
      parent_email: resolvedParentEmail,
      parent_phone: resolvedParentPhone,
      player_name: resolvedPlayerName,
      player_age: resolvedPlayerAge,
      player_position: request_type === 'new_player' ? (player_position || null) : null,
      player_goals: request_type === 'new_player' ? (player_goals || null) : null,
      preferred_session_type: preferred_session_type || 'individual',
      message: message || null,
      preferred_slots: preferred_slots || null,
      preferred_availability_text: preferred_availability_text || null,
    })

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  const dashboardUrl = 'https://skillpathiq.com/dashboard'
  const trainerFirstName = trainer.full_name.split(' ')[0]

  if (request_type === 'returning_player') {
    const playerProfileUrl = `https://skillpathiq.com/dashboard/players/${resolvedPlayerId}`

    const trainerBody = [
      `Hi ${trainerFirstName},`,
      ``,
      `─────────────────────────────`,
      `RETURNING PLAYER SESSION REQUEST`,
      `─────────────────────────────`,
      ``,
      `${resolvedPlayerName} is requesting another session.`,
      ``,
      `Session type: ${preferred_session_type === 'group' ? 'Group' : '1-on-1'}`,
      resolvedPlayerAge ? `Player age: ${resolvedPlayerAge}` : null,
      preferred_availability_text ? `\nPreferred times:\n${preferred_availability_text.split('\n').map(l => `  ${l}`).join('\n')}` : null,
      message ? `\nMessage: ${message}` : null,
      ``,
      `Parent contact: ${resolvedParentName || 'on file'}${resolvedParentEmail ? ` · ${resolvedParentEmail}` : ''}`,
      resolvedParentPhone ? `Phone: ${resolvedParentPhone}` : null,
      ``,
      `View player profile: ${playerProfileUrl}`,
      ``,
      `Log in to your dashboard to accept or decline this request.`,
    ].filter(line => line !== null).join('\n')

    await resend.emails.send({
      from: 'SkillPathIQ <noreply@skillpathiq.app>',
      to: [trainer.email],
      subject: `Session request from ${resolvedPlayerName} — Returning Player`,
      html: emailHtml(
        trainerBody,
        `<a href="${dashboardUrl}" style="color: #00CC7A; text-decoration: none; font-weight: 600;">View in dashboard →</a> · Sent via SkillPathIQ`
      ),
    }).catch(() => {})

    if (resolvedParentEmail) {
      const parentBody = `Hi${resolvedParentName ? ` ${resolvedParentName}` : ''},\n\nYour session request for ${resolvedPlayerName} has been sent to ${trainer.full_name}.\n\nThey'll review it and be in touch soon to confirm your session.\n\nThanks!`
      await resend.emails.send({
        from: 'SkillPathIQ <noreply@skillpathiq.app>',
        to: [resolvedParentEmail],
        replyTo: trainer.email,
        subject: `Session request received — ${trainer.full_name}`,
        html: emailHtml(
          parentBody,
          `Sent via <a href="https://skillpathiq.com" style="color: #00CC7A; text-decoration: none; font-weight: 600;">SkillPathIQ</a>`
        ),
      }).catch(() => {})
    }
  } else {
    const trainerBody = [
      `Hi ${trainerFirstName},`,
      ``,
      `You have a new session request from ${resolvedParentName} for ${resolvedPlayerName}.`,
      ``,
      `Request details:`,
      `  Player: ${resolvedPlayerName}${resolvedPlayerAge ? `, age ${resolvedPlayerAge}` : ''}`,
      player_position ? `  Position: ${player_position}` : null,
      `  Session type: ${preferred_session_type === 'group' ? 'Group' : '1-on-1'}`,
      player_goals ? `  Goals: ${player_goals}` : null,
      preferred_availability_text ? `\nPreferred times:\n${preferred_availability_text.split('\n').map(l => `  ${l}`).join('\n')}` : null,
      resolvedParentPhone ? `\n  Phone: ${resolvedParentPhone}` : null,
      message ? `  Message: ${message}` : null,
      ``,
      `Parent contact: ${resolvedParentName} · ${resolvedParentEmail}`,
      ``,
      `Log in to your dashboard to accept or decline this request.`,
    ].filter(line => line !== null).join('\n')

    await resend.emails.send({
      from: 'SkillPathIQ <noreply@skillpathiq.app>',
      to: [trainer.email],
      subject: `New session request from ${resolvedParentName} for ${resolvedPlayerName}`,
      html: emailHtml(
        trainerBody,
        `<a href="${dashboardUrl}" style="color: #00CC7A; text-decoration: none; font-weight: 600;">View in dashboard →</a> · Sent via SkillPathIQ`
      ),
    }).catch(() => {})

    const parentBody = `Hi ${resolvedParentName},\n\nYour session request for ${resolvedPlayerName} has been sent to ${trainer.full_name}.\n\nThey'll review it and be in touch soon to confirm your first session.\n\nThanks for reaching out!`

    await resend.emails.send({
      from: 'SkillPathIQ <noreply@skillpathiq.app>',
      to: [resolvedParentEmail],
      replyTo: trainer.email,
      subject: `Session request received — ${trainer.full_name}`,
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
