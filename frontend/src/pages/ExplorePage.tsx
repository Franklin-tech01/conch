// CONCH Platform - Explore Page with Advanced Filtering

import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { fetchConches } from '../lib/api'
import { useSSE } from '../hooks/useSSE'
import { GridSkeleton } from '../components/Loader'
import type { Conch } from '../lib/types'
import { shortKey } from '../lib/wallet'

// Icons
const FilterIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
  </svg>
)

const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)

const GridIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <rect x="3" y="3" width="7" height="7"/>
    <rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/>
    <rect x="3" y="14" width="7" height="7"/>
  </svg>
)

const ListIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <line x1="8" y1="6" x2="21" y2="6"/>
    <line x1="8" y1="12" x2="21" y2="12"/>
    <line x1="8" y1="18" x2="21" y2="18"/>
    <line x1="3" y1="6" x2="3.01" y2="6"/>
    <line x1="3" y1="12" x2="3.01" y2="12"/>
    <line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
)

const CalendarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)

type SortOption = 'newest' | 'oldest' | 'era-high' | 'era-low' | 'relevance' | 'popularity'
type ViewMode = 'grid' | 'list'

export default function ExplorePage() {
  const [conches, setConches] = useState<Conch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [page, setPage] = useState(1)
  
  // Filter states
  const [filters, setFilters] = useState({
    state: '',
    era: '',
    author: '',
    dateFrom: '',
    dateTo: ''
  })

  // Connect to SSE for real-time updates
  useSSE()

  // Fetch conches from API
  useEffect(() => {
    const loadConches = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchConches(page, 50)
        setConches(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load conches')
      } finally {
        setLoading(false)
      }
    }
    loadConches()
  }, [page])

  // Filter and sort conches
  const filteredConches = useMemo(() => {
    let result = [...conches]
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(c => 
        c.intent?.toLowerCase().includes(query) ||
        c.story?.toLowerCase().includes(query) ||
        c.owner?.toLowerCase().includes(query)
      )
    }
    
    // State filter
    if (filters.state) {
      result = result.filter(c => c.state?.type === filters.state)
    }
    
    // Era filter
    if (filters.era) {
      const eraRange = filters.era.split('-')
      if (eraRange[1] === '+') {
        result = result.filter(c => c.era >= parseInt(eraRange[0]))
      } else {
        const [min, max] = eraRange.map(Number)
        result = result.filter(c => c.era >= min && c.era <= max)
      }
    }
    
    // Author filter
    if (filters.author) {
      result = result.filter(c => 
        c.owner?.toLowerCase().includes(filters.author.toLowerCase())
      )
    }
    
    // Date filters
    if (filters.dateFrom) {
      result = result.filter(c => 
        new Date(c.created_at) >= new Date(filters.dateFrom)
      )
    }
    if (filters.dateTo) {
      result = result.filter(c => 
        new Date(c.created_at) <= new Date(filters.dateTo)
      )
    }
    
    // Sort
    switch (sortBy) {
      case 'newest':
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        break
      case 'oldest':
        result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        break
      case 'era-high':
        result.sort((a, b) => b.era - a.era)
        break
      case 'era-low':
        result.sort((a, b) => a.era - b.era)
        break
    }
    
    return result
  }, [conches, searchQuery, filters, sortBy])

  return (
    <div className="explore-page">
      <div className="container" style={{ paddingTop: '100px', paddingBottom: '40px' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="section-title">Explore</h1>
          
          {/* Search Bar */}
          <div className="explore-search">
            <div className="search-input-wrapper">
              <SearchIcon />
              <input
                type="text"
                className="explore-search-input"
                placeholder="Search Conches..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button 
              className={`btn btn-secondary ${showFilters ? 'active' : ''}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <FilterIcon />
              Filters
              {(filters.state || filters.era || filters.author) && (
                <span className="filter-count">
                  {[filters.state, filters.era, filters.author].filter(Boolean).length}
                </span>
              )}
            </button>
          </div>
          
          {/* Advanced Filters Panel */}
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="filters-panel"
            >
              <div className="filters-grid">
                <div className="filter-group">
                  <label className="filter-label">State</label>
                  <select 
                    className="select"
                    value={filters.state}
                    onChange={(e) => setFilters(prev => ({ ...prev, state: e.target.value }))}
                  >
                    <option value="">All States</option>
                    <option value="memory">Memory</option>
                    <option value="knowledge">Knowledge</option>
                    <option value="wisdom">Wisdom</option>
                    <option value="artifact">Artifact</option>
                  </select>
                </div>
                
                <div className="filter-group">
                  <label className="filter-label">Era</label>
                  <select 
                    className="select"
                    value={filters.era}
                    onChange={(e) => setFilters(prev => ({ ...prev, era: e.target.value }))}
                  >
                    <option value="">All Eras</option>
                    <option value="1-5">Era 1-5</option>
                    <option value="6-10">Era 6-10</option>
                    <option value="11-15">Era 11-15</option>
                    <option value="16+">Era 16+</option>
                  </select>
                </div>
                
                <div className="filter-group">
                  <label className="filter-label">Author</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Search by author"
                    value={filters.author}
                    onChange={(e) => setFilters(prev => ({ ...prev, author: e.target.value }))}
                  />
                </div>
                
                <div className="filter-group">
                  <label className="filter-label">Date Range</label>
                  <div className="date-range">
                    <div className="date-input">
                      <CalendarIcon />
                      <input
                        type="date"
                        className="input"
                        value={filters.dateFrom}
                        onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                      />
                    </div>
                    <span className="date-separator">to</span>
                    <div className="date-input">
                      <CalendarIcon />
                      <input
                        type="date"
                        className="input"
                        value={filters.dateTo}
                        onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="filter-actions">
                <button 
                  className="btn btn-ghost"
                  onClick={() => setFilters({ state: '', era: '', author: '', dateFrom: '', dateTo: '' })}
                >
                  Clear All
                </button>
                <button 
                  className="btn btn-primary"
                  onClick={() => setShowFilters(false)}
                >
                  Apply Filters
                </button>
              </div>
            </motion.div>
          )}
          
          {/* Sort and View Controls */}
          <div className="explore-controls">
            <div className="sort-options">
              <span className="sort-label">Sort by:</span>
              {([
                { value: 'newest', label: 'Newest' },
                { value: 'oldest', label: 'Oldest' },
                { value: 'popularity', label: 'Popularity' },
                { value: 'era-high', label: 'Era (High)' },
                { value: 'era-low', label: 'Era (Low)' }
              ] as { value: SortOption; label: string }[]).map(option => (
                <button
                  key={option.value}
                  className={`sort-btn ${sortBy === option.value ? 'active' : ''}`}
                  onClick={() => setSortBy(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            
            <div className="view-toggle">
              <button
                className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                aria-label="Grid view"
              >
                <GridIcon />
              </button>
              <button
                className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                aria-label="List view"
              >
                <ListIcon />
              </button>
            </div>
          </div>
          
          {/* Results */}
          {loading && conches.length === 0 ? (
            <GridSkeleton count={6} />
          ) : error ? (
            <div className="error-state">
              <p>{error}</p>
              <button 
                className="btn btn-secondary"
                onClick={() => fetchConches(page, 50).then(setConches)}
              >
                Try Again
              </button>
            </div>
          ) : filteredConches.length === 0 ? (
            <div className="empty-state">
              <p>No Conches found matching your criteria.</p>
              <Link to="/create" className="btn btn-primary">
                Create a Conch
              </Link>
            </div>
          ) : (
            <div className={`explore-results ${viewMode}`}>
              {filteredConches.map((conch, index) => (
                <motion.div
                  key={conch.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`conch-card ${viewMode}`}
                >
                  <Link to={`/conch/${conch.id}`} className="conch-card-link">
                    <div className="conch-card-header">
                      <h3 className="conch-title">{conch.intent || 'Untitled'}</h3>
                      <span className="conch-era">Era {conch.era}</span>
                    </div>
                    <p className="conch-story">{conch.story?.substring(0, 120) || 'No description'}...</p>
                    <div className="conch-footer">
                      <span className="conch-author" title={conch.owner}>
                        by {conch.owner && conch.owner.length > 16 ? shortKey(conch.owner) : conch.owner}
                      </span>
                      <span className="conch-date">{new Date(conch.created_at).toLocaleDateString()}</span>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
          
          {/* Pagination */}
          {filteredConches.length > 0 && (
            <div className="pagination">
              <button 
                className="page-btn" 
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                ← Previous
              </button>
              <button className="page-btn active">{page}</button>
              <button 
                className="page-btn"
                disabled={filteredConches.length < 50}
                onClick={() => setPage(p => p + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </motion.div>
      </div>
      
      <style>{`
        .explore-page { min-height: 100vh; padding-top: 80px; }
        .explore-search { display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
        .search-input-wrapper { flex: 1; position: relative; display: flex; align-items: center; min-width: 200px; }
        .search-input-wrapper svg { position: absolute; left: 16px; color: var(--color-text-muted); }
        .explore-search-input { width: 100%; padding: 14px 16px 14px 48px; background: var(--color-bg-card); border: 1px solid var(--color-border); border-radius: var(--radius-xl); color: var(--color-text); font-size: 16px; transition: all 0.2s; }
        .explore-search-input:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-muted); outline: none; }
        .explore-search-input::placeholder { color: var(--color-text-muted); }
        .filter-count { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; background: var(--color-primary); color: white; border-radius: 50%; font-size: 12px; margin-left: 4px; }
        .filters-panel { background: var(--color-bg-card); border: 1px solid var(--color-border); border-radius: var(--radius-xl); padding: 24px; margin-bottom: 24px; }
        .filters-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 20px; }
        .filter-group { display: flex; flex-direction: column; gap: 8px; }
        .filter-label { font-size: 14px; font-weight: 500; color: var(--color-text-muted); }
        .date-range { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .date-input { display: flex; align-items: center; gap: 4px; flex: 1; min-width: 120px; }
        .date-input svg { color: var(--color-text-muted); flex-shrink: 0; }
        .date-separator { color: var(--color-text-muted); font-size: 14px; }
        .filter-actions { display: flex; justify-content: flex-end; gap: 12px; padding-top: 16px; border-top: 1px solid var(--color-border); }
        .explore-controls { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px; }
        .sort-options { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .sort-label { color: var(--color-text-muted); margin-right: 8px; }
        .sort-btn { padding: 8px 16px; background: transparent; color: var(--color-text-muted); border-radius: var(--radius-lg); font-size: 14px; cursor: pointer; transition: all 0.2s; border: none; }
        .sort-btn:hover { background: var(--color-white-10); }
        .sort-btn.active { background: var(--color-primary-muted); color: var(--color-primary); }
        
        /* Light theme for explore page */
        [data-theme="light"] .sort-btn { background: #FFFFFF; color: #666; border: 1px solid rgba(0,0,0,0.1); }
        [data-theme="light"] .sort-btn:hover { background: rgba(255,111,97,0.1); border-color: rgba(255,111,97,0.3); }
        [data-theme="light"] .sort-btn.active { background: linear-gradient(135deg, #FF6F61, #FF8A7D); color: white; border-color: #FF6F61; }
        [data-theme="light"] .view-toggle { background: #FFFFFF; border-color: rgba(0,0,0,0.1); }
        [data-theme="light"] .view-btn { color: #666; }
        [data-theme="light"] .view-btn:hover { color: #E85A4A; }
        [data-theme="light"] .view-btn.active { background: rgba(255,111,97,0.15); color: #E85A4A; }
        [data-theme="light"] .explore-search-input { background: #FFFFFF; border-color: rgba(0,0,0,0.15); color: #1A1A1A; }
        [data-theme="light"] .conch-card { background: #FFFFFF; border-color: rgba(0,0,0,0.1); }
        [data-theme="light"] .conch-card:hover { border-color: #FF6F61; }
        [data-theme="light"] .filters-panel { background: #FFFFFF; border-color: rgba(0,0,0,0.1); }
        [data-theme="light"] .filter-label { color: #666; }
        [data-theme="light"] .sort-label { color: #666; }
        .view-toggle { display: flex; gap: 4px; background: var(--color-bg-card); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 4px; }
        .view-btn { padding: 8px; background: transparent; border: none; border-radius: var(--radius-md); color: var(--color-text-muted); cursor: pointer; transition: all 0.2s; }
        .view-btn:hover { color: var(--color-text); }
        .view-btn.active { background: var(--color-primary-muted); color: var(--color-primary); }
        .explore-results { display: grid; gap: 20px; }
        .explore-results.grid { grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); }
        .explore-results.list { grid-template-columns: 1fr; }
        .conch-card { background: var(--color-bg-card); border: 1px solid var(--color-border); border-radius: var(--radius-xl); padding: 24px; transition: all 0.3s ease; }
        .conch-card:hover { border-color: var(--color-primary); transform: translateY(-4px); box-shadow: 0 8px 30px rgba(212, 175, 55, 0.15); }
        .conch-card-link { text-decoration: none; color: inherit; }
        .conch-card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; gap: 12px; }
        .conch-title { font-size: 1.125rem; color: var(--color-text); margin: 0; flex: 1; }
        .conch-era { padding: 4px 12px; background: var(--color-primary-muted); color: var(--color-primary); border-radius: var(--radius-full); font-size: 12px; font-weight: 600; white-space: nowrap; }
        .conch-story { color: var(--color-text-muted); font-size: 14px; line-height: 1.6; margin-bottom: 16px; }
        .conch-footer { display: flex; justify-content: space-between; font-size: 12px; color: var(--color-text-muted); padding-top: 16px; border-top: 1px solid var(--color-border); }
        .conch-author { font-weight: 500; }
        .pagination { display: flex; justify-content: center; gap: 8px; margin-top: 32px; }
        .page-btn { padding: 10px 16px; background: var(--color-bg-card); border: 1px solid var(--color-border); border-radius: var(--radius-lg); color: var(--color-text-muted); font-size: 14px; cursor: pointer; transition: all 0.2s; }
        .page-btn:hover:not(:disabled) { border-color: var(--color-primary); color: var(--color-text); }
        .page-btn.active { background: var(--color-primary-muted); border-color: var(--color-primary); color: var(--color-primary); }
        .page-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .empty-state, .error-state { text-align: center; padding: 60px 20px; background: var(--color-bg-card); border: 1px dashed var(--color-border); border-radius: var(--radius-xl); }
        .error-state { border-color: rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.05); }
        .error-state p { color: #ef4444; margin-bottom: 20px; }
        .btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: var(--radius-lg); font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s; border: none; text-decoration: none; }
        .btn-primary { background: var(--color-primary); color: white; }
        .btn-primary:hover { background: var(--color-gold); }
        .btn-secondary { background: var(--color-bg-card); border: 1px solid var(--color-border); color: var(--color-text); }
        .btn-secondary:hover, .btn-secondary.active { border-color: var(--color-primary); }
        .btn-ghost { background: transparent; color: var(--color-text-muted); }
        .btn-ghost:hover { color: var(--color-text); }
        .select, .input { padding: 10px 14px; background: var(--color-bg-elevated); border: 1px solid var(--color-border); border-radius: var(--radius-lg); color: var(--color-text); font-size: 14px; }
        .select:focus, .input:focus { outline: none; border-color: var(--color-primary); }
        
        @media (max-width: 768px) {
          .explore-controls { flex-direction: column; align-items: stretch; }
          .sort-options { justify-content: center; }
          .view-toggle { align-self: flex-end; }
          .explore-results.grid { grid-template-columns: 1fr; }
          .filters-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  )
}
