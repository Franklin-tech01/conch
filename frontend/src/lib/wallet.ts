// Conch Wallet — client-side Ed25519 keypair management
// Keys never leave the browser. Identity is key ownership, not accounts.

import * as ed from '@noble/ed25519'

const WALLET_STORAGE_KEY = 'conch_wallet'

export interface Wallet {
  publicKey: string   // hex-encoded Ed25519 public key
  privateKey: string  // hex-encoded Ed25519 private key
  displayName: string // local-only human label
  createdAt: string
}

export async function generateWallet(displayName = 'Anonymous'): Promise<Wallet> {
  const { secretKey, publicKey } = await ed.keygenAsync()
  return {
    publicKey: ed.etc.bytesToHex(publicKey),
    privateKey: ed.etc.bytesToHex(secretKey),
    displayName,
    createdAt: new Date().toISOString(),
  }
}

export async function signMessage(message: string, privateKeyHex: string): Promise<string> {
  const secretKey = ed.etc.hexToBytes(privateKeyHex)
  const msgBytes = new TextEncoder().encode(message)
  const sig = await ed.signAsync(msgBytes, secretKey)
  return ed.etc.bytesToHex(sig)
}

export async function verifySignature(
  message: string,
  signatureHex: string,
  publicKeyHex: string,
): Promise<boolean> {
  try {
    const sig = ed.etc.hexToBytes(signatureHex)
    const msg = new TextEncoder().encode(message)
    const pub = ed.etc.hexToBytes(publicKeyHex)
    return await ed.verifyAsync(sig, msg, pub)
  } catch {
    return false
  }
}

export function saveWallet(wallet: Wallet): void {
  localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(wallet))
}

export function loadWallet(): Wallet | null {
  const stored = localStorage.getItem(WALLET_STORAGE_KEY)
  if (!stored) return null
  try {
    return JSON.parse(stored) as Wallet
  } catch {
    return null
  }
}

export function clearWallet(): void {
  localStorage.removeItem(WALLET_STORAGE_KEY)
}

/** Returns a shortened display version of a public key, e.g. "a1b2c3d4...ef5678" */
export function shortKey(publicKey: string): string {
  return `${publicKey.slice(0, 8)}…${publicKey.slice(-6)}`
}

/** Export wallet as a JSON string the user can save to a file */
export function exportWallet(wallet: Wallet): string {
  return JSON.stringify(wallet, null, 2)
}

/** Import wallet from a JSON string */
export function importWallet(json: string): Wallet {
  const parsed = JSON.parse(json) as Wallet
  if (!parsed.publicKey || !parsed.privateKey) {
    throw new Error('Invalid wallet file — missing keys')
  }
  return parsed
}
