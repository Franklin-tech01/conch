// CONCH Platform - Server-Sent Events Hook

import { useEffect, useRef, useCallback } from 'react'
import { useConchStore } from '../lib/store'
import type { ConchEvent, Conch, ConchLink, Notification } from '../lib/types'

const API_BASE = '/api'

export function useSSE() {
  const eventSourceRef = useRef<EventSource | null>(null)
  const { addEvent, addConch, updateConch, removeConch } = useConchStore()

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const token = localStorage.getItem('conch_token')
    const url = token
      ? `/events?token=${token}`
      : `/events`

    const eventSource = new EventSource(url)
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      console.log('SSE connected')
    }

    eventSource.onerror = (error) => {
      console.error('SSE error:', error)
      eventSource.close()
      // Reconnect after 5 seconds
      setTimeout(() => connect(), 5000)
    }

    eventSource.addEventListener('message', (event: MessageEvent) => {
      try {
        const data: unknown = JSON.parse(event.data)
        console.log('SSE message:', data)
      } catch (e) {
        console.error('Failed to parse SSE message:', e)
      }
    })

    eventSource.addEventListener('conch_created', (event: MessageEvent) => {
      try {
        const data: Conch = JSON.parse(event.data)
        const conchEvent: ConchEvent = {
          type: 'conch_created',
          conch: data,
        }
        addEvent(conchEvent)
        addConch(data)
        
        // Dispatch custom event for other components
        window.dispatchEvent(new CustomEvent('conch-created', { detail: data }))
      } catch (e) {
        console.error('Failed to parse conch_created event:', e)
      }
    })

    eventSource.addEventListener('conch_updated', (event: MessageEvent) => {
      try {
        const data: Conch = JSON.parse(event.data)
        const conchEvent: ConchEvent = {
          type: 'conch_updated',
          conch: data,
        }
        addEvent(conchEvent)
        updateConch(data)
        
        // Dispatch custom event for other components
        window.dispatchEvent(new CustomEvent('conch-updated', { detail: data }))
      } catch (e) {
        console.error('Failed to parse conch_updated event:', e)
      }
    })

    eventSource.addEventListener('conch_deleted', (event: MessageEvent) => {
      try {
        const data: { id: string } = JSON.parse(event.data)
        const conchEvent: ConchEvent = {
          type: 'conch_deleted',
          id: data.id,
        }
        addEvent(conchEvent)
        removeConch(data.id)
        
        // Dispatch custom event for other components
        window.dispatchEvent(new CustomEvent('conch-deleted', { detail: data }))
      } catch (e) {
        console.error('Failed to parse conch_deleted event:', e)
      }
    })

    eventSource.addEventListener('conch_linked', (event: MessageEvent) => {
      try {
        const data: ConchLink = JSON.parse(event.data)
        const conchEvent: ConchEvent = {
          type: 'link_created',
          link: data,
        }
        addEvent(conchEvent)
        
        // Dispatch custom event for other components
        window.dispatchEvent(new CustomEvent('conch-linked', { detail: data }))
      } catch (e) {
        console.error('Failed to parse conch_linked event:', e)
      }
    })
    
    // Listen for follow/notifications events
    eventSource.addEventListener('notification', (event: MessageEvent) => {
      try {
        const data: Notification = JSON.parse(event.data)
        window.dispatchEvent(new CustomEvent('new-notification', { detail: data }))
      } catch (e) {
        console.error('Failed to parse notification event:', e)
      }
    })

  }, [addEvent, addConch, updateConch, removeConch])

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
  }, [])

  useEffect(() => {
    connect()
    return () => disconnect()
  }, [connect, disconnect])

  // We don't return connect as it's called automatically in useEffect
  return { disconnect }
}

// Hook to fetch initial data and subscribe to updates
export function useConches(initialPage = 1, pageSize = 20) {
  const { setConches, setLoading, setError, conches } = useConchStore()
  useSSE() // Auto-connect for real-time updates

  const fetchConches = useCallback(async (page = initialPage, size = pageSize) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `${API_BASE}/conches?page=${page}&page_size=${size}`,
        {
          headers: {
            'Content-Type': 'application/json',
          }
        }
      )
      
      if (!response.ok) {
        throw new Error(`Failed to fetch conches: ${response.status}`)
      }
      
      const text = await response.text()
      if (!text) {
        setConches([])
        return
      }
      
      const data = JSON.parse(text)
      let conchList: Conch[] = []
      
      if (data && typeof data === 'object' && 'success' in data) {
        conchList = data.data || []
      } else if (Array.isArray(data)) {
        conchList = data
      }
      
      setConches(conchList)
    } catch (err) {
      console.error('Failed to fetch conches:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch conches')
      setConches([])
    } finally {
      setLoading(false)
    }
  }, [setConches, setLoading, setError, initialPage, pageSize])

  return { conches, fetchConches }
}
