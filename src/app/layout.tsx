import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'SkillPathIQ',
  description: 'The training platform for independent sports trainers',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" style={{ background: '#0E0E0F' }}>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Exo+2:wght@600;700&display=swap" rel="stylesheet" />
      </head>
      <body style={{ margin: 0, padding: 0, background: '#0E0E0F', overflowX: 'hidden' }}>
        {children}
      </body>
    </html>
  )
}
