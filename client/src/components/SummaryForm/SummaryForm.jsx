import PropTypes from "prop-types";
import { useState } from "react";
import styles from './SummaryForm.module.css'
import * as summaryService from '../../services/summaryService'
import logger from '../../utils/logger'
import {useAuth} from '../../contexts/AuthContext'

const SummaryForm = ({onSubmit}) => {
    const [url, setUrl] = useState('')
    const [errors, setErrors] = useState([])
    const auth = useAuth()

    const handleChange = (e) => {
        setUrl(e.target.value);
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setErrors([]);

        try{
            const res = await summaryService.postUrl(url, auth)
            const data = await res.json()
            if(!res.ok){
                const errorMessages = data.errors.map(error => error.message);
                setErrors(errorMessages);
            }else{
                setErrors([]);
                onSubmit();
            }
        }catch(error){
            setErrors({ ...errors, server: error.message || "Something went wrong..." })
            logger.warn(error)
        }
    }
    return(
        <form onSubmit={handleSubmit}>
            {errors.length > 0 && (
                <div className={styles.errorContainer}>
                    {errors.map((err, index) => (
                        <span key={index} className={styles.error}>{err}</span>
                    ))}
                </div>
            )}
            <input 
                type="text" 
                value={url}
                onChange={handleChange}
                placeholder="Paste a link to any webpage, YouTube video, 
                or even a Twitch livestream and get a summary in seconds"
                className={styles.input}
                />
                <button type="submit">Summarize</button>
        </form>
    )

}

SummaryForm.prototype = {
    onSubmit: PropTypes.func.isRequired
}

export default SummaryForm