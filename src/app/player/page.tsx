import { createClient } from '@supabase/supabase-js'
import { Suspense } from 'react'
import PlayerShareClient from '@/components/PlayerShareClient'

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

function NotFound({ message }: { message: string }) {
  return (
    <div style={{ minHeight: '100vh', background: '#0E0E0F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <p style={{ color: '#9A9A9F', fontSize: '14px' }}>{message}</p>
    </div>
  )
}

async function PlayerPageInner({ playerId }: { playerId: string }) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )

  const { data: player } = await supabase
    .from('players')
    .select('*')
    .eq('id', playerId)
    .single()

  if (!player) return <NotFound message="Player not found." />

  const { data: trainer } = await supabase
    .from('profiles')
    .select('id, full_name, bio, sport, location, profile_photo_url, individual_rate, group_rate')
    .eq('id', player.trainer_id)
    .single()

  const today = new Date().toISOString().split('T')[0]

  const [{ data: rawWindows }, { data: sessionDurations }, { data: rawBlackouts }] = await Promise.all([
    supabase
      .from('trainer_availability_windows')
      .select('id, day_of_week, start_time, end_time, session_type, display_label, sort_order, duration_minutes, buffer_minutes, max_capacity')
      .eq('trainer_id', player.trainer_id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('trainer_session_durations')
      .select('id, duration_minutes, label')
      .eq('trainer_id', player.trainer_id)
      .order('duration_minutes', { ascending: true }),
    supabase
      .from('trainer_blackout_dates')
      .select('blackout_date')
      .eq('trainer_id', player.trainer_id)
      .gte('blackout_date', today)
      .order('blackout_date', { ascending: true }),
  ])

  const blackoutDaySet = new Set(
    (rawBlackouts || []).map(b => DAY_NAMES[new Date(b.blackout_date + 'T00:00:00').getDay()])
  )
  const availabilityWindows = (rawWindows || []).filter(w => !blackoutDaySet.has(w.day_of_week))
  const upcomingBlackouts = (rawBlackouts || []).map(b => b.blackout_date)

  return (
    <PlayerShareClient
      player={player}
      trainer={trainer || null}
      availabilityWindows={availabilityWindows}
      sessionDurations={sessionDurations || []}
      upcomingBlackouts={upcomingBlackouts}
    />
  )
}

export default async function PlayerPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id: playerId } = await searchParams
  if (!playerId) return <NotFound message="No player ID provided." />
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0E0E0F' }} />}>
      <PlayerPageInner playerId={playerId} />
    </Suspense>
  )
}
