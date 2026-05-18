// CONCH Platform - Navbar Component

import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useConchStore } from '../lib/store'
import { fetchNotifications } from '../lib/api'
import { shortKey } from '../lib/wallet'
import type { Notification } from '../lib/types'
import './Navbar.css'

// Icons
const SunIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/>
    <line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
)

const MoonIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
)

const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)

const BellIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
)


interface NavbarProps {
  wsConnected: boolean
}

export default function Navbar({ wsConnected }: NavbarProps) {
  const location = useLocation()
  const { theme, toggleTheme, wallet } = useConchStore()
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  
  // Fetch notifications on mount
  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const data = await fetchNotifications(10)
        setNotifications(data)
      } catch (error) {
        console.warn('Failed to load notifications:', error)
      } finally {
        setLoading(false)
      }
    }
    loadNotifications()
    
    // Listen for real-time notification events
    const handleNewNotification = (event: CustomEvent<Notification>) => {
      setNotifications(prev => [event.detail, ...prev])
    }
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleNotificationSafe = (e: any) => handleNewNotification(e as CustomEvent<Notification>)
    window.addEventListener('new-notification', handleNotificationSafe)
    
    return () => {
      window.removeEventListener('new-notification', handleNotificationSafe)
    }
  }, [])
  
  // Format notification time
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)
    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    return 'Just now'
  }
  
  const isActive = (path: string) => location.pathname === path
  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          <svg className="conch-icon" viewBox="0 0 100 100" fill="none">
            <path 
              d="M50 5 C30 25 20 45 20 65 C20 85 35 95 50 95 C65 95 80 85 80 65 C80 45 70 25 50 5Z"
              stroke="url(#goldGradient)"
              strokeWidth="2"
              fill="none"
            />
            <path 
              d="M50 15 C35 30 30 45 30 60 C30 80 40 90 50 90 C60 90 70 80 70 60 C70 45 65 30 50 15Z"
              stroke="url(#goldGradient)"
              strokeWidth="1.5"
              fill="none"
              opacity="0.6"
            />
            <path 
              d="M50 25 C40 35 38 45 38 55 C38 70 45 80 50 80 C55 80 62 70 62 55 C62 45 60 35 50 25Z"
              stroke="url(#goldGradient)"
              strokeWidth="1"
              fill="none"
              opacity="0.3"
            />
            <defs>
              <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#d4af37" />
                <stop offset="100%" stopColor="#f5d76e" />
              </linearGradient>
            </defs>
          </svg>
          <span className="logo-text">CONCH</span>
        </Link>

        <div className="navbar-links">
          <Link 
            to="/" 
            className={`nav-link ${isActive('/') ? 'active' : ''}`}
          >
            Home
          </Link>
          <Link 
            to="/feed" 
            className={`nav-link ${isActive('/feed') ? 'active' : ''}`}
          >
            Feed
          </Link>
          <Link 
            to="/explore" 
            className={`nav-link ${isActive('/explore') ? 'active' : ''}`}
          >
            Explore
          </Link>
          <Link 
            to="/create" 
            className="nav-link create-link"
          >
            <PlusIcon />
            <span className="create-text">New Conch</span>
          </Link>
          <Link 
            to="/graph" 
            className={`nav-link ${isActive('/graph') ? 'active' : ''}`}
          >
            Graph
          </Link>
          <Link 
            to="/dashboard" 
            className={`nav-link ${isActive('/dashboard') ? 'active' : ''}`}
          >
            Dashboard
          </Link>
        </div>

        <div className="navbar-actions">
          {/* Notifications Bell */}
          <div className="notifications-wrapper">
            <button 
              className="notification-bell"
              onClick={() => setShowNotifications(!showNotifications)}
              aria-label="Notifications"
            >
              <BellIcon />
              {unreadCount > 0 && (
                <span className="notification-badge">{unreadCount}</span>
              )}
            </button>
            
            {showNotifications && (
              <div className="notifications-dropdown">
                <div className="notifications-header">
                  <h4>Notifications</h4>
                  <button className="mark-read">Mark all read</button>
                </div>
                <div className="notifications-list">
                  {loading ? (
                    <div className="notifications-loading">Loading...</div>
                  ) : notifications.length === 0 ? (
                    <div className="notifications-empty">No notifications yet</div>
                  ) : (
                    notifications.map(notif => (
                      <div key={notif.id} className="notification-item">
                        <div className="notif-avatar">{(notif.user_username || notif.from_username || '?')[0].toUpperCase()}</div>
                        <div className="notif-content">
                          <p><strong>{notif.user_username || notif.from_username}</strong> {notif.message}</p>
                          <span className="notif-time">{formatTime(notif.created_at)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <Link to="/profile" className="view-all" onClick={() => setShowNotifications(false)}>
                  View all notifications
                </Link>
              </div>
            )}
          </div>
          
          {/* Wallet identity */}
          {wallet ? (
            <Link
              to="/wallet"
              className={`nav-link ${isActive('/wallet') ? 'active' : ''}`}
              title="Your wallet"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontFamily: 'monospace' }}
            >
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: `hsl(${parseInt(wallet.publicKey.slice(0,4), 16) % 360}, 60%, 50%)`, flexShrink: 0 }} />
              {wallet.displayName !== 'Anonymous' ? wallet.displayName : shortKey(wallet.publicKey)}
            </Link>
          ) : (
            <Link
              to="/wallet"
              style={{ padding: '8px 16px', background: 'var(--color-primary)', color: 'white', borderRadius: 'var(--radius-lg)', fontSize: '14px', fontWeight: 500, textDecoration: 'none' }}
            >
              Get a key
            </Link>
          )}
          
          {/* Theme Toggle Button */}
          <button 
            className="theme-toggle" 
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          
          {/* Connection Status */}
          <div className={`connection-indicator ${wsConnected ? 'connected' : ''}`}>
            <span className="indicator-dot"></span>
            <span className="indicator-text">
              {wsConnected ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>
      </div>
    </nav>
  )
}
