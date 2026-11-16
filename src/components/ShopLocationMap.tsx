import { useEffect, useMemo, useRef, useState } from 'react';
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  Car,
  Compass,
  ExternalLink,
  Footprints,
  LocateFixed,
  MapPin,
  Navigation,
  Phone,
  RotateCcw,
  Star,
  TrainFront,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { BlurFade } from './ui/blur-fade';
import { BorderBeam } from './ui/border-beam';

export const SHOP_COORDS = { lat: 32.7944157, lng: -96.7776046 };

export const SHOP_DIRECT_DIRECTIONS_BASE =
  'https://www.google.com/maps/dir/?api=1&destination=32.7944157,-96.7776046&destination_place_id=ChIJfQrtsZWZToYRNd_akfcSRGk';

type TravelMode = 'DRIVING' | 'WALKING' | 'TRANSIT';

interface RouteSummary {
  distanceMeters: number;
  durationMillis: number;
  startLatLng?: { lat: number; lng: number } | null;
}

interface PolylineHandle {
  setMap: (map: unknown | null) => void;
  setOptions: (options: Record<string, unknown>) => void;
}

function formatMiles(meters: number) {
  const miles = meters / 1609.344;
  return miles < 0.2 ? `${Math.round(meters * 3.28084)} ft` : `${miles.toFixed(1)} mi`;
}

function formatDuration(millis: number) {
  const totalMins = Math.max(1, Math.round(millis / 60000));
  if (totalMins < 60) return `${totalMins} min`;
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return mins > 0 ? `${hrs} hr ${mins} min` : `${hrs} hr`;
}

