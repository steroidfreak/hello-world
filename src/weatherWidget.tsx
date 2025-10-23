import React, { useEffect, useState } from "react";
import { createRoot, Root } from "react-dom/client";

type OpenWeatherCondition = {
  id: number;
  main: string;
  description: string;
  icon: string;
};

type OpenWeatherMain = {
  temp: number;
  feels_like: number;
  temp_min: number;
  temp_max: number;
  pressure: number;
  humidity: number;
};

type OpenWeatherWind = {
  speed: number;
  deg: number;
  gust?: number;
};

type OpenWeatherSys = {
  country?: string;
  sunrise?: number;
  sunset?: number;
};

type OpenWeatherResponse = {
  weather: OpenWeatherCondition[];
  main: OpenWeatherMain;
  wind?: OpenWeatherWind;
  name?: string;
  dt: number;
  timezone: number;
  sys?: OpenWeatherSys;
  visibility?: number;
  rain?: Record<string, number>;
  clouds?: { all?: number };
};

type WeatherUnits = "standard" | "metric" | "imperial";

type WeatherComponentProps = {
  lat?: number;
  lon?: number;
  apiKey?: string;
  units?: WeatherUnits;
  title?: string;
  initialData?: OpenWeatherResponse;
};

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; payload: OpenWeatherResponse };

function formatTemperature(value: number, units: WeatherUnits = "standard"): string {
  if (Number.isNaN(value)) {
    return "N/A";
  }
  if (units === "metric") {
    return `${Math.round(value)}\u00B0C`;
  }
  if (units === "imperial") {
    return `${Math.round(value)}\u00B0F`;
  }
  return `${Math.round(value)}K`;
}

function formatVisibility(visibility: number | undefined): string {
  if (!visibility && visibility !== 0) {
    return "N/A";
  }
  if (visibility >= 1000) {
    return `${(visibility / 1000).toFixed(1)} km`;
  }
  return `${visibility} m`;
}

function formatWindSpeed(speed: number | undefined, units: WeatherUnits = "standard"): string {
  if (speed === undefined || Number.isNaN(speed)) {
    return "N/A";
  }
  if (units === "imperial") {
    return `${speed.toFixed(1)} mph`;
  }
  if (units === "metric") {
    return `${speed.toFixed(1)} m/s`;
  }
  return `${speed.toFixed(1)} m/s`;
}

function formatTimeFromUnix(unixTime: number | undefined, timezoneOffset: number): string {
  if (!unixTime) {
    return "--:--";
  }
  const date = new Date((unixTime + timezoneOffset) * 1000);
  return date.toUTCString().slice(17, 22);
}

function degToCompass(deg: number | undefined): string {
  if (deg === undefined) {
    return "N/A";
  }
  const directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const index = Math.round(deg / 22.5) % 16;
  return directions[index];
}

function buildApiUrl({ lat, lon, apiKey, units }: Required<Pick<WeatherComponentProps, "lat" | "lon" | "apiKey">> & { units?: WeatherUnits }): string {
  const params = new URLSearchParams({
    lat: lat.toString(),
    lon: lon.toString(),
    appid: apiKey,
  });
  if (units && units !== "standard") {
    params.set("units", units);
  }
  return `https://api.openweathermap.org/data/2.5/weather?${params.toString()}`;
}

const containerRoots = new WeakMap<HTMLElement, Root>();

