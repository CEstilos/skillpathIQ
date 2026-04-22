'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function DateProvider() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const localDate = new Date().toLocaleDateString('en-CA')
    // Set cookie so server can read it
    document.cookie = `localDate=${localDate};path=/;max-age=86400`
    const currentDate = searchParams.get('date')
    if (currentDate !== localDate) {
      const params = new URLSearchParams(searchParams.toString())
      params.set('date', localDate)
      router.replace(`/dashboard?${params.toString()}`)
    }
  }, [])

  return null
}
