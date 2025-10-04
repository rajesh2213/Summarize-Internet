import { useState } from 'react'
import './App.css'
import AppRouter from './router.jsx'
import Header from './components/Header/Header.jsx'
import LoadingOverlay from './components/LoadingOverlay/LoadingOverlay.jsx'
import useInitialLoad from './hooks/useInitialLoad.js'

function App() {
  const { isLoading, loadingProgress, loadingMessage } = useInitialLoad()

  return (
    <>
      <LoadingOverlay 
        isVisible={isLoading}
        message={loadingMessage}
        showProgress={true}
        progress={loadingProgress}
      />
      {!isLoading && (
        <>
          <Header />
          <AppRouter />
        </>
      )}
    </>
  )
}

export default App
