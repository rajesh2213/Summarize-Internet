import { useState, useContext, createContext, useEffect} from 'react'
import { useUI } from './UIContext';

const SummaryContext = createContext()

export const useSummary = () => {
    const context = useContext(SummaryContext)
    if(!context){
        throw new Error('useSummary must be used within a SummaryProvider')
    }
    return context
}

export const SummaryProvider = ({children}) => {
    const {setSubmitted} = useUI()
    const [docId, setDocId] = useState(null)
    const [status, setStatus] = useState(null)
    const [summary, setSummary] = useState(null)
    const [error, setError] = useState(null)

    const resetSummaryState = () => {
        setDocId(null);
        setStatus("")
        setSummary(null);
        setError(null);
        setSubmitted(false)
    }

    return (
        <SummaryContext.Provider value={{docId, status, summary, error, setDocId, setStatus, setSummary, setError, resetSummaryState}}>
            {children}
        </SummaryContext.Provider>
    )
}