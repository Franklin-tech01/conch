// CONCH Platform - Types

export interface Conch {
  id: string
  state: Record<string, unknown>
  story: string
  lineage: string[]
  intent: string
  era: number
  owner: string
  permissions: Permissions
  signature: string
  created_at: string
  updated_at: string
}

export interface Permissions {
  owner: 'Admin' | 'Write' | 'Read' | 'None'
  readers: PermissionEntry[]
  writers: PermissionEntry[]
  inheritors: PermissionEntry[]
}

export interface PermissionEntry {
  subject: string
  level: 'Admin' | 'Write' | 'Read' | 'None'
  expires_at: string | null
}

export interface ConchLink {
  id: string
  source_id: string
  target_id: string
  link_type: string
  created_at: string
}

export interface GraphNode {
  id: string
  story: string
  intent: string
  era: number
  owner: string
  state: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface GraphEdge {
  source: string
  target: string
  link_type: string
}

export interface ConchGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface User {
  id: string
  username: string
  email: string
  public_key: string | null
}

export interface TokenResponse {
  token: string
  user: User
}

export interface NotificationPreferences {
  mute_users: string[]
  mute_conches: string[]
  email_notifications: boolean
  push_notifications: boolean
  mentions: boolean
  follows: boolean
  likes: boolean
  comments: boolean
  digest: string
}

export interface UserProfile {
  id: string
  username: string
  display_name?: string
  email: string
  public_key?: string
  bio: string
  avatar_url: string
  cover_image: string
  expertise: string[]
  notification_preferences: NotificationPreferences
  created_at: string
}

export interface ApiResponse<T> {
  success: boolean
  data: T | null
  error: string | null
}

export interface ConchEvent {
  type: 'conch_created' | 'conch_updated' | 'conch_deleted' | 'link_created' | 'link_deleted'
  conch?: Conch
  link?: ConchLink
  id?: string
  source_id?: string
  target_id?: string
}

export interface CreateConchRequest {
  state: Record<string, unknown>
  story: string
  intent: string
  owner?: string
  lineage?: string[]
  permissions?: Permissions
}

export interface UpdateConchRequest {
  state?: Record<string, unknown>
  story?: string
  intent?: string
  permissions?: Permissions
}

// Notification message delivered to the user
export interface Notification {
  id: string
  user_username: string
  type: string
  from_username?: string
  conch_id?: string
  message: string
  read: boolean
  created_at: string
}

// Collaboration and comment types
export interface Comment {
  id: string
  author: string
  conch_id: string
  content: string
  created_at: string
  updated_at?: string
}

export interface ShareLink {
  id: string
  owner: string
  conch_id?: string
  graph_view?: ConchGraph
  expires_at?: string
}

export interface GraphFilter {
  state?: string
  tag?: string
  era?: { min?: number; max?: number }
  search?: string
}
