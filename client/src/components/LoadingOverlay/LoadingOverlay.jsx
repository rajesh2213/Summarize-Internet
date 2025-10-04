import React from 'react'
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner'
import styles from './LoadingOverlay.module.css'

const LoadingOverlay = ({ 
  isVisible = true, 
  message = 'Initializing...',
  showProgress = false,
  progress = 0 
}) => {
  if (!isVisible) return null

  return (
    <div className={styles.overlay}>
      <div className={styles.overlayContent}>
        <div className={styles.logoContainer}>
          <div className={styles.logo}>
          </div>
        </div>
        
        <div className={styles.spinnerContainer}>
          <LoadingSpinner size="large" message={message} />
        </div>

      </div>
    </div>
  )
}

export default LoadingOverlay
