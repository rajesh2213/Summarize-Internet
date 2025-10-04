import React from 'react'
import styles from './LoadingSpinner.module.css'

const LoadingSpinner = ({ size = 'medium', message = '' }) => {
  return (
    <div className={styles.spinnerContainer}>
      <div className={`${styles.spinner} ${styles[size]}`}>
        <div className={styles.spinnerRing}>
          <div className={styles.spinnerRingInner}></div>
        </div>
        <div className={styles.spinnerRing}>
          <div className={styles.spinnerRingInner}></div>
        </div>
        <div className={styles.spinnerRing}>
          <div className={styles.spinnerRingInner}></div>
        </div>
      </div>
      {message && (
        <div className={styles.spinnerMessage}>
          {message}
        </div>
      )}
    </div>
  )
}

export default LoadingSpinner
