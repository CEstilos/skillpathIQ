import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import PlayerProfileClient from '@/components/PlayerProfileClient'

export default async function PlayerProfilePage({ params, searchParams }: { params: { id: string }; searchParams?: Promise<{ toast?: string }> }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const resolvedSearch = searchParams ? await searchParams : {}
  const initialToast = resolvedSearch.toast ? decodeURIComponent(resolvedSearch.toast) : null

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

  // Fetch player's group memberships
  const { data: memberRows } = await supabase
    .from('group_members').select('group_id').eq('player_id', params.id)
  const groupIds = (memberRows || []).map(m => m.group_id)

  // Build drill_weeks query with all group IDs
  let drillFilter = `player_id.eq.${params.id}`
  for (const gid of groupIds) drillFilter += `,group_id.eq.${gid}`
  const { data: drillWeeks } = await supabase
    .from('drill_weeks')
    .select('*')
    .or(drillFilter)
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

  // Fetch all groups this player belongs to
  const { data: groups } = groupIds.length > 0
    ? await supabase.from('groups').select('*').in('id', groupIds)
    : { data: [] }

  const { data: profile } = await supabase
    .from('profiles').select('full_name, email').eq('id', user.id).single()

  const { data: activePackageData } = await supabase
    .from('player_packages')
    .select('*, trainer_packages(name, session_count)')
    .eq('player_id', params.id)
    .eq('trainer_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <PlayerProfileClient
      player={player}
      sessions={sessions || []}
      drillWeeks={drillWeeks || []}
      drills={drills || []}
      completions={completions || []}
      groups={groups || []}
      trainerName={profile?.full_name || undefined}
      trainerEmail={(profile as { full_name?: string; email?: string } | null)?.email || undefined}
      initialToast={initialToast}
      activePackage={activePackageData || null}
    />
  )
}
