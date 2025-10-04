import {useState} from 'react'
import { debounce } from '../../utils/commonHandler'
import { Navigate } from 'react-router-dom'
import * as validator from '../../utils/validator'
import { useAuth } from '../../contexts/AuthContext'
import styles from './login.module.css'

const Login = () => {
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    })
    const [errors, setErrors] = useState({})
    const [redirect, setRedirect] = useState(false)
    const auth = useAuth()

    const debouncedValidateField = debounce((id, value, currentFormData) => {
        let error = null;
        switch(id){
            case 'email':
                error = validator.validateEmail(value);
                break;
            case 'password':
                error = validator.validateLoginPassword(value)
                break;
        }
        const newErr = {...errors, [id]: error} 
        setErrors(newErr)
    }, 500)

    const handleChange = (e) => {
        const {id, value} = e.target
        setFormData(prev => ({...prev, [id]: value}))
        debouncedValidateField(id, value, { ...formData, [id]: value });
    }

    const handleLoginSubmit = async (e) => {
        e.preventDefault()
        try{
            await auth.login(formData)
            setRedirect(true)
        } catch (error) {
            setErrors({ ...errors, server: error.message || "Something went wrong..." })
        }
    }

    if(redirect){
        return <Navigate to="/"/>
    }
    return (
        <div className={styles.loginPage}>
            <div className={styles.loginContainer}>
                <div className={styles.authHeader}>
                    <h1>Welcome Back</h1>
                    <p>Sign in to your account to continue</p>
                </div>
                
                {errors.server && <div className={styles.serverError}>{errors.server}</div>}
                
                <form onSubmit={handleLoginSubmit} className={styles.authForm}>
                    <div className={styles.formGroup}>
                        <label htmlFor="email" className={styles.formLabel}>Email Address</label>
                        <input
                            type='email'
                            id='email'
                            value={formData.email}
                            onChange={handleChange}
                            className={styles.formInput}
                            placeholder="Enter your email"
                        />
                        {errors.email && <span className={styles.fieldError}>{errors.email}</span>}
                    </div>
                    
                    <div className={styles.formGroup}>
                        <label htmlFor="password" className={styles.formLabel}>Password</label>
                        <input
                            type='password'
                            id='password'
                            value={formData.password}
                            onChange={handleChange}
                            className={styles.formInput}
                            placeholder="Enter your password"
                        />
                        {errors.password && <span className={styles.fieldError}>{errors.password}</span>}
                    </div>
                    
                    <button type='submit' className={styles.submitButton}>
                        Sign In
                    </button>
                </form>
                
                <div className={styles.authFooter}>
                    <p>Don't have an account? <a href="/register" className={styles.authLink}>Sign up</a></p>
                </div>
            </div>
        </div>
    )
}

export default Login;