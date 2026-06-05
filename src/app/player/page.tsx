import { createClient } from '@supabase/supabase-js'
import { Suspense } from 'react'
import PlayerShareClient from '@/components/PlayerShareClient'

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

function getNextNDateISOs(dayOfWeek: string, n: number, blackouts: string[]): string[] {
  const dayNums: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 }
  const target = dayNums[dayOfWeek.toLowerCase()] ?? -1
  if (target === -1) return []
  const blackoutSet = new Set(blackouts)
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)
  cursor.setDate(cursor.getDate() + 1)
  const results: string[] = []
  let safety = 0
  while (results.length < n && safety < 365) {
    if (cursor.getDay() === target) {
      const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
      if (!blackoutSet.has(iso)) results.push(iso)
    }
    cursor.setDate(cursor.getDate() + 1)
    safety++
  }
  return results
}

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

  // Service role client for all data that requires bypassing RLS on the public profile page
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data: player } = await supabase
    .from('players')
    .select('*')
    .eq('id', playerId)
    .single()

  if (!player) return <NotFound message="Player not found." />

  const { data: memberRows } = await supabaseAdmin
    .from('group_members').select('group_id').eq('player_id', player.id)
  const group_ids = (memberRows || []).map(m => m.group_id)
  const playerWithGroups = { ...player, group_ids }

  const today = new Date().toISOString().split('T')[0]

  // Fetch all independent data in parallel
  const [
    { data: trainer },
    { data: rawWindows },
    { data: sessionDurations },
    { data: rawBlackouts },
    { data: latestFeedbackRow },
    { data: allSessionsData },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, bio, sport, location, profile_photo_url, individual_rate, group_rate, username')
      .eq('id', player.trainer_id)
      .single(),
    supabase
      .from('trainer_availability_windows')
      .select('id, day_of_week, start_time, end_time, session_type, display_label, sort_order, duration_minutes, buffer_minutes, max_capacity, gender_filter, min_age, max_age, experience_filter')
      .eq('trainer_id', player.trainer_id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('trainer_session_durations')
      .select('id, duration_minutes, label')
      .eq('trainer_id', player.trainer_id)
      .order('duration_minutes', { ascending: true }),
    supabaseAdmin
      .from('trainer_blackout_dates')
      .select('blackout_date')
      .eq('trainer_id', player.trainer_id)
      .gte('blackout_date', today)
      .order('blackout_date', { ascending: true }),
    // Latest coach feedback — service role bypasses RLS
    supabaseAdmin
      .from('sessions')
      .select('feedback, session_date')
      .eq('player_id', player.id)
      .not('feedback', 'is', null)
      .order('session_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Session history for the Sessions tab
    supabaseAdmin
      .from('sessions')
      .select('id, feedback, session_date, session_type, notes, drills_covered')
      .eq('player_id', player.id)
      .order('session_date', { ascending: false })
      .limit(20),
  ])

  const blackoutDaySet = new Set(
    (rawBlackouts || []).map(b => DAY_NAMES[new Date(b.blackout_date + 'T00:00:00').getDay()])
  )
  const availabilityWindows = (rawWindows || []).filter(w => !blackoutDaySet.has(w.day_of_week))
  const upcomingBlackouts = (rawBlackouts || []).map(b => b.blackout_date)

  // Fetch current drill week: player-specific first, then group fallback
  let drillWeekData: { id: string; title: string; group_id: string | null; player_id: string | null; week_start: string } | null = null
  const { data: playerDrillWeek } = await supabaseAdmin
    .from('drill_weeks')
    .select('id, title, group_id, player_id, week_start')
    .eq('player_id', player.id)
    .order('week_start', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (playerDrillWeek) {
    drillWeekData = playerDrillWeek
  } else if (group_ids.length > 0) {
    const groupFilter = group_ids.map(gid => `group_id.eq.${gid}`).join(',')
    const { data: groupDrillWeek } = await supabaseAdmin
      .from('drill_weeks')
      .select('id, title, group_id, player_id, week_start')
      .or(groupFilter)
      .order('week_start', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (groupDrillWeek) drillWeekData = groupDrillWeek
  }

  // Fetch all drill weeks for the history tab
  const orFilter = group_ids.length > 0
    ? `player_id.eq.${player.id},${group_ids.map(gid => `group_id.eq.${gid}`).join(',')}`
    : `player_id.eq.${player.id}`
  const { data: allDrillWeeksData } = await supabaseAdmin
    .from('drill_weeks')
    .select('id, title, week_start')
    .or(orFilter)
    .order('week_start', { ascending: false })

  // Fetch drills + completions in parallel (depends on week IDs)
  const currentWeekDrillIds: string[] = []
  const allWeekIds = (allDrillWeeksData || []).map(w => w.id)

  const [currentDrillsResult, allDrillsResult] = await Promise.all([
    drillWeekData
      ? supabaseAdmin.from('drills').select('id, title, description, reps, drill_week_id, sort_order').eq('drill_week_id', drillWeekData.id).order('sort_order', { ascending: true })
      : Promise.resolve({ data: [] as { id: string; title: string; description: string; reps: string; drill_week_id: string; sort_order: number }[] }),
    allWeekIds.length > 0
      ? supabaseAdmin.from('drills').select('id, title, reps, drill_week_id').in('drill_week_id', allWeekIds)
      : Promise.resolve({ data: [] as { id: string; title: string; reps: string; drill_week_id: string }[] }),
  ])

  const currentDrills = currentDrillsResult.data || []
  const allDrills = allDrillsResult.data || []
  currentWeekDrillIds.push(...currentDrills.map(d => d.id))

  const allDrillIds = allDrills.map(d => d.id)
  const [currentCompletionsResult, allCompletionsResult] = await Promise.all([
    currentWeekDrillIds.length > 0
      ? supabaseAdmin.from('completions').select('id, drill_id, player_id').eq('player_id', player.id).in('drill_id', currentWeekDrillIds)
      : Promise.resolve({ data: [] as { id: string; drill_id: string; player_id: string }[] }),
    allDrillIds.length > 0
      ? supabaseAdmin.from('completions').select('id, drill_id, player_id').eq('player_id', player.id).in('drill_id', allDrillIds)
      : Promise.resolve({ data: [] as { id: string; drill_id: string; player_id: string }[] }),
  ])

  const initialCompletions = currentCompletionsResult.data || []
  const allCompletions = allCompletionsResult.data || []

  // Upcoming group sessions + package/attendance data
  let upcomingGroupSessions: {
    id: string; session_date: string; session_time: string; duration_minutes: number | null
    group_id: string; group_name: string; group_window_id: string | null
    display_label: string | null; max_capacity: number | null; confirmed_count: number
  }[] = []
  let confirmedGroupIds: string[] = []
  let pendingAttendanceSessionIds: string[] = []
  let activePackage: { id: string; sessions_remaining: number; package_name: string } | null = null
  type GroupSchedule = { group_id: string; group_name: string; window_id: string | null; display_label: string | null; session_time: string; duration_minutes: number; upcoming_dates: string[] }
  let groupSchedules: GroupSchedule[] = []

  if (group_ids.length > 0) {
    const [
      { data: rawSessions },
      { data: confirmedRows },
      { data: pendingRows },
      { data: playerGroupsData },
    ] = await Promise.all([
      supabaseAdmin
        .from('sessions')
        .select('id, session_date, session_time, duration_minutes, group_id, groups(id, name, window_id)')
        .in('group_id', group_ids)
        .gte('session_date', today)
        .neq('status', 'logged')
        .neq('status', 'cancelled')
        .is('player_id', null)
        .order('session_date', { ascending: true })
        .order('session_time', { ascending: true })
        .limit(20),
      supabaseAdmin
        .from('group_confirmed_players')
        .select('group_id')
        .eq('player_id', player.id)
        .in('group_id', group_ids),
      supabaseAdmin
        .from('session_attendance_requests')
        .select('session_id')
        .eq('player_id', player.id)
        .eq('status', 'pending'),
      supabaseAdmin
        .from('groups')
        .select('id, name, window_id')
        .in('id', group_ids),
    ])

    confirmedGroupIds = (confirmedRows || []).map(r => r.group_id)
    pendingAttendanceSessionIds = (pendingRows || []).map(r => r.session_id)

    if (rawSessions && rawSessions.length > 0) {
      type RawSession = {
        id: string; session_date: string; session_time: string
        duration_minutes: number | null; group_id: string
        groups: { id: string; name: string; window_id: string | null } | null
      }
      const typedSessions = rawSessions as unknown as RawSession[]

      const windowIds = [...new Set(
        typedSessions.map(s => s.groups?.window_id).filter(Boolean) as string[]
      )]

      let windowMap: Record<string, { display_label: string | null; max_capacity: number | null }> = {}
      if (windowIds.length > 0) {
        const { data: windows } = await supabaseAdmin
          .from('trainer_availability_windows')
          .select('id, display_label, max_capacity')
          .in('id', windowIds)
        for (const w of windows || []) {
          windowMap[w.id] = { display_label: w.display_label, max_capacity: w.max_capacity }
        }
      }

      const relevantGroupIds = [...new Set(typedSessions.map(s => s.group_id))]
      const { data: confirmedCounts } = await supabaseAdmin
        .from('group_confirmed_players')
        .select('group_id')
        .in('group_id', relevantGroupIds)
      const countByGroup: Record<string, number> = {}
      for (const row of confirmedCounts || []) {
        countByGroup[row.group_id] = (countByGroup[row.group_id] || 0) + 1
      }

      upcomingGroupSessions = typedSessions.map(s => {
        const groupData = s.groups
        const windowId = groupData?.window_id || null
        const windowInfo = windowId ? windowMap[windowId] : null
        return {
          id: s.id,
          session_date: s.session_date,
          session_time: s.session_time,
          duration_minutes: s.duration_minutes,
          group_id: s.group_id,
          group_name: groupData?.name || 'Group',
          group_window_id: windowId,
          display_label: windowInfo?.display_label || null,
          max_capacity: windowInfo?.max_capacity || null,
          confirmed_count: countByGroup[s.group_id] || 0,
        }
      })
    }

    // For groups without a resolvable window, fall back to inferring day/time from existing sessions
    const fallbackGroupIds = (playerGroupsData || [])
      .filter(g => !g.window_id || !(rawWindows || []).find(w => w.id === g.window_id))
      .map(g => g.id)

    const fallbackInfoMap: Record<string, { day_of_week: string; session_time: string; duration_minutes: number }> = {}
    if (fallbackGroupIds.length > 0) {
      const { data: fallbackSessions } = await supabaseAdmin
        .from('sessions')
        .select('group_id, session_date, session_time, duration_minutes')
        .in('group_id', fallbackGroupIds)
        .not('session_time', 'is', null)
        .order('session_date', { ascending: false })
        .limit(fallbackGroupIds.length * 5)
      for (const s of (fallbackSessions || [])) {
        if (!fallbackInfoMap[s.group_id] && s.session_time) {
          const d = new Date(s.session_date + 'T00:00:00')
          fallbackInfoMap[s.group_id] = {
            day_of_week: DAY_NAMES[d.getDay()],
            session_time: s.session_time,
            duration_minutes: s.duration_minutes || 60,
          }
        }
      }
    }

    // Compute upcoming dates per group from availability windows (for date-selection UI)
    groupSchedules = (playerGroupsData || []).flatMap(g => {
      const w = g.window_id ? (rawWindows || []).find(w => w.id === g.window_id) : null
      if (w) {
        return [{
          group_id: g.id,
          group_name: g.name,
          window_id: w.id as string | null,
          display_label: w.display_label,
          session_time: w.start_time,
          duration_minutes: w.duration_minutes,
          upcoming_dates: getNextNDateISOs(w.day_of_week, 5, upcomingBlackouts),
        }]
      }
      const fallback = fallbackInfoMap[g.id]
      if (!fallback) return []
      return [{
        group_id: g.id,
        group_name: g.name,
        window_id: null as string | null,
        display_label: null,
        session_time: fallback.session_time,
        duration_minutes: fallback.duration_minutes,
        upcoming_dates: getNextNDateISOs(fallback.day_of_week, 5, upcomingBlackouts),
      }]
    })
  }

  // Active player_package
  const { data: pkgRow } = await supabaseAdmin
    .from('player_packages')
    .select('id, sessions_remaining, trainer_packages(name)')
    .eq('player_id', player.id)
    .eq('trainer_id', player.trainer_id)
    .eq('status', 'active')
    .gt('sessions_remaining', 0)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (pkgRow) {
    activePackage = {
      id: pkgRow.id,
      sessions_remaining: pkgRow.sessions_remaining,
      package_name: (Array.isArray(pkgRow.trainer_packages) ? pkgRow.trainer_packages[0] : pkgRow.trainer_packages as { name: string } | null)?.name || 'Package',
    }
  }

  return (
    <PlayerShareClient
      player={playerWithGroups}
      trainer={trainer || null}
      availabilityWindows={availabilityWindows}
      sessionDurations={sessionDurations || []}
      upcomingBlackouts={upcomingBlackouts}
      latestFeedback={latestFeedbackRow?.feedback || null}
      initialSessions={(allSessionsData || []) as { id: string; feedback: string | null; session_date: string; session_type: string; notes: string | null; drills_covered: string | null }[]}
      initialDrillWeek={drillWeekData}
      initialDrills={currentDrills}
      initialCompletions={initialCompletions}
      initialAllDrillWeeks={(allDrillWeeksData || []) as { id: string; title: string; week_start: string }[]}
      initialAllDrills={allDrills}
      initialAllCompletions={allCompletions}
      upcomingGroupSessions={upcomingGroupSessions}
      confirmedGroupIds={confirmedGroupIds}
      pendingAttendanceSessionIds={pendingAttendanceSessionIds}
      activePackage={activePackage}
      trainerUsername={trainer?.username || null}
      groupSchedules={groupSchedules}
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
