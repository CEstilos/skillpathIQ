import { NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function POST(request: Request) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { to, subject, body, playerName, playerUrl } = await request.json()

  try {
    const { data, error } = await resend.emails.send({
      from: 'SkillPathIQ <noreply@skillpathiq.app>',
      to: [to],
      subject: subject || `Session update for ${playerName}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 0; background: #ffffff;">
          
        <!-- HEADER -->
        <div style="background: #0E0E0F; padding: 20px 32px; border-radius: 12px 12px 0 0; text-align: center;">
        <img src="https://skillpathiq.com/logo.png" alt="SkillPathIQ" style="height: 28px; width: auto; max-width: 160px;" />
        </div>

          <!-- BODY -->
          <div style="padding: 32px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px;">
            <div style="font-size: 15px; color: #1a1a1a; line-height: 1.8; white-space: pre-wrap; margin-bottom: 28px;">
${body}
            </div>

            ${playerUrl ? `
            <!-- CTA BUTTON -->
            <div style="margin-bottom: 28px;">
              <a href="${playerUrl}" style="display: inline-block; background: #00FF9F; color: #0E0E0F; text-decoration: none; padding: 13px 24px; border-radius: 8px; font-weight: 700; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
                View ${playerName}&apos;s progress →
              </a>
            </div>
            ` : ''}

            <!-- FOOTER -->
            <div style="border-top: 1px solid #e5e5e5; padding-top: 20px; margin-top: 8px;">
              <p style="font-size: 12px; color: #999999; margin: 0;">
                Sent via <a href="https://skillpathiq.com" style="color: #00CC7A; text-decoration: none; font-weight: 600;">SkillPathIQ</a> · Youth sports trainer platform
              </p>
            </div>
          </div>

        </div>
      `,
    })

    if (error) return NextResponse.json({ error }, { status: 400 })
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
