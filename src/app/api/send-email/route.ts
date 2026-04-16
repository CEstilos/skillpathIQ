import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  const { to, subject, body, playerName, playerUrl } = await request.json()

  try {
    const { data, error } = await resend.emails.send({
      from: 'SkillPathIQ <onboarding@resend.dev>',
      to: [to],
      subject: subject || `Session update for ${playerName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 16px; background: #ffffff;">
          <div style="margin-bottom: 24px;">
            <img src="https://skillpathiq.com/logo.png" alt="SkillPathIQ" style="height: 36px; width: auto;" />
          </div>
          <div style="font-size: 15px; color: #333333; line-height: 1.7; white-space: pre-wrap; margin-bottom: 32px;">
${body}
          </div>
          ${playerUrl ? `
          <div style="margin-bottom: 32px;">
            <a href="${playerUrl}" style="display: inline-block; background: #00FF9F; color: #0E0E0F; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 700; font-size: 14px;">
              View ${playerName}'s drill progress →
            </a>
          </div>
          ` : ''}
          <div style="border-top: 1px solid #e5e5e5; padding-top: 20px; font-size: 12px; color: #999999;">
            Powered by SkillPathIQ · <a href="https://skillpathiq.com" style="color: #999999;">skillpathiq.com</a>
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
