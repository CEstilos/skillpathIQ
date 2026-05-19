import { NextResponse, NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: groupId } = await params

    // Auth check
    const supabaseAuth = await createServerSupabaseClient()
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    const body = await request.json()
    const { booking_request_id } = body
    if (!booking_request_id) {
      return NextResponse.json({ error: 'Missing booking_request_id' }, { status: 400 })
    }

    // Validate group belongs to trainer
    const { data: group } = await supabaseAdmin
      .from('groups')
      .select('id, trainer_id')
      .eq('id', groupId)
      .eq('trainer_id', user.id)
      .single()
    if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 })

    // Validate booking request
    const { data: req } = await supabaseAdmin
      .from('booking_requests')
      .select('*')
      .eq('id', booking_request_id)
      .eq('trainer_id', user.id)
      .single()
    if (!req) return NextResponse.json({ error: 'Booking request not found' }, { status: 404 })
    if (req.status !== 'pending') return NextResponse.json({ error: 'Request already processed' }, { status: 409 })

    // Fetch trainer
    const { data: trainer } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', user.id)
      .single()
    if (!trainer) return NextResponse.json({ error: 'Trainer not found' }, { status: 404 })

    let playerId: string | null = req.player_id

    // Create new player from booking request (no group assignment) if not returning
    if (req.request_type !== 'returning_player' || !playerId) {
      const initials = (req.player_name || '').trim().split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
      const currentYear = new Date().getFullYear()
      const birthYear = req.player_age ? currentYear - req.player_age : null

      const { data: newPlayer, error: playerError } = await supabaseAdmin
        .from('players')
        .insert({
          trainer_id: user.id,
          full_name: (req.player_name || '').trim(),
          parent_email: req.parent_email || null,
          parent_name: req.parent_name || null,
          parent_phone: req.parent_phone || null,
          birth_year: birthYear,
          player_gender: req.player_gender || null,
          player_experience: req.player_experience || null,
          additional_info: req.additional_info || null,
          contact_type: 'parent',
          avatar_initials: initials,
          archived: false,
        })
        .select('id')
        .single()
      if (playerError || !newPlayer) {
        return NextResponse.json({ error: playerError?.message || 'Failed to create player' }, { status: 500 })
      }
      playerId = newPlayer.id
    }

    // Update booking request to declined
    await supabaseAdmin
      .from('booking_requests')
      .update({ status: 'declined', player_id: playerId })
      .eq('id', booking_request_id)

    // Send decline email
    if (req.parent_email) {
      const parentBody = `Hi ${req.parent_name || ''},\n\nThank you for reaching out about ${req.player_name}. Unfortunately, we're not able to accept this request at this time.\n\nWe appreciate your interest and wish you all the best.\n\n${trainer.full_name}`
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: 'SkillPathIQ <noreply@skillpathiq.app>',
        to: [req.parent_email],
        replyTo: trainer.email,
        subject: `Session request update from ${trainer.full_name}`,
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
