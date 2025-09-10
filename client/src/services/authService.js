import { useAuth } from '../contexts/AuthContext';
import authFetch from '../utils/authFetch';

const API = import.meta.env.VITE_API_URL

export const registerUser = async (userData) => {
    return await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
    })
}

export const resendVerificationEmail = async (email) => {
    return await fetch(`${API}/auth/resend-verification`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
    });
}

export const loginUser = async (userData) => {
    return await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData),
        credentials: 'include',
    })
}

export const logoutUser = async () => {
    return await fetch(`${API}/auth/logout`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include'
    })
}

export const refreshToken = async () => {
    return await fetch(`${API}/auth/refresh-token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
    })
}