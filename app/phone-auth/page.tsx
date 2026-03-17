'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function PhoneAuth() {
  const router = useRouter()
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSendOtp() {
    if (!phone.trim()) return
    setLoading(true)
    setError('')

    const { error: err } = await supabase.auth.signInWithOtp({ phone: phone.trim() })

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    setStep('code')
    setLoading(false)
  }

  async function handleVerifyOtp() {
    if (!code.trim()) return
    setLoading(true)
    setError('')

    const { error: err } = await supabase.auth.verifyOtp({
      phone: phone.trim(),
      token: code.trim(),
      type: 'sms',
    })

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    router.push('/create')
  }

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full max-w-[420px] space-y-6">
        {step === 'phone' ? (
          <>
            <div>
              <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>
                Enter your phone number
              </h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                We'll send you a verification code.
              </p>
            </div>
            <div className="space-y-3">
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+1 555 000 0000"
                className="w-full px-4 py-3 rounded-xl text-base outline-none"
                style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && phone.trim() && handleSendOtp()}
              />
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button
                onClick={handleSendOtp}
                disabled={!phone.trim() || loading}
                className="w-full py-3.5 rounded-xl text-sm font-medium text-white transition-opacity disabled:opacity-40 active:opacity-80"
                style={{ background: '#1A1A18' }}
              >
                {loading ? 'Sending…' : 'Send code'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div>
              <button
                onClick={() => { setStep('phone'); setError('') }}
                className="text-sm mb-4 block"
                style={{ color: 'var(--text-muted)' }}
              >
                ← Back
              </button>
              <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>
                Enter the code
              </h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                Sent to {phone}.
              </p>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                inputMode="numeric"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="123456"
                className="w-full px-4 py-3 rounded-xl text-base outline-none tracking-widest"
                style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && code.trim() && handleVerifyOtp()}
              />
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button
                onClick={handleVerifyOtp}
                disabled={!code.trim() || loading}
                className="w-full py-3.5 rounded-xl text-sm font-medium text-white transition-opacity disabled:opacity-40 active:opacity-80"
                style={{ background: '#1A1A18' }}
              >
                {loading ? 'Verifying…' : 'Verify'}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
