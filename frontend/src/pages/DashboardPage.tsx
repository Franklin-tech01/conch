// CONCH Platform - User Dashboard Page

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useConchStore } from '../lib/store'
import { fetchConches } from '../lib/api'
import { useSSE } from '../hooks/useSSE'
import Loader from '../components/Loader'
import { shortKey } from '../lib/wallet'

// Icons
const TrendingIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
    <polyline points="17 6 23 6 23 12"/>
  </svg>
)

const ActivityIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
)

const UsersIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)

const ChartIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
)

const FireIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
  </svg>
)

const RefreshIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <polyline points="23 4 23 10 17 10"/>
    <polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
)

export default function DashboardPage() {
  const { conches, setConches, loading, setLoading } = useConchStore()
  const [activeFeed, setActiveFeed] = useState<'following' | 'trending' | 'recent'>('recent')
  const [refreshing, setRefreshing] = useState(false)
  const [following, setFollowing] = useState<string[]>(['Alice', 'Bob', 'Charlie'])
  const [suggestedUsers, setSuggestedUsers] = useState([
    { id: '1', username: 'MemoryWeaver', conches: 12 },
    { id: '2', username: 'SpiralArchitect', conches: 8 },
    { id: '3', username: 'EraExplorer', conches: 15 },
  ])

  // Connect to SSE for real-time updates
  useSSE()

  // Calculate stats from real data
  const stats = [
    { label: 'Total Conches', value: conches.length, icon: <ActivityIcon />, change: '+0' },
    { label: 'Following', value: following.length, icon: <UsersIcon />, change: '+0' },
    { label: 'Total Views', value: '0', icon: <ChartIcon />, change: '+0%' },
    { label: 'Streak', value: '0 days', icon: <FireIcon />, change: 'New' },
  ]

  // Get recent conches sorted by date
  const recentConches = [...conches]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10)

  // Get trending conches (most viewed/engaged - using era as proxy)
  const trendingConches = [...conches]
    .sort((a, b) => b.era - a.era)
    .slice(0, 5)

  // Get personalized feed from followed users (mock for now)
  const followingFeed = [...conches]
    .filter(c => following.includes(c.owner))
    .slice(0, 5)

  // Follow a user
  const handleFollow = (username: string) => {
    if (!following.includes(username)) {
      setFollowing([...following, username])
      setSuggestedUsers(suggestedUsers.filter(u => u.username !== username))
    }
  }


  // Load conches on mount
  useEffect(() => {
    const loadConches = async () => {
      if (conches.length === 0) {
        setLoading(true)
        try {
          const data = await fetchConches(1, 50)
          setConches(data)
        } catch (error) {
          console.error('Failed to load conches:', error)
        } finally {
          setLoading(false)
        }
      }
    }
    loadConches()
  }, [conches.length, setConches, setLoading])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const data = await fetchConches(1, 50)
      setConches(data)
    } catch (error) {
      console.error('Failed to refresh:', error)
    } finally {
      setRefreshing(false)
    }
  }

  if (loading && conches.length === 0) {
    return (
      <div className="dashboard-page">
        <div className="container" style={{ paddingTop: '100px', paddingBottom: '40px' }}>
          <Loader fullPage message="Loading dashboard..." />
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-page">
      <div className="container" style={{ paddingTop: '100px', paddingBottom: '40px' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="dashboard-header">
            <h1 className="section-title" style={{ textAlign: 'left', marginBottom: 0 }}>
              Dashboard
            </h1>
            <button className="btn btn-secondary" onClick={handleRefresh} disabled={refreshing}>
              <RefreshIcon />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
          
          {/* Stats Grid */}
          <div className="stats-grid">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                className="stat-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <div className="stat-icon">{stat.icon}</div>
                <div className="stat-content">
                  <span className="stat-value">{stat.value}</span>
                  <span className="stat-label">{stat.label}</span>
                </div>
                <span className="stat-change">{stat.change}</span>
              </motion.div>
            ))}
          </div>
          
          {/* Main Content Grid */}
          <div className="dashboard-grid">
            {/* Left Column */}
            <div className="dashboard-column">
              {/* Feed Section */}
              <div className="card">
                <div className="feed-tabs">
                  <button
                    className={`feed-tab ${activeFeed === 'recent' ? 'active' : ''}`}
                    onClick={() => setActiveFeed('recent')}
                  >
                    Recent
                  </button>
                  <button
                    className={`feed-tab ${activeFeed === 'following' ? 'active' : ''}`}
                    onClick={() => setActiveFeed('following')}
                  >
                    Following
                  </button>
                  <button
                    className={`feed-tab ${activeFeed === 'trending' ? 'active' : ''}`}
                    onClick={() => setActiveFeed('trending')}
                  >
                    Trending
                  </button>
                </div>
                
                <div className="feed-content">
                  {activeFeed === 'recent' && (
                    <div className="feed-list">
                      {recentConches.length > 0 ? recentConches.map(conch => (
                        <Link key={conch.id} to={`/conch/${conch.id}`} className="feed-item">
                          <div className="feed-item-avatar">C</div>
                          <div className="feed-item-content">
                            <span className="feed-item-title">{conch.intent || conch.story?.slice(0, 30) || 'Untitled'}...</span>
                            <span className="feed-item-meta">Era {conch.era} • {new Date(conch.created_at).toLocaleDateString()}</span>
                          </div>
                        </Link>
                      )) : (
                        <div className="empty-feed">
                          <span>No recent activity</span>
                          <Link to="/create" className="btn btn-primary btn-small">Create First Conch</Link>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {activeFeed === 'following' && (
                    <div className="feed-list">
                      {followingFeed.length > 0 ? followingFeed.map(conch => (
                        <Link key={conch.id} to={`/conch/${conch.id}`} className="feed-item">
                          <div className="feed-item-avatar">{conch.owner[0]?.toUpperCase() || 'U'}</div>
                          <div className="feed-item-content">
                            <span className="feed-item-title">{conch.intent || 'Untitled'}</span>
                            <span className="feed-item-meta" title={conch.owner}>
                              by {conch.owner && conch.owner.length > 16 ? shortKey(conch.owner) : conch.owner}
                            </span>
                          </div>
                        </Link>
                      )) : (
                        <div className="empty-feed">
                          <span>No activity from followed users</span>
                          <Link to="/explore" className="btn btn-secondary btn-small">Explore Users</Link>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {activeFeed === 'trending' && (
                    <div className="feed-list">
                      {trendingConches.length > 0 ? trendingConches.map(conch => (
                        <Link key={conch.id} to={`/conch/${conch.id}`} className="feed-item">
                          <div className="feed-item-icon trending">
                            <TrendingIcon />
                          </div>
                          <div className="feed-item-content">
                            <span className="feed-item-title">{conch.intent || 'Untitled'}</span>
                            <span className="feed-item-meta">Era {conch.era}</span>
                          </div>
                        </Link>
                      )) : (
                        <div className="empty-feed">
                          <span>No trending conches</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Right Column */}
            <div className="dashboard-column">
              {/* Analytics Widget */}
              <div className="card">
                <h3 style={{ marginBottom: '16px', color: 'var(--color-gold)' }}>
                  <ActivityIcon /> Activity
                </h3>
                <div className="activity-chart">
                  <div className="chart-bars">
                    {conches.length > 0 ? (
                      // Generate bars based on conch data or mock data
                      Array.from({ length: 7 }).map((_, i) => {
                        const height = Math.max(20, Math.min(100, 30 + (i * 10) + (conches.length * 5)))
                        return (
                          <div key={i} className="chart-bar">
                            <div 
                              className="chart-bar-fill" 
                              style={{ height: `${height}%` }}
                            ></div>
                            <span className="chart-bar-label">
                              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}
                            </span>
                          </div>
                        )
                      })
                    ) : (
                      [65, 45, 80, 55, 90, 70, 85].map((height, i) => (
                        <div key={i} className="chart-bar">
                          <div 
                            className="chart-bar-fill" 
                            style={{ height: `${height}%` }}
                          ></div>
                          <span className="chart-bar-label">
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="activity-summary">
                  <span>You have created {conches.length} Conch{conches.length !== 1 ? 'es' : ''}</span>
                </div>
              </div>
              
              {/* Suggested Users Widget */}
              <div className="card">
                <h3 style={{ marginBottom: '16px', color: 'var(--color-gold)' }}>
                  <UsersIcon /> Suggested Users
                </h3>
                <div className="suggested-users">
                  {suggestedUsers.map(user => (
                    <div key={user.id} className="suggested-user">
                      <div className="user-avatar">{user.username[0]}</div>
                      <div className="user-info">
                        <span className="user-name">{user.username}</span>
                        <span className="user-conches">{user.conches} Conches</span>
                      </div>
                      <button 
                        className="btn btn-small btn-secondary"
                        onClick={() => handleFollow(user.username)}
                      >
                        Follow
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Gamification Widget */}
              <div className="card">
                <h3 style={{ marginBottom: '16px', color: 'var(--color-gold)' }}>
                  <FireIcon /> Achievements
                </h3>
                <div className="achievements-grid">
                  <div className={`achievement-badge ${conches.length > 0 ? '' : 'locked'}`} data-tooltip="Created first Conch">
                    <span className="badge-icon">🌱</span>
                    <span className="badge-label">First Conch</span>
                  </div>
                  <div className={`achievement-badge ${conches.length >= 5 ? '' : 'locked'}`} data-tooltip="Created 5 Conches">
                    <span className="badge-icon">🌿</span>
                    <span className="badge-label">Growing</span>
                  </div>
                  <div className={`achievement-badge ${conches.length >= 10 ? '' : 'locked'}`} data-tooltip="Create 10 Conches">
                    <span className="badge-icon">🌳</span>
                    <span className="badge-label">Master</span>
                  </div>
                  <div className="achievement-badge" data-tooltip="Link 5 Conches">
                    <span className="badge-icon">🔗</span>
                    <span className="badge-label">Connector</span>
                  </div>
                  <div className="achievement-badge" data-tooltip="Visit daily">
                    <span className="badge-icon">🔥</span>
                    <span className="badge-label">Streak</span>
                  </div>
                  <div className="achievement-badge" data-tooltip="Get 100 views">
                    <span className="badge-icon">👁️</span>
                    <span className="badge-label">Popular</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
      
      <style>{`
        .dashboard-page {
          min-height: 100vh;
        }
        
        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 16px;
        }
        
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }
        
        .stat-card {
          background: var(--color-bg-card);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-xl);
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          transition: all 0.2s;
        }
        
        .stat-card:hover {
          border-color: var(--color-primary-muted);
          transform: translateY(-2px);
        }
        
        .stat-icon {
          width: 48px;
          height: 48px;
          border-radius: var(--radius-lg);
          background: var(--color-primary-muted);
          color: var(--color-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        
        .stat-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        
        .stat-value {
          font-size: 24px;
          font-weight: 700;
          color: var(--color-text);
          white-space: nowrap;
        }
        
        .stat-label {
          font-size: 14px;
          color: var(--color-text-muted);
        }
        
        .stat-change {
          font-size: 14px;
          font-weight: 500;
          color: var(--color-success);
          padding: 4px 8px;
          background: var(--color-success-muted);
          border-radius: var(--radius-full);
          white-space: nowrap;
        }
        
        .dashboard-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 24px;
        }
        
        .dashboard-column {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        
        .card {
          background: var(--color-bg-card);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-xl);
          padding: 24px;
        }
        
        .card h3 {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
        }
        
        .feed-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
          border-bottom: 1px solid var(--color-border);
          padding-bottom: 12px;
        }
        
        .feed-tab {
          padding: 8px 16px;
          background: transparent;
          color: var(--color-text-muted);
          border-radius: var(--radius-lg);
          font-weight: 500;
          transition: all 0.2s;
          border: none;
          cursor: pointer;
        }
        
        .feed-tab:hover {
          background: var(--color-white-10);
          color: var(--color-text);
        }
        
        .feed-tab.active {
          background: var(--color-primary-muted);
          color: var(--color-primary);
        }
        
        .feed-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .feed-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: var(--color-bg-elevated);
          border-radius: var(--radius-lg);
          cursor: pointer;
          transition: all 0.2s;
          text-decoration: none;
        }
        
        .feed-item:hover {
          background: var(--color-primary-muted);
        }
        
        .feed-item-avatar {
          width: 40px;
          height: 40px;
          border-radius: var(--radius-full);
          background: linear-gradient(135deg, var(--color-primary), var(--color-gold));
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          color: white;
          flex-shrink: 0;
        }
        
        .feed-item-icon {
          width: 40px;
          height: 40px;
          border-radius: var(--radius-full);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        
        .feed-item-icon.trending {
          background: var(--color-success-muted);
          color: var(--color-success);
        }
        
        .feed-item-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }
        
        .feed-item-title {
          font-weight: 500;
          color: var(--color-text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .feed-item-meta {
          font-size: 12px;
          color: var(--color-text-muted);
        }
        
        .empty-feed {
          text-align: center;
          padding: 32px;
          color: var(--color-text-muted);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }
        
        .btn-small {
          padding: 8px 16px;
          font-size: 12px;
        }
        
        .activity-chart {
          margin-bottom: 16px;
        }
        
        .chart-bars {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          height: 120px;
          gap: 8px;
        }
        
        .chart-bar {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          height: 100%;
        }
        
        .chart-bar-fill {
          width: 100%;
          background: linear-gradient(180deg, var(--color-primary), var(--color-gold));
          border-radius: 4px 4px 0 0;
          margin-top: auto;
          transition: height 0.5s ease;
          min-height: 4px;
        }
        
        .chart-bar-label {
          font-size: 10px;
          color: var(--color-text-muted);
          margin-top: 8px;
        }
        
        .activity-summary {
          text-align: center;
          font-size: 14px;
          color: var(--color-text-muted);
          padding-top: 12px;
          border-top: 1px solid var(--color-border);
        }
        
        .achievements-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }
        
        .suggested-users {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .suggested-user {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px;
          background: var(--color-bg-elevated);
          border-radius: var(--radius-lg);
        }
        
        .user-avatar {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-full);
          background: linear-gradient(135deg, var(--color-primary), var(--color-gold));
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          color: white;
          font-size: 14px;
        }
        
        .user-info {
          flex: 1;
          display: flex;
          flex-direction: column;
        }
        
        .user-name {
          font-weight: 500;
          color: var(--color-text);
          font-size: 14px;
        }
        
        .user-conches {
          font-size: 12px;
          color: var(--color-text-muted);
        }
        
        /* Light theme support */
        [data-theme="light"] .suggested-user {
          background: var(--color-bg-input);
        }
        
        .achievement-badge {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 12px;
          background: var(--color-bg-elevated);
          border-radius: var(--radius-lg);
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
        }
        
        .achievement-badge:hover {
          transform: translateY(-2px);
        }
        
        .achievement-badge.locked {
          opacity: 0.4;
          filter: grayscale(1);
        }
        
        .badge-icon {
          font-size: 24px;
        }
        
        .badge-label {
          font-size: 11px;
          color: var(--color-text-muted);
        }
        
        .btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          border-radius: var(--radius-lg);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }
        
        .btn-secondary {
          background: var(--color-bg-card);
          border: 1px solid var(--color-border);
          color: var(--color-text);
        }
        
        .btn-secondary:hover:not(:disabled) {
          border-color: var(--color-primary);
        }
        
        .btn-secondary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .btn-primary {
          background: var(--color-primary);
          color: white;
        }
        
        .btn-primary:hover {
          background: var(--color-gold);
        }
        
        @media (max-width: 1024px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          
          .dashboard-grid {
            grid-template-columns: 1fr;
          }
        }
        
        @media (max-width: 768px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }
          
          .achievements-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          
          .dashboard-header {
            flex-direction: column;
            align-items: stretch;
          }
          
          .dashboard-header .btn {
            justify-content: center;
          }
          
          .stat-card {
            padding: 16px;
          }
          
          .stat-icon {
            width: 40px;
            height: 40px;
          }
          
          .stat-value {
            font-size: 20px;
          }
          
          .suggested-users {
            gap: 8px;
          }
          
          .suggested-user {
            padding: 6px;
          }
          
          .user-avatar {
            width: 32px;
            height: 32px;
          }
        }
        
        @media (max-width: 480px) {
          .dashboard-page {
            padding-top: 70px;
          }
          
          .section-title {
            font-size: 1.5rem;
          }
          
          .stats-grid {
            gap: 12px;
          }
          
          .stat-card {
            flex-direction: column;
            text-align: center;
          }
          
          .stat-icon {
            margin: 0 auto;
          }
          
          .achievements-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
          }
          
          .achievement-badge {
            padding: 8px;
          }
          
          .badge-icon {
            font-size: 18px;
          }
          
          .badge-label {
            font-size: 10px;
          }
        }
      `}</style>
    </div>
  )
}
