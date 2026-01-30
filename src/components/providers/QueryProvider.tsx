'use client'

import { isServer, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ReactNode } from 'react'

/**
 * Create a QueryClient preconfigured with sensible defaults tuned for financial data.
 *
 * Default behavior:
 * - Queries: staleTime = 5 minutes; gcTime = 10 minutes; retry = 3; refetchOnWindowFocus = true; refetchOnReconnect = true
 * - Mutations: retry = 1
 *
 * @returns A newly constructed QueryClient configured with the above defaults
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
 * Return a QueryClient appropriate for the current execution environment.
 *
 * On the server this always constructs and returns a new QueryClient to avoid
 * cross-request state sharing. In the browser it returns a single shared
 * QueryClient instance, creating it on first access and reusing it thereafter.
 *
 * @returns A `QueryClient` instance: a fresh instance on the server, a shared singleton in the browser.
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
 * Provides a shared TanStack Query client to the React tree and renders React Query DevTools.
 *
 * Wraps `children` in a `QueryClientProvider` using the client returned by `getQueryClient`.
 *
 * @param children - React nodes to be rendered within the query provider
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