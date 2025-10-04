import { useContext, createContext } from "react";
import { useAuthStatus, useLogin, useLogout, useRefreshToken } from '../hooks/useAuth'
import logger from '../utils/logger'

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({children}) => {
    const { data: authData, isLoading: authLoading, error: authError } = useAuthStatus()
    const loginMutation = useLogin()
    const logoutMutation = useLogout()
    const refreshTokenMutation = useRefreshToken()

    const login = async (credentials) => {
        try {
            await loginMutation.mutateAsync(credentials)
        } catch (err) {
            logger.error('[AuthContext] Login failed:', err)
            throw err
        }
    }

    const logout = async () => {
        try {
            await logoutMutation.mutateAsync()
        } catch (err) {
            logger.error('[AuthContext] Logout failed:', err)
            throw err
        }
    }

    const isAuthenticated = authData?.isAuthenticated || false
    const user = authData?.user || null
    const token = authData?.token || null
    const loading = authLoading || loginMutation.isPending || logoutMutation.isPending

    return (
        <AuthContext.Provider value={{
            token, 
            loading, 
            user, 
            isAuth: isAuthenticated, 
            logout, 
            login,
            error: authError || loginMutation.error || logoutMutation.error
        }}>
            {children}
        </AuthContext.Provider>
    )
}
