import { NextResponse, NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

function formatDateLong(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
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

type DateRequest = { group_id: string; window_id: string; date: string }
type DateResult = { date: string; success: boolean; error?: string; session_id?: string }

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { player_id, requests } = body as { player_id: string; requests: DateRequest[] }

    if (!player_id || !requests?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    const { data: player } = await supabase
      .from('players')
      .select('id, full_name, parent_email, parent_name, trainer_id')
      .eq('id', player_id)
      .single()
    if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 })

    const today = new Date().toISOString().split('T')[0]

    const { data: pkg } = await supabase
      .from('player_packages')
      .select('id, sessions_remaining, trainer_packages(name)')
      .eq('player_id', player_id)
      .eq('trainer_id', player.trainer_id)
      .eq('status', 'active')
      .gt('sessions_remaining', 0)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // If a package exists, validate there are enough sessions
    if (pkg && requests.length > pkg.sessions_remaining) {
      return NextResponse.json({
        error: `You have ${pkg.sessions_remaining} session${pkg.sessions_remaining !== 1 ? 's' : ''} remaining but selected ${requests.length}. Please deselect some dates.`,
      }, { status: 400 })
    }

    // Fetch group names upfront for use as session titles
    const uniqueGroupIds = [...new Set(requests.map(r => r.group_id))]
    const { data: groupRows } = await supabase
      .from('groups').select('id, name').in('id', uniqueGroupIds)
    const groupNameMap: Record<string, string> = {}
    for (const g of groupRows || []) groupNameMap[g.id] = g.name

    const results: DateResult[] = []

    for (const req of requests) {
      if (req.date <= today) {
        results.push({ date: req.date, success: false, error: 'Date is in the past' })
        continue
      }

      const { data: win } = await supabase
        .from('trainer_availability_windows')
        .select('id, start_time, duration_minutes, max_capacity')
        .eq('id', req.window_id)
        .single()
      if (!win) {
        results.push({ date: req.date, success: false, error: 'Invalid training slot' })
        continue
      }

      // Find or create session for this group + date
      const { data: existingSession } = await supabase
        .from('sessions')
        .select('id, status')
        .eq('group_id', req.group_id)
        .eq('session_date', req.date)
        .eq('trainer_id', player.trainer_id)
        .is('player_id', null)
        .maybeSingle()

      let sessionId: string
      if (existingSession) {
        if (existingSession.status === 'cancelled' || existingSession.status === 'logged') {
          results.push({ date: req.date, success: false, error: 'Session no longer available' })
          continue
        }
        sessionId = existingSession.id
      } else {
        const { data: newSession, error: sessionError } = await supabase
          .from('sessions')
          .insert({
            trainer_id: player.trainer_id,
            group_id: req.group_id,
            title: groupNameMap[req.group_id] || 'Group Session',
            session_date: req.date,
            session_time: win.start_time,
            duration_minutes: win.duration_minutes,
            session_type: 'group',
            status: 'upcoming',
            type: 'one-off',
          })
          .select('id')
          .single()
        if (sessionError || !newSession) {
          results.push({ date: req.date, success: false, error: sessionError?.message || 'Failed to create session' })
          continue
        }
        sessionId = newSession.id
      }

      // Check capacity
      if (win.max_capacity) {
        const { count: confirmedCount } = await supabase
          .from('group_confirmed_players')
          .select('id', { count: 'exact', head: true })
          .eq('group_id', req.group_id)
        if (confirmedCount !== null && confirmedCount >= win.max_capacity) {
          results.push({ date: req.date, success: false, error: 'Session is at capacity' })
          continue
        }
      }

      // Check for duplicate request
      const { data: existingReq } = await supabase
        .from('session_attendance_requests')
        .select('id')
        .eq('player_id', player_id)
        .eq('session_id', sessionId)
        .maybeSingle()
      if (existingReq) {
        results.push({ date: req.date, success: false, error: 'Already requested this date' })
        continue
      }

      const { error: insertError } = await supabase
        .from('session_attendance_requests')
        .insert({
          player_id,
          trainer_id: player.trainer_id,
          group_id: req.group_id,
          session_id: sessionId,
          player_package_id: pkg?.id || null,
          status: 'pending',
        })
      if (insertError) {
        results.push({ date: req.date, success: false, error: insertError.message })
        continue
      }

      results.push({ date: req.date, success: true, session_id: sessionId })
    }

    // Email trainer one summary for all successful requests
    const successful = results.filter(r => r.success)
    if (successful.length > 0) {
      const { data: trainer } = await supabase
        .from('profiles').select('id, full_name, email').eq('id', player.trainer_id).single()

      const { data: group } = await supabase
        .from('groups').select('name').eq('id', requests[0].group_id).single()

      if (trainer?.email) {
        const pkgTemplate = pkg ? (Array.isArray(pkg.trainer_packages) ? pkg.trainer_packages[0] : pkg.trainer_packages) : null
        const packageName = (pkgTemplate as { name: string } | null)?.name
        const groupName = group?.name || 'Group'

        const dateLines = successful.map(r => `  • ${formatDateLong(r.date)}`).join('\n')

        const packageLine = pkg
          ? `Package: ${packageName || 'Package'} · ${pkg.sessions_remaining} session${pkg.sessions_remaining !== 1 ? 's' : ''} remaining`
          : `⚠️ Note: ${player.full_name} has no active package. You can approve this request manually.`

        const trainerBody = [
          `Hi ${trainer.full_name?.split(' ')[0] || 'Coach'},`,
          ``,
          `${player.full_name} has requested ${successful.length} spot${successful.length !== 1 ? 's' : ''} in ${groupName}:`,
          ``,
          dateLines,
          ``,
          packageLine,
          ``,
          `Confirm or decline from your Training Hub: https://skillpathiq.com/dashboard`,
          ``,
          `— SkillPathIQ`,
        ].join('\n')

        const resend = new Resend(process.env.RESEND_API_KEY)
        await resend.emails.send({
          from: 'SkillPathIQ <noreply@skillpathiq.app>',
          to: [trainer.email],
          subject: `${successful.length} session request${successful.length !== 1 ? 's' : ''} — ${player.full_name} · ${groupName}`,
          html: emailHtml(trainerBody),
        }).catch(() => {})
      }
    }

    return NextResponse.json({ success: true, results, sessions_remaining: pkg?.sessions_remaining ?? 0 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
