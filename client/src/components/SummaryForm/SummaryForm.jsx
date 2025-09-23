import PropTypes from "prop-types";
import { useState } from "react";
import styles from './SummaryForm.module.css'
import * as summaryService from '../../services/summaryService'
import logger from '../../utils/logger'
import {useAuth} from '../../contexts/AuthContext'

const SummaryForm = ({onSubmit}) => {
    const [url, setUrl] = useState('')
    const [errors, setErrors] = useState([])
    const [isLoading, setIsLoading] = useState(false)
    const auth = useAuth()

    const handleChange = (e) => {
        setUrl(e.target.value);
        if (errors.length > 0) {
            setErrors([]);
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setErrors([]);
        setIsLoading(true);

        try{
            const res = await summaryService.postUrl(url, auth)
            const data = await res.json()
            if(!res.ok){
                const errorMessages = data.errors.map(error => error.message);
                setErrors(errorMessages);
            }else{
                setErrors([]);
                onSubmit(data.id, "QUEUED");
            }
        }catch(error){
            setErrors([error.message || "Something went wrong..."])
            logger.warn(error)
        } finally {
            setIsLoading(false);
        }
    }

    return(
        <form onSubmit={handleSubmit} className={styles.form}>
            {errors.length > 0 && (
                <div className={styles.errorContainer}>
                    {errors.map((err, index) => (
                        <span key={index} className={styles.error}>{err}</span>
                    ))}
                </div>
            )}
            
            <div className={styles.inputContainer}>
                <input 
                    type="url" 
                    value={url}
                    onChange={handleChange}
                    placeholder="Paste a link to any webpage, YouTube video, or even a Twitch livestream and get a summary in seconds"
                    className={styles.input}
                    disabled={isLoading}
                    required
                />
            </div>
            
            <button 
                type="submit" 
                className={`${styles.submitButton} ${isLoading ? styles.loading : ''}`}
                disabled={isLoading || !url.trim()}
            >
                {isLoading ? 'Processing...' : 'Summarize'}
            </button>
        </form>
    )
}

SummaryForm.propTypes = {
    onSubmit: PropTypes.func.isRequired
}

export default SummaryForm