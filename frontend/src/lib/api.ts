// CONCH Platform - API Client

import type {
  Conch,
  ConchGraph,
  CreateConchRequest,
  UpdateConchRequest,
  ConchLink,
  Notification,
  NotificationPreferences,
  Comment,
} from './types'
import { loadWallet } from './wallet'

const API_BASE = import.meta.env?.VITE_API_URL || '/api'

// Development mode flag
const IS_DEVELOPMENT = import.meta.env?.DEV || false

// Mock data for when backend is unavailable
const MOCK_CONCHES: Conch[] = [
  {
    id: '1',
    state: { title: 'Welcome to Conch', content: 'This is a sample conch. The backend is not deployed yet, but you can explore the interface!' },
    story: 'Welcome to Conch',
    lineage: [],
    intent: 'demo',
    era: 1,
    owner: 'demo-user',
    permissions: {
      owner: 'Admin',
      readers: [],
      writers: [],
      inheritors: []
    },
    signature: 'demo-signature',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
]

// Helper for making requests
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const wallet = loadWallet()

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(wallet && { 'X-Public-Key': wallet.publicKey }),
    ...options.headers,
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error(`API Error ${response.status}: ${endpoint} - ${errorText}`)
      
      // If backend is not available, fall back to mock data
      if (response.status === 404 || response.status >= 500) {
        console.log('[FALLBACK] Backend unavailable, using mock data')
        if (endpoint === '/conches' || endpoint.startsWith('/conches?')) {
          return MOCK_CONCHES as T
        }
      }
      
      throw new Error(`API Error: ${response.status} - ${response.statusText}`)
    }

    // Handle empty responses
    const text = await response.text()
    if (!text) {
      return null as T
    }

    try {
      const data = JSON.parse(text)
      
      // Handle our API response format: { success: boolean, data: T }
      if (data && typeof data === 'object' && 'success' in data) {
        if (!data.success) {
          throw new Error(data.error || 'Request failed')
        }
        return data.data as T
      }
      
      return data
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      throw new Error('Invalid response format')
    }
  } catch (networkError) {
    console.error('Network error:', networkError)
    
    // If it's a network error (backend down), fall back to mock data
    if (endpoint === '/conches' || endpoint.startsWith('/conches?')) {
      console.log('[FALLBACK] Network error, using mock data')
      return MOCK_CONCHES as T
    }
    
    throw networkError
  }
}

// Auth
export async function login(email: string, password: string): Promise<TokenResponse> {
  return request<TokenResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export async function register(username: string, email: string, password: string): Promise<TokenResponse> {
  return request<TokenResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password }),
  })
}

export function logout() {
  localStorage.removeItem('conch_token')
}

// Conches - the backend returns array directly
export async function fetchConches(page = 1, pageSize = 20): Promise<Conch[]> {
  try {
    // Backend returns: { success: true, data: Conch[] }
    const response = await request<Conch[]>(`/conches?page=${page}&page_size=${pageSize}`)
    return response || []
  } catch (error) {
    console.warn('Failed to fetch conches, using empty list:', error)
    return []
  }
}


export async function fetchConch(id: string): Promise<Conch | null> {
  try {
    return await request<Conch>(`/conches/${id}`)
  } catch (error) {
    console.warn(`Failed to fetch conch ${id}:`, error)
    return null
  }
}

