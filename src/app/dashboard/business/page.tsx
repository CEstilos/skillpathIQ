import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import BusinessClient from '@/components/BusinessClient'

export default async function BusinessPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()

  const { data: players } = await supabase
    .from('players').select('*').eq('trainer_id', user.id).eq('archived', false)

  const { data: sessions } = await supabase
    .from('sessions').select('*').eq('trainer_id', user.id)
    .order('session_date', { ascending: false })

  const { data: attendance } = await supabase
    .from('session_attendance')
    .select('session_id, player_id, attended')
    .eq('trainer_id', user.id)

  const { data: groupMemberRows } = await supabase
    .from('group_members').select('group_id, player_id')
    .in('player_id', (players || []).map(p => p.id))

  const groupIdsMap = new Map<string, string[]>()
  for (const m of (groupMemberRows || [])) {
    if (!groupIdsMap.has(m.player_id)) groupIdsMap.set(m.player_id, [])
    groupIdsMap.get(m.player_id)!.push(m.group_id)
  }
  const enrichedPlayers = (players || []).map(p => ({ ...p, group_ids: groupIdsMap.get(p.id) || [] }))

  return (
    <BusinessClient
      profile={profile}
      players={enrichedPlayers}
      sessions={sessions || []}
      attendance={attendance || []}
    />
  )
}
