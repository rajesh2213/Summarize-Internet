class CacheManager {
  constructor() {
    this.queryClient = null
  }

  setQueryClient(queryClient) {
    this.queryClient = queryClient
  }

  ensureQueryClient() {
    if (!this.queryClient) {
      throw new Error('QueryClient not initialized. Call setQueryClient first.')
    }
  }

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
      staleTime: 5 * 60 * 1000,
    })
  }

  invalidateSummary(docId) {
    this.ensureQueryClient()
    this.queryClient.invalidateQueries({ 
      queryKey: ['summary', docId] 
    })
  }

  invalidateAllSummaries() {
    this.ensureQueryClient()
    this.queryClient.invalidateQueries({ 
      queryKey: ['summary'] 
    })
  }

  clearAllCaches() {
    this.ensureQueryClient()
    this.queryClient.clear()
  }

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

  setCacheData(queryKey, data) {
    this.ensureQueryClient()
    this.queryClient.setQueryData(queryKey, data)
  }

  getCacheData(queryKey) {
    this.ensureQueryClient()
    return this.queryClient.getQueryData(queryKey)
  }

  removeCacheEntry(queryKey) {
    this.ensureQueryClient()
    this.queryClient.removeQueries({ queryKey })
  }

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

  refetchActiveQueries() {
    this.ensureQueryClient()
    this.queryClient.refetchQueries({
      type: 'active'
    })
  }

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

export const cacheManager = new CacheManager()
export default cacheManager
