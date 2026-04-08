import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'SkillPathIQ',
  description: 'The training platform for independent sports trainers',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
