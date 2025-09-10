import { useState } from 'react'
import './App.css'
import AppRouter from './router.jsx'
import Header from './components/Header/Header.jsx'

function App() {

  return (
    <>
      <Header />
      <AppRouter />
    </>
  )
}

export default App
