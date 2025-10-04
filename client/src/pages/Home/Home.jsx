import { useState, useRef } from 'react'
import styles from './Home.module.css'
import { useUI } from '../../contexts/UIContext'
import SummaryForm from '../../components/SummaryForm/SummaryForm'
import Summary from '../../components/Summary/Summary'
import ResizableSplitter from '../../components/ResizableSplitter/ResizableSplitter'
import Footer from '../../components/Footer/Footer'
import { useEffect } from 'react'
import { statusMap } from '../../utils/statusMap'
import { fetchSummary, postUrl } from '../../services/summaryService'
import { useAuth } from '../../contexts/AuthContext'
import { useSummary } from '../../contexts/SummaryContext'
import { useSummary as useSummaryQuery } from '../../hooks/useSummary'
import LoadingBar from '../../components/LoadingBar/LoadingBar'
import logger from '../../utils/logger'

const API = import.meta.env.VITE_API_URL

const Home = () => {
    const { submitted, setSubmitted } = useUI()
    const { docId, status, summary, error, setDocId, setStatus, setSummary, setError, resetSummaryState } = useSummary()
    const auth = useAuth()
    const mainRef = useRef(null)
    
    const { data: cachedSummary, isLoading: summaryLoading, error: summaryError } = useSummaryQuery(docId, status)

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

    useEffect(() => {
        resetSummaryState()
    }, [])

    useEffect(() => {
        if (cachedSummary?.summary && status === "COMPLETED" && !summary) {
            logger.info(`[Home] Setting summary from cached data for docId: ${docId}`)
            setSummary(cachedSummary.summary)
        }
    }, [cachedSummary, status, docId, summary])

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
                    if (data.stage === "COMPLETED") {
                        if (data.summary) {
                            setSummary(data.summary)
                        } else if (cachedSummary?.summary) {
                            setSummary(cachedSummary.summary)
                        } else {
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

    const handleUrlSubmit = (docId, status, isExisting = false) => {
        logger.info(`[Home] handleUrlSubmit called with docId: ${docId}, status: ${status}, existing: ${isExisting}`)
        
        resetSummaryState()
        setDocId(docId)
        setStatus(status)
        setSubmitted(true)
        
        if (isExisting && status === "COMPLETED") {
            logger.info(`[Home] Document already exists with completed summary, fetching summary for docId: ${docId}`)
        } else if (isExisting && status === "QUEUED") {
            logger.info(`[Home] Document already exists but being processed, waiting for completion for docId: ${docId}`)
        }
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
                                        <button 
                                            onClick={() => {
                                                setError(null)
                                                setSubmitted(false)
                                            }}
                                            className={styles.retryButton}
                                        >
                                            Try Again
                                        </button>
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