import { useState, useEffect, useContext, createContext } from "react";
import {refreshToken, logoutUser} from '../services/authService'
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

    const [token, setToken] = useState(null)
    const [loading, setLoading] = useState(true)
    const [user, setUser] = useState(null)
    const [isAuth, setIsAuth] = useState(false)

    useEffect(() => {
        const tryRefresh = async () => {
            const res = await refreshToken();
            try{
                if(res.ok){
                    const data = await res.json()
                    if(data.accessToken){
                        logger.info('Auth refresh token success')
                        login(data.accessToken, data.user)
                        return
                    }else {
                    setToken(null)
                    setUser(null)
                    setIsAuth(false)
                }
                }
                logger.info('Auth refresh token')
            }catch(err){
                logger.warn('Auth refresh token error: ', err)
                setToken(null)
                setUser(null)
                setIsAuth(false)
            }finally{
                setLoading(false)
            }
        }
        tryRefresh()
    }, [])

    const login = (token, userData) => {
        setToken(token)
        setUser(userData)
        setIsAuth(true)
    }

    const logout = async () => {
        try {
            const res = await logoutUser()
            if (res.ok) {
                setToken(null)
                setIsAuth(false)
            }
        } catch (err) {
            logger.warn('Logout failed: ', err)
            setToken(null)
        }
    }

    return (
        <AuthContext.Provider value={{token, loading, user, isAuth, logout, login}}>
            {children}
        </AuthContext.Provider>
    )
}
