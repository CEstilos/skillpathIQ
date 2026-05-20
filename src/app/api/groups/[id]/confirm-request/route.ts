import { NextResponse, NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

function formatTime(t: string) {
  if (!t) return ''
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
      .select('*')
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

    // Fetch trainer profile
    const { data: trainer } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, location, venmo_handle')
      .eq('id', user.id)
      .single()
    if (!trainer) return NextResponse.json({ error: 'Trainer not found' }, { status: 404 })

    let playerId: string | null = req.player_id

    // Create new player from booking request if not a returning player
    if (req.request_type !== 'returning_player' || !playerId) {
      const initials = (req.player_name || '').trim().split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

      // Compute birth year from age (approximate)
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
        .select('*')
        .single()

      if (playerError || !newPlayer) {
        return NextResponse.json({ error: playerError?.message || 'Failed to create player' }, { status: 500 })
      }
      playerId = newPlayer.id
    }

    if (!playerId) return NextResponse.json({ error: 'No player linked' }, { status: 400 })

    // Insert into group_members (ignore conflict)
    const { error: memberError } = await supabaseAdmin
      .from('group_members')
      .insert({ group_id: groupId, player_id: playerId })
    if (memberError && !memberError.message.includes('duplicate')) {
      return NextResponse.json({ error: memberError.message }, { status: 500 })
    }

    // Insert into group_confirmed_players (ignore conflict)
    const { error: confirmError } = await supabaseAdmin
      .from('group_confirmed_players')
      .insert({ group_id: groupId, player_id: playerId, confirmed_by_trainer_id: user.id })
    if (confirmError && !confirmError.message.includes('duplicate')) {
      return NextResponse.json({ error: confirmError.message }, { status: 500 })
    }

    // Create player_package if request has a package_id
    let playerPackageId: string | null = null
    if (req.package_id) {
      try {
        const { data: pkg } = await supabaseAdmin
          .from('trainer_packages')
          .select('*')
          .eq('id', req.package_id)
          .single()

        if (pkg) {
          const { data: newPlayerPkg } = await supabaseAdmin
            .from('player_packages')
            .insert({
              player_id: playerId,
              trainer_id: user.id,
              group_id: groupId,
              package_id: req.package_id,
              sessions_total: pkg.session_count,
              sessions_remaining: pkg.session_count,
              sessions_used: 0,
              price_paid: pkg.price,
              payment_status: 'pending',
              payment_method: 'venmo',
              status: 'active',
              refund_eligible: true,
            })
            .select('id')
            .single()

          if (newPlayerPkg) playerPackageId = newPlayerPkg.id
        }
      } catch {
        // Don't block confirmation if package creation fails
      }
    }

    // Fetch package info for email
    let confirmedPkg: { name: string; session_count: number; price: number } | null = null
    if (req.package_id) {
      try {
        const { data: pkgInfo } = await supabaseAdmin
          .from('trainer_packages')
          .select('name, session_count, price')
          .eq('id', req.package_id)
          .single()
        confirmedPkg = pkgInfo || null
      } catch { /* ignore */ }
    }

    // Update booking request to accepted
    await supabaseAdmin
      .from('booking_requests')
      .update({
        status: 'accepted',
        player_id: playerId,
        ...(playerPackageId ? { player_package_id: playerPackageId } : {}),
      })
      .eq('id', booking_request_id)

    // Fetch the player we just inserted/used to return to client
    const { data: playerData } = await supabaseAdmin
      .from('players')
      .select('id, full_name, parent_email, avatar_initials, birth_year, player_gender, player_experience')
      .eq('id', playerId)
      .single()

    // Send parent confirmation email
    const trainerFirstName = trainer.full_name?.split(' ')[0] || 'Coach'
    const scheduleLine: string | null = group.session_day
      ? `Schedule: ${group.session_day}s${group.session_time ? ` · ${formatTime(group.session_time)}` : ''}`
      : null
    const location = group.location || trainer.location || null

    const parentBody = [
      `Hi ${req.parent_name || ''},`,
      ``,
      `${req.player_name} has been added to ${group.name}.`,
      ``,
      `Group: ${group.name}`,
      `Trainer: ${trainer.full_name}`,
      scheduleLine,
      location ? `Location: ${location}` : null,
      confirmedPkg ? `\nPackage: ${confirmedPkg.name} — ${confirmedPkg.session_count} sessions` : null,
      confirmedPkg ? `Total due: $${Number(confirmedPkg.price).toFixed(2)}` : null,
      (trainer as { venmo_handle?: string | null }).venmo_handle && confirmedPkg ? `Payment: venmo.com/${(trainer as { venmo_handle?: string | null }).venmo_handle}` : null,
      confirmedPkg ? `\nSessions are valid for 90 days from your first training session.` : null,
      confirmedPkg ? `Refund policy: Full refund within 48 hours. Unused sessions refunded at package rate until 50% of sessions are used.` : null,
      ``,
      `${trainerFirstName} will be in touch with session details. If you have any questions, reply to this email.`,
      ``,
      `— SkillPathIQ`,
    ].filter(l => l !== null).join('\n')

    if (req.parent_email) {
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: 'SkillPathIQ <noreply@skillpathiq.app>',
        to: [req.parent_email],
        replyTo: trainer.email,
        subject: `You're in — ${group.name} with ${trainerFirstName}`,
        html: emailHtml(
          parentBody,
          `Sent via <a href="https://skillpathiq.com" style="color: #00CC7A; text-decoration: none; font-weight: 600;">SkillPathIQ</a>`
        ),
      }).catch(() => {})
    }

    return NextResponse.json({ success: true, player: playerData })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
