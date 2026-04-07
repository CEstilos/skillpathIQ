import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import DashboardClient from '@/components/DashboardClient'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: groups } = await supabase
    .from('groups')
    .select('*')
    .eq('trainer_id', user.id)
    .order('created_at', { ascending: true })

  const { data: players } = await supabase
    .from('players')
    .select('*')
    .eq('trainer_id', user.id)
    .order('created_at', { ascending: true })

  const { data: completions } = await supabase
    .from('completions')
    .select('*')
    .in('player_id', players?.map(p => p.id) || [])

  const { data: drillWeeks } = await supabase
    .from('drill_weeks')
    .select('*')
    .eq('trainer_id', user.id)
    .order('week_start', { ascending: false })

  const { data: drills } = await supabase
    .from('drills')
    .select('*')
    .eq('trainer_id', user.id)

  return (
    <DashboardClient
      profile={profile}
      groups={groups || []}
      players={players || []}
      completions={completions || []}
      drillWeeks={drillWeeks || []}
      drills={drills || []}
    />
  )
}
