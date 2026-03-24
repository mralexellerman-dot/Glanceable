// ─── Weather condition detection ──────────────────────────────────────────────
// Uses browser Geolocation + Open-Meteo (no API key required).
// Module-level promise cache — one fetch per browser session.
// Falls back to null on any error (permission denied, timeout, offline).

export type WeatherCondition = 'rain' | 'storm' | 'snow' | 'heat' | null

let _promise: Promise<WeatherCondition> | null = null

export function getWeatherCondition(): Promise<WeatherCondition> {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if (!_promise) _promise = _fetch()
  return _promise
}

async function _fetch(): Promise<WeatherCondition> {
  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        timeout:     6_000,
        maximumAge:  600_000,   // accept cached position up to 10 min old
      })
    )
    const { latitude: lat, longitude: lon } = pos.coords
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
      `&current=weather_code,temperature_2m&temperature_unit=fahrenheit&forecast_days=1`
    const res  = await fetch(url)
    const data = await res.json()
    const code = (data.current?.weather_code ?? -1) as number
    const temp = (data.current?.temperature_2m ?? 70) as number
    return classify(code, temp)
  } catch {
    return null
  }
}

// WMO weather code → simplified condition
// https://open-meteo.com/en/docs — "WMO Weather interpretation codes"
function classify(code: number, tempF: number): WeatherCondition {
  if (code >= 95)                                                 return 'storm' // thunderstorm
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain'  // drizzle / rain / showers
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow'  // snowfall / snow showers
  if (tempF >= 90)                                               return 'heat'  // hot day, clear sky
  return null  // clear / cloudy / mild — not meaningful enough to surface
}
