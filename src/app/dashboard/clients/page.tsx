import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import ClientsPageClient from '@/components/ClientsPageClient'

export default async function ClientsPage() {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: players } = await supabase
    .from('players')
    .select('*')
    .eq('trainer_id', user.id)
    .order('created_at', { ascending: false })

  const { data: groups } = await supabase
    .from('groups')
    .select('*')
    .eq('trainer_id', user.id)

  const { data: drillWeeks } = await supabase
    .from('drill_weeks')
    .select('*')
    .eq('trainer_id', user.id)
    .order('week_start', { ascending: false })

  return (
    <ClientsPageClient
      profile={profile}
      players={players || []}
      groups={groups || []}
      drillWeeks={drillWeeks || []}
    />
  )
}
