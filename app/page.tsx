export default function Home() {
  return (
    <div className="min-h-screen bg-white">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="max-w-xl mx-auto px-6 py-20 text-center">
        <h1 className="text-7xl font-bold mb-6 tracking-tight">
          GLANCEABLE
        </h1>

        <h2 className="text-3xl mb-16 text-gray-700 font-light">
          Join the present
        </h2>

        <div className="text-xl text-gray-700 mb-10 space-y-2 text-left max-w-xs mx-auto">
          <p>It's Easter morning.</p>
          <br />
          <p>When is lunch?</p>
          <p>Where are we going?</p>
          <br />
          <p>No one knows.</p>
        </div>

        <div className="text-xl text-gray-700 mb-10 space-y-2 text-left max-w-xs mx-auto">
          <p className="text-gray-400">—</p>
          <p>Someone just puts it down:</p>
          <br />
          <p className="font-semibold text-gray-900">Lunch — 12:30 PM</p>
          <br />
          <p className="text-gray-400">—</p>
          <p>Everyone sees it.</p>
        </div>

        <a
          href="/create"
          className="inline-block bg-black text-white px-14 py-5 rounded-xl text-xl font-semibold hover:bg-gray-800 transition-colors"
        >
          Tap in
        </a>

        <p className="mt-4 text-gray-500 text-base">
          Know what's happening — without asking.
        </p>
      </section>

      {/* ── Proof / product state ─────────────────────────────────────────── */}
      <section className="max-w-sm mx-auto px-6 pb-20">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-left">
          <div className="mb-4 pb-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900">Home</p>
          </div>

          <div className="mb-1">
            <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Current</p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-900">Alex — On the way</span>
                <span className="text-gray-400">8m ago</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-900">Mom — Lunch</span>
                <span className="text-gray-400">just now</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-900">Dad — Watching TV</span>
                <span className="text-gray-400">22m ago</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100">
            <div className="flex justify-between text-sm">
              <span className="text-gray-700">Lunch</span>
              <span className="text-gray-500">12:30 PM</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Problem ───────────────────────────────────────────────────────── */}
      <section className="max-w-xl mx-auto px-6 py-20 text-center bg-gray-50">
        <div className="text-xl text-gray-700 space-y-3 max-w-xs mx-auto text-left">
          <p>"Where are you?"</p>
          <p>"When will you be home?"</p>
          <p>"Did you leave yet?"</p>
        </div>

        <p className="mt-10 text-xl text-gray-800">
          You don't ask once.
        </p>
        <p className="mt-2 text-xl text-gray-800">
          You ask all day.
        </p>
      </section>

      {/* ── Resolution ────────────────────────────────────────────────────── */}
      <section className="max-w-xl mx-auto px-6 py-20 text-center">
        <p className="text-2xl text-gray-700 mb-8">Or…</p>
        <p className="text-2xl font-semibold text-gray-900 mb-10">You just glance.</p>

        <div className="text-lg text-gray-700 space-y-2 text-left max-w-xs mx-auto mb-10">
          <p>Alex — On the way</p>
          <p>Mom — Lunch</p>
          <p>Dad — Watching TV</p>
        </div>

        <p className="text-xl text-gray-700">No asking.</p>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section className="max-w-xl mx-auto px-6 py-20 text-center bg-gray-50">
        <div className="text-lg text-gray-700 space-y-4 max-w-xs mx-auto text-left">
          <p>1. Tap what's happening</p>
          <p>2. Others see it</p>
          <p>3. Everyone stays in sync</p>
        </div>

        <p className="mt-10 text-xl text-gray-500">That's it.</p>
      </section>

      {/* ── Households / spouses ──────────────────────────────────────────── */}
      <section className="max-w-xl mx-auto px-6 py-20 text-center">
        <h3 className="text-2xl font-bold mb-8 text-gray-900">For households</h3>

        <p className="text-xl text-gray-700 mb-2">You don't need to check in.</p>
        <p className="text-xl text-gray-700 mb-10">They don't need to respond.</p>

        <div className="text-gray-400 mb-6">—</div>

        <div className="text-xl text-gray-700 space-y-2 mb-10">
          <p>Dinner.</p>
          <p>On the way.</p>
          <p>Home.</p>
        </div>

        <div className="text-gray-400 mb-6">—</div>

        <p className="text-xl font-semibold text-gray-900">Just glance. Just know.</p>
      </section>

      {/* ── Set it once ───────────────────────────────────────────────────── */}
      <section className="max-w-xl mx-auto px-6 py-20 text-center bg-gray-50">
        <p className="text-xl text-gray-800 mb-2">Someone sets it once.</p>
        <p className="text-xl text-gray-800 mb-10">Everyone sees it.</p>

        <div className="text-gray-400 mb-6">—</div>

        <div className="text-lg text-gray-700 space-y-2 max-w-xs mx-auto text-left mb-10">
          <p>Lunch — 12:30 PM</p>
          <p>Practice — 6:30 PM</p>
        </div>

        <div className="text-gray-400 mb-6">—</div>

        <p className="text-xl text-gray-700 mb-2">No group text.</p>
        <p className="text-xl text-gray-700">No confusion.</p>
      </section>

      {/* ── Teams ─────────────────────────────────────────────────────────── */}
      <section className="max-w-xl mx-auto px-6 py-20 text-center">
        <h3 className="text-2xl font-bold mb-8 text-gray-900">For teams</h3>

        <p className="text-xl text-gray-700 mb-2">No roll call.</p>
        <p className="text-xl text-gray-700 mb-10">No "where is everyone?"</p>

        <div className="text-gray-400 mb-6">—</div>

        <p className="text-xl text-gray-700 mb-2">Practice starts.</p>
        <p className="text-xl text-gray-700 mb-10">People tap in as they arrive.</p>

        <div className="text-gray-400 mb-6">—</div>

        <p className="text-xl font-semibold text-gray-900">You see it instantly.</p>
      </section>

      {/* ── Timing ────────────────────────────────────────────────────────── */}
      <section className="max-w-xl mx-auto px-6 py-20 text-center bg-gray-50">
        <p className="text-xl text-gray-800 mb-10">
          Know when to reach out — and when not to.
        </p>

        <div className="max-w-xs mx-auto text-left space-y-4 mb-10">
          <div className="flex justify-between text-lg">
            <span className="text-gray-800">In a meeting</span>
            <span className="text-gray-500">don't interrupt</span>
          </div>
          <div className="flex justify-between text-lg">
            <span className="text-gray-800">On the way</span>
            <span className="text-gray-500">okay to text</span>
          </div>
          <div className="flex justify-between text-lg">
            <span className="text-gray-800">At home</span>
            <span className="text-gray-500">call anytime</span>
          </div>
        </div>

        <p className="text-xl text-gray-700">No guessing.</p>
      </section>

      {/* ── Life360 comparison ────────────────────────────────────────────── */}
      <section className="max-w-xl mx-auto px-6 py-20 text-center">
        <h3 className="text-2xl font-bold mb-16 text-gray-900">
          Coordination without surveillance
        </h3>

        <div className="grid grid-cols-2 gap-6 max-w-md mx-auto text-left mb-10">
          <div>
            <p className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wide">Life360</p>
            <div className="space-y-3 text-base text-gray-600">
              <p>Always tracking</p>
              <p>Battery drain</p>
              <p>Constant monitoring</p>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wide">Glanceable</p>
            <div className="space-y-3 text-base text-gray-800">
              <p>Tap when it matters</p>
              <p>Nothing running in the background</p>
              <p>Your choice</p>
            </div>
          </div>
        </div>

        <p className="text-lg text-gray-500">Same awareness. Less noise.</p>
      </section>

      {/* ── Final close ───────────────────────────────────────────────────── */}
      <section className="max-w-xl mx-auto px-6 py-24 text-center">
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
