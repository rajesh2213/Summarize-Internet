import styles from './Register.module.css'
import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { debounce } from '../../utils/commonHandler'
import { registerUser } from '../../services/authService'
import ResendEmail from '../../components/ResendEmail/ResendEmail'
import {
    validateEmail,
    validatePassword,
    validateUsername,
    validateName,
    validatePasswordMatch
} from '../../utils/validator';
import logger from '../../utils/logger'

const API_URL = import.meta.env.VITE_API_URL

const Register = () => {
    const [formData, setFormData] = useState({
        email: '',
        firstName: '',
        lastName: '',
        username: '',
        password: '',
        confirmPassword: ''
    })

    const [registered, setRegistered] = useState(false)
    const [errors, setErrors] = useState({})

    const debouncedValidateField = debounce((id, value, currentFormData) => {
        let error = null;
        switch (id) {
            case 'email':
                error = validateEmail(value);
                break;
            case 'firstName':
                error = validateName(value, "First");
                break;
            case 'username':
                error = validateUsername(value);
                break;
            case 'password':
                error = validatePassword(value)
                break;
        }

        const newErrors = { ...errors, [id]: error }
        setErrors(newErrors)
    }, 500);

    const validateForm = () => {
        const newErrors = {
            email: validateEmail(formData.email),
            firstName: validateName(formData.firstName, "First"),
            username: validateUsername(formData.username),
            password: validatePassword(formData.password),
            confirmPassword: validatePasswordMatch(formData.password, formData.confirmPassword)
        }
        setErrors(newErrors)

        return !Object.values(newErrors).some(err => err !== null)
    }

    const handleChange = (e) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
        debouncedValidateField(id, value, { ...formData, [id]: value });
    };

    const handleRegisterSubmit = async (e) => {
        e.preventDefault()
        if (validateForm()) {
            try {
                const res = await registerUser(formData)
                const data = await res.json()
                if (!res.ok) {
                    setErrors({ ...errors, server: data.errors.join('\n') })
                } else {
                    setRegistered(true)
                }
            } catch (err) {
                setErrors({ ...errors, server: err.message || "Something went wrong..." })
                logger.warn(err.message)
            }
        }
    }

    const handleGoogleSignIn = () => {
        window.location.href = `${API_URL}/auth/google`
    }

    return (
        <div className={styles.registerPage}>
            <div className={styles.registerContainer}>
                {registered ? (
                    <ResendEmail email={formData.email}/>
                ) : (
                    <>
                        <div className={styles.authHeader}>
                            <h1>Create Account</h1>
                            <p>Join Summarize-Internet and start your journey</p>
                        </div>
                        
                        {errors.server && <div className={styles.serverError}>{errors.server}</div>}
                        
                        <form onSubmit={handleRegisterSubmit} className={styles.authForm}>
                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label htmlFor="firstName" className={styles.formLabel}>First Name</label>
                                    <input
                                        type="text"
                                        id='firstName'
                                        value={formData.firstName}
                                        onChange={handleChange}
                                        className={styles.formInput}
                                        placeholder="Enter your first name"
                                    />
                                    {errors.firstName && <span className={styles.fieldError}>{errors.firstName}</span>}
                                </div>
                                
                                <div className={styles.formGroup}>
                                    <label htmlFor="lastName" className={styles.formLabel}>Last Name</label>
                                    <input
                                        type="text"
                                        id='lastName'
                                        value={formData.lastName}
                                        onChange={handleChange}
                                        className={styles.formInput}
                                        placeholder="Enter your last name"
                                    />
                                    {errors.lastName && <span className={styles.fieldError}>{errors.lastName}</span>}
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label htmlFor="email" className={styles.formLabel}>Email Address</label>
                                <input
                                    type="email"
                                    id='email'
                                    value={formData.email}
                                    onChange={handleChange}
                                    className={styles.formInput}
                                    placeholder="Enter your email"
                                />
                                {errors.email && <span className={styles.fieldError}>{errors.email}</span>}
                            </div>

                            <div className={styles.formGroup}>
                                <label htmlFor="username" className={styles.formLabel}>Username</label>
                                <input
                                    type="text"
                                    id='username'
                                    value={formData.username}
                                    onChange={handleChange}
                                    className={styles.formInput}
                                    placeholder="Choose a username"
                                />
                                {errors.username && <span className={styles.fieldError}>{errors.username}</span>}
                            </div>

                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label htmlFor="password" className={styles.formLabel}>Password</label>
                                    <input
                                        type="password"
                                        id="password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        className={styles.formInput}
                                        placeholder="Create a password"
                                        autoComplete="new-password"
                                    />
                                    {errors.password && <span className={styles.fieldError}>{errors.password}</span>}
                                </div>
                                
                                <div className={styles.formGroup}>
                                    <label htmlFor="confirmPassword" className={styles.formLabel}>Confirm Password</label>
                                    <input
                                        type="password"
                                        id="confirmPassword"
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                        className={styles.formInput}
                                        placeholder="Confirm your password"
                                    />
                                    {errors.confirmPassword && <span className={styles.fieldError}>{errors.confirmPassword}</span>}
                                </div>
                            </div>

                            <button type="submit" className={styles.submitButton}>
                                Create Account
                            </button>
                        </form>
                        
                        <div className={styles.divider}>
                            <span>or</span>
                        </div>
                        
                        <button 
                            type='button' 
                            onClick={handleGoogleSignIn}
                            className={styles.googleButton}
                        >
                            <svg className={styles.googleIcon} viewBox="0 0 24 24" width="20" height="20">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                            Continue with Google
                        </button>
                        
                        <div className={styles.authFooter}>
                            <p>Already have an account? <Link to="/login" className={styles.authLink}>Sign in</Link></p>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

export default Register;