import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import DashboardClient from '@/components/DashboardClient'

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()

  const { data: players } = await supabase
    .from('players').select('*').eq('trainer_id', user.id).eq('archived', false)
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

    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const cookieDate = cookieStore.get('localDate')?.value
    const today = (await searchParams).date || cookieDate || new Date().toISOString().split('T')[0]

  const { data: sessionPlayers } = await supabase
  .from('session_players')
  .select('session_id, player_id')



    const { data: todaySessions } = await supabase
    .from('sessions').select('*, groups(name, sport)')
    .eq('trainer_id', user.id)
    .eq('session_date', today)
    .neq('status', 'cancelled')
    .is('player_id', null)
    .order('session_time', { ascending: true })

    const { data: sessionLogs } = await supabase
  .from('session_logs')
  .select('session_id')
  .in('session_id', [
    ...(todaySessions?.map(s => s.id) || []),
  ])
  const playerIds = players?.map(p => p.id) || []
  let sessionRequests: { id: string; player_id: string; note: string | null; requested_at: string; status: string; players?: { id: string; full_name: string; parent_email: string } }[] = []
  if (playerIds.length > 0) {
    const { data: requestsData } = await supabase
      .from('session_requests')
      .select('*, players(id, full_name, parent_email)')
      .eq('status', 'pending')
      .in('player_id', playerIds)
      .order('requested_at', { ascending: false })
    sessionRequests = requestsData || []
  }

  const { data: bookingRequests } = await supabase
    .from('booking_requests')
    .select('*')
    .eq('trainer_id', user.id)
    .order('created_at', { ascending: false })

  const { data: unloggedSessions } = await supabase
  .from('sessions')
  .select('*, groups(name, sport)')
  .eq('trainer_id', user.id)
  .is('player_id', null)
  .lte('session_date', today)
  .neq('status', 'logged')
  .neq('status', 'cancelled')
  .order('session_date', { ascending: false })
  // Fetch upcoming one-off sessions
  const { data: upcomingOneOff } = await supabase
    .from('sessions').select('*, groups(name, sport)')
    .eq('trainer_id', user.id)
    .eq('type', 'one-off')
    .gt('session_date', today)
    .neq('status', 'cancelled')
    .is('player_id', null)
    .order('session_date', { ascending: true })
    .limit(20)

  // Fetch all recurring sessions (including past ones — we'll compute next occurrence)
  const { data: recurringSessions } = await supabase
    .from('sessions').select('*, groups(name, sport)')
    .eq('trainer_id', user.id)
    .eq('type', 'recurring')
    .neq('status', 'cancelled')
    .is('player_id', null)

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
    .slice(0, 20)

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
        sessionLogs={sessionLogs || []}
        unloggedSessions={unloggedSessions || []}
        sessionRequests={sessionRequests || []}
        bookingRequests={bookingRequests || []}
      />
    )
}
