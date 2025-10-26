import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import styles from './googleAuthSuccess.module.css'

const GoogleAuthSuccess = () => {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        const handleGoogleAuthSuccess = async () => {
            try {
                const token = searchParams.get('token')
                const userParam = searchParams.get('user')

                if (!token || !userParam) {
                    setError('Authentication failed. Missing token or user data.')
                    setLoading(false)
                    return
                }

                const user = JSON.parse(decodeURIComponent(userParam))
                
                queryClient.setQueryData(['auth', 'status'], {
                    isAuthenticated: true,
                    user: user,
                    token: token
                })
                
                localStorage.setItem('accessToken', token)
                localStorage.setItem('username', user.username)
                
                window.dispatchEvent(new CustomEvent('auth:login', {
                    detail: {
                        accessToken: token,
                        user: user
                    }
                }))

                navigate('/', { replace: true })
            } catch (err) {
                console.error('Google auth success error:', err)
                setError('Failed to process authentication. Please try again.')
                setLoading(false)
            }
        }

        handleGoogleAuthSuccess()
    }, [searchParams, navigate, queryClient])

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.loadingContainer}>
                    <div className={styles.spinner}></div>
                    <h2>Completing sign in...</h2>
                    <p>Please wait while we set up your account.</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className={styles.container}>
                <div className={styles.errorContainer}>
                    <div className={styles.errorIcon}>⚠️</div>
                    <h2>Authentication Failed</h2>
                    <p>{error}</p>
                    <button 
                        onClick={() => navigate('/login')}
                        className={styles.retryButton}
                    >
                        Try Again
                    </button>
                </div>
            </div>
        )
    }

    return null
}

export default GoogleAuthSuccess
