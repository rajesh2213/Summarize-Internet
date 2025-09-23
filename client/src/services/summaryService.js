import authFetch from '../utils/authFetch';

const API = import.meta.env.VITE_API_URL

const makeRequest = async (url, options, auth) => {
    if (auth && auth.token) {
        return await authFetch(url, options, auth)
    } else {
        return await fetch(url, {
            ...options,
            credentials: 'include'
        })
    }
}

export const postUrl = async (url, auth) => {
    return await makeRequest(`${API}/v1/summarize`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({url})
    }, auth)
}

export const fetchSummary = async (docId, auth) => {
    return await makeRequest(`${API}/v1/summary/${docId}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    }, auth)
}