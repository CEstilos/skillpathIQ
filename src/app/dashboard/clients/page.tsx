import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import ClientsPageClient from '@/components/ClientsPageClient'

export default async function ClientsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()

  const { data: players } = await supabase
    .from('players').select('*').eq('trainer_id', user.id).eq('archived', false)
    .order('created_at', { ascending: false })

  const { data: archivedPlayers } = await supabase
    .from('players').select('*').eq('trainer_id', user.id).eq('archived', true)
    .order('archived_at', { ascending: false })

  const { data: sessions } = await supabase
    .from('sessions').select('*').eq('trainer_id', user.id)
    .neq('status', 'cancelled')
    .order('session_date', { ascending: false })

  const { data: groups } = await supabase
    .from('groups').select('*').eq('trainer_id', user.id)

  const { data: sessionPlayers } = await supabase
    .from('session_players').select('session_id, player_id')

  const { data: drillWeeks } = await supabase
    .from('drill_weeks').select('*').eq('trainer_id', user.id)
    .order('week_start', { ascending: false })

  const { data: drills } = await supabase
    .from('drills').select('*').eq('trainer_id', user.id)

  const { data: completions } = await supabase
    .from('completions').select('*')
    .in('player_id', players?.map(p => p.id) || [])

  const allPlayerIds = [...(players || []).map(p => p.id), ...(archivedPlayers || []).map(p => p.id)]
  const { data: groupMemberRows } = allPlayerIds.length > 0
    ? await supabase.from('group_members').select('group_id, player_id').in('player_id', allPlayerIds)
    : { data: [] }

  const groupIdsMap = new Map<string, string[]>()
  for (const m of (groupMemberRows || [])) {
    if (!groupIdsMap.has(m.player_id)) groupIdsMap.set(m.player_id, [])
    groupIdsMap.get(m.player_id)!.push(m.group_id)
  }
  const enrichedPlayers = (players || []).map(p => ({ ...p, group_ids: groupIdsMap.get(p.id) || [] }))
  const enrichedArchivedPlayers = (archivedPlayers || []).map(p => ({ ...p, group_ids: groupIdsMap.get(p.id) || [] }))

  return (
    <ClientsPageClient
      profile={profile}
      players={enrichedPlayers}
      archivedPlayers={enrichedArchivedPlayers}
      sessions={sessions || []}
      groups={groups || []}
      sessionPlayers={sessionPlayers || []}
      drillWeeks={drillWeeks || []}
      drills={drills || []}
      completions={completions || []}
    />
  )
}