const WeatherCard: React.FC<{ data: OpenWeatherResponse; units: WeatherUnits; title?: string }> = ({ data, units, title }) => {
  const primaryCondition = data.weather?.[0];
  const iconUrl = primaryCondition ? `https://openweathermap.org/img/wn/${primaryCondition.icon}@2x.png` : null;
  const locationLabel = title ?? data.name ?? "Current Location";
  const tempDisplay = formatTemperature(data.main.temp, units);
  const feelsLikeDisplay = formatTemperature(data.main.feels_like, units);

  const rainVolume = data.rain ? data.rain["1h"] ?? data.rain["3h"] : undefined;
  const humidity = data.main.humidity;

  return (
    <div className="weather-card">
      <div className="hero">
        <div className="hero-left">
          <p className="meta">Updated {new Date((data.dt + data.timezone) * 1000).toUTCString().slice(0, 22)}</p>
          <h1>{locationLabel}</h1>
          <div className="temp">
            <span className="temp-primary">{tempDisplay}</span>
            {primaryCondition && <span className="temp-caption">{primaryCondition.description}</span>}
          </div>
          <div className="meta-row">
            <span>Feels like {feelsLikeDisplay}</span>
            <span>Humidity {humidity}%</span>
            {rainVolume !== undefined && <span>Rain {rainVolume.toFixed(1)} mm</span>}
          </div>
        </div>
        {iconUrl ? (
          <div className="hero-right">
            <img src={iconUrl} alt={primaryCondition?.description ?? "Weather icon"} />
          </div>
        ) : null}
      </div>

      <div className="details">
        <div className="detail">
          <h3>Wind</h3>
          <p>{formatWindSpeed(data.wind?.speed, units)}</p>
          <span className="detail-meta">
            {degToCompass(data.wind?.deg)} {data.wind?.gust ? `• Gusts ${formatWindSpeed(data.wind.gust, units)}` : ""}
          </span>
        </div>
        <div className="detail">
          <h3>Visibility</h3>
          <p>{formatVisibility(data.visibility)}</p>
          <span className="detail-meta">{data.clouds?.all !== undefined ? `Cloud cover ${data.clouds.all}%` : "—"}</span>
        </div>
        <div className="detail">
          <h3>Pressure</h3>
          <p>{data.main.pressure} hPa</p>
          <span className="detail-meta">{data.sys?.country ? `Country ${data.sys.country}` : "—"}</span>
        </div>
        <div className="detail">
          <h3>Sunrise & Sunset</h3>
          <p>
            {formatTimeFromUnix(data.sys?.sunrise, data.timezone)} / {formatTimeFromUnix(data.sys?.sunset, data.timezone)}
          </p>
          <span className="detail-meta">Local time</span>
        </div>
      </div>
    </div>
  );
};

