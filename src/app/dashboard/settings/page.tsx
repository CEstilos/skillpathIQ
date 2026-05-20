import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import SettingsClient from '@/components/SettingsClient'
import { seedDefaultPackages } from '@/lib/seedDefaultPackages'

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: packages } = await supabase
    .from('trainer_packages')
    .select('*')
    .eq('trainer_id', user.id)
    .order('sort_order', { ascending: true })

  // Seed default packages if none exist
  if (!packages || packages.length === 0) {
    await seedDefaultPackages(user.id)
    const { data: seededPackages } = await supabase
      .from('trainer_packages')
      .select('*')
      .eq('trainer_id', user.id)
      .order('sort_order', { ascending: true })
    return <SettingsClient profile={profile} packages={seededPackages || []} />
  }

  return <SettingsClient profile={profile} packages={packages || []} />
}
