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
                        <h1>Sign Up</h1>
                        {errors.server && <span className={styles.error}>{errors.server}</span>}
                        <form onSubmit={handleRegisterSubmit} >
                            <label htmlFor="email">Email</label>
                            <input
                                type="text"
                                id='email'
                                value={formData.email}
                                onChange={handleChange}
                            />
                            {errors.email && <span className={styles.error}>{errors.email}</span>}

                            <label htmlFor="firstName">First Name</label>
                            <input
                                type="text"
                                id='firstName'
                                value={formData.firstName}
                                onChange={handleChange}
                            />
                            {errors.firstName && <span className={styles.error}>{errors.firstName}</span>}

                            <label htmlFor="lastName">Last Name</label>
                            <input
                                type="text"
                                id='lastName'
                                value={formData.lastName}
                                onChange={handleChange}
                            />
                            {errors.lastName && <span className={styles.error}>{errors.lastName}</span>}

                            <label htmlFor="username">Username</label>
                            <input
                                type="text"
                                id='username'
                                value={formData.username}
                                onChange={handleChange}
                            />
                            {errors.username && <span className={styles.error}>{errors.username}</span>}

                            <label htmlFor="password">Password</label>
                            <input
                                type="password"
                                id="password"
                                value={formData.password}
                                onChange={handleChange}
                                autoComplete="new-password"
                            />
                            {errors.password && <span className={styles.error}>{errors.password}</span>}

                            <label htmlFor="confirmPassword">Confirm Password</label>
                            <input
                                type="password"
                                id="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                            />
                            {errors.confirmPassword && <span className={styles.error}>{errors.confirmPassword}</span>}

                            <button type="submit">Register</button>
                        </form>
                    </>
                )}
            </div>
        </div>
    )
}

export default Register;