export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h1 className="text-7xl font-bold mb-6 tracking-tight">
          GLANCEABLE
        </h1>

        <h2 className="text-4xl mb-12 text-gray-700 font-light">
          Join the present
        </h2>

        <p className="text-3xl font-semibold mb-6">
          Know what's happening — without asking:
        </p>

        <div className="text-xl text-gray-600 mb-10 space-y-3 max-w-md mx-auto">
          <p>"Where are you?"</p>
          <p>"When will you be home?"</p>
          <p>"Did you leave yet?"</p>
        </div>

        <p className="text-2xl mb-4 max-w-2xl mx-auto leading-relaxed">
          Stop the "where are you?" texts.
        </p>

        <p className="text-2xl mb-12 max-w-2xl mx-auto leading-relaxed">
          Just tap in. Just glance.
        </p>

        <a
          href="/create"
          className="inline-block bg-black text-white px-14 py-5 rounded-xl text-xl font-semibold hover:bg-gray-800 transition-colors"
        >
          Tap in to try
        </a>
      </section>

      {/* Before/After */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-2 gap-12">
          {/* Without Glanceable */}
          <div className="bg-red-50 p-8 rounded-xl">
            <h4 className="text-2xl font-bold mb-6 text-red-900">
              WITHOUT GLANCEABLE
            </h4>
            <div className="space-y-2 text-gray-700 text-lg">
              <p>"Where are you?"</p>
              <p>"Are you almost home?"</p>
              <p>"Did you leave work?"</p>
              <p>"Text me when you get there"</p>
            </div>
            <p className="mt-6 text-red-900 font-semibold">
              20+ times a day.
            </p>
          </div>

          {/* With Glanceable */}
          <div className="bg-green-50 p-8 rounded-xl">
            <h4 className="text-2xl font-bold mb-6 text-green-900">
              WITH GLANCEABLE
            </h4>
            <div className="bg-white p-6 rounded-lg shadow-sm text-left">
              {/* Space header */}
              <div className="mb-4 pb-3 border-b border-gray-200">
                <p className="text-base font-semibold text-gray-900">🏠 Home</p>
              </div>

              {/* Current presence */}
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-500 mb-2">CURRENT</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Alex — home</span>
                    <span className="text-gray-400">just now</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Sarah — on the way</span>
                    <span className="text-gray-400">10m ago</span>
                  </div>
                </div>
              </div>

              {/* Upcoming */}
              <div className="mb-4 pb-3 border-b border-gray-200">
                <div className="flex justify-between text-sm">
                  <span>🍕 Pizza delivery</span>
                  <span className="text-gray-600">6:30pm</span>
                </div>
              </div>
            </div>
            <p className="mt-6 text-green-900 font-semibold">
              No asking. Just glance.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-5xl mx-auto px-6 py-20 bg-gray-50">
        <h3 className="text-4xl font-bold text-center mb-16">
          How It Works
        </h3>

        <div className="grid md:grid-cols-3 gap-12 text-center">
          <div>
            <div className="text-6xl font-bold text-gray-900 mb-4">1</div>
            <p className="text-xl text-gray-700">
              Tap in when you arrive or leave
            </p>
          </div>

          <div>
            <div className="text-6xl font-bold text-gray-900 mb-4">2</div>
            <p className="text-xl text-gray-700">
              Others see what's happening
            </p>
          </div>

          <div>
            <div className="text-6xl font-bold text-gray-900 mb-4">3</div>
            <p className="text-xl text-gray-700">
              No more "where are you?" texts
            </p>
          </div>
        </div>
      </section>

      {/* For Families */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h3 className="text-4xl font-bold mb-6">For Families</h3>
        <p className="text-xl text-gray-700 max-w-2xl mx-auto mb-4">
          You don't need to check in.
        </p>
        <p className="text-xl text-gray-700 max-w-2xl mx-auto">
          They don't need to respond.
        </p>
        <p className="text-xl text-gray-700 max-w-2xl mx-auto mt-8 font-semibold">
          Just glance. Just know.
        </p>
      </section>

      {/* For Teams */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center bg-gray-50">
        <h3 className="text-4xl font-bold mb-6">For Teams</h3>
        <p className="text-xl text-gray-700 max-w-2xl mx-auto mb-4">
          No roll call.
        </p>
        <p className="text-xl text-gray-700 max-w-2xl mx-auto">
          No group text confusion.
        </p>
        <p className="text-xl text-gray-700 max-w-2xl mx-auto mt-8 font-semibold">
          See who's here. In seconds.
        </p>
      </section>

      {/* For Parents */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <h3 className="text-4xl font-bold text-center mb-12">
          For Parents
        </h3>

        <div className="max-w-2xl mx-auto text-center space-y-6">
          <p className="text-2xl text-gray-800">
            You check in because you care.
          </p>

          <p className="text-2xl text-gray-800">
            They respond — but it's one more interruption.
          </p>

          <div className="bg-gray-50 p-8 rounded-xl my-8">
            <p className="text-xl font-semibold text-gray-900 mb-4">
              The compromise:
            </p>
            <p className="text-lg text-gray-700 leading-relaxed">
              They tap in when they arrive.<br />
              You glance. You know they're safe.<br />
              No nagging. No guilt.
            </p>
          </div>
        </div>
      </section>

      {/* Better Timing */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center bg-gray-50">
        <h3 className="text-4xl font-bold mb-6">Better timing</h3>
        <p className="text-xl text-gray-700 max-w-2xl mx-auto mb-10">
          Know when to reach out — and when not to.
        </p>

        <div className="max-w-sm mx-auto text-left space-y-4">
          <div className="flex justify-between text-lg">
            <span className="text-gray-800">In a meeting</span>
            <span className="text-gray-500">don't interrupt</span>
          </div>
          <div className="flex justify-between text-lg">
            <span className="text-gray-800">On the way</span>
            <span className="text-gray-500">okay to text</span>
          </div>
          <div className="flex justify-between text-lg">
            <span className="text-gray-800">Settling down</span>
            <span className="text-gray-500">call later</span>
          </div>
        </div>

        <p className="mt-10 text-xl text-gray-700 font-semibold">
          No guessing. No mistiming.
        </p>
      </section>

      {/* Coordination without surveillance */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <h3 className="text-4xl font-bold text-center mb-4">
          Coordination without surveillance
        </h3>
        <p className="text-center text-xl text-gray-600 mb-16">
          Same peace of mind. Less invasion.
        </p>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Life360 Column */}
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-8">
            <div className="text-center mb-6">
              <h4 className="text-2xl font-bold text-red-900">Life360</h4>
            </div>

            <div className="space-y-4">
              <p className="text-lg text-red-900">Always watching</p>
              <p className="text-lg text-red-900">Heavy battery use</p>
              <p className="text-lg text-red-900">Parent control</p>
            </div>
          </div>

          {/* Glanceable Column */}
          <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-8">
            <div className="text-center mb-6">
              <h4 className="text-2xl font-bold text-green-900">Glanceable</h4>
            </div>

            <div className="space-y-4">
              <p className="text-lg text-green-900">Tap when ready</p>
              <p className="text-lg text-green-900">Minimal usage</p>
              <p className="text-lg text-green-900">Your choice</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <p className="text-3xl font-bold mb-10 text-gray-900">
          Stop asking. Start knowing.
        </p>
        <a
          href="/create"
          className="inline-block bg-black text-white px-14 py-5 rounded-xl text-xl font-semibold hover:bg-gray-800 transition-colors"
        >
          Tap in to try
        </a>
        <p className="mt-6 text-gray-600">
          No setup. No tutorial. No credit card.
        </p>
      </section>
    </div>
  );
}
