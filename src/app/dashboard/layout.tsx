import { Suspense } from 'react'
import DateProvider from './DateProvider'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <DateProvider />
      </Suspense>
      {children}
    </>
  )
}