export async function createConch(data: CreateConchRequest): Promise<Conch | null> {
  try {
    return await request<Conch>('/conches', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  } catch (error) {
    console.warn('Failed to create conch:', error)
    throw error
  }
}

export async function updateConch(id: string, data: UpdateConchRequest): Promise<Conch | null> {
  try {
    return await request<Conch>(`/conches/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  } catch (error) {
    console.warn(`Failed to update conch ${id}:`, error)
    throw error
  }
}

export async function deleteConch(id: string): Promise<boolean> {
  try {
    return await request<boolean>(`/conches/${id}`, {
      method: 'DELETE',
    })
  } catch (error) {
    console.warn(`Failed to delete conch ${id}:`, error)
    return false
  }
}

// Lineage - fetch links for a conch (backend uses /links endpoint)
export async function fetchLineage(id: string): Promise<Conch[]> {
  try {
    // Get linked conches via the links endpoint
    const links = await request<ConchLink[]>(`/conches/${id}/links`)
    if (!links || links.length === 0) return []
    
    // Fetch the actual conches that are linked
    const linkedConches: Conch[] = []
    for (const link of links) {
      const targetId = link.target_id || link.source_id
      const conch = await fetchConch(targetId)
      if (conch) linkedConches.push(conch)
    }
    return linkedConches
  } catch (error) {
    console.warn(`Failed to fetch lineage for ${id}:`, error)
    return []
  }
}

export async function fetchNeighborhood(id: string): Promise<Conch[]> {
  return fetchLineage(id) // Same as lineage in our backend
}

// Graph - get all conches with their links
export interface GraphFilters {
  author?: string
  sortBy?: 'created_at' | 'updated_at' | 'era'
  tags?: string[]
  state?: string
}

export async function fetchGraph(filters?: GraphFilters): Promise<ConchGraph> {
  try {
    let url = '/graph'
    const params = new URLSearchParams()
    
    if (filters) {
      if (filters.author) params.append('author', filters.author)
      if (filters.sortBy) params.append('sort', filters.sortBy)
      if (filters.tags?.length) params.append('tags', filters.tags.join(','))
      if (filters.state) params.append('state', filters.state)
    }
    
    if (params.toString()) {
      url += '?' + params.toString()
    }
    
    // Backend returns: { success: true, data: { conches: [], links: [] } }
    const response = await request<{ conches: Conch[], links: ConchLink[] }>(url)
    if (!response) return { nodes: [], edges: [] }
    
    return {
      nodes: response.conches || [],
      edges: (response.links || []).map(link => ({
        source: link.source_id,
        target: link.target_id,
        link_type: link.link_type || 'references'
      }))
    }
  } catch (error) {
    console.warn('Failed to fetch graph:', error)
    return { nodes: [], edges: [] }
  }
}

// Links - create links between conches
export async function linkConch(sourceId: string, targetId: string, linkType: string): Promise<ConchLink | null> {
  try {
    return await request<ConchLink>(`/conches/${sourceId}/links`, {
      method: 'POST',
      body: JSON.stringify({ target_id: targetId, link_type: linkType }),
    })
  } catch (error) {
    console.warn(`Failed to link conches:`, error)
    return null
  }
}

// Get links for a conch
export async function fetchLinks(conchId: string): Promise<ConchLink[]> {
  try {
    return await request<ConchLink[]>(`/conches/${conchId}/links`)
  } catch (error) {
    console.warn(`Failed to fetch links for ${conchId}:`, error)
    return []
  }
}

// ============ USER PROFILES ============

export interface UserProfile {
  id: string
  username: string
  email: string
  public_key?: string
  bio: string
  avatar_url: string
  cover_image: string
  expertise: string[]
  created_at: string
}

export interface UpdateProfileRequest {
  bio?: string
  avatar_url?: string
  cover_image?: string
  expertise?: string[]
}

export async function fetchUserProfile(username: string): Promise<UserProfile | null> {
  try {
    return await request<UserProfile>(`/users/${username}`)
  } catch (error) {
    console.warn(`Failed to fetch user profile ${username}:`, error)
    return null
  }
}

export async function updateUserProfile(username: string, data: UpdateProfileRequest): Promise<boolean> {
  try {
    await request(`/users/${username}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    return true
  } catch (error) {
    console.warn(`Failed to update user profile:`, error)
    return false
  }
}

// ============ FOLLOWS ============

export async function followUser(username: string): Promise<boolean> {
  try {
    await request('/follow', {
      method: 'POST',
      body: JSON.stringify({ username }),
    })
    return true
  } catch (error) {
    console.warn(`Failed to follow user:`, error)
    return false
  }
}

export async function unfollowUser(username: string): Promise<boolean> {
  try {
    await request(`/follow/${username}`, {
      method: 'DELETE',
    })
    return true
  } catch (error) {
    console.warn(`Failed to unfollow user:`, error)
    return false
  }
}

export async function getFollowersCount(username: string): Promise<number> {
  try {
    const response = await request<{ count: number }>(`/users/${username}/followers`)
    return response?.count || 0
  } catch (error) {
    return 0
  }
}

export async function getFollowingCount(username: string): Promise<number> {
  try {
    const response = await request<{ count: number }>(`/users/${username}/following`)
    return response?.count || 0
  } catch (error) {
    return 0
  }
}

export async function checkFollowing(username: string): Promise<boolean> {
  try {
    const response = await request<{ following: boolean }>(`/follow/status/${username}`)
    return response?.following || false
  } catch (error) {
    return false
  }
}

// ============ NOTIFICATIONS ============

export async function fetchNotifications(limit = 20): Promise<Notification[]> {
  try {
    return await request<Notification[]>(`/notifications?page_size=${limit}`)
  } catch (error) {
    console.warn('Failed to fetch notifications:', error)
    return []
  }
}

export async function markNotificationRead(id: string): Promise<boolean> {
  try {
    await request(`/notifications/${id}/read`, { method: 'PUT' })
    return true
  } catch (error) {
    return false
  }
}

export async function updateNotificationPreferences(username: string, prefs: Partial<NotificationPreferences>): Promise<boolean> {
  try {
    await request(`/users/${username}/preferences`, { method: 'PUT', body: JSON.stringify(prefs) })
    return true
  } catch (error) {
    console.warn('Failed to update notification preferences:', error)
    return false
  }
}

// ============ VERSION HISTORY ============

export interface ConchVersion {
  id: string
  conch_id: string
  version_number: number
  state: Record<string, unknown>
  story: string
  intent: string
  created_at: string
}

export async function fetchConchVersions(conchId: string): Promise<ConchVersion[]> {
  try {
    return await request<ConchVersion[]>(`/conches/${conchId}/versions`)
  } catch (error) {
    console.warn(`Failed to fetch versions for ${conchId}:`, error)
    return []
  }
}

// ============ LIKES ============

export async function likeConch(conchId: string, username: string): Promise<boolean> {
  try {
    await request(`/conches/${conchId}/likes`, {
      method: 'POST',
      body: JSON.stringify({ username }),
    })
    return true
  } catch (error) {
    console.warn(`Failed to like conch:`, error)
    return false
  }
}

export async function unlikeConch(conchId: string): Promise<boolean> {
  try {
    await request(`/conches/${conchId}/likes`, { method: 'DELETE' })
    return true
  } catch (error) {
    return false
  }
}

export async function getConchLikes(conchId: string): Promise<number> {
  try {
    const response = await request<{ likes: number }>(`/conches/${conchId}/likes`)
    return response?.likes || 0
  } catch (error) {
    return 0
  }
}

// ============ COMMENTS ============

export async function addComment(conchId: string, username: string, content: string, parentId?: string): Promise<Comment | null> {
  try {
    return await request<Comment>(`/conches/${conchId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ username, content, parent_id: parentId }),
    })
  } catch (error) {
    console.warn(`Failed to add comment:`, error)
    return null
  }
}

export async function fetchComments(conchId: string): Promise<Comment[]> {
  try {
    return await request<Comment[]>(`/conches/${conchId}/comments`)
  } catch (error) {
    console.warn(`Failed to fetch comments:`, error)
    return []
  }
}

// ============ TAGS ============

export interface Tag {
  id: string
  name: string
  usage_count: number
}

export async function addConchTags(conchId: string, tags: string[]): Promise<boolean> {
  try {
    await request(`/conches/${conchId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tags }),
    })
    return true
  } catch (error) {
    return false
  }
}

