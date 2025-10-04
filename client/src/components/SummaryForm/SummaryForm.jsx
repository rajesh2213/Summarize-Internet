import PropTypes from "prop-types";
import { useState } from "react";
import styles from './SummaryForm.module.css'
import { useSubmitUrl } from '../../hooks/useSummary'
import logger from '../../utils/logger'

const SummaryForm = ({onSubmit}) => {
    const [url, setUrl] = useState('')
    const [errors, setErrors] = useState([])
    const submitUrlMutation = useSubmitUrl()

    const handleChange = (e) => {
        setUrl(e.target.value);
        if (errors.length > 0) {
            setErrors([]);
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setErrors([]);

        try{
            const data = await submitUrlMutation.mutateAsync(url)
            setErrors([]);
            onSubmit(data.id, data.status || "QUEUED", data.existing);
        }catch(error){
            setErrors([error.message || "Something went wrong..."])
            logger.warn(error)
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
                    disabled={submitUrlMutation.isPending}
                    required
                />
            </div>
            
            <button 
                type="submit" 
                className={`${styles.submitButton} ${submitUrlMutation.isPending ? styles.loading : ''}`}
                disabled={submitUrlMutation.isPending || !url.trim()}
            >
                {submitUrlMutation.isPending ? 'Processing...' : 'Summarize'}
            </button>
        </form>
    )
}

SummaryForm.propTypes = {
    onSubmit: PropTypes.func.isRequired
}

export default SummaryForm