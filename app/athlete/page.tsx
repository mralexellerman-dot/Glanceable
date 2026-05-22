"use client"
import { useSearchParams } from "next/navigation"

export default function AthletePage() {
  const searchParams = useSearchParams()
  const sport = searchParams.get("sport") || "default"

  const COPY: any = {
  bowling: {
  headline: "Who you are when nobody’s watching.",
  sub: "Track your offseason quietly. Practice, review, and show up — let your season take shape over time.",
  cta: "Start your offseason",
  examples: [
  "Bowling practice · focused",
  "League night",
  "Tournament",
  "Working on release",
  "Spare shooting",
  "Ball work / adjustments",
  "Reviewing tape",
  "Strength training",
  "Conditioning",
  "Stretching / mobility",
  "Recovery",
],
},
    default: {
      headline: "Who you are when nobody’s watching.",
      sub: "Track your offseason quietly. Show up, log it, and let your season take shape.",
      cta: "Start your summer record",
      examples: [
        "Practice · focused",
        "Training",
        "Recovery",
        "Reviewing",
      ],
    },
  }

  const content = COPY[sport] || COPY.default

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center px-6 max-w-xl">
        <h1 className="text-5xl font-bold mb-6">
          {content.headline}
        </h1>

        <p className="text-gray-600 mb-6">
          {content.sub}
        </p>

        <div className="mb-6 text-gray-500 text-sm">
          {content.examples.map((e: string, i: number) => (
            <div key={i}>{e}</div>
          ))}
        </div>

        <a
          href="/create"
          className="inline-block bg-black text-white px-8 py-4 rounded-xl text-lg"
        >
          {content.cta}
        </a>
      </div>
    </div>
  )
}