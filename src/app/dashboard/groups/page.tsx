import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import GroupsListClient from '@/components/GroupsListClient'

export default async function GroupsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles').select('full_name').eq('id', user.id).single()

  const { data: groups } = await supabase
    .from('groups').select('*').eq('trainer_id', user.id)
    .order('name', { ascending: true })

  const { data: players } = await supabase
    .from('players').select('id, full_name, group_id, parent_email')
    .eq('trainer_id', user.id).eq('archived', false)

  const { data: sessions } = await supabase
    .from('sessions').select('id, group_id, session_date, session_time, status, title, rescheduled_date')
    .eq('trainer_id', user.id)
    .not('group_id', 'is', null)
    .neq('status', 'cancelled')
    .order('session_date', { ascending: true })

  const { data: drillWeeks } = await supabase
    .from('drill_weeks').select('id, group_id')
    .eq('trainer_id', user.id)
    .not('group_id', 'is', null)

  const { data: drills } = await supabase
    .from('drills').select('id, drill_week_id')
    .in('drill_week_id', drillWeeks?.map(w => w.id) || [])

  const { data: completions } = await supabase
    .from('completions').select('player_id, drill_id')
    .in('player_id', players?.map(p => p.id) || [])
    .in('drill_id', drills?.map(d => d.id) || [])

  return (
    <GroupsListClient
      profile={profile}
      groups={groups || []}
      players={players || []}
      sessions={sessions || []}
      drillWeeks={drillWeeks || []}
      drills={drills || []}
      completions={completions || []}
    />
  )
}
