'use client'

import { isServer, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ReactNode } from 'react'

/**
 * Creates a new QueryClient instance with optimized defaults for financial data.
 * 
 * Configuration rationale:
 * - staleTime: 5 minutes - Exchange rates don't change rapidly; prevents excessive API calls
 * - gcTime: 10 minutes - Keep data in cache longer for quick navigation back
 * - retry: 3 - Retry failed requests for transient errors
 * - refetchOnWindowFocus: true - Refresh data when user returns to the app
 * - refetchOnReconnect: true - Refresh when network connection is restored
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Financial data: 5 minutes stale time to prevent excessive API calls
        staleTime: 5 * 60 * 1000,
        // Keep data in cache for 10 minutes after becoming inactive
        gcTime: 10 * 60 * 1000,
        // Retry failed requests 3 times with exponential backoff
        retry: 3,
        // Refetch on window focus for live data
        refetchOnWindowFocus: true,
        // Refetch on reconnect
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 1,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined = undefined

/**
 * Gets or creates a QueryClient instance.
 * On server: always creates a new instance for each request
 * On browser: reuses the same instance to maintain state across renders
 */
function getQueryClient() {
  if (isServer) {
    // Server: always make a new query client
    return makeQueryClient()
  } else {
    // Browser: make a new query client if we don't already have one
    // This is very important, so we don't re-make a new client if React
    // suspends during the initial render
    if (!browserQueryClient) browserQueryClient = makeQueryClient()
    return browserQueryClient
  }
}

interface QueryProviderProps {
  children: ReactNode
}

/**
 * QueryProvider wraps the application with TanStack Query's QueryClientProvider.
 * 
 * This enables:
 * - Automatic caching and deduplication of requests
 * - Background refetching for fresh data
 * - Error handling with retry logic
 * - DevTools for debugging (only in development)
 */
export function QueryProvider({ children }: QueryProviderProps) {
  // NOTE: Avoid useState when initializing the query client if you don't
  //       have a suspense boundary between this and the code that may
  //       suspend because React will throw away the client on the initial
  //       render if it suspends and there is no boundary
  const queryClient = getQueryClient()

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
