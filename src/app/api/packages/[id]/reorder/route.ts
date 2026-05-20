import { NextResponse, NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const supabaseAuth = await createServerSupabaseClient()
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    const body = await request.json()
    const { direction } = body as { direction: 'up' | 'down' }

    // Fetch all packages for this trainer ordered by sort_order
    const { data: packages } = await supabaseAdmin
      .from('trainer_packages')
      .select('id, sort_order')
      .eq('trainer_id', user.id)
      .order('sort_order', { ascending: true })

    if (!packages) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const idx = packages.findIndex(p => p.id === id)
    if (idx === -1) return NextResponse.json({ error: 'Package not found' }, { status: 404 })

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= packages.length) {
      return NextResponse.json({ success: true }) // Already at boundary
    }

    const current = packages[idx]
    const swap = packages[swapIdx]

    // Swap sort_orders
    await Promise.all([
      supabaseAdmin.from('trainer_packages').update({ sort_order: swap.sort_order }).eq('id', current.id),
      supabaseAdmin.from('trainer_packages').update({ sort_order: current.sort_order }).eq('id', swap.id),
    ])

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
