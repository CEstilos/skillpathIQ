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

  const { data: memberRows } = await supabase
    .from('group_members').select('group_id').eq('player_id', player.id)
  const group_ids = (memberRows || []).map(m => m.group_id)
  const playerWithGroups = { ...player, group_ids }

  const { data: trainer } = await supabase
    .from('profiles')
    .select('id, full_name, bio, sport, location, profile_photo_url, individual_rate, group_rate, username')
    .eq('id', player.trainer_id)
    .single()

  const today = new Date().toISOString().split('T')[0]

  const [{ data: rawWindows }, { data: sessionDurations }, { data: rawBlackouts }] = await Promise.all([
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

  // Fetch upcoming group sessions for player's groups
  let upcomingGroupSessions: {
    id: string
    session_date: string
    session_time: string
    duration_minutes: number | null
    group_id: string
    group_name: string
    group_window_id: string | null
    display_label: string | null
    max_capacity: number | null
    confirmed_count: number
  }[] = []

  let confirmedGroupIds: string[] = []
  let pendingAttendanceSessionIds: string[] = []
  let activePackage: { id: string; sessions_remaining: number; package_name: string } | null = null

  if (group_ids.length > 0) {
    const [
      { data: rawSessions },
      { data: confirmedRows },
      { data: pendingRows },
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
        .limit(5),
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

      // Gather unique window IDs from groups for capacity info
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

      // Get confirmed counts per group
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
  }

  // Fetch active player_package
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
      upcomingGroupSessions={upcomingGroupSessions}
      confirmedGroupIds={confirmedGroupIds}
      pendingAttendanceSessionIds={pendingAttendanceSessionIds}
      activePackage={activePackage}
      trainerUsername={trainer?.username || null}
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
