import { refreshToken } from '../services/authService';
import logger from './logger'

const authFetch = async (url, options, auth) => {
    const token = auth.token;
    const config = {
        ...options,
        headers: {
            ...options.headers,
            Authorization: token ? `Bearer ${token}` : ''
        },
        credentials: 'include'
    }
    const isFormData = options.body && options.body instanceof FormData;
    if (!isFormData) {
        config.headers['Content-Type'] = 'application/json';
    }

    try {
        let res = await fetch(url, config)
        if (res.status === 401) {
            res = await refreshToken();
            if(!res.ok){
                logger.warn('authFetch error: ', res.message)
                throw new Error('Refresh token invalid or expired.'); 
            }
            const data = await res.json()
            if (data.accessToken) {
                auth.login(data.accessToken, data.user);
                config.headers.Authorization = `Bearer ${data.accessToken}`;
                return await fetch(url, config);
            }
            logger.warn('Refresh token response did not contain an access token.');
            throw new Error('Refresh token response invalid.');
        }
        return res
    } catch (error) {
        logger.warn('authFetch error: ', error)
        throw error
    }
}

export default authFetch;