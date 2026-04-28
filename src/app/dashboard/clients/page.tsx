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

  return (
    <ClientsPageClient
      profile={profile}
      players={players || []}
      archivedPlayers={archivedPlayers || []}
      sessions={sessions || []}
      groups={groups || []}
      sessionPlayers={sessionPlayers || []}
      drillWeeks={drillWeeks || []}
      drills={drills || []}
      completions={completions || []}
    />
  )
}
