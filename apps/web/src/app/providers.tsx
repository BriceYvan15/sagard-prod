'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: { retry: 1, staleTime: 30_000 },
      },
    }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { borderRadius: '10px', background: '#1E1E1E', color: '#fff' },
          success: { style: { borderLeft: '4px solid #C8D400' } },
          error:   { style: { borderLeft: '4px solid #ef4444' } },
        }}
      />
    </QueryClientProvider>
  )
}
