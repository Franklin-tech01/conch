// CONCH Platform - Main App Component

import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'

// Components
import Navbar from './components/Navbar'
import LandingPage from './pages/LandingPage'
import ConchFeed from './pages/ConchFeed'
import CreateConch from './pages/CreateConch'
import ConchDetail from './pages/ConchDetail'
import GraphView from './pages/GraphView'
import LiveEvents from './components/LiveEvents'

// New Pages
import ProfilePage from './pages/ProfilePage'
import DashboardPage from './pages/DashboardPage'
import ExplorePage from './pages/ExplorePage'
import CollaborationHub from './pages/CollaborationHub'
import WalletPage from './pages/WalletPage'

// Store
import { useConchStore } from './lib/store'

// API
import { fetchConches } from './lib/api'

function App() {
  const { setConches, setLoading, addEvent, theme } = useConchStore()
  const [wsConnected, setWsConnected] = useState(false)

  // Apply theme on mount
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // Initial data fetch
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        const conches = await fetchConches()
        setConches(conches)
      } catch (error) {
        console.error('Failed to fetch conches:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [setConches, setLoading])

  // SSE connection for real-time updates
  useEffect(() => {
    const eventSource = new EventSource('/events')

    eventSource.onopen = () => {
      console.log('SSE connected')
      setWsConnected(true)
    }

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        addEvent(data)
        
        // Refresh conches when there's an update
        if (data.type === 'conch_created' || data.type === 'conch_updated') {
          fetchConches().then(setConches)
        }
      } catch (error) {
        console.error('Failed to parse SSE message:', error)
      }
    }

    eventSource.onerror = (error) => {
      console.error('SSE error:', error)
      setWsConnected(false)
      eventSource.close()
    }

    return () => {
      eventSource.close()
    }
  }, [addEvent, setConches])

  return (
    <BrowserRouter>
      <div className="app">
        <Navbar wsConnected={wsConnected} />
        
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/feed" element={<ConchFeed />} />
            <Route path="/create" element={<CreateConch />} />
            <Route path="/conch/:id" element={<ConchDetail />} />
            <Route path="/graph" element={<GraphView />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/collaborate" element={<CollaborationHub />} />
            <Route path="/wallet" element={<WalletPage />} />
            <Route path="*" element={<LandingPage />} />
          </Routes>
        </AnimatePresence>

        <LiveEvents />
      </div>
    </BrowserRouter>
  )
}

export default App