const WeatherApp: React.FC<WeatherComponentProps> = ({ lat, lon, apiKey, units = "metric", title, initialData }) => {
  const [state, setState] = useState<FetchState>(() =>
    initialData ? { status: "success", payload: initialData } : { status: "idle" }
  );

  const hasRequiredParams = lat !== undefined && lon !== undefined && !!apiKey;

  useEffect(() => {
    if (!hasRequiredParams) {
      setState({ status: "error", message: "Missing latitude, longitude, or API key." });
      return;
    }

    if (initialData) {
      setState({ status: "success", payload: initialData });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });
    const url = buildApiUrl({ lat: lat!, lon: lon!, apiKey: apiKey!, units });

    fetch(url)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Weather request failed (${res.status})`);
        }
        const payload: OpenWeatherResponse = await res.json();
        if (!cancelled) {
          setState({ status: "success", payload });
        }
      })
      .catch((error: unknown) => {
    if (!cancelled) {
      const message = error instanceof Error ? error.message : "Unknown error loading weather data.";
      setState({ status: "error", message });
    }
  });

  return () => {
    cancelled = true;
  };
  }, [lat, lon, apiKey, units, hasRequiredParams, initialData]);

  const data = state.status === "success" ? state.payload : null;
  const error = state.status === "error" ? state.message : undefined;

  // 🔒 Critical bit: render NOTHING until data is ready (and no error)
  if (!data) return null;
  // If you also want to suppress HTML on errors, return null here too
  // if (error) return null;

  return (
    <>
      <style>{`
        :root {
          color-scheme: light;
        }
        body {
          margin: 0;
          padding: 32px;
          font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
          background: linear-gradient(120deg, #0ea5e9 0%, #8b5cf6 100%);
          color: #0f172a;
        }
        .frame {
          max-width: 760px;
          margin: 0 auto;
        }
        .weather-card {
          background: rgba(255, 255, 255, 0.92);
          border-radius: 24px;
          padding: 32px;
          box-shadow: 0 30px 60px rgba(15, 23, 42, 0.25);
          display: flex;
          flex-direction: column;
          gap: 32px;
          border: 1px solid rgba(255, 255, 255, 0.6);
          backdrop-filter: blur(8px);
        }
        .hero {
          display: flex;
          justify-content: space-between;
          gap: 16px;
        }
        .hero-left {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .hero-left h1 {
          margin: 0;
          font-size: 32px;
          font-weight: 700;
        }
        .meta {
          margin: 0;
          color: #475569;
          font-size: 14px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          font-weight: 600;
        }
        .temp {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .temp-primary {
          font-size: 48px;
          font-weight: 700;
          line-height: 1;
        }
        .temp-caption {
          font-size: 16px;
          color: #1d4ed8;
          text-transform: capitalize;
        }
        .meta-row {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          font-size: 14px;
          color: #1f2937;
        }
        .hero-right img {
          width: 120px;
          height: 120px;
          filter: drop-shadow(0 12px 20px rgba(14, 116, 144, 0.35));
        }
        .details {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 18px;
        }
        .detail {
          background: rgba(255, 255, 255, 0.85);
          border-radius: 18px;
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          border: 1px solid rgba(226, 232, 240, 0.9);
        }
        .detail h3 {
          margin: 0;
          font-size: 14px;
          color: #2563eb;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .detail p {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
        }
        .detail-meta {
          font-size: 13px;
          color: #475569;
        }
        .loading, .error {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          padding: 80px 24px;
          background: rgba(255, 255, 255, 0.92);
          border-radius: 24px;
          box-shadow: 0 30px 60px rgba(15, 23, 42, 0.25);
        }
        .loading p, .error p {
          margin: 0;
          color: #1f2937;
        }
        .error h2 {
          margin: 0;
          font-size: 24px;
          color: #dc2626;
        }
        .hint {
          color: #475569;
          font-size: 14px;
        }
        .spinner {
          width: 48px;
          height: 48px;
          border: 4px solid rgba(37, 99, 235, 0.2);
          border-top-color: #2563eb;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @media (max-width: 640px) {
          body {
            padding: 24px 16px;
          }
          .hero {
            flex-direction: column;
            align-items: center;
            text-align: center;
          }
          .hero-left h1 {
            font-size: 28px;
          }
          .temp-primary {
            font-size: 40px;
          }
      }
    `}</style>
      <div className="frame">
        <WeatherCard data={data} units={units} title={title} />
      </div>
    </>
  );
};

type ToolInput = {
  lat?: number | string;
  lon?: number | string;
  apiKey?: string;
  units?: WeatherUnits;
  title?: string;
  initialData?: OpenWeatherResponse;
};

function normalizeNumber(value: number | string | undefined): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(parsed) ? parsed : undefined;
}

function renderWeatherWidget(container: HTMLElement, input: ToolInput = {}): void {
  const root = containerRoots.get(container) ?? createRoot(container);
  containerRoots.set(container, root);

  const props: WeatherComponentProps = {
    lat: normalizeNumber(input.lat),
    lon: normalizeNumber(input.lon),
    apiKey: input.apiKey,
    units: input.units ?? "metric",
    title: input.title,
    initialData: input.initialData,
  };

  root.render(<WeatherApp {...props} />);
}

declare global {
  interface Window {
    renderWeatherWidget?: (container: HTMLElement, input?: ToolInput) => void;
    openai?: {
      toolInput?: ToolInput;
    };
  }
}

if (typeof window !== "undefined") {
  window.renderWeatherWidget = renderWeatherWidget;
}

export {};
