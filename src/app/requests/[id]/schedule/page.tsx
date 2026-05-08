import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import ScheduleRequestClient from '@/components/ScheduleRequestClient'

export default async function ScheduleRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: bookingRequest } = await supabase
    .from('booking_requests')
    .select('*')
    .eq('id', id)
    .eq('trainer_id', user.id)
    .single()

  if (!bookingRequest) {
    return (
      <div style={{ minHeight: '100vh', background: '#0E0E0F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', padding: '24px' }}>
        <div style={{ textAlign: 'center', color: '#9A9A9F', fontSize: '14px' }}>Booking request not found.</div>
      </div>
    )
  }

  if (bookingRequest.status !== 'pending') {
    return (
      <div style={{ minHeight: '100vh', background: '#0E0E0F', fontFamily: 'sans-serif', padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: '360px' }}>
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#ffffff', marginBottom: '8px' }}>Already processed</div>
          <div style={{ fontSize: '14px', color: '#9A9A9F', marginBottom: '24px' }}>This request has already been {bookingRequest.status}.</div>
          <a href="/dashboard" style={{ display: 'inline-block', background: '#00FF9F', color: '#0E0E0F', textDecoration: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: 700 }}>← Back to Dashboard</a>
        </div>
      </div>
    )
  }

  const today = new Date().toISOString().split('T')[0]

  const [
    { data: availabilityWindows },
    { data: sessionDurations },
    { data: upcomingSessions },
    { data: profile },
  ] = await Promise.all([
    supabase
      .from('trainer_availability_windows')
      .select('id, day_of_week, start_time, end_time, session_type, duration_minutes, display_label')
      .eq('trainer_id', user.id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('trainer_session_durations')
      .select('id, duration_minutes, label')
      .eq('trainer_id', user.id)
      .order('duration_minutes', { ascending: true }),
    supabase
      .from('sessions')
      .select('id, title, session_date, session_time, duration_minutes, session_type, player_id, players(full_name)')
      .eq('trainer_id', user.id)
      .gte('session_date', today)
      .neq('status', 'cancelled')
      .not('status', 'eq', 'logged')
      .order('session_date', { ascending: true })
      .order('session_time', { ascending: true })
      .limit(50),
    supabase
      .from('profiles')
      .select('id, full_name, location')
      .eq('id', user.id)
      .single(),
  ])

  // Normalize Supabase join: players comes back as array[0] or null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const normalizedSessions = (upcomingSessions || []).map((s: any) => ({
    ...s,
    players: Array.isArray(s.players) ? (s.players[0] ?? null) : s.players ?? null,
  }))

  return (
    <ScheduleRequestClient
      bookingRequest={bookingRequest}
      availabilityWindows={availabilityWindows || []}
      sessionDurations={sessionDurations || []}
      upcomingSessions={normalizedSessions}
      trainerName={profile?.full_name || ''}
    />
  )
}
