import { useState, useEffect } from 'react'
import styles from './TypewriterText.module.css'

const TypewriterText = ({ text, speed = 30, onComplete }) => {
  const [displayedText, setDisplayedText] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isTyping, setIsTyping] = useState(true)

  useEffect(() => {
    if (!text || currentIndex >= text.length) {
      setIsTyping(false)
      if (onComplete) onComplete()
      return
    }

    const timer = setTimeout(() => {
      setDisplayedText(prev => prev + text[currentIndex])
      setCurrentIndex(prev => prev + 1)
    }, speed)

    return () => clearTimeout(timer)
  }, [currentIndex, text, speed, onComplete])

  useEffect(() => {
    setDisplayedText('')
    setCurrentIndex(0)
    setIsTyping(true)
  }, [text])

  return (
    <div className={styles.typewriterContainer}>
      <span className={styles.typewriterText}>
        {displayedText}
        {isTyping && <span className={styles.cursor}>|</span>}
      </span>
    </div>
  )
}

export default TypewriterText
