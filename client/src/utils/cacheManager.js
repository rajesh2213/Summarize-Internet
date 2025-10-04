// Cache management utilities
class CacheManager {
  constructor() {
    this.queryClient = null
  }

  // Set the query client instance
  setQueryClient(queryClient) {
    this.queryClient = queryClient
  }

  // Ensure query client is available
  ensureQueryClient() {
    if (!this.queryClient) {
      throw new Error('QueryClient not initialized. Call setQueryClient first.')
    }
  }

  // Prefetch summary data
  async prefetchSummary(docId) {
    console.log('PreFetching...')
    this.ensureQueryClient()
    await this.queryClient.prefetchQuery({
      queryKey: ['summary', docId],
      queryFn: async () => {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/v1/summary/${docId}`)
        if (!response.ok) {
          throw new Error('Failed to fetch summary')
        }
        return response.json()
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
    })
  }

  // Invalidate summary cache
  invalidateSummary(docId) {
    this.ensureQueryClient()
    this.queryClient.invalidateQueries({ 
      queryKey: ['summary', docId] 
    })
  }

  // Invalidate all summary caches
  invalidateAllSummaries() {
    this.ensureQueryClient()
    this.queryClient.invalidateQueries({ 
      queryKey: ['summary'] 
    })
  }

  // Clear all caches
  clearAllCaches() {
    this.ensureQueryClient()
    this.queryClient.clear()
  }

  // Get cache statistics
  getCacheStats() {
    this.ensureQueryClient()
    const cache = this.queryClient.getQueryCache()
    const queries = cache.getAll()
    
    return {
      totalQueries: queries.length,
      queries: queries.map(query => ({
        queryKey: query.queryKey,
        state: query.state.status,
        dataUpdatedAt: query.state.dataUpdatedAt,
        data: query.state.data
      }))
    }
  }

  // Set cache data manually
  setCacheData(queryKey, data) {
    this.ensureQueryClient()
    this.queryClient.setQueryData(queryKey, data)
  }

  // Get cache data
  getCacheData(queryKey) {
    this.ensureQueryClient()
    return this.queryClient.getQueryData(queryKey)
  }

  // Remove specific cache entry
  removeCacheEntry(queryKey) {
    this.ensureQueryClient()
    this.queryClient.removeQueries({ queryKey })
  }

  // Prefetch multiple summaries
  async prefetchMultipleSummaries(docIds) {
    this.ensureQueryClient()
    const prefetchPromises = docIds.map(docId => 
      this.prefetchSummary(docId)
    )
    
    try {
      await Promise.all(prefetchPromises)
      console.log(`[CacheManager] Prefetched ${docIds.length} summaries`)
    } catch (error) {
      console.error('[CacheManager] Error prefetching summaries:', error)
    }
  }

  // Background refetch for active queries
  refetchActiveQueries() {
    this.ensureQueryClient()
    this.queryClient.refetchQueries({
      type: 'active'
    })
  }

  // Set global cache configuration
  setGlobalConfig(config) {
    this.ensureQueryClient()
    this.queryClient.setDefaultOptions({
      queries: {
        ...config.queries
      },
      mutations: {
        ...config.mutations
      }
    })
  }
}

// Export singleton instance
export const cacheManager = new CacheManager()
export default cacheManager
