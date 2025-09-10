import {useState} from 'react'
import { debounce } from '../../utils/commonHandler'
import { Navigate } from 'react-router-dom'
import * as validator from '../../utils/validator'
import {loginUser} from '../../services/authService'
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
            console.log('click')
            const res = await loginUser(formData)
            const data = await res.json()
            if(!res.ok){
                console.error(data.errors)
                setErrors({ ...errors, server: data.errors.join('\n') })
            } else {
                auth.login(data.accessToken, data.user)
                setRedirect(true)
            }
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
                <h1>Login</h1>
                {errors.server && <span className={styles.error}>{errors.server}</span>}
                <form onSubmit={handleLoginSubmit}>
                    <div>
                        <label htmlFor="email">Email</label>
                        <input
                            type='text'
                            id='email'
                            value={formData.email}
                            onChange={handleChange}
                        />
                        {errors.email && <span className={styles.error}>{errors.email}</span>}
                    </div>
                    <div>
                        <label htmlFor="password">Password</label>
                        <input
                            type='password'
                            id='password'
                            value={formData.password}
                            onChange={handleChange}
                        />
                        {errors.password && <span>{errors.password}</span>}
                        <button type='submit'>Continue</button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default Login;