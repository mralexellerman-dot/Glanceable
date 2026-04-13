'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    try {
      const lastSpaceId = localStorage.getItem('last_space_id')
      if (lastSpaceId) {
        router.replace(`/space/${lastSpaceId}`)
        return
      }
    } catch {}
  }, [router])

  return (
    <div className="min-h-screen bg-white">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="max-w-xl mx-auto px-6 py-20 text-center">
        <h1 className="text-7xl font-bold mb-16 tracking-tight">
          GLANCEABLE
        </h1>

        <div className="text-xl text-gray-700 space-y-2 text-left max-w-xs mx-auto mb-10">
          <p>You're in Dallas.</p>
          <p>They're in Fort Worth.</p>
          <br />
          <p>You tap: <span className="font-semibold text-gray-900">Lunch</span></p>
          <br />
          <p>They see it.</p>
          <p>They join.</p>
        </div>

        <p className="text-gray-400 text-xl mb-10 max-w-xs mx-auto text-left">—</p>

        <p className="text-xl text-gray-700 mb-14 max-w-xs mx-auto text-left">
          Now you know it's a good time to call.
        </p>

        <a
          href="/create"
          className="inline-block bg-black text-white px-14 py-5 rounded-xl text-xl font-semibold hover:bg-gray-800 transition-colors"
        >
          Tap in
        </a>

        <p className="mt-4 text-gray-500 text-base">
          Know when it's a good time to connect — without asking.
        </p>
      </section>

      {/* ── Screenshot ────────────────────────────────────────────────────── */}
      <section className="mx-auto pb-16 text-center" style={{ maxWidth: '480px', padding: '0 16px 64px' }}>
        <img
          src="/IMG_8777.jpeg"
          alt="Glanceable — Current states, Upcoming, and Today"
          className="w-full rounded-2xl shadow-lg"
        />
        <p className="mt-3 text-base text-gray-400">No texts. Just this.</p>
      </section>

      {/* ── Problem ───────────────────────────────────────────────────────── */}
      <section className="max-w-xl mx-auto px-6 py-20 text-center bg-gray-50">
        <div className="text-xl text-gray-700 space-y-3 max-w-xs mx-auto text-left">
          <p>"Can I call you?"</p>
          <p>"Are you free?"</p>
          <p>"What are you doing?"</p>
        </div>

        <p className="mt-10 text-xl text-gray-800">
          You don't want to interrupt.
        </p>

        <p className="mt-4 text-xl text-gray-600">
          So you wait.<br />Or you ask anyway.
        </p>
      </section>

      {/* ── Shift ─────────────────────────────────────────────────────────── */}
      <section className="max-w-xl mx-auto px-6 py-20 text-center">
        <p className="text-2xl text-gray-700 mb-8">Or…</p>
        <p className="text-2xl font-semibold text-gray-900 mb-10">You just glance.</p>

        <div className="text-lg text-gray-700 space-y-2 text-left max-w-xs mx-auto mb-10">
          <p>They're at lunch.</p>
          <p>You join.</p>
          <br />
          <p>Now you know.</p>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section className="max-w-xl mx-auto px-6 py-20 text-center bg-gray-50">
        <div className="text-lg text-gray-700 space-y-4 max-w-xs mx-auto text-left">
          <p>Tap what you're in.</p>
          <br />
          <p>They see it.</p>
          <br />
          <p>They can join you.</p>
        </div>

        <div className="text-gray-400 text-xl mt-8 mb-0">—</div>
        <p className="mt-4 text-xl text-gray-500">That's it.</p>
      </section>

      {/* ── Distance moment ───────────────────────────────────────────────── */}
      <section className="max-w-xl mx-auto px-6 py-20 text-center">
        <p className="text-xl text-gray-700 mb-4">You're not in the same place.</p>
        <p className="text-xl text-gray-700 mb-10">You don't need to be.</p>

        <div className="text-gray-400 mb-8">—</div>

        <p className="text-xl text-gray-800 mb-2">Same moment.</p>
        <p className="text-xl text-gray-800">Same state.</p>
      </section>

      {/* ── Final close ───────────────────────────────────────────────────── */}
      <section className="max-w-xl mx-auto px-6 py-24 text-center bg-gray-50">
        <p className="text-3xl font-bold mb-3 text-gray-900">Stop asking.</p>
        <p className="text-3xl font-bold mb-14 text-gray-900">Start knowing.</p>

        <a
          href="/create"
          className="inline-block bg-black text-white px-14 py-5 rounded-xl text-xl font-semibold hover:bg-gray-800 transition-colors"
        >
          Tap in
        </a>
      </section>

    </div>
  )
}
