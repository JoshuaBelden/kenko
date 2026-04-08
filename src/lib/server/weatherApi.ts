export interface WeatherData {
  temperatureMax: number
  temperatureMin: number
  weatherCode: number
  weatherLabel: string
  precipitation: number
  fetchedAt: string
}

const WMO_CODES: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
}

function celsiusToFahrenheit(c: number): number {
  return Math.round((c * 9) / 5 + 32)
}

export async function geocodeZip(zip: string): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(zip)}&count=1`,
      {
        headers: { "User-Agent": "Kenko/1.0" },
        signal: AbortSignal.timeout(5000),
      },
    )

    if (!res.ok) return null

    const data = await res.json()
    if (!Array.isArray(data.results) || data.results.length === 0) return null

    const result = data.results[0]
    return { latitude: result.latitude, longitude: result.longitude }
  } catch {
    return null
  }
}

export async function fetchWeatherForDate(
  lat: number,
  lon: number,
  date: string,
  timezone: string,
): Promise<WeatherData | null> {
  try {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      daily: "temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum",
      timezone,
      start_date: date,
      end_date: date,
    })

    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      headers: { "User-Agent": "Kenko/1.0" },
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) return null

    const data = await res.json()
    const daily = data.daily
    if (!daily || !Array.isArray(daily.time) || daily.time.length === 0) return null

    const idx = daily.time.indexOf(date)
    if (idx === -1) return null

    const weatherCode = daily.weathercode[idx]

    return {
      temperatureMax: celsiusToFahrenheit(daily.temperature_2m_max[idx]),
      temperatureMin: celsiusToFahrenheit(daily.temperature_2m_min[idx]),
      weatherCode,
      weatherLabel: WMO_CODES[weatherCode] ?? "Unknown",
      precipitation: Math.round(daily.precipitation_sum[idx] * 10) / 10,
      fetchedAt: new Date().toISOString(),
    }
  } catch {
    return null
  }
}
