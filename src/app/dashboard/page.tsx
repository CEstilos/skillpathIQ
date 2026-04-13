import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import DashboardClient from '@/components/DashboardClient'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()

  const { data: players } = await supabase
    .from('players').select('*').eq('trainer_id', user.id)
    .order('created_at', { ascending: false })

  const { data: groups } = await supabase
    .from('groups').select('*').eq('trainer_id', user.id)
    .order('created_at', { ascending: true })

  const { data: sessions } = await supabase
    .from('sessions').select('*').eq('trainer_id', user.id)
    .order('session_date', { ascending: false })

  const { data: drillWeeks } = await supabase
    .from('drill_weeks').select('*').eq('trainer_id', user.id)
    .order('week_start', { ascending: false })

  const { data: drills } = await supabase
    .from('drills').select('*').eq('trainer_id', user.id)

  const { data: completions } = await supabase
    .from('completions').select('*')
    .in('player_id', players?.map(p => p.id) || [])

  const today = new Date().toISOString().split('T')[0]

  const { data: sessionPlayers } = await supabase
  .from('session_players')
  .select('session_id, player_id')
  .eq('trainer_id', user.id)

  const { data: todaySessions } = await supabase
    .from('sessions').select('*, groups(name, sport)')
    .eq('trainer_id', user.id)
    .eq('session_date', today)
    .not('session_time', 'is', null)
    .order('session_time', { ascending: true })

  const { data: upcomingSessions } = await supabase
    .from('sessions').select('*, groups(name, sport)')
    .eq('trainer_id', user.id)
    .gt('session_date', today)
    .not('session_time', 'is', null)
    .order('session_date', { ascending: true })
    .limit(5)

  return (
    <DashboardClient
      profile={profile}
      players={players || []}
      groups={groups || []}
      sessions={sessions || []}
      drillWeeks={drillWeeks || []}
      drills={drills || []}
      completions={completions || []}
      todaySessions={todaySessions || []}
      upcomingSessions={upcomingSessions || []}
      allSessionPlayers={sessionPlayers || []}
    />
  )
}
