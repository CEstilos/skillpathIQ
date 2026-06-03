import { NextResponse, NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

function formatDateLong(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

function formatTime(t: string) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${hour}:${m.toString().padStart(2, '0')}${ampm}`
}

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

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: requestId } = await params

    const supabaseAuth = await createServerSupabaseClient()
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    // Fetch request with all related data
    const { data: req } = await supabase
      .from('session_attendance_requests')
      .select('*, players(id, full_name, parent_name, parent_email), groups(id, name), sessions(id, session_date, session_time, duration_minutes), player_packages(id, sessions_remaining, trainer_packages(name))')
      .eq('id', requestId)
      .eq('trainer_id', user.id)
      .single()
    if (!req) return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    if (req.status !== 'pending') return NextResponse.json({ error: 'Request already processed' }, { status: 409 })

    // Fetch trainer profile
    const { data: trainer } = await supabase
      .from('profiles')
      .select('id, full_name, email, location')
      .eq('id', user.id)
      .single()
    if (!trainer) return NextResponse.json({ error: 'Trainer not found' }, { status: 404 })

    // Add player to group_confirmed_players
    await supabase
      .from('group_confirmed_players')
      .insert({ group_id: req.group_id, player_id: req.player_id, confirmed_by_trainer_id: user.id })
      .then(() => {})

    // Update request status to confirmed
    await supabase
      .from('session_attendance_requests')
      .update({ status: 'confirmed' })
      .eq('id', requestId)

    const player = req.players as { id: string; full_name: string; parent_name: string | null; parent_email: string | null }
    const group = req.groups as { id: string; name: string }
    const session = req.sessions as { id: string; session_date: string; session_time: string; duration_minutes: number | null }
    const playerPkg = req.player_packages as { id: string; sessions_remaining: number; trainer_packages: { name: string } | null } | null
    const sessionsRemaining = playerPkg?.sessions_remaining ?? null

    // Send parent confirmation email
    if (player?.parent_email) {
      const parentBody = [
        `Hi ${player.parent_name || player.full_name},`,
        ``,
        `${player.full_name} is confirmed for the following session:`,
        ``,
        `Date: ${formatDateLong(session.session_date)}`,
        `Time: ${formatTime(session.session_time)}`,
        session.duration_minutes ? `Duration: ${session.duration_minutes} minutes` : null,
        `Group: ${group.name}`,
        `Trainer: ${trainer.full_name}`,
        trainer.location ? `Location: ${trainer.location}` : null,
        sessionsRemaining !== null ? `\n${sessionsRemaining} session${sessionsRemaining !== 1 ? 's' : ''} remaining in your package.` : null,
        ``,
        `If you need to cancel, please contact ${trainer.full_name} at ${trainer.email}.`,
        ``,
        `— SkillPathIQ`,
      ].filter(l => l !== null).join('\n')

      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: 'SkillPathIQ <noreply@skillpathiq.app>',
        to: [player.parent_email],
        replyTo: trainer.email,
        subject: `You're confirmed — ${formatDateLong(session.session_date)} with ${trainer.full_name}`,
        html: emailHtml(parentBody),
      }).catch(() => {})
    }

    return NextResponse.json({
      success: true,
      player_name: player?.full_name,
      session_date: session?.session_date,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
