// CONCH Platform - Conch Feed Page

import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useConchStore } from '../lib/store'
import { fetchConches } from '../lib/api'
import { useSSE } from '../hooks/useSSE'
import { GridSkeleton } from '../components/Loader'
import type { Conch } from '../lib/types'
import { shortKey } from '../lib/wallet'

// AI Sparkle icon
const SparkleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <path d="M12 3v18"/>
    <path d="M3 12h18"/>
    <path d="m4.93 4.93 14.14 14.14"/>
    <path d="m19.07 4.93-14.14 14.14"/>
  </svg>
)

// Search icon
const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)

export default function ConchFeed() {
  const { conches, setConches, loading, setLoading, error, setError } = useConchStore()
  const [filter, setFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [eraFilter, setEraFilter] = useState<string>('')
  const [showRecommendations, setShowRecommendations] = useState(false)
  const [recommending, setRecommending] = useState(false)
  const [recommendedConches, setRecommendedConches] = useState<Conch[]>([])
  
  // Connect to SSE for real-time updates
  useSSE()

  useEffect(() => {
    const loadConches = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchConches(1, 50)
        setConches(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load conches')
      } finally {
        setLoading(false)
      }
    }
    loadConches()
  }, [setConches, setLoading, setError])

  // Handle AI recommendations
  const handleGetRecommendations = async () => {
    setRecommending(true)
    setShowRecommendations(true)
    
    // Simulate AI recommendation based on user's viewing history
    // In a real app, this would call an AI API
    setTimeout(() => {
      const shuffled = [...conches].sort(() => Math.random() - 0.5)
      setRecommendedConches(shuffled.slice(0, 3))
      setRecommending(false)
    }, 1500)
  }

  // Filter conches based on selected filter and search
  const filteredConches = useMemo(() => {
    let result = [...conches]
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(conch => 
        conch.intent?.toLowerCase().includes(query) ||
        conch.story?.toLowerCase().includes(query) ||
        conch.owner?.toLowerCase().includes(query) ||
        Object.keys(conch.state || {}).some(key => 
          String(conch.state[key]).toLowerCase().includes(query)
        )
      )
    }
    
    // Apply era filter
    if (eraFilter) {
      const era = parseInt(eraFilter)
      if (!isNaN(era)) {
        result = result.filter(conch => conch.era === era)
      }
    }
    
    // Apply sort filter
    switch (filter) {
      case 'recent':
        return result.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      case 'ancient':
        return result.sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
      case 'highest-era':
        return result.sort((a, b) => b.era - a.era)
      default:
        return result
    }
  }, [conches, filter, searchQuery, eraFilter])

  // Get unique eras for filter dropdown
  const uniqueEras = useMemo(() => {
    const eras = new Set(conches.map(c => c.era))
    return Array.from(eras).sort((a, b) => a - b)
  }, [conches])

  if (loading && conches.length === 0) {
    return (
      <div className="feed-page">
        <div className="container">
          <header className="feed-header">
            <h1>Conch Feed</h1>
            <p className="text-muted">Explore the living archive of Conches</p>
          </header>
          <GridSkeleton count={6} />
        </div>
      </div>
    )
  }

  return (
    <div className="feed-page">
      <div className="container">
        <header className="feed-header">
          <h1>Conch Feed</h1>
          <p className="text-muted">Explore the living archive of Conches</p>
        </header>

        {/* Search and Filters */}
        <div className="feed-controls">
          <div className="search-box">
            <SearchIcon />
            <input
              type="text"
              placeholder="Search Conches by intent, story, or owner..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
          
          <div className="filter-row">
            <div className="feed-filters">
              <button 
                className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                All
              </button>
              <button 
                className={`filter-btn ${filter === 'recent' ? 'active' : ''}`}
                onClick={() => setFilter('recent')}
              >
                Recent
              </button>
              <button 
                className={`filter-btn ${filter === 'ancient' ? 'active' : ''}`}
                onClick={() => setFilter('ancient')}
              >
                Ancient
              </button>
              <button 
                className={`filter-btn ${filter === 'highest-era' ? 'active' : ''}`}
                onClick={() => setFilter('highest-era')}
              >
                Highest Era
              </button>
            </div>
            
            {/* Era Filter */}
            <select 
              className="era-select"
              value={eraFilter}
              onChange={(e) => setEraFilter(e.target.value)}
              aria-label="Filter by era"
            >
              <option value="">All Eras</option>
              {uniqueEras.map(era => (
                <option key={era} value={era}>Era {era}</option>
              ))}
            </select>
            
            {/* AI Recommendation Button */}
            <button 
              className="btn btn-primary recommendation-btn"
              onClick={handleGetRecommendations}
              disabled={recommending}
            >
              <SparkleIcon />
              {recommending ? 'Analyzing...' : 'Get Personalized Recommendations'}
            </button>
          </div>
        </div>

        {/* Results count */}
        <div className="results-info">
          {searchQuery || eraFilter || filter !== 'all' ? (
            <span>{filteredConches.length} of {conches.length} Conches</span>
          ) : (
            <span>{conches.length} Conches</span>
          )}
        </div>

        {error && (
          <div className="error-state">
            <p>{error}</p>
            <button 
              className="btn btn-secondary"
              onClick={() => fetchConches(1, 50).then(setConches)}
            >
              Try Again
            </button>
          </div>
        )}

        {/* AI Recommendations Section */}
        {showRecommendations && (
          <div className="recommendations-section">
            <h3>
              <SparkleIcon /> Personalized For You
              {recommending && <span className="loading-dots">...</span>}
            </h3>
            {!recommending && recommendedConches.length > 0 && (
              <div className="recommendations-grid">
                {recommendedConches.map(conch => (
                  <Link key={conch.id} to={`/conch/${conch.id}`} className="recommendation-card">
                    <span className="rec-badge">✨ AI Pick</span>
                    <h4>{conch.intent || 'Untitled'}</h4>
                    <p>{conch.story?.slice(0, 80)}...</p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {!loading && filteredConches.length === 0 ? (
          <div className="empty-state">
            <p>No Conches found. Be the first to create one!</p>
            <Link to="/create" className="btn btn-primary">
              Create Conch
            </Link>
          </div>
        ) : (
          <div className="conch-grid">
            {filteredConches.map((conch, index) => (
              <motion.div
                key={conch.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Link to={`/conch/${conch.id}`} className="conch-card">
                  <div className="conch-card-header">
                    <span className="era-badge">Era {conch.era}</span>
                    <span className="owner" title={conch.owner}>
                      {conch.owner && conch.owner.length > 16 ? shortKey(conch.owner) : conch.owner}
                    </span>
                  </div>
                  <h3 className="conch-story">
                    {conch.intent || conch.story?.substring(0, 50) || 'Untitled'}
                  </h3>
                  <p className="conch-intent">
                    {conch.story && conch.story.length > 100 
                      ? conch.story.substring(0, 100) + '...'
                      : conch.story
                    }
                  </p>
                  <div className="conch-meta">
                    <span>Lineage: {conch.lineage?.length || 0}</span>
                    <span>Updated: {new Date(conch.updated_at).toLocaleDateString()}</span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
      
      <style>{`
        .feed-page {
          min-height: 100vh;
          padding-top: 80px;
        }
        
        .feed-header {
          margin-bottom: 32px;
        }
        
        .feed-header h1 {
          font-size: 2.5rem;
          margin-bottom: 8px;
        }
        
        .feed-controls {
          margin-bottom: 24px;
        }
        
        .search-box {
          position: relative;
          margin-bottom: 16px;
        }
        
        .search-box svg {
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--color-text-muted);
        }
        
        .search-box .search-input {
          width: 100%;
          padding: 14px 16px 14px 48px;
          background: var(--color-bg-card);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          color: var(--color-text);
          font-size: 15px;
          transition: all 0.2s;
        }
        
        .search-box .search-input:focus {
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px var(--color-primary-muted);
          outline: none;
        }
        
        .search-box .search-input::placeholder {
          color: var(--color-text-muted);
        }
        
        .filter-row {
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
        }
        
        .feed-filters {
          display: flex;
          gap: 12px;
        }
        
        .filter-btn {
          padding: 10px 20px;
          background: var(--color-bg-card);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          color: var(--color-text-muted);
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .filter-btn:hover {
          border-color: var(--color-primary-muted);
          color: var(--color-text);
        }
        
        .filter-btn.active {
          background: var(--color-primary-muted);
          border-color: var(--color-primary);
          color: var(--color-primary);
        }
        
        /* Light theme filter button fix - More visible in light mode */
        [data-theme="light"] .filter-btn {
          background: #FFFFFF;
          border-color: rgba(0, 0, 0, 0.15);
          color: #666666;
        }
        
        [data-theme="light"] .filter-btn:hover {
          background: rgba(255, 111, 97, 0.1);
          border-color: rgba(255, 111, 97, 0.4);
          color: #E85A4A;
        }
        
        [data-theme="light"] .filter-btn.active {
          background: linear-gradient(135deg, #FF6F61, #FF8A7D);
          border-color: #FF6F61;
          color: #FFFFFF;
        }
        
        /* Light theme recommendation button - More visible */
        [data-theme="light"] .recommendation-btn {
          background: linear-gradient(135deg, #E85A4A, #FF6F61) !important;
          color: #FFFFFF !important;
          box-shadow: 0 4px 15px rgba(255, 111, 97, 0.4) !important;
          border: none !important;
        }
        
        [data-theme="light"] .recommendation-btn:hover {
          box-shadow: 0 6px 20px rgba(255, 111, 97, 0.5) !important;
          transform: translateY(-2px);
        }
        
        .era-select {
          padding: 10px 16px;
          background: var(--color-bg-card);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          color: var(--color-text);
          font-size: 14px;
          cursor: pointer;
        }
        
        .recommendation-btn {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        [data-theme="light"] .recommendation-btn {
          background: linear-gradient(135deg, #E85A4A, #FF6F61);
          color: white;
        }
        
        .results-info {
          margin-bottom: 20px;
          color: var(--color-text-muted);
          font-size: 14px;
        }
        
        .recommendations-section {
          margin-bottom: 32px;
          padding: 24px;
          background: linear-gradient(135deg, rgba(255, 111, 97, 0.1), rgba(212, 175, 55, 0.1));
          border: 1px solid var(--color-gold-muted);
          border-radius: var(--radius-xl);
        }
        
        .recommendations-section h3 {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--color-gold);
          margin-bottom: 16px;
        }
        
        .loading-dots {
          color: var(--color-primary);
        }
        
        .recommendations-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 16px;
        }
        
        .recommendation-card {
          position: relative;
          padding: 20px;
          background: var(--color-bg-card);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          text-decoration: none;
          transition: all 0.2s;
        }
        
        .recommendation-card:hover {
          border-color: var(--color-gold);
          transform: translateY(-2px);
        }
        
        .rec-badge {
          position: absolute;
          top: -8px;
          right: 12px;
          padding: 4px 10px;
          background: linear-gradient(135deg, var(--color-gold), var(--color-gold-light));
          color: var(--color-black);
          font-size: 11px;
          font-weight: 600;
          border-radius: var(--radius-full);
        }
        
        .recommendation-card h4 {
          color: var(--color-text);
          margin-bottom: 8px;
        }
        
        .recommendation-card p {
          color: var(--color-text-muted);
          font-size: 13px;
        }
        
        .conch-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 24px;
        }
        
        .conch-card {
          display: block;
          background: var(--color-bg-card);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-xl);
          padding: 24px;
          text-decoration: none;
          transition: all 0.3s ease;
        }
        
        .conch-card:hover {
          border-color: var(--color-primary);
          transform: translateY(-4px);
          box-shadow: 0 8px 30px rgba(212, 175, 55, 0.15);
        }
        
        .conch-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        
        .era-badge {
          padding: 4px 12px;
          background: var(--color-primary-muted);
          color: var(--color-primary);
          border-radius: var(--radius-full);
          font-size: 12px;
          font-weight: 600;
        }
        
        /* Light theme era badge */
        [data-theme="light"] .era-badge {
          background: rgba(255, 111, 97, 0.15);
          color: #E85A4A;
        }
        
        .owner {
          color: var(--color-text-muted);
          font-size: 13px;
          font-family: monospace;
          max-width: 140px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        .conch-story {
          font-size: 1.25rem;
          color: var(--color-text);
          margin-bottom: 8px;
          line-height: 1.4;
        }
        
        .conch-intent {
          color: var(--color-text-muted);
          font-size: 14px;
          line-height: 1.6;
          margin-bottom: 16px;
        }
        
        .conch-meta {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: var(--color-text-muted);
          padding-top: 16px;
          border-top: 1px solid var(--color-border);
        }
        
        .empty-state {
          text-align: center;
          padding: 60px 20px;
          background: var(--color-bg-card);
          border: 1px dashed var(--color-border);
          border-radius: var(--radius-xl);
        }
        
        .empty-state p {
          color: var(--color-text-muted);
          margin-bottom: 20px;
        }
        
        .error-state {
          text-align: center;
          padding: 40px 20px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: var(--radius-xl);
          margin-bottom: 24px;
        }
        
        .error-state p {
          color: #ef4444;
          margin-bottom: 16px;
        }
        
        @media (max-width: 768px) {
          .feed-header h1 {
            font-size: 1.75rem;
          }
          
          .conch-grid {
            grid-template-columns: 1fr;
          }
          
          .feed-filters {
            flex-wrap: wrap;
          }
          
          .filter-btn {
            flex: 1;
            min-width: 80px;
            text-align: center;
          }
          
          .filter-row {
            flex-direction: column;
            align-items: stretch;
          }
          
          .recommendation-btn {
            justify-content: center;
          }
          
          .recommendations-grid {
            grid-template-columns: 1fr;
          }
          
          .era-select {
            width: 100%;
          }
        }
        
        @media (max-width: 480px) {
          .feed-page {
            padding-top: 70px;
          }
          
          .feed-header h1 {
            font-size: 1.5rem;
          }
          
          .search-box .search-input {
            font-size: 14px;
            padding: 12px 16px 12px 44px;
          }
          
          .filter-btn {
            padding: 8px 12px;
            font-size: 13px;
          }
          
          .conch-card {
            padding: 16px;
          }
          
          .conch-story {
            font-size: 1.1rem;
          }
          
          .era-badge {
            padding: 3px 8px;
            font-size: 11px;
          }
        }
      `}</style>
    </div>
  )
}
