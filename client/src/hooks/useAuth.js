import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { refreshToken, logoutUser, loginUser } from '../services/authService'
import logger from '../utils/logger'

export const useAuthStatus = () => {
  return useQuery({
    queryKey: ['auth', 'status'],
    queryFn: async () => {
      try {
        const response = await refreshToken()
        if (response.ok) {
          const data = await response.json()
          return {
            isAuthenticated: true,
            user: data.user,
            token: data.accessToken
          }
        }
        return {
          isAuthenticated: false,
          user: null,
          token: null
        }
      } catch (error) {
        logger.warn('[useAuthStatus] Error checking auth status:', error)
        return {
          isAuthenticated: false,
          user: null,
          token: null
        }
      }
    },
    staleTime: 5 * 60 * 1000, 
    gcTime: 15 * 60 * 1000, 
    retry: false, 
    refetchOnWindowFocus: true, 
  })
}

export const useLogin = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (credentials) => {
      const response = await loginUser(credentials)
      if (!response.ok) {
        const errorData = await response.json()
        if (errorData.redirectUrl && errorData.status === 403) {
          window.location.href = errorData.redirectUrl
          return
        }
        throw new Error(errorData.errors?.join('\n') || 'Login failed')
      }
      return response.json()
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['auth', 'status'], {
        isAuthenticated: true,
        user: data.user,
        token: data.accessToken
      })
      
      localStorage.setItem('accessToken', data.accessToken)
      localStorage.setItem('username', data.user.username)
      
      window.dispatchEvent(new CustomEvent('auth:login', {
        detail: {
          accessToken: data.accessToken,
          user: data.user
        }
      }))
      
      logger.info('[useLogin] Login successful')
    },
    onError: (error) => {
      logger.error('[useLogin] Login failed:', error)
    },
  })
}

export const useLogout = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async () => {
      try {
        await logoutUser()
      } catch (error) {
        logger.warn('[useLogout] Error during logout:', error)
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(['auth', 'status'], {
        isAuthenticated: false,
        user: null,
        token: null
      })
      
      queryClient.removeQueries({ queryKey: ['summary'] })
      queryClient.removeQueries({ queryKey: ['documentStatus'] })
      
      localStorage.removeItem('accessToken')
      localStorage.removeItem('username')
      
      window.dispatchEvent(new CustomEvent('auth:logout'))
      
      logger.info('[useLogout] Logout successful')
    },
    onError: (error) => {
      logger.error('[useLogout] Logout failed:', error)
    },
  })
}

export const useRefreshToken = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async () => {
      const response = await refreshToken()
      if (!response.ok) {
        throw new Error('Token refresh failed')
      }
      return response.json()
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['auth', 'status'], {
        isAuthenticated: true,
        user: data.user,
        token: data.accessToken
      })
      
      localStorage.setItem('accessToken', data.accessToken)
      localStorage.setItem('username', data.user.username)
      
      logger.info('[useRefreshToken] Token refreshed successfully')
    },
    onError: (error) => {
      logger.error('[useRefreshToken] Token refresh failed:', error)
      queryClient.setQueryData(['auth', 'status'], {
        isAuthenticated: false,
        user: null,
        token: null
      })
      
      localStorage.removeItem('accessToken')
      localStorage.removeItem('username')
      
      window.dispatchEvent(new CustomEvent('auth:logout'))
    },
  })
}
