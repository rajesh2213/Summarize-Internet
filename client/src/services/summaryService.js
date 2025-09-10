import authFetch from '../utils/authFetch';

const API = import.meta.env.VITE_API_URL

export const postUrl = async (url, auth) => {
    return await authFetch(`${API}/v1/summarize`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({url})
    }, auth)
}