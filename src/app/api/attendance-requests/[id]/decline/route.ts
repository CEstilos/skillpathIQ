import { NextResponse, NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

function formatDateLong(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
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

    // Fetch request
    const { data: req } = await supabase
      .from('session_attendance_requests')
      .select('*, players(id, full_name, parent_name, parent_email), sessions(id, session_date)')
      .eq('id', requestId)
      .eq('trainer_id', user.id)
      .single()
    if (!req) return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    if (req.status !== 'pending') return NextResponse.json({ error: 'Request already processed' }, { status: 409 })

    // Fetch trainer
    const { data: trainer } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', user.id)
      .single()

    // Update status to declined
    await supabase
      .from('session_attendance_requests')
      .update({ status: 'declined' })
      .eq('id', requestId)

    const player = req.players as { full_name: string; parent_name: string | null; parent_email: string | null }
    const session = req.sessions as { session_date: string }

    // Send parent notification
    if (player?.parent_email && trainer) {
      const parentBody = [
        `Hi ${player.parent_name || player.full_name},`,
        ``,
        `Unfortunately ${player.full_name}'s request for ${formatDateLong(session.session_date)} could not be confirmed.`,
        ``,
        `Please contact ${trainer.full_name} at ${trainer.email} to discuss alternative sessions.`,
        ``,
        `— SkillPathIQ`,
      ].join('\n')

      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: 'SkillPathIQ <noreply@skillpathiq.app>',
        to: [player.parent_email],
        replyTo: trainer.email,
        subject: `Session request update — ${trainer.full_name}`,
        html: emailHtml(parentBody),
      }).catch(() => {})
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
