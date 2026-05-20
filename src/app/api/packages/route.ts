import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const supabaseAuth = await createServerSupabaseClient()
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    const body = await request.json()
    const { name, session_count, price, description } = body

    if (!name || !session_count || !price) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const price_per_session = parseFloat(price) / parseInt(session_count)

    // Get max sort_order for this trainer
    const { data: existing } = await supabaseAdmin
      .from('trainer_packages')
      .select('sort_order')
      .eq('trainer_id', user.id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single()

    const sort_order = (existing?.sort_order ?? 0) + 1

    const { data, error } = await supabaseAdmin
      .from('trainer_packages')
      .insert({
        trainer_id: user.id,
        name: name.trim(),
        session_count: parseInt(session_count),
        price: parseFloat(price),
        price_per_session,
        description: description?.trim() || null,
        sort_order,
        is_active: true,
        is_most_popular: false,
        is_best_value: false,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ package: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
