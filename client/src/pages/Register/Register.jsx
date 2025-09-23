import styles from './Register.module.css'
import { useState, useEffect, useRef } from 'react'
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
                        
                        <div className={styles.authFooter}>
                            <p>Already have an account? <a href="/login" className={styles.authLink}>Sign in</a></p>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

export default Register;