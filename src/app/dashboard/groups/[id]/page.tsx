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

  const { data: players } = await supabase
    .from('players').select('*').eq('group_id', params.id)
    .order('full_name', { ascending: true })

  const { data: allPlayers } = await supabase
    .from('players').select('id, full_name, group_id, parent_email, avatar_initials')
    .eq('trainer_id', user.id).order('full_name', { ascending: true })

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
    .in('player_id', players?.map(p => p.id) || [])
    .in('drill_id', drills?.map(d => d.id) || [])

  return (
    <GroupDetailClient
      group={group}
      players={players || []}
      allPlayers={allPlayers || []}
      sessions={sessions || []}
      drillWeeks={drillWeeks || []}
      drills={drills || []}
      completions={completions || []}
      trainerName={profile?.full_name || undefined}
      trainerEmail={(profile as { full_name?: string; email?: string } | null)?.email || undefined}
    />
  )
}
