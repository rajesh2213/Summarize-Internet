import {useState} from 'react'
import styles from './Home.module.css'
import { useUI } from '../../contexts/UIContext'
import SummaryForm from '../../components/SummaryForm/SummaryForm'

const Home = () => {
    const { submitted, setSubmitted } = useUI()
    const handleUrlSubmit = () => setSubmitted(true)

    return (
        <div className={`${styles.homeContainer} ${submitted ? styles.submitted : ''}`}>
            {!submitted ? (
                <div className={styles.intro}>
                    <h3>Your personal AI summary engine. Focus on what matters, we'll handle the rest</h3>
                </div>
            ) : (
                <>
                </>
            )}
            <SummaryForm onSubmit={handleUrlSubmit} />
        </div>
    )
}

export default Home