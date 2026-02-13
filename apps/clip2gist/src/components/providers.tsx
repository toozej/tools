'use client'

import { SessionProvider } from 'next-auth/react'

export function Providers({ children }: { children: React.ReactNode }) {
  // basePath required because app is served behind nginx with Next.js basePath: '/clip2gist'
  return <SessionProvider basePath="/clip2gist/api/auth">{children}</SessionProvider>
}