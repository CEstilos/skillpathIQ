import { NextResponse, NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

function formatDateLong(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${hour}:${m.toString().padStart(2, '0')}${ampm}`
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookingRequestId } = await params

    // Auth check via server supabase
    const supabaseAuth = await createServerSupabaseClient()
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    // Fetch and validate booking request
    const { data: req } = await supabaseAdmin
      .from('booking_requests')
      .select('*')
      .eq('id', bookingRequestId)
      .eq('trainer_id', user.id)
      .single()

    if (!req) return NextResponse.json({ error: 'Booking request not found' }, { status: 404 })
    if (req.status !== 'pending') return NextResponse.json({ error: 'Request already processed' }, { status: 409 })

    const body = await request.json()
    const { session_date, session_time, duration_minutes, session_type } = body

    if (!session_date || !session_time || !duration_minutes || !session_type) {
      return NextResponse.json({ error: 'Missing required fields: session_date, session_time, duration_minutes, session_type' }, { status: 400 })
    }

    // Fetch trainer profile for email
    const { data: trainer } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, location')
      .eq('id', user.id)
      .single()

    if (!trainer) return NextResponse.json({ error: 'Trainer not found' }, { status: 404 })

    let playerId = req.player_id as string | null

    // Step 1: Create player if new
    if (req.request_type === 'new_player') {
      const initials = req.player_name.trim().split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
      const { data: newPlayer, error: playerError } = await supabaseAdmin
        .from('players')
        .insert({
          trainer_id: user.id,
          full_name: req.player_name.trim(),
          parent_email: req.parent_email,
          parent_name: req.parent_name,
          parent_phone: req.parent_phone || null,
          contact_type: 'parent',
          avatar_initials: initials,
          archived: false,
          player_gender: req.player_gender || null,
          player_experience: req.player_experience || null,
          additional_info: req.additional_info || null,
        })
        .select('id')
        .single()

      if (playerError || !newPlayer) {
        return NextResponse.json({ error: playerError?.message || 'Failed to create player' }, { status: 500 })
      }
      playerId = newPlayer.id
    }

    if (!playerId) return NextResponse.json({ error: 'No player linked to this request' }, { status: 400 })

    // Step 2: Create session
    const sessionTitle = `${req.player_name.trim().split(' ')[0]} — ${session_type === 'group' ? 'Group' : '1-on-1'}`
    const { data: newSession, error: sessionError } = await supabaseAdmin
      .from('sessions')
      .insert({
        trainer_id: user.id,
        player_id: playerId,
        title: sessionTitle,
        session_date,
        session_time,
        duration_minutes,
        session_type,
        type: 'one-off',
        status: 'scheduled',
        booking_request_id: bookingRequestId,
        notes: [req.player_goals, req.message].filter(Boolean).join('\n') || null,
      })
      .select('id')
      .single()

    if (sessionError || !newSession) {
      // Try to clean up player we just created
      if (req.request_type === 'new_player' && playerId) {
        await supabaseAdmin.from('players').delete().eq('id', playerId)
      }
      return NextResponse.json({ error: sessionError?.message || 'Failed to create session' }, { status: 500 })
    }

    // Step 3: Update booking request to accepted, set player_id for new players
    await supabaseAdmin
      .from('booking_requests')
      .update({
        status: 'accepted',
        ...(req.request_type === 'new_player' ? { player_id: playerId } : {}),
      })
      .eq('id', bookingRequestId)

    // Step 3b: If this is a group session request, add player to the linked group
    if (session_type === 'group' && req.preferred_slots && req.preferred_slots.length > 0) {
      const windowIds = req.preferred_slots.map((s: { window_id: string }) => s.window_id).filter(Boolean)
      if (windowIds.length > 0) {
        const { data: linkedGroup } = await supabaseAdmin
          .from('groups')
          .select('id')
          .eq('trainer_id', user.id)
          .in('window_id', windowIds)
          .single()
        if (linkedGroup) {
          await supabaseAdmin
            .from('group_members')
            .insert({ group_id: linkedGroup.id, player_id: playerId })
            .then(() => {}) // ignore duplicate errors
        }
      }
    }

    // Step 4: Send confirmation email to parent
    const resend = new Resend(process.env.RESEND_API_KEY)
    const formattedDate = formatDateLong(session_date)
    const formattedTime = formatTime(session_time)
    const location = trainer.location || 'TBD'

    const parentBody = [
      `Hi ${req.parent_name},`,
      ``,
      `Your session for ${req.player_name} has been confirmed.`,
      ``,
      `Session details:`,
      `  Date: ${formattedDate}`,
      `  Time: ${formattedTime}`,
      `  Duration: ${duration_minutes} minutes`,
      `  Type: ${session_type === 'group' ? 'Group' : 'Individual'}`,
      `  Trainer: ${trainer.full_name}`,
      `  Location: ${location}`,
      ``,
      `If you need to reschedule, please contact ${trainer.full_name} directly at ${trainer.email}.`,
      ``,
      `See you on the court.`,
      `— SkillPathIQ`,
    ].join('\n')

    await resend.emails.send({
      from: 'SkillPathIQ <noreply@skillpathiq.app>',
      to: [req.parent_email],
      replyTo: trainer.email,
      subject: `Session confirmed — ${trainer.full_name}`,
      html: emailHtml(
        parentBody,
        `Sent via <a href="https://skillpathiq.com" style="color: #00CC7A; text-decoration: none; font-weight: 600;">SkillPathIQ</a>`
      ),
    }).catch(() => {})

    return NextResponse.json({ success: true, player_id: playerId, session_id: newSession.id })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
