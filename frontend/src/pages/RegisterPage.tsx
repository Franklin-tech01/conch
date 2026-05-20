// Redirects to wallet — registration is replaced by keypair generation
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function RegisterPage() {
  const navigate = useNavigate()
  useEffect(() => { navigate('/wallet', { replace: true }) }, [navigate])
  return null
}
