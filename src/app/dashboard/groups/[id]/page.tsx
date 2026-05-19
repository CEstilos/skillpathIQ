/*
-- Run in Supabase SQL Editor:
-- ALTER TABLE groups ADD COLUMN IF NOT EXISTS window_id uuid REFERENCES trainer_availability_windows(id) ON DELETE SET NULL;
-- ALTER TABLE groups ADD COLUMN IF NOT EXISTS description text;
-- CREATE TABLE IF NOT EXISTS group_confirmed_players (
--   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--   group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
--   player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
--   confirmed_at timestamptz DEFAULT now(),
--   confirmed_by_trainer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
--   UNIQUE(group_id, player_id)
-- );
-- ALTER TABLE group_confirmed_players ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "trainers_manage_confirmed_players" ON group_confirmed_players FOR ALL
--   USING (EXISTS (SELECT 1 FROM groups WHERE groups.id = group_confirmed_players.group_id AND groups.trainer_id = auth.uid()))
--   WITH CHECK (EXISTS (SELECT 1 FROM groups WHERE groups.id = group_confirmed_players.group_id AND groups.trainer_id = auth.uid()));
*/

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import GroupDetailClient from '@/components/GroupDetailClient'

export default async function GroupDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ request?: string }>
}) {
  const { id: groupId } = await params
  const { request: requestId } = await searchParams

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: group } = await supabase
    .from('groups').select('*').eq('id', groupId).eq('trainer_id', user.id).single()

  if (!group) redirect('/dashboard/groups')

  const { data: profile } = await supabase
    .from('profiles').select('full_name, email, location').eq('id', user.id).single()

  // Fetch the linked availability window (if any), and all trainer's windows for edit dropdown
  const { data: allWindows } = await supabase
    .from('trainer_availability_windows')
    .select('id, day_of_week, start_time, end_time, session_type, display_label, max_capacity, sort_order')
    .eq('trainer_id', user.id)
    .in('session_type', ['group', 'both'])
    .order('sort_order', { ascending: true })

  const linkedWindow = (group as { window_id?: string | null }).window_id
    ? (allWindows || []).find(w => w.id === (group as { window_id?: string | null }).window_id) || null
    : null

  const maxCapacity = linkedWindow?.max_capacity ?? null

  // Booking request from ?request= param
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let bookingRequest: any = null
  if (requestId) {
    const { data: req } = await supabase
      .from('booking_requests')
      .select('*')
      .eq('id', requestId)
      .eq('trainer_id', user.id)
      .single()
    if (req && req.status === 'pending') {
      bookingRequest = req
    }
  }

  // Get member player IDs for this group
  const { data: memberRows } = await supabase
    .from('group_members').select('player_id').eq('group_id', groupId)
  const memberPlayerIds = (memberRows || []).map(r => r.player_id)

  // Fetch group's players
  const groupPlayers = memberPlayerIds.length > 0
    ? (await supabase.from('players').select('*').in('id', memberPlayerIds).eq('archived', false).order('full_name', { ascending: true })).data || []
    : []

  // Attendance stats — two queries, merge
  const { data: loggedSessions } = await supabase
    .from('sessions')
    .select('id, session_date')
    .eq('group_id', groupId)
    .eq('status', 'logged')

  const loggedSessionIds = (loggedSessions || []).map(s => s.id)
  const sessionDateById = new Map<string, string>()
  for (const s of (loggedSessions || [])) sessionDateById.set(s.id, s.session_date)

  const { data: attendanceRows } = loggedSessionIds.length > 0
    ? await supabase
        .from('session_attendance')
        .select('session_id, player_id, attended')
        .in('session_id', loggedSessionIds)
        .eq('attended', true)
    : { data: [] as { session_id: string; player_id: string; attended: boolean }[] }

  const attendanceStats = new Map<string, { total: number; lastDate: string | null }>()
  for (const row of (attendanceRows || [])) {
    const existing = attendanceStats.get(row.player_id) || { total: 0, lastDate: null }
    existing.total += 1
    const date = sessionDateById.get(row.session_id) || null
    if (date && (!existing.lastDate || date > existing.lastDate)) {
      existing.lastDate = date
    }
    attendanceStats.set(row.player_id, existing)
  }

  const rosterPlayers = groupPlayers.map(p => {
    const stats = attendanceStats.get(p.id) || { total: 0, lastDate: null }
    return {
      id: p.id,
      full_name: p.full_name,
      parent_email: p.parent_email || null,
      avatar_initials: p.avatar_initials || null,
      birth_year: p.birth_year || null,
      player_gender: p.player_gender || null,
      player_experience: p.player_experience || null,
      total_attended: stats.total,
      last_attended: stats.lastDate,
    }
  })

  // Confirmed players
  const { data: confirmedRows } = await supabase
    .from('group_confirmed_players')
    .select('player_id')
    .eq('group_id', groupId)

  const confirmedIds = (confirmedRows || []).map(r => r.player_id)
  const confirmedPlayers = confirmedIds.length > 0
    ? (await supabase.from('players').select('id, full_name, avatar_initials, parent_email').in('id', confirmedIds)).data || []
    : []

  // All trainer's players (for adding existing player to the group)
  const { data: rawAllPlayers } = await supabase
    .from('players').select('id, full_name, parent_email, avatar_initials')
    .eq('trainer_id', user.id).eq('archived', false).order('full_name', { ascending: true })

  const allPlayerIds = (rawAllPlayers || []).map(p => p.id)
  const { data: allMemberRows } = allPlayerIds.length > 0
    ? await supabase.from('group_members').select('group_id, player_id').in('player_id', allPlayerIds)
    : { data: [] as { group_id: string; player_id: string }[] }

  const membershipMap = new Map<string, string[]>()
  for (const m of (allMemberRows || [])) {
    if (!membershipMap.has(m.player_id)) membershipMap.set(m.player_id, [])
    membershipMap.get(m.player_id)!.push(m.group_id)
  }
  const allPlayers = (rawAllPlayers || []).map(p => ({ ...p, group_ids: membershipMap.get(p.id) || [] }))

  // Upcoming sessions
  const today = new Date().toISOString().split('T')[0]
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, title, session_date, session_time, status, group_id, rescheduled_date')
    .eq('group_id', groupId)
    .neq('status', 'cancelled')
    .order('session_date', { ascending: true })

  // Session history (logged sessions w/ attendance counts)
  const sessionHistory = (loggedSessions || [])
    .map(s => {
      const totalAttended = (attendanceRows || []).filter(a => a.session_id === s.id).length
      // count of total attendance rows (attended or not) requires another query — we'll show attended count vs roster size
      return {
        id: s.id,
        session_date: s.session_date,
        attended_count: totalAttended,
        total_count: rosterPlayers.length,
      }
    })
    .sort((a, b) => b.session_date.localeCompare(a.session_date))
    .slice(0, 20)

  // Drill data — kept for legacy display
  const { data: drillWeeks } = await supabase
    .from('drill_weeks').select('*').eq('group_id', groupId)
    .order('week_start', { ascending: false })

  const { data: drills } = await supabase
    .from('drills').select('*')
    .in('drill_week_id', drillWeeks?.map(w => w.id) || [])
    .order('sort_order', { ascending: true })

  const { data: completions } = await supabase
    .from('completions').select('player_id, drill_id')
    .in('player_id', rosterPlayers.map(p => p.id))
    .in('drill_id', drills?.map(d => d.id) || [])

  return (
    <GroupDetailClient
      group={group}
      allWindows={allWindows || []}
      linkedWindow={linkedWindow}
      bookingRequest={bookingRequest}
      confirmedPlayers={confirmedPlayers}
      rosterPlayers={rosterPlayers}
      sessionHistory={sessionHistory}
      maxCapacity={maxCapacity}
      sessions={sessions || []}
      allPlayers={allPlayers}
      drillWeeks={drillWeeks || []}
      drills={drills || []}
      completions={completions || []}
      trainerName={profile?.full_name || undefined}
      trainerEmail={(profile as { full_name?: string; email?: string } | null)?.email || undefined}
      trainerProfile={{
        full_name: profile?.full_name || '',
        email: profile?.email || '',
        location: (profile as { location?: string | null } | null)?.location || null,
      }}
									       />
  )
}
