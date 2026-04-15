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

  const { data: todaySessions } = await supabase
    .from('sessions').select('*, groups(name, sport)')
    .eq('trainer_id', user.id)
    .eq('session_date', today)
    .neq('status', 'cancelled')
    .order('session_time', { ascending: true })

  // Fetch upcoming one-off sessions
  const { data: upcomingOneOff } = await supabase
    .from('sessions').select('*, groups(name, sport)')
    .eq('trainer_id', user.id)
    .eq('type', 'one-off')
    .gt('session_date', today)
    .neq('status', 'cancelled')
    .order('session_date', { ascending: true })
    .limit(10)

  // Fetch all recurring sessions (including past ones — we'll compute next occurrence)
  const { data: recurringSessions } = await supabase
    .from('sessions').select('*, groups(name, sport)')
    .eq('trainer_id', user.id)
    .eq('type', 'recurring')
    .neq('status', 'cancelled')

  // Calculate next occurrence for each recurring session
  function getNextOccurrence(sessionDate: string, recurrenceRule: string): string {
    const start = new Date(sessionDate + 'T00:00:00')
    const todayDate = new Date(today + 'T00:00:00')

    if (start > todayDate) return sessionDate

    let next = new Date(start)
    const intervalDays = recurrenceRule === 'daily' ? 1
      : recurrenceRule === 'biweekly' ? 14
      : recurrenceRule === 'monthly' ? 30
      : 7 // default weekly

    while (next <= todayDate) {
      next.setDate(next.getDate() + intervalDays)
    }

    return next.toISOString().split('T')[0]
  }

  // Map recurring sessions to their next occurrence date
  const upcomingRecurring = (recurringSessions || []).map(s => ({
    ...s,
    session_date: getNextOccurrence(s.session_date, s.recurrence_rule || 'weekly'),
  })).filter(s => s.session_date > today)

  // Merge and sort all upcoming sessions
  const allUpcoming = [...(upcomingOneOff || []), ...upcomingRecurring]
    .sort((a, b) => a.session_date.localeCompare(b.session_date))
    .slice(0, 10)

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
      upcomingSessions={allUpcoming}
      allSessionPlayers={sessionPlayers || []}
    />
  )
}
