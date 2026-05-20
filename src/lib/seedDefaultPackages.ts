import { createClient } from '@supabase/supabase-js'

export async function seedDefaultPackages(trainerId: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  const { count } = await supabase
    .from('trainer_packages')
    .select('id', { count: 'exact', head: true })
    .eq('trainer_id', trainerId)
  if ((count ?? 0) > 0) return
  await supabase.from('trainer_packages').insert([
    {
      trainer_id: trainerId,
      name: 'Drop-In',
      session_count: 1,
      price: 40.00,
      price_per_session: 40.00,
      description: 'Try a single session with no commitment.',
      sort_order: 1,
      is_most_popular: false,
      is_best_value: false,
    },
    {
      trainer_id: trainerId,
      name: 'Standard — 4 Sessions',
      session_count: 4,
      price: 140.00,
      price_per_session: 35.00,
      description: "Priority booking for days that work best for you + commitment to your player's development.",
      sort_order: 2,
      is_most_popular: true,
      is_best_value: false,
    },
    {
      trainer_id: trainerId,
      name: 'Elite — 8 Sessions',
      session_count: 8,
      price: 260.00,
      price_per_session: 32.50,
      description: "Priority booking for days that work best for you + commitment to your player's development.",
      sort_order: 3,
      is_most_popular: false,
      is_best_value: true,
    },
  ])
}
