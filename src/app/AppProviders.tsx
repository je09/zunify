import { ReactNode } from 'react'
import { LibraryProvider } from '../LibraryContext'

interface AppProvidersProps {
  token: string | null
  children: ReactNode
}

export function AppProviders({ token, children }: AppProvidersProps) {
  return <LibraryProvider token={token}>{children}</LibraryProvider>
}
