import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import GroupDetailClient from '@/components/GroupDetailClient'

export default async function GroupDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: group } = await supabase
    .from('groups').select('*').eq('id', params.id).eq('trainer_id', user.id).single()

  if (!group) redirect('/dashboard/groups')

  const { data: profile } = await supabase
    .from('profiles').select('full_name, email').eq('id', user.id).single()

  // Get member player IDs for this group
  const { data: memberRows } = await supabase
    .from('group_members').select('player_id').eq('group_id', params.id)
  const memberPlayerIds = (memberRows || []).map(r => r.player_id)

  // Fetch group's players
  const players = memberPlayerIds.length > 0
    ? (await supabase.from('players').select('*').in('id', memberPlayerIds).eq('archived', false).order('full_name', { ascending: true })).data || []
    : []

  // Fetch all players (without group_id column)
  const { data: rawAllPlayers } = await supabase
    .from('players').select('id, full_name, parent_email, avatar_initials')
    .eq('trainer_id', user.id).eq('archived', false).order('full_name', { ascending: true })

  // Fetch all group memberships for those players so we know which groups each player is already in
  const allPlayerIds = (rawAllPlayers || []).map(p => p.id)
  const { data: allMemberRows } = allPlayerIds.length > 0
    ? await supabase.from('group_members').select('group_id, player_id').in('player_id', allPlayerIds)
    : { data: [] }

  const membershipMap = new Map<string, string[]>()
  for (const m of (allMemberRows || [])) {
    if (!membershipMap.has(m.player_id)) membershipMap.set(m.player_id, [])
    membershipMap.get(m.player_id)!.push(m.group_id)
  }
  const allPlayers = (rawAllPlayers || []).map(p => ({ ...p, group_ids: membershipMap.get(p.id) || [] }))

  const { data: sessions } = await supabase
    .from('sessions').select('id, title, session_date, session_time, status, group_id, rescheduled_date')
    .eq('group_id', params.id).neq('status', 'cancelled')
    .order('session_date', { ascending: true })

  const { data: drillWeeks } = await supabase
    .from('drill_weeks').select('*').eq('group_id', params.id)
    .order('week_start', { ascending: false })

  const { data: drills } = await supabase
    .from('drills').select('*')
    .in('drill_week_id', drillWeeks?.map(w => w.id) || [])
    .order('sort_order', { ascending: true })

  const { data: completions } = await supabase
    .from('completions').select('player_id, drill_id')
    .in('player_id', players.map(p => p.id))
    .in('drill_id', drills?.map(d => d.id) || [])

  return (
    <GroupDetailClient
      group={group}
      players={players}
      allPlayers={allPlayers}
      sessions={sessions || []}
      drillWeeks={drillWeeks || []}
      drills={drills || []}
      completions={completions || []}
      trainerName={profile?.full_name || undefined}
      trainerEmail={(profile as { full_name?: string; email?: string } | null)?.email || undefined}
    />
  )
}