function RouteOverlay({
  origin,
  travelMode,
  onRouteComputed,
  onError,
  onLoadingChange,
}: {
  origin: string | { lat: number; lng: number } | null;
  travelMode: TravelMode;
  onRouteComputed: (summary: RouteSummary | null) => void;
  onError: (message: string | null) => void;
  onLoadingChange: (loading: boolean) => void;
}) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<PolylineHandle[]>([]);
  const [originPin, setOriginPin] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    // Cleanup any previously rendered route polylines
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    if (!origin) {
      setOriginPin(null);
      onRouteComputed(null);
      onError(null);
      onLoadingChange(false);
      if (map) {
        map.panTo(SHOP_COORDS);
        map.setZoom(16);
      }
      return;
    }

    if (!routesLib || !map) return;

    let cancelled = false;
    onLoadingChange(true);
    onError(null);

    const request = {
      origin,
      destination: SHOP_COORDS,
      travelMode,
      fields: ['path', 'distanceMeters', 'durationMillis', 'viewport', 'legs'],
    };

    const routeApi = (routesLib as unknown as { Route?: { computeRoutes?: (req: unknown) => Promise<{ routes?: any[] }> } }).Route;

    if (!routeApi?.computeRoutes) {
      onLoadingChange(false);
      onError('Route preview library is initializing. Use Direct Directions below.');
      return;
    }

    routeApi
      .computeRoutes(request)
      .then((response) => {
        if (cancelled) return;
        onLoadingChange(false);

        const primaryRoute = response?.routes?.[0];
        if (!primaryRoute) {
          setOriginPin(null);
          onRouteComputed(null);
          onError('No route found from that location. Try a nearby Dallas street or open Google Maps.');
          return;
        }

        if (typeof primaryRoute.createPolylines === 'function') {
          const newPolylines = primaryRoute.createPolylines() as PolylineHandle[];
          newPolylines.forEach((polyline) => {
            polyline.setOptions({
              strokeColor: '#E9B84B',
              strokeOpacity: 0.94,
              strokeWeight: 5,
            });
            polyline.setMap(map);
          });
          polylinesRef.current = newPolylines;
        }

        if (primaryRoute.viewport) {
          map.fitBounds(primaryRoute.viewport, 64);
        }

        let startLoc: { lat: number; lng: number } | null = null;
        if (typeof origin === 'object') {
          startLoc = origin;
        } else {
          const legStart = primaryRoute.legs?.[0]?.startLocation;
          if (legStart && typeof legStart.lat === 'function' && typeof legStart.lng === 'function') {
            startLoc = { lat: legStart.lat(), lng: legStart.lng() };
          } else if (legStart && typeof legStart.lat === 'number' && typeof legStart.lng === 'number') {
            startLoc = { lat: legStart.lat, lng: legStart.lng };
          }
        }
        setOriginPin(startLoc);

        onRouteComputed({
          distanceMeters: Number(primaryRoute.distanceMeters ?? 0),
          durationMillis: Number(primaryRoute.durationMillis ?? 0),
          startLatLng: startLoc,
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        onLoadingChange(false);
        setOriginPin(null);
        onRouteComputed(null);

        const errMsg = err instanceof Error ? err.message : String(err);
        if (
          errMsg.includes('RESOURCE_EXHAUSTED') ||
          errMsg.includes('OVER_QUERY_LIMIT') ||
          errMsg.includes('Quota') ||
          errMsg.includes('429')
        ) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        onError('Unable to calculate live preview for that starting point. Use Get Direct Directions below.');
      });

    return () => {
      cancelled = true;
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [routesLib, map, origin, travelMode, onRouteComputed, onError, onLoadingChange]);

  if (!originPin) return null;

  return (
    <AdvancedMarker position={originPin} title="Your Starting Point">
      <Pin background="#F5F2EA" borderColor="#0B0B0B" glyphColor="#0B0B0B" scale={0.9} />
    </AdvancedMarker>
  );
}

function ShopMarkerAndInfo({
  address,
  rating,
  reviewCount,
  directDirectionsUrl,
}: {
  address: string;
  rating: string;
  reviewCount: number;
  directDirectionsUrl: string;
}) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [infoOpen, setInfoOpen] = useState(true);

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={SHOP_COORDS}
        title="Xecutive Cutz"
        onClick={() => setInfoOpen((prev) => !prev)}
      >
        <Pin background="#E9B84B" borderColor="#0B0B0B" glyphColor="#0B0B0B" scale={1.15} />
      </AdvancedMarker>

      {infoOpen && marker && (
        <InfoWindow anchor={marker} onCloseClick={() => setInfoOpen(false)}>
          <div className="p-1 max-w-[230px] text-[#0B0B0B] space-y-1.5 font-sans">
            <div className="flex items-center justify-between gap-2">
              <p className="font-serif text-sm font-bold text-[#0B0B0B]">Xecutive Cutz</p>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#8A6213]">
                <Star className="w-3 h-3 fill-[#C99B3C] text-[#C99B3C]" />
                {rating} ({reviewCount})
              </span>
            </div>
            <p className="text-xs text-[#3A3832] leading-snug">{address}</p>
            <a
              href={directDirectionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8A6213] hover:text-[#0B0B0B] underline pt-0.5"
            >
              <Navigation className="w-3 h-3" />
              <span>Direct Directions</span>
            </a>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

export function ShopLocationMap() {
  const { settings, businessHours, systemStatus } = useShop();

  const apiKey = useMemo(
    () =>
      (
        (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ||
        systemStatus?.googleMapsApiKey ||
        ''
      ).trim(),
    [systemStatus?.googleMapsApiKey]
  );

  const address = settings?.address || '919 N Haskell Ave., Dallas, TX 75204, United States';
  const phone = settings?.phone || '+1 972-358-1199';
  const rating = settings?.google_rating?.toFixed(1) || '5.0';
  const reviewCount = settings?.google_review_count ?? 6;
  const mapsPlaceUrl =
    settings?.google_maps_url ||
    'https://www.google.com/maps/place/Xecutive+Cutz/@32.7944157,-96.7776046,17z/data=!3m1!4b1!4m6!3m5!1s0x864e9995b1ed0a7d:0x694412f791dadf35!8m2!3d32.7944157!4d-96.7776046!16s%2Fg%2F11n8vp2c08?entry=ttu';

  const [originInput, setOriginInput] = useState('');
  const [activeOrigin, setActiveOrigin] = useState<string | { lat: number; lng: number } | null>(null);
  const [travelMode, setTravelMode] = useState<TravelMode>('DRIVING');
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);

  const tueSatHours = businessHours.find((h) => h.day_of_week === 2 && h.is_open);

  const directDirectionsUrl = useMemo(() => {
    const modeParam =
      travelMode === 'WALKING'
        ? '&travelmode=walking'
        : travelMode === 'TRANSIT'
        ? '&travelmode=transit'
        : '&travelmode=driving';

    if (typeof activeOrigin === 'object' && activeOrigin !== null) {
      return `${SHOP_DIRECT_DIRECTIONS_BASE}&origin=${activeOrigin.lat},${activeOrigin.lng}${modeParam}`;
    }
    if (typeof activeOrigin === 'string' && activeOrigin.trim()) {
      return `${SHOP_DIRECT_DIRECTIONS_BASE}&origin=${encodeURIComponent(activeOrigin.trim())}${modeParam}`;
    }
    if (originInput.trim()) {
      return `${SHOP_DIRECT_DIRECTIONS_BASE}&origin=${encodeURIComponent(originInput.trim())}${modeParam}`;
    }
    return `${SHOP_DIRECT_DIRECTIONS_BASE}${modeParam}`;
  }, [activeOrigin, originInput, travelMode]);

  const handleComputeRoute = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = originInput.trim();
    if (!cleaned) {
      setRouteError('Enter your starting address or use your current location.');
      return;
    }
    setRouteError(null);
    setActiveOrigin(cleaned);
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setRouteError('Geolocation is not supported by your browser. Enter an address instead.');
      return;
    }
    setGeoLoading(true);
    setRouteError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLoading(false);
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setOriginInput('Current GPS Location');
        setActiveOrigin(coords);
      },
      () => {
        setGeoLoading(false);
        setRouteError('Location permission denied. Enter a Dallas neighborhood or address above.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleClearRoute = () => {
    setOriginInput('');
    setActiveOrigin(null);
    setRouteSummary(null);
    setRouteError(null);
  };

  return (
    <section
      id="location"
      className="py-20 lg:py-28 bg-[#0B0B0B] border-t border-[rgba(218,174,77,0.22)]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <BlurFade inView className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="space-y-3 max-w-2xl">
            <p className="text-xs font-semibold tracking-widest uppercase text-[#E9B84B]">
              Visit The Barbershop
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-[#F5F2EA]">
              Find Us in Dallas, Texas.
            </h2>
            <p className="text-sm sm:text-base text-[#A5A29B]">
              Conveniently located on North Haskell Avenue near Uptown and Deep Ellum. Preview your route live or launch turn-by-turn directions in Google Maps.
            </p>
          </div>
          <a
            href={directDirectionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-gold-sheen group inline-flex items-center gap-2.5 px-6 py-3.5 text-xs sm:text-sm font-semibold bg-[#E9B84B] text-[#0B0B0B] hover:bg-[#C99B3C] hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-8px_rgba(233,184,75,0.45)] transition-all duration-200 rounded-sm whitespace-nowrap shrink-0"
          >
            <Navigation className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            <span>Get Direct Directions</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80" />
          </a>
        </BlurFade>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Panel: Directions & Location Details */}
          <div className="lg:col-span-5 bg-[#141414] border border-[rgba(218,174,77,0.24)] rounded-sm p-6 sm:p-7 flex flex-col justify-between space-y-6">
            <div className="space-y-6">
              {/* Shop Card Header */}
              <div className="pb-5 border-b border-[rgba(218,174,77,0.16)] space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-serif text-2xl font-semibold text-[#F5F2EA]">
                      {settings?.business_name || 'Xecutive Cutz'}
                    </h3>
                    <p className="text-xs text-[#E9B84B] mt-0.5">Master Barbershop · Dallas, TX</p>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#1C1B18] border border-[rgba(218,174,77,0.3)] rounded-sm text-xs font-semibold text-[#E9B84B] tabular-nums shrink-0">
                    <Star className="w-3.5 h-3.5 fill-[#E9B84B] text-[#E9B84B]" />
                    <span>{rating}</span>
                    <span className="text-[#A5A29B] font-normal">({reviewCount})</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs sm:text-sm text-[#A5A29B]">
                  <div className="flex items-start gap-2.5">
                    <MapPin className="w-4 h-4 text-[#E9B84B] shrink-0 mt-0.5" />
                    <span className="text-[#F5F2EA]/90 leading-snug">{address}</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Phone className="w-4 h-4 text-[#E9B84B] shrink-0 mt-0.5" />
                    <a
                      href={`tel:${phone.replace(/[^+\d]/g, '')}`}
                      className="text-[#F5F2EA]/90 hover:text-[#E9B84B] transition-colors tabular-nums"
                    >
                      {phone}
                    </a>
                  </div>
                </div>
                {tueSatHours && (
                  <p className="text-xs text-[#A5A29B]">
                    Open Tue – Sat · Walk-ins welcome when chairs allow, online appointments prioritized.
                  </p>
                )}
              </div>

              {/* Direct Route Preview Form */}
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="route-origin-input"
                    className="text-xs font-semibold tracking-wider uppercase text-[#E9B84B] flex items-center gap-1.5"
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span>Route & Travel Time Preview</span>
                  </label>
                  {activeOrigin && (
                    <button
                      type="button"
                      onClick={handleClearRoute}
                      className="inline-flex items-center gap-1 text-xs text-[#A5A29B] hover:text-[#E9B84B] transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset</span>
                    </button>
                  )}
                </div>

                {/* Travel Mode Selector */}
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'DRIVING', label: 'Drive', icon: Car },
                      { id: 'WALKING', label: 'Walk', icon: Footprints },
                      { id: 'TRANSIT', label: 'Transit', icon: TrainFront },
                    ] as const
                  ).map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setTravelMode(id)}
                      className={`inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium rounded-sm border transition-all duration-200 cursor-pointer ${
                        travelMode === id
                          ? 'bg-[#E9B84B] text-[#0B0B0B] border-[#E9B84B] font-semibold'
                          : 'bg-[#1C1B18] text-[#A5A29B] border-[rgba(218,174,77,0.22)] hover:border-[#E9B84B]/60 hover:text-[#F5F2EA]'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>

                <form onSubmit={handleComputeRoute} className="space-y-2.5">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      id="route-origin-input"
                      type="text"
                      value={originInput}
                      onChange={(e) => setOriginInput(e.target.value)}
                      placeholder="Enter starting street or Dallas zip..."
                      className="flex-1 px-3.5 py-2.5 text-sm bg-[#0B0B0B] border border-[rgba(218,174,77,0.28)] focus:border-[#E9B84B] focus:outline-none text-[#F5F2EA] placeholder-[#A5A29B]/60 rounded-sm"
                    />
                    <button
                      type="submit"
                      disabled={routeLoading}
                      className="px-4 py-2.5 text-xs font-semibold bg-[#1C1B18] border border-[#E9B84B]/60 text-[#E9B84B] hover:bg-[#E9B84B] hover:text-[#0B0B0B] transition-colors rounded-sm whitespace-nowrap cursor-pointer disabled:opacity-50"
                    >
                      {routeLoading ? 'Calculating...' : 'Preview Route'}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleUseMyLocation}
                    disabled={geoLoading || routeLoading}
                    className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium text-[#F5F2EA]/85 bg-[#1C1B18]/70 border border-[rgba(218,174,77,0.2)] hover:border-[#E9B84B]/60 hover:text-[#E9B84B] transition-colors rounded-sm cursor-pointer disabled:opacity-50"
                  >
                    <LocateFixed className="w-3.5 h-3.5 text-[#E9B84B]" />
                    <span>{geoLoading ? 'Detecting your GPS location...' : 'Use My Current Location'}</span>
                  </button>
                </form>

                {routeError && (
                  <p className="text-xs text-amber-300 bg-amber-950/35 border border-amber-500/30 rounded-sm px-3 py-2">
                    {routeError}
                  </p>
                )}

                {routeSummary && (
                  <div className="p-3.5 bg-[#1C1B18] border border-[#E9B84B]/45 rounded-sm flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-[#E9B84B] font-semibold">
                        Estimated {travelMode.toLowerCase()} trip
                      </p>
                      <p className="text-base font-semibold text-[#F5F2EA] tabular-nums mt-0.5">
                        {formatDuration(routeSummary.durationMillis)} · {formatMiles(routeSummary.distanceMeters)}
                      </p>
                    </div>
                    <a
                      href={directDirectionsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 text-xs font-semibold bg-[#E9B84B] text-[#0B0B0B] hover:bg-[#C99B3C] rounded-sm whitespace-nowrap transition-colors"
                    >
                      Start Nav
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Direct Google Maps Actions */}
            <div className="pt-4 border-t border-[rgba(218,174,77,0.16)] flex flex-col sm:flex-row gap-3">
              <a
                href={directDirectionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-gold-sheen flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 text-xs font-semibold bg-[#E9B84B] text-[#0B0B0B] hover:bg-[#C99B3C] transition-all duration-200 rounded-sm whitespace-nowrap"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Direct Directions</span>
              </a>
              <a
                href={mapsPlaceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 text-xs font-semibold text-[#F5F2EA] border border-[rgba(218,174,77,0.35)] hover:border-[#E9B84B] hover:text-[#E9B84B] transition-colors rounded-sm whitespace-nowrap"
              >
                <span>Open Shop Pin</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Right Panel: Interactive Google Map */}
          <div className="lg:col-span-7 rounded-sm overflow-hidden border border-[rgba(218,174,77,0.28)] bg-[#141414] min-h-[420px] lg:min-h-[480px] relative shadow-[0_24px_60px_-20px_rgba(0,0,0,0.85)]">
            <BorderBeam
              duration={12}
              size={300}
              borderWidth={1.5}
              className="from-transparent via-[#E9B84B]/80 to-transparent"
            />
            {apiKey ? (
              <APIProvider apiKey={apiKey} libraries={['routes', 'marker']} language="en" region="US">
                <GoogleMap
                  mapId="DEMO_MAP_ID"
                  defaultCenter={SHOP_COORDS}
                  defaultZoom={16}
                  gestureHandling="cooperative"
                  colorScheme="DARK"
                  mapTypeControl={false}
                  streetViewControl={true}
                  fullscreenControl={true}
                  internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                  className="w-full h-[420px] lg:h-full min-h-[420px]"
                >
                  <ShopMarkerAndInfo
                    address={address}
                    rating={rating}
                    reviewCount={reviewCount}
                    directDirectionsUrl={directDirectionsUrl}
                  />
                  <RouteOverlay
                    origin={activeOrigin}
                    travelMode={travelMode}
                    onRouteComputed={setRouteSummary}
                    onError={setRouteError}
                    onLoadingChange={setRouteLoading}
                  />
                </GoogleMap>
              </APIProvider>
            ) : (
              <div className="w-full h-full min-h-[420px] flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-[#141414] via-[#1C1B18] to-[#0B0B0B] space-y-4">
                <div className="w-14 h-14 rounded-full bg-[#E9B84B]/15 border border-[#E9B84B]/40 flex items-center justify-center">
                  <MapPin className="w-7 h-7 text-[#E9B84B]" />
                </div>
                <div className="space-y-1.5 max-w-md">
                  <h3 className="font-serif text-2xl text-[#F5F2EA]">Xecutive Cutz — Dallas</h3>
                  <p className="text-sm text-[#A5A29B]">{address}</p>
                  <p className="text-xs text-[#A5A29B]/80 font-mono">
                    32.7944° N, 96.7776° W
                  </p>
                </div>
                <a
                  href={directDirectionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-gold-sheen inline-flex items-center gap-2 px-6 py-3 text-xs font-semibold bg-[#E9B84B] text-[#0B0B0B] hover:bg-[#C99B3C] rounded-sm transition-colors"
                >
                  <Navigation className="w-4 h-4" />
                  <span>Open Turn-by-Turn Google Maps</span>
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
