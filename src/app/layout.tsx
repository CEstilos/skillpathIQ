import type { Metadata } from 'next'
import PostHogProvider from '@/components/PostHogProvider'
import PostHogPageView from '@/components/PostHogPageView'

export const metadata: Metadata = {
  title: 'SkillPathIQ',
  description: 'Player accountability for sports trainers',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <PostHogProvider>
          <PostHogPageView />
          {children}
        </PostHogProvider>
      </body>
    </html>
  )
}