export async function fetchConchTags(conchId: string): Promise<string[]> {
  try {
    return await request<string[]>(`/conches/${conchId}/tags`)
  } catch (error) {
    return []
  }
}

export async function searchTags(query: string, limit = 10): Promise<Tag[]> {
  try {
    return await request<Tag[]>(`/tags/search?q=${encodeURIComponent(query)}&limit=${limit}`)
  } catch (error) {
    return []
  }
}

// ============ SEARCH ============

export interface SearchFilters {
  q?: string
  tags?: string[]
  author?: string
  state?: string
  date_from?: string
  date_to?: string
  sort?: 'date_desc' | 'date_asc' | 'popularity' | 'relevance'
  page?: number
  page_size?: number
}

export async function searchConches(filters: SearchFilters): Promise<Conch[]> {
  const params = new URLSearchParams()
  
  if (filters.q) params.append('q', filters.q)
  if (filters.tags?.length) params.append('tags', filters.tags.join(','))
  if (filters.author) params.append('author', filters.author)
  if (filters.state) params.append('state', filters.state)
  if (filters.date_from) params.append('date_from', filters.date_from)
  if (filters.date_to) params.append('date_to', filters.date_to)
  if (filters.sort) params.append('sort', filters.sort)
  params.append('page', String(filters.page || 1))
  params.append('page_size', String(filters.page_size || 20))
  
  try {
    return await request<Conch[]>(`/search?${params.toString()}`)
  } catch (error) {
    console.warn('Search failed:', error)
    return []
  }
}

// ============ AI EVOLUTION SUGGESTIONS ============

export interface EvolutionSuggestion {
  id: string
  type: 'state' | 'related' | 'evolution'
  title: string
  description: string
  confidence: number
  suggestedState?: Record<string, unknown>
  relatedConchId?: string
}

export async function getEvolutionSuggestions(conchId: string): Promise<EvolutionSuggestion[]> {
  try {
    return await request<EvolutionSuggestion[]>(`/conches/${conchId}/suggestions`)
  } catch (error) {
    console.warn('Failed to get evolution suggestions:', error)
    return []
  }
}

// ============ COLLABORATION HUB ============

export interface CollaborationConch {
  conch: Conch
  collaborators: string[]
  role: 'owner' | 'editor' | 'viewer'
  lastEdited?: string
}

export interface Collaborator {
  username: string
  expertise: string[]
  interests: string[]
  commonConnections: number
}

export async function fetchUserCollaborations(username: string): Promise<CollaborationConch[]> {
  try {
    return await request<CollaborationConch[]>(`/users/${username}/collaborations`)
  } catch (error) {
    console.warn('Failed to fetch collaborations:', error)
    return []
  }
}

export async function suggestCollaborators(username: string): Promise<Collaborator[]> {
  try {
    return await request<Collaborator[]>(`/users/${username}/suggest-collaborators`)
  } catch (error) {
    console.warn('Failed to suggest collaborators:', error)
    return []
  }
}
