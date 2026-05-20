// CONCH Platform - Create Conch Page (Milestone 1: structured .conch format)

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { newConch, validateConch, createConch, type ConchObject, type ValidationResult } from '../lib/api'
import { useConchStore } from '../lib/store'

const CONCH_TYPES = ['memory', 'knowledge', 'wisdom', 'artifact'] as const

export default function CreateConch() {
  const navigate = useNavigate()
  const { addConch, wallet } = useConchStore()

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tags, setTags] = useState('')
  const [conchType, setConchType] = useState<typeof CONCH_TYPES[number]>('memory')
  const [showPreview, setShowPreview] = useState(false)

  const [preview, setPreview] = useState<ConchObject | null>(null)
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const creator = wallet?.publicKey ?? 'anonymous'

  const buildPayload = useCallback(() => ({
    fields: [
      { name: 'title', type: 'string' as const, required: true, description: 'Human-readable title' },
      { name: 'body', type: 'string' as const, required: true, description: 'Main content' },
      { name: 'tags', type: 'array' as const, required: false, description: 'Topic tags' },
      { name: 'type', type: 'string' as const, required: false, description: 'Conch category' },
    ],
    data: {
      title,
      body,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      type: conchType,
    },
  }), [title, body, tags, conchType])

  // Live preview: rebuild the ConchObject whenever form values change
  useEffect(() => {
    if (!title && !body) {
      setPreview(null)
      setValidation(null)
      return
    }
    const timeout = setTimeout(async () => {
      setPreviewLoading(true)
      try {
        const { fields, data } = buildPayload()
        const obj = await newConch(creator, fields, data)
        setPreview(obj)
        const result = await validateConch(JSON.stringify(obj))
        setValidation(result)
      } catch {
        setPreview(null)
        setValidation(null)
      } finally {
        setPreviewLoading(false)
      }
    }, 500)
    return () => clearTimeout(timeout)
  }, [title, body, tags, conchType, creator, buildPayload])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !body.trim()) {
      setError('Title and body are required.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const { fields, data } = buildPayload()
      const obj = await newConch(creator, fields, data)

      // Persist: store the full ConchObject as the `state` field in the DB
      const saved = await createConch({
        state: obj as unknown as Record<string, unknown>,
        story: title,
        intent: conchType,
        owner: creator,
      })

      if (!saved) throw new Error('No response from server')
      addConch(saved)
      navigate(`/conch/${saved.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create Conch')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', paddingTop: '80px', paddingBottom: '60px' }}>
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '0 20px' }}>

        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Create a Conch</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '15px' }}>
            Forge a new structured memory in the spiral
          </p>
        </div>

        {error && (
          <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-lg)', color: '#ef4444', fontSize: '14px', marginBottom: '20px' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: showPreview ? '1fr 1fr' : '1fr', gap: '24px', alignItems: 'start' }}>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div style={fieldGroup}>
              <label style={labelStyle}>Title <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="What is this memory about?"
                required
                style={inputStyle}
              />
            </div>

            <div style={fieldGroup}>
              <label style={labelStyle}>Body <span style={{ color: '#ef4444' }}>*</span></label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="The full content of this Conch..."
                required
                rows={7}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label style={labelStyle}>Tags</label>
                <input
                  type="text"
                  value={tags}
                  onChange={e => setTags(e.target.value)}
                  placeholder="memory, agents, ..."
                  style={inputStyle}
                />
                <span style={hintStyle}>Comma-separated</span>
              </div>
              <div>
                <label style={labelStyle}>Type</label>
                <select
                  value={conchType}
                  onChange={e => setConchType(e.target.value as typeof CONCH_TYPES[number])}
                  style={inputStyle}
                >
                  {CONCH_TYPES.map(t => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Validation badge */}
            {validation && (
              <div style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-lg)',
                fontSize: '13px',
                marginBottom: '20px',
                background: validation.valid ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${validation.valid ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                color: validation.valid ? '#22c55e' : '#ef4444',
              }}>
                {validation.valid ? (
                  '✓ Valid .conch structure'
                ) : (
                  <>
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>Validation errors:</div>
                    {validation.errors.map((e, i) => <div key={i}>· {e}</div>)}
                  </>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setShowPreview(s => !s)}
                style={{ padding: '10px 18px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '13px' }}
              >
                {showPreview ? 'Hide preview' : 'Show .conch preview'}
              </button>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  style={{ padding: '10px 20px', borderRadius: 'var(--radius-lg)', border: 'none', background: 'var(--color-bg-elevated)', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '14px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || (!!validation && !validation.valid)}
                  style={{ padding: '10px 24px', borderRadius: 'var(--radius-lg)', border: 'none', background: 'var(--color-primary)', color: 'white', cursor: submitting ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 500, opacity: submitting ? 0.7 : 1 }}
                >
                  {submitting ? 'Creating…' : 'Create Conch'}
                </button>
              </div>
            </div>
          </form>

          {/* .conch preview panel */}
          {showPreview && (
            <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '20px', position: 'sticky', top: '100px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                  .conch preview
                </span>
                {previewLoading && (
                  <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>updating…</span>
                )}
              </div>
              {preview ? (
                <pre style={{ fontSize: '11px', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--color-text-muted)', margin: 0, maxHeight: '520px', overflowY: 'auto' }}>
                  {JSON.stringify(preview, null, 2)}
                </pre>
              ) : (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>
                  Start typing to see the generated .conch structure here.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const fieldGroup: React.CSSProperties = { marginBottom: '20px' }

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 500,
  marginBottom: '6px',
  color: 'var(--color-text)',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: 'var(--color-bg-elevated)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  color: 'var(--color-text)',
  fontSize: '15px',
  boxSizing: 'border-box',
}

const hintStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  color: 'var(--color-text-muted)',
  marginTop: '4px',
}
