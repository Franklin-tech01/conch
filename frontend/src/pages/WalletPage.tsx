// Conch Wallet — local keypair management. No server, no accounts.

import { useState, useRef } from 'react'
import { generateWallet, saveWallet, clearWallet, exportWallet, importWallet, shortKey } from '../lib/wallet'
import { useConchStore } from '../lib/store'

export default function WalletPage() {
  const { wallet, setWallet } = useConchStore()
  const [displayName, setDisplayName] = useState(wallet?.displayName ?? '')
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPrivate, setShowPrivate] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    try {
      const w = await generateWallet(displayName || 'Anonymous')
      saveWallet(w)
      setWallet(w)
    } catch (e) {
      setError('Failed to generate keypair')
    } finally {
      setGenerating(false)
    }
  }

  const handleSaveName = () => {
    if (!wallet) return
    const updated = { ...wallet, displayName }
    saveWallet(updated)
    setWallet(updated)
  }

  const handleCopyKey = () => {
    if (!wallet) return
    navigator.clipboard.writeText(wallet.publicKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleExport = () => {
    if (!wallet) return
    const blob = new Blob([exportWallet(wallet)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `conch-wallet-${wallet.publicKey.slice(0, 8)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const w = importWallet(ev.target?.result as string)
        saveWallet(w)
        setWallet(w)
        setDisplayName(w.displayName)
        setError(null)
      } catch {
        setError('Invalid wallet file')
      }
    }
    reader.readAsText(file)
  }

  const handleDestroy = () => {
    if (!confirm('This will permanently delete your local key. There is no recovery. Continue?')) return
    clearWallet()
    setWallet(null)
    setDisplayName('')
  }

  const card: React.CSSProperties = {
    background: 'var(--color-bg-card)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-xl)',
    padding: '24px',
    marginBottom: '16px',
  }

  const btn = (variant: 'primary' | 'ghost' | 'danger'): React.CSSProperties => ({
    padding: '10px 20px',
    borderRadius: 'var(--radius-lg)',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 500,
    fontSize: '14px',
    background: variant === 'primary' ? 'var(--color-primary)' : variant === 'danger' ? 'rgba(239,68,68,0.15)' : 'var(--color-bg-elevated)',
    color: variant === 'danger' ? '#ef4444' : variant === 'primary' ? 'white' : 'var(--color-text)',
  })

  return (
    <div style={{ minHeight: '100vh', paddingTop: '80px', paddingBottom: '60px' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '0 20px' }}>
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Your Wallet</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '15px' }}>
            Your identity is your key. No accounts, no passwords — just cryptographic ownership.
          </p>
        </div>

        {error && (
          <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-lg)', color: '#ef4444', fontSize: '14px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {!wallet ? (
          <div style={card}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>No key found</h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginBottom: '20px' }}>
              Generate a keypair to get started. Your private key stays in your browser — the server never sees it.
            </p>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Display name (optional)</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="e.g. Alice"
                style={{ width: '100%', padding: '10px 14px', background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', color: 'var(--color-text)', fontSize: '15px', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button style={btn('primary')} onClick={handleGenerate} disabled={generating}>
                {generating ? 'Generating…' : 'Generate keypair'}
              </button>
              <button style={btn('ghost')} onClick={() => importRef.current?.click()}>
                Import existing key
              </button>
              <input ref={importRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
            </div>
          </div>
        ) : (
          <>
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: `hsl(${parseInt(wallet.publicKey.slice(0,4), 16) % 360}, 60%, 50%)`, flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '16px' }}>{wallet.displayName}</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '13px', color: 'var(--color-text-muted)' }}>{shortKey(wallet.publicKey)}</div>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Display name</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    style={{ flex: 1, padding: '10px 14px', background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', color: 'var(--color-text)', fontSize: '14px' }}
                  />
                  <button style={btn('ghost')} onClick={handleSaveName}>Save</button>
                </div>
              </div>

              <div style={{ marginBottom: '8px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Public key <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(your identity)</span></label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <code style={{ flex: 1, padding: '10px 14px', background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', fontSize: '12px', wordBreak: 'break-all', color: 'var(--color-text-muted)' }}>
                    {wallet.publicKey}
                  </code>
                  <button style={btn('ghost')} onClick={handleCopyKey}>{copied ? 'Copied!' : 'Copy'}</button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Private key <span style={{ color: '#ef4444', fontWeight: 400 }}>(never share this)</span></label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <code style={{ flex: 1, padding: '10px 14px', background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', fontSize: '12px', wordBreak: 'break-all', color: 'var(--color-text-muted)', filter: showPrivate ? 'none' : 'blur(6px)', userSelect: showPrivate ? 'text' : 'none' }}>
                    {wallet.privateKey}
                  </code>
                  <button style={btn('ghost')} onClick={() => setShowPrivate(s => !s)}>{showPrivate ? 'Hide' : 'Reveal'}</button>
                </div>
              </div>
            </div>

            <div style={card}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>Key management</h3>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button style={btn('ghost')} onClick={handleExport}>Export wallet</button>
                <button style={btn('ghost')} onClick={() => importRef.current?.click()}>Import wallet</button>
                <button style={btn('danger')} onClick={handleDestroy}>Delete key</button>
              </div>
              <input ref={importRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
              <p style={{ marginTop: '12px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                Export your wallet file and store it somewhere safe. If you delete your key without a backup, access to your Conches is permanently lost.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
