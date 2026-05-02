import { createClient } from '@supabase/supabase-js'
import TrainerProfileClient from '@/components/TrainerProfileClient'

export default async function TrainerProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )

  const { data: trainer } = await supabase
    .from('profiles')
    .select('id, full_name, bio, sport, location, profile_photo_url, public_profile_enabled, individual_rate, group_rate')
    .eq('username', username)
    .single()

  if (!trainer) {
    return (
      <div style={{ minHeight: '100vh', background: '#0E0E0F', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', padding: '24px' }}>
        <div style={{ fontSize: '14px', color: '#9A9A9F', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>404</div>
          This trainer profile doesn&apos;t exist.
        </div>
      </div>
    )
  }

  if (!trainer.public_profile_enabled) {
    return (
      <div style={{ minHeight: '100vh', background: '#0E0E0F', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', padding: '24px' }}>
        <div style={{ fontSize: '14px', color: '#9A9A9F', textAlign: 'center' }}>
          This profile is not currently available.
        </div>
      </div>
    )
  }

  const [{ data: availabilityWindows }, { data: sessionDurations }] = await Promise.all([
    supabase
      .from('trainer_availability_windows')
      .select('id, day_of_week, start_time, end_time, session_type, display_label, sort_order')
      .eq('trainer_id', trainer.id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('trainer_session_durations')
      .select('id, duration_minutes, label')
      .eq('trainer_id', trainer.id)
      .order('duration_minutes', { ascending: true }),
  ])

  return <TrainerProfileClient trainer={trainer} availabilityWindows={availabilityWindows || []} sessionDurations={sessionDurations || []} />
}
