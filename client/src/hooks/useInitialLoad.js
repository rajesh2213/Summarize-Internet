import { useState, useEffect } from 'react'

const useInitialLoad = () => {
  const [isLoading, setIsLoading] = useState(true)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [loadingMessage, setLoadingMessage] = useState('Initializing...')

  useEffect(() => {
    const loadApp = async () => {
      try {
        const steps = [
          { progress: 20, message: 'Loading assets...' },
          { progress: 40, message: 'Initializing components...' },
          { progress: 60, message: 'Setting up context...' },
          { progress: 80, message: 'Preparing interface...' },
          { progress: 100, message: 'Ready!' }
        ]

        for (const step of steps) {
          setLoadingProgress(step.progress)
          setLoadingMessage(step.message)
          
          await new Promise(resolve => setTimeout(resolve, 300))
        }

        await new Promise(resolve => setTimeout(resolve, 300))
        
        setIsLoading(false)
      } catch (error) {
        console.error('Error during initial load:', error)
        setIsLoading(false)
      }
    }

    loadApp()
  }, [])

  return {
    isLoading,
    loadingProgress,
    loadingMessage
  }
}

export default useInitialLoad
