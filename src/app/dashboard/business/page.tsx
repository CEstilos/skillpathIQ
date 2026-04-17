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
    .from('players').select('*').eq('trainer_id', user.id)

  const { data: sessions } = await supabase
    .from('sessions').select('*').eq('trainer_id', user.id)
    .order('session_date', { ascending: false })

  const { data: attendance } = await supabase
    .from('session_attendance')
    .select('session_id, player_id, attended')
    .eq('trainer_id', user.id)

  return (
    <BusinessClient
      profile={profile}
      players={players || []}
      sessions={sessions || []}
      attendance={attendance || []}
    />
  )
}
