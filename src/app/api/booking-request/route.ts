import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
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
    trainer_id, trainer_name,
    parent_name, parent_email, parent_phone,
    player_name, player_age, player_position, player_goals,
    preferred_session_type, message,
    preferred_slots,
  } = body

  if (!trainer_id || !parent_name || !parent_email || !player_name || !player_age) {
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

  // Build human-readable ranked availability text from preferred_slots
  let preferred_availability_text: string | null = null
  if (preferred_slots && Array.isArray(preferred_slots) && preferred_slots.length > 0) {
    const windowIds = [...new Set((preferred_slots as PreferredSlot[]).map(s => s.window_id))]
    const { data: windowRows } = await supabaseAdmin
      .from('trainer_availability_windows')
      .select('id, day_of_week, session_type, duration_minutes')
      .in('id', windowIds)

    const windowMap = new Map((windowRows || []).map(w => [w.id, w]))

    const lines = (preferred_slots as PreferredSlot[])
      .sort((a, b) => a.rank - b.rank)
      .map(s => {
        const w = windowMap.get(s.window_id)
        if (!w) return null
        const day = w.day_of_week.charAt(0).toUpperCase() + w.day_of_week.slice(1)
        const time = formatTime(s.slot_time)
        const type = w.session_type === 'individual' ? 'Individual' : w.session_type === 'group' ? 'Group' : 'Individual/Group'
        const label = RANK_LABELS[s.rank - 1] || `Choice ${s.rank}`
        return `${label}: ${day} ${time} (${type} · ${w.duration_minutes}min)`
      })
      .filter(Boolean)

    preferred_availability_text = lines.join('\n')
  }

  // Insert booking request
  const { error: insertError } = await supabaseAdmin
    .from('booking_requests')
    .insert({
      trainer_id,
      parent_name,
      parent_email,
      parent_phone: parent_phone || null,
      player_name,
      player_age: player_age || null,
      player_position: player_position || null,
      player_goals: player_goals || null,
      preferred_session_type: preferred_session_type || 'individual',
      message: message || null,
      preferred_slots: preferred_slots || null,
      preferred_availability_text: preferred_availability_text || null,
    })

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  const dashboardUrl = 'https://skillpathiq.com/dashboard'

  // Notify trainer
  const trainerBody = [
    `Hi ${trainer.full_name.split(' ')[0]},`,
    ``,
    `You have a new session request from ${parent_name} for ${player_name}.`,
    ``,
    `Request details:`,
    `  Player: ${player_name}${player_age ? `, age ${player_age}` : ''}`,
    player_position ? `  Position: ${player_position}` : null,
    `  Session type: ${preferred_session_type === 'group' ? 'Group' : '1-on-1'}`,
    player_goals ? `  Goals: ${player_goals}` : null,
    preferred_availability_text ? `\nPreferred times:\n${preferred_availability_text.split('\n').map(l => `  ${l}`).join('\n')}` : null,
    parent_phone ? `\n  Phone: ${parent_phone}` : null,
    message ? `  Message: ${message}` : null,
    ``,
    `Parent contact: ${parent_name} · ${parent_email}`,
    ``,
    `Log in to your dashboard to accept or decline this request.`,
  ].filter(line => line !== null).join('\n')

  await resend.emails.send({
    from: 'SkillPathIQ <noreply@skillpathiq.app>',
    to: [trainer.email],
    subject: `New session request from ${parent_name} for ${player_name}`,
    html: emailHtml(
      trainerBody,
      `<a href="${dashboardUrl}" style="color: #00CC7A; text-decoration: none; font-weight: 600;">View in dashboard →</a> · Sent via SkillPathIQ`
    ),
  }).catch(() => {})

  // Confirm to parent
  const parentBody = `Hi ${parent_name},\n\nYour session request for ${player_name} has been sent to ${trainer.full_name}.\n\nThey'll review it and be in touch soon to confirm your first session.\n\nThanks for reaching out!`

  await resend.emails.send({
    from: 'SkillPathIQ <noreply@skillpathiq.app>',
    to: [parent_email],
    replyTo: trainer.email,
    subject: `Session request received — ${trainer.full_name}`,
    html: emailHtml(
      parentBody,
      `Sent via <a href="https://skillpathiq.com" style="color: #00CC7A; text-decoration: none; font-weight: 600;">SkillPathIQ</a>`
    ),
  }).catch(() => {})

  return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
