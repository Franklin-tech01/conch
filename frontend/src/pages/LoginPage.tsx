// Redirects to wallet — login is replaced by keypair auth
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function LoginPage() {
  const navigate = useNavigate()
  useEffect(() => { navigate('/wallet', { replace: true }) }, [navigate])
  return null
}
