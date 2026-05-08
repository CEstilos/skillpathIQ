import { createClient } from '@supabase/supabase-js'
import IntakeClient from '@/components/IntakeClient'

function InactiveMessage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', padding: '24px' }}>
      <p style={{ color: '#9A9A9F', fontSize: '14px', textAlign: 'center' }}>This link is no longer active.</p>
    </div>
  )
}

export default async function IntakePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )

  const { data: trainer } = await supabase
    .from('profiles')
    .select('id, full_name, public_profile_enabled')
    .eq('username', username)
    .single()

  if (!trainer || !trainer.public_profile_enabled) {
    return <InactiveMessage />
  }

  return (
    <IntakeClient
      trainer={{ id: trainer.id, full_name: trainer.full_name }}
    />
  )
}
