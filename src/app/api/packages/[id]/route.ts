import { NextResponse, NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

export async function PATCH(
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

    // Verify ownership
    const { data: existing } = await supabaseAdmin
      .from('trainer_packages')
      .select('trainer_id')
      .eq('id', id)
      .single()

    if (!existing || existing.trainer_id !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await request.json()
    const updates: Record<string, unknown> = {}

    if (body.name !== undefined) updates.name = body.name.trim()
    if (body.session_count !== undefined) updates.session_count = parseInt(body.session_count)
    if (body.price !== undefined) updates.price = parseFloat(body.price)
    if (body.description !== undefined) updates.description = body.description?.trim() || null
    if (body.is_active !== undefined) updates.is_active = body.is_active

    // Recompute price_per_session when price or session_count changes
    if (body.price !== undefined || body.session_count !== undefined) {
      const price = body.price !== undefined ? parseFloat(body.price) : 0
      const count = body.session_count !== undefined ? parseInt(body.session_count) : 1
      if (price > 0 && count > 0) {
        updates.price_per_session = price / count
      }
    }

    const { data, error } = await supabaseAdmin
      .from('trainer_packages')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ package: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
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

    // Verify ownership
    const { data: existing } = await supabaseAdmin
      .from('trainer_packages')
      .select('trainer_id')
      .eq('id', id)
      .single()

    if (!existing || existing.trainer_id !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { error } = await supabaseAdmin
      .from('trainer_packages')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
