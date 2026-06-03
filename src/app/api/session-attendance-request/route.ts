import { NextResponse, NextRequest } from 'next/server'
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { player_id, session_id } = body

    if (!player_id || !session_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    // Validate player
    const { data: player } = await supabase
      .from('players')
      .select('id, full_name, parent_email, parent_name, trainer_id')
      .eq('id', player_id)
      .single()
    if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 })

    // Validate session belongs to this trainer and is upcoming
    const today = new Date().toISOString().split('T')[0]
    const { data: session } = await supabase
      .from('sessions')
      .select('id, session_date, session_time, duration_minutes, group_id, trainer_id, status')
      .eq('id', session_id)
      .eq('trainer_id', player.trainer_id)
      .single()
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    if (session.session_date < today) return NextResponse.json({ error: 'Session is in the past' }, { status: 400 })
    if (session.status === 'cancelled') return NextResponse.json({ error: 'Session is cancelled' }, { status: 400 })
    if (!session.group_id) return NextResponse.json({ error: 'Not a group session' }, { status: 400 })

    // Check for duplicate
    const { data: existing } = await supabase
      .from('session_attendance_requests')
      .select('id')
      .eq('player_id', player_id)
      .eq('session_id', session_id)
      .single()
    if (existing) return NextResponse.json({ error: 'Request already exists for this session' }, { status: 409 })

    // Fetch player's active package
    const { data: pkg } = await supabase
      .from('player_packages')
      .select('id, sessions_remaining, trainer_packages(name)')
      .eq('player_id', player_id)
      .eq('trainer_id', player.trainer_id)
      .eq('status', 'active')
      .gt('sessions_remaining', 0)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (!pkg) return NextResponse.json({ error: 'No active package sessions remaining' }, { status: 400 })

    // Fetch group (for name and capacity check)
    const { data: group } = await supabase
      .from('groups')
      .select('id, name, window_id')
      .eq('id', session.group_id)
      .single()

    // Check capacity if window has max_capacity set
    if (group?.window_id) {
      const { data: window } = await supabase
        .from('trainer_availability_windows')
        .select('max_capacity')
        .eq('id', group.window_id)
        .single()
      if (window?.max_capacity) {
        const { count: confirmedCount } = await supabase
          .from('group_confirmed_players')
          .select('id', { count: 'exact', head: true })
          .eq('group_id', session.group_id)
        if (confirmedCount !== null && confirmedCount >= window.max_capacity) {
          return NextResponse.json({ error: 'Group session is at capacity' }, { status: 400 })
        }
      }
    }

    // Fetch trainer
    const { data: trainer } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', player.trainer_id)
      .single()

    // Insert attendance request
    const { data: newRequest, error: insertError } = await supabase
      .from('session_attendance_requests')
      .insert({
        player_id,
        trainer_id: player.trainer_id,
        group_id: session.group_id,
        session_id,
        player_package_id: pkg.id,
        status: 'pending',
      })
      .select('id')
      .single()
    if (insertError || !newRequest) {
      return NextResponse.json({ error: insertError?.message || 'Failed to create request' }, { status: 500 })
    }

    // Send trainer notification email
    const pkgTemplate = Array.isArray(pkg.trainer_packages) ? pkg.trainer_packages[0] : pkg.trainer_packages
    const packageName = (pkgTemplate as { name: string } | null)?.name || 'Package'
    const groupName = group?.name || 'Group'

    const trainerBody = [
      `Hi ${trainer?.full_name?.split(' ')[0] || 'Coach'},`,
      ``,
      `${player.full_name} has requested a spot in your ${groupName} session.`,
      ``,
      `Date: ${formatDateLong(session.session_date)}`,
      `Time: ${formatTime(session.session_time)}`,
      session.duration_minutes ? `Duration: ${session.duration_minutes} minutes` : null,
      `Package: ${packageName} · ${pkg.sessions_remaining} session${pkg.sessions_remaining !== 1 ? 's' : ''} remaining`,
      ``,
      `View on Training Hub: https://skillpathiq.com/dashboard`,
      ``,
      `— SkillPathIQ`,
    ].filter(l => l !== null).join('\n')

    if (trainer?.email) {
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: 'SkillPathIQ <noreply@skillpathiq.app>',
        to: [trainer.email],
        subject: `Session spot request — ${player.full_name} · ${formatDateLong(session.session_date)}`,
        html: emailHtml(trainerBody),
      }).catch(() => {})
    }

    return NextResponse.json({
      success: true,
      request_id: newRequest.id,
      sessions_remaining: pkg.sessions_remaining,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
