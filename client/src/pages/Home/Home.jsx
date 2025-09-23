import { useState, useRef } from 'react'
import styles from './Home.module.css'
import { useUI } from '../../contexts/UIContext'
import SummaryForm from '../../components/SummaryForm/SummaryForm'
import Summary from '../../components/Summary/Summary'
import ResizableSplitter from '../../components/ResizableSplitter/ResizableSplitter'
import Footer from '../../components/Footer/Footer'
import { useEffect } from 'react'
import { statusMap } from '../../utils/statusMap'
import { fetchSummary } from '../../services/summaryService'
import { useAuth } from '../../contexts/AuthContext'
import LoadingBar from '../../components/LoadingBar/LoadingBar'
import logger from '../../utils/logger'

const API = import.meta.env.VITE_API_URL

const Home = () => {
    const { submitted, setSubmitted } = useUI()
    const auth = useAuth()
    const [docId, setDocId] = useState(null)
    const [status, setStatus] = useState("")
    const [summary, setSummary] = useState(null)
    const [error, setError] = useState(null)
    const mainRef = useRef(null)

    const scrollToMainContent = () => {
        if (mainRef.current) {
            const headerHeight = 70; 
            const elementPosition = mainRef.current.offsetTop - headerHeight;
            
            window.scrollTo({
                top: elementPosition,
                behavior: 'smooth'
            });
        }
    }

    const resetState = () => {
        setSubmitted(false);
        setDocId(null);
        setStatus("")
        setSummary(null);
        setError(null);
    }

    useEffect(() => {
        resetState()
    }, [])

    useEffect(() => {
        if (summary) {
            const timer = setTimeout(() => {
                scrollToMainContent();
                
                if (mainRef.current) {
                    mainRef.current.classList.add(styles.scrollHighlight);
                    
                    setTimeout(() => {
                        if (mainRef.current) {
                            mainRef.current.classList.remove(styles.scrollHighlight);
                        }
                    }, 2000);
                }
            }, 500);
            
            return () => clearTimeout(timer);
        }
    }, [summary])

    useEffect(() => {
        if (!docId) {
            logger.info(`[EventSource] No docId, skipping EventSource setup`)
            return
        }

        logger.info(`[EventSource] Setting up EventSource for docId: ${docId}`)
        const es = new EventSource(`${API}/v1/progress/${docId}`)

        es.onopen = () => {
            logger.info(`[EventSource] Connected to progress stream for docId: ${docId}`)
        }

        es.onmessage = async (e) => {
            try {
                const data = JSON.parse(e.data)
                logger.info(`[EventSource] Received progress update:`, data)

                if (data.stage === "CONNECTED") {
                    logger.info(`[EventSource] Connection confirmed for docId: ${docId}`)
                    return
                }

                if (data.stage === "HEARTBEAT") {
                    logger.info(`[EventSource] Heartbeat received for docId: ${docId}`)
                    return
                }
                setStatus(data.stage)

                if (data.stage === "COMPLETED" || data.stage === "ERROR") {
                    if (data.summary) {
                        setSummary(data.summary)
                    } else if (data.stage === "COMPLETED") {
                        try {
                            const res = await fetchSummary(docId, auth)
                            const summaryData = await res.json()
                            if (!res.ok) {
                                setError("Failed to fetch summary, Try again..")
                            } else {
                                setSummary(summaryData.summary)
                            }
                        } catch (err) {
                            setError("Failed to fetch summary, Try again..")
                        }
                    } else {
                        setError("Processing failed. Please try again.")
                    }
                    es.close()
                }
            } catch (err) {
                logger.warn("[EventSource] Error parsing message:", err)
                setError("Invalid response received. Please try again.")
                es.close()
            }
        }

        es.onerror = (err) => {
            logger.warn("EventSource failed:", err);
            logger.warn("EventSource readyState:", es.readyState);

            if (es.readyState === EventSource.CLOSED) {
                setError("Connection closed. Please try again.");
            } else {
                setError("Connection lost. Please try again.");
            }
            es.close();
        }

        return () => {
            logger.info(`[EventSource] Cleaning up connection for docId: ${docId}`)
            es.close()
        }
    }, [docId])

    const handleUrlSubmit = (id, stage) => {
        logger.info(`[Home] handleUrlSubmit called with id: ${id}, stage: ${stage}`)
        resetState()
        const mapped = statusMap[stage]
        setDocId(id)
        setStatus(stage)
        setSubmitted(true)
    }

    return (
        <>
            <div className={styles.homeContainer}>
                <div className={styles.intro}>
                    <h1>Summarize-Internet</h1>
                    <h3>Your personal AI summary engine. Focus on what matters, we'll handle the rest</h3>
                </div>
                
                <div ref={mainRef} className={`${styles.mainContent} ${summary ? styles.summaryPresent : ''}`}>
                    <ResizableSplitter 
                        initialSize={50}
                        minSize={30}
                        maxSize={80}
                        direction="horizontal"
                        className={styles.splitterContainer}
                    >
                        <div className={styles.leftSection}>
                            <div className={`${styles.summaryConatiner} ${summary ? styles.summaryPresent : ''}`}>
                                {!submitted && (
                                    <SummaryForm onSubmit={handleUrlSubmit} />
                                )}

                                {error && (
                                    <div className={styles.errorBox}>
                                        <p>{error}</p>
                                        <SummaryForm onSubmit={handleUrlSubmit} />
                                    </div>
                                )}

                                {summary && (
                                    <div className={styles.summaryBox}>
                                        <h4>Summary</h4>
                                        <Summary summary={summary} />
                                    </div>
                                )}

                                {submitted && !summary && !error && (
                                    <LoadingBar
                                        id={docId}
                                        status={status}
                                    />
                                )}
                            </div>
                        </div>

                        <div className={styles.rightSection}>
                            <div className={`${styles.tutorialPlaceholder} ${summary ? styles.summaryPresent : ''}`}>
                                <div className={styles.placeholderContent}>
                                    <div className={styles.placeholderIcon}>🎥</div>
                                    <h4>Tutorial</h4>
                                </div>
                            </div>
                        </div>
                    </ResizableSplitter>
                </div>
            </div>
            
            <Footer />
        </>
    )
}

export default Home