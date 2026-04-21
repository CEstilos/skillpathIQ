'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function DateProvider() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const localDate = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local timezone
    const currentDate = searchParams.get('date')
    if (currentDate !== localDate) {
      const params = new URLSearchParams(searchParams.toString())
      params.set('date', localDate)
      router.replace(`/dashboard?${params.toString()}`)
    }
  }, [])

  return null
}
