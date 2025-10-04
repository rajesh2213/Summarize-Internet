import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchSummary, postUrl } from '../services/summaryService'
import { useAuth } from '../contexts/AuthContext'
import logger from '../utils/logger'

export const useSummary = (docId, status = null) => {
  const auth = useAuth()
  
  return useQuery({
    queryKey: ['summary', docId],
    queryFn: async () => {
      if (!docId) return null
      const response = await fetchSummary(docId, auth)
      if (!response.ok) {
        throw new Error('Failed to fetch summary')
      }
      return response.json()
    },
    enabled: !!docId && status === 'COMPLETED',
    staleTime: 5 * 60 * 1000, 
    gcTime: 30 * 60 * 1000,
    retry: (failureCount, error) => {
      if (error?.status === 404 || error?.status === 403) {
        return false
      }
      return failureCount < 3
    },
  })
}

export const useSubmitUrl = () => {
  const auth = useAuth()
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (url) => {
      logger.info('[useSubmitUrl] Submitting URL for summarization:', url)
      const response = await postUrl(url, auth)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to submit URL')
      }
      return response.json()
    },
    onSuccess: (data) => {
      logger.info('[useSubmitUrl] URL submitted successfully:', data)
      queryClient.invalidateQueries({ queryKey: ['summary'] })
    },
    onError: (error) => {
      logger.error('[useSubmitUrl] Error submitting URL:', error)
    },
  })
}

export const useDocumentStatus = (docId) => {
  return useQuery({
    queryKey: ['documentStatus', docId],
    queryFn: async () => {
      if (!docId) return null
      return { status: 'PROCESSING', docId }
    },
    enabled: !!docId,
    refetchInterval: (data) => {
      if (data?.status === 'COMPLETED' || data?.status === 'ERROR') {
        return false
      }
      return 5000
    },
    staleTime: 0, 
  })
}

export const usePrefetchSummary = () => {
  const queryClient = useQueryClient()
  
  return (docId) => {
    queryClient.prefetchQuery({
      queryKey: ['summary', docId],
      queryFn: async () => {
        const response = await fetchSummary(docId, null)
        if (!response.ok) {
          throw new Error('Failed to fetch summary')
        }
        return response.json()
      },
      staleTime: 5 * 60 * 1000,
    })
  }
}

export const useInvalidateSummary = () => {
  const queryClient = useQueryClient()
  
  return (docId) => {
    queryClient.invalidateQueries({ 
      queryKey: ['summary', docId] 
    })
  }
}
