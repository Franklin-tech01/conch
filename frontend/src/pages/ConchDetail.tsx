// CONCH Platform - Conch Detail Page

import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fetchConch, fetchLineage, fetchNeighborhood } from '../lib/api'
import { useSSE } from '../hooks/useSSE'
import Loader from '../components/Loader'
import type { Conch } from '../lib/types'
import { shortKey } from '../lib/wallet'

export default function ConchDetail() {
  const { id } = useParams<{ id: string }>()
  const [conch, setConch] = useState<Conch | null>(null)
  const [lineage, setLineage] = useState<Conch[]>([])
  const [neighbors, setNeighbors] = useState<Conch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'story' | 'lineage' | 'neighbors' | 'history'>('story')
  
  // Mock version history (in real app, this would come from backend)
  const versionHistory = [
    { version: 3, date: new Date(conch?.updated_at || Date.now()).toLocaleDateString(), changes: 'Updated intent and story' },
    { version: 2, date: new Date(Date.now() - 86400000).toLocaleDateString(), changes: 'Added new state fields' },
    { version: 1, date: new Date(Date.now() - 172800000).toLocaleDateString(), changes: 'Initial creation' },
  ]

  // Connect to SSE for real-time updates
  useSSE()

  useEffect(() => {
    const loadData = async () => {
      if (!id) return
      setLoading(true)
      setError(null)
      try {
        const [conchData, lineageData, neighborsData] = await Promise.all([
          fetchConch(id),
          fetchLineage(id),
          fetchNeighborhood(id)
        ])
        setConch(conchData)
        setLineage(lineageData || [])
        setNeighbors(neighborsData || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load conch')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [id])

  if (loading) {
    return (
      <div className="detail-page">
        <div className="container">
          <Loader fullPage message="Loading Conch..." />
        </div>
      </div>
    )
  }

  if (error || !conch) {
    return (
      <div className="detail-page">
        <div className="container">
          <div className="error-container">
            <h2>Conch Not Found</h2>
            <p>{error || 'The requested conch could not be found.'}</p>
            <Link to="/feed" className="btn btn-primary">
              Back to Feed
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="detail-page">
      <div className="container">
        <header className="detail-header">
          <Link to="/feed" className="back-link">← Back to Feed</Link>
          <div className="conch-header-content">
            <span className="era-badge large">Era {conch.era}</span>
            <h1>{conch.intent || 'Untitled Conch'}</h1>
            <p className="owner" title={conch.owner}>
              by {conch.owner && conch.owner.length > 16 ? shortKey(conch.owner) : conch.owner}
            </p>
          </div>
        </header>

        <div className="detail-tabs">
          <button 
            className={`tab ${activeTab === 'story' ? 'active' : ''}`}
            onClick={() => setActiveTab('story')}
          >
            Story
          </button>
          <button 
            className={`tab ${activeTab === 'lineage' ? 'active' : ''}`}
            onClick={() => setActiveTab('lineage')}
          >
            Lineage ({lineage.length})
          </button>
          <button 
            className={`tab ${activeTab === 'neighbors' ? 'active' : ''}`}
            onClick={() => setActiveTab('neighbors')}
          >
            Connected ({neighbors.length})
          </button>
          <button 
            className={`tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            Version History
          </button>
        </div>

        <div className="detail-content">
          {activeTab === 'story' && (
            <div className="story-content">
              <p className="story-text">{conch.story}</p>
              <div className="metadata">
                <div className="meta-item">
                  <span className="meta-label">Signature</span>
                  <span className="meta-value">{conch.signature?.substring(0, 16) || 'N/A'}...</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Created</span>
                  <span className="meta-value">{new Date(conch.created_at).toLocaleString()}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Updated</span>
                  <span className="meta-value">{new Date(conch.updated_at).toLocaleString()}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Lineage Count</span>
                  <span className="meta-value">{conch.lineage?.length || 0}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'lineage' && (
            <div className="lineage-list">
              {lineage.length === 0 ? (
                <div className="empty-section">
                  <p>No lineage ancestors</p>
                </div>
              ) : (
                lineage.map(ancestor => (
                  <Link key={ancestor.id} to={`/conch/${ancestor.id}`} className="lineage-item">
                    <span className="era-badge">Era {ancestor.era}</span>
                    <div className="lineage-content">
                      <h4>{ancestor.intent || 'Untitled'}</h4>
                      <p>{ancestor.story?.substring(0, 50) || 'No description'}...</p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          )}

          {activeTab === 'neighbors' && (
            <div className="neighbors-grid">
              {neighbors.length === 0 ? (
                <div className="empty-section">
                  <p>No connected Conches</p>
                </div>
              ) : (
                neighbors.map(neighbor => (
                  <Link key={neighbor.id} to={`/conch/${neighbor.id}`} className="neighbor-card">
                    <span className="era-badge">Era {neighbor.era}</span>
                    <h4>{neighbor.intent || 'Untitled'}</h4>
                    <p>{neighbor.story?.substring(0, 80) || 'No description'}...</p>
                  </Link>
                ))
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="version-history">
              <div className="history-header">
                <p className="history-note">View and restore previous versions of this Conch</p>
              </div>
              <div className="history-timeline">
                {versionHistory.map((version, index) => (
                  <div key={version.version} className={`history-item ${index === 0 ? 'current' : ''}`}>
                    <div className="history-marker">
                      <div className="marker-dot"></div>
                      {index < versionHistory.length - 1 && <div className="marker-line"></div>}
                    </div>
                    <div className="history-content">
                      <div className="history-header-row">
                        <span className="version-number">Version {version.version}</span>
                        {index === 0 && <span className="current-badge">Current</span>}
                        <span className="version-date">{version.date}</span>
                      </div>
                      <p className="version-changes">{version.changes}</p>
                      {index > 0 && (
                        <button className="btn btn-small btn-secondary restore-btn">
                          Restore this version
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      
      <style>{`
        .detail-page {
          min-height: 100vh;
          padding-top: 80px;
          padding-bottom: 60px;
        }
        
        .detail-header {
          margin-bottom: 32px;
        }
        
        .back-link {
          display: inline-block;
          color: var(--color-primary);
          text-decoration: none;
          margin-bottom: 16px;
          font-size: 14px;
          transition: color 0.2s;
        }
        
        .back-link:hover {
          color: var(--color-gold);
        }
        
        .conch-header-content {
          padding: 24px;
          background: var(--color-bg-card);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-xl);
        }
        
        .conch-header-content h1 {
          font-size: 2rem;
          margin: 16px 0 8px;
        }
        
        .conch-header-content .owner {
          color: var(--color-text-muted);
          font-family: monospace;
          font-size: 13px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 100%;
        }
        
        .detail-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 24px;
          border-bottom: 1px solid var(--color-border);
          padding-bottom: 12px;
          overflow-x: auto;
        }
        
        .tab {
          padding: 12px 24px;
          background: transparent;
          border: none;
          color: var(--color-text-muted);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          border-radius: var(--radius-lg);
          transition: all 0.2s;
          white-space: nowrap;
        }
        
        .tab:hover {
          background: var(--color-white-10);
          color: var(--color-text);
        }
        
        .tab.active {
          background: var(--color-primary-muted);
          color: var(--color-primary);
        }
        
        .detail-content {
          background: var(--color-bg-card);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-xl);
          padding: 32px;
        }
        
        .story-text {
          font-size: 1.125rem;
          line-height: 1.8;
          color: var(--color-text);
          margin-bottom: 32px;
        }
        
        .metadata {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          padding-top: 24px;
          border-top: 1px solid var(--color-border);
        }
        
        .meta-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        
        .meta-label {
          font-size: 12px;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .meta-value {
          font-size: 14px;
          color: var(--color-text);
          font-family: monospace;
        }
        
        .lineage-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .lineage-item {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          background: var(--color-bg-elevated);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          text-decoration: none;
          transition: all 0.2s;
        }
        
        .lineage-item:hover {
          border-color: var(--color-primary);
        }
        
        .lineage-content h4 {
          color: var(--color-text);
          margin-bottom: 4px;
        }
        
        .lineage-content p {
          color: var(--color-text-muted);
          font-size: 14px;
        }
        
        .neighbors-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }
        
        .neighbor-card {
          padding: 20px;
          background: var(--color-bg-elevated);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          text-decoration: none;
          transition: all 0.2s;
        }
        
        .neighbor-card:hover {
          border-color: var(--color-primary);
          transform: translateY(-2px);
        }
        
        .neighbor-card h4 {
          color: var(--color-text);
          margin: 12px 0 8px;
        }
        
        .neighbor-card p {
          color: var(--color-text-muted);
          font-size: 14px;
          line-height: 1.5;
        }
        
        /* Version History Styles */
        .version-history {
          padding: 20px 0;
        }
        
        .history-header {
          margin-bottom: 24px;
        }
        
        .history-note {
          color: var(--color-text-muted);
          font-size: 14px;
        }
        
        .history-timeline {
          display: flex;
          flex-direction: column;
        }
        
        .history-item {
          display: flex;
          gap: 16px;
          padding-bottom: 24px;
        }
        
        .history-marker {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 20px;
        }
        
        .marker-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: var(--color-primary-muted);
          border: 2px solid var(--color-primary);
        }
        
        .history-item.current .marker-dot {
          background: var(--color-primary);
          box-shadow: 0 0 10px var(--color-primary);
        }
        
        .marker-line {
          width: 2px;
          flex: 1;
          background: var(--color-border);
          margin-top: 8px;
        }
        
        .history-content {
          flex: 1;
          background: var(--color-bg-elevated);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 16px;
        }
        
        .history-header-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
        }
        
        .version-number {
          font-weight: 600;
          color: var(--color-gold);
        }
        
        .current-badge {
          padding: 2px 8px;
          background: var(--color-success-muted);
          color: var(--color-success);
          border-radius: var(--radius-full);
          font-size: 11px;
          font-weight: 500;
        }
        
        .version-date {
          color: var(--color-text-muted);
          font-size: 13px;
          margin-left: auto;
        }
        
        .version-changes {
          color: var(--color-text-muted);
          font-size: 14px;
        }
        
        .restore-btn {
          margin-top: 12px;
        }
        
        /* Light theme support */
        [data-theme="light"] .history-content {
          background: var(--color-bg-input);
        }
        
        .empty-section {
          text-align: center;
          padding: 40px;
          color: var(--color-text-muted);
        }
        
        .error-container {
          text-align: center;
          padding: 60px 20px;
        }
        
        .error-container h2 {
          margin-bottom: 16px;
        }
        
        .error-container p {
          color: var(--color-text-muted);
          margin-bottom: 24px;
        }
        
        @media (max-width: 768px) {
          .conch-header-content h1 {
            font-size: 1.5rem;
          }
          
          .detail-content {
            padding: 20px;
          }
          
          .metadata {
            grid-template-columns: 1fr;
          }
          
          .neighbors-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}
