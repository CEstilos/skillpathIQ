import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import PlayerProfileClient from '@/components/PlayerProfileClient'

export default async function PlayerProfilePage({ params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: player } = await supabase
    .from('players')
    .select('*')
    .eq('id', params.id)
    .eq('trainer_id', user.id)
    .single()

  if (!player) redirect('/dashboard')

  const { data: sessions } = await supabase
    .from('sessions')
    .select('*')
    .eq('player_id', params.id)
    .order('session_date', { ascending: false })

  const { data: drillWeeks } = await supabase
    .from('drill_weeks')
    .select('*')
    .or(`player_id.eq.${params.id},group_id.eq.${player.group_id || '00000000-0000-0000-0000-000000000000'}`)
    .order('week_start', { ascending: false })

  const { data: drills } = await supabase
    .from('drills')
    .select('*')
    .in('drill_week_id', drillWeeks?.map(w => w.id) || [])
    .order('sort_order', { ascending: true })

  const { data: completions } = await supabase
    .from('completions')
    .select('*')
    .eq('player_id', params.id)
    .in('drill_id', drills?.map(d => d.id) || [])

  const { data: group } = player.group_id ? await supabase
    .from('groups')
    .select('*')
    .eq('id', player.group_id)
    .single() : { data: null }

  const { data: profile } = await supabase
    .from('profiles').select('full_name, email').eq('id', user.id).single()

  return (
    <PlayerProfileClient
      player={player}
      sessions={sessions || []}
      drillWeeks={drillWeeks || []}
      drills={drills || []}
      completions={completions || []}
      group={group}
      trainerName={profile?.full_name || undefined}
      trainerEmail={(profile as { full_name?: string; email?: string } | null)?.email || undefined}
    />
  )
}
