import { createContext, useContext, useState } from "react";

const UIContext = createContext(null)

export const UIProvider = ({children}) => {
    const [submitted, setSubmitted] = useState(false)

    const value = {
        submitted, 
        setSubmitted
    }
    return (
        <UIContext.Provider value={value}>
            {children}
        </UIContext.Provider>
    )
}

export const useUI = () => useContext(UIContext)