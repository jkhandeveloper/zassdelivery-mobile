import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  Marker,
  type CameraRef,
  type LngLat,
  type LngLatBounds,
  type MapProps,
} from "@maplibre/maplibre-react-native";
import { Bike, Crosshair, Home, Store } from "lucide-react-native";
import * as React from "react";
import { Linking, Pressable, Text, View } from "react-native";

import { useTheme } from "@/components/providers/theme-provider";
import type { Coordinates } from "@/lib/socket-events";

/**
 * Where the food is, on a map.
 *
 * Drawn with MapLibre on OpenFreeMap's vector tiles: open source end to end,
 * no API key, no billing account, and the same engine and tiles on Android,
 * iOS and the web app. Three things shape everything below.
 *
 * **The rider has to move, not teleport.** Position reports arrive every few
 * seconds, so a marker bound straight to the latest fix jumps between distant
 * points and reads as a bug. `useGlidingPosition` eases from the last drawn
 * point to the new fix, so the dot slides.
 *
 * **The camera must not fight the user.** Auto-fitting the viewport to the
 * markers is right on first paint and wrong the instant someone pans to look
 * ahead down the road — at which point re-fitting every few seconds makes the
 * map unusable. So auto-fit stops for good once the user touches it, and a
 * recentre button gives it back deliberately.
 *
 * **A straight line is not a route.** There is no directions API here, and the
 * `distanceKm` the server reports is straight-line too. The line is drawn
 * dashed and labelled as direct distance rather than dressed up as a road
 * route the rider is not necessarily taking.
 */

interface DeliveryMapProps {
  /** Where the rider collects from. */
  pickup: Coordinates | null;
  /** Null for an address that never resolved to coordinates. */
  destination: Coordinates | null;
  rider: Coordinates | null;
  restaurantName: string;
  /** Straight-line distance left, as reported by the server. */
  distanceKm: number | null;
  height?: number;
}

/** OpenFreeMap: free hosted OpenStreetMap tiles with no key and no request cap. */
const MAP_STYLE = {
  light: "https://tiles.openfreemap.org/styles/liberty",
  dark: "https://tiles.openfreemap.org/styles/dark",
} as const;

/**
 * Required by the OpenStreetMap licence. The styles carry no attribution of
 * their own, so MapLibre's built-in ornament would be empty — this replaces it.
 */
const ATTRIBUTION = "© OpenFreeMap © OpenMapTiles © OpenStreetMap";
const ATTRIBUTION_URL = "https://www.openstreetmap.org/copyright";

/** Padding so markers do not sit under the map's edges or the recentre button. */
const FIT_PADDING = { top: 70, right: 60, bottom: 70, left: 60 };

/** Roughly a 1.5 km view — used when there is only one place to show. */
const SINGLE_POINT_ZOOM = 14.5;

/**
 * Points closer together than this (about 200 m) are framed as one place.
 * Fitting bounds around a rider standing at the restaurant would otherwise
 * zoom to the maximum, a view of one rooftop.
 */
const MIN_FIT_SPAN_DEGREES = 0.002;

/**
 * How long one slide between fixes takes. Slightly under the reporting
 * interval, so each slide finishes just before the next fix arrives rather
 * than being cut short by it.
 */
const GLIDE_MS = 1_200;

function toLngLat(point: Coordinates): LngLat {
  return [point.longitude, point.latitude];
}

function boundsOf(points: Coordinates[]): LngLatBounds {
  const longitudes = points.map((point) => point.longitude);
  const latitudes = points.map((point) => point.latitude);

  return [
    Math.min(...longitudes),
    Math.min(...latitudes),
    Math.max(...longitudes),
    Math.max(...latitudes),
  ];
}

type CameraView =
  | { center: LngLat; zoom: number }
  | { bounds: LngLatBounds; padding: typeof FIT_PADDING };

/** The camera view that frames every point: fitted bounds, or one place. */
function viewFor(points: Coordinates[]): CameraView {
  const [west, south, east, north] = boundsOf(points);

  if (east - west < MIN_FIT_SPAN_DEGREES && north - south < MIN_FIT_SPAN_DEGREES) {
    return { center: [(west + east) / 2, (south + north) / 2], zoom: SINGLE_POINT_ZOOM };
  }

  return { bounds: [west, south, east, north], padding: FIT_PADDING };
}

/**
 * The rider's position as drawn: eased from wherever the dot is now to the
 * latest fix, rather than snapped to it.
 *
 * Keyed on the coordinates themselves, not the object — the screen builds a
 * fresh `{ latitude, longitude }` on every render, and restarting the slide
 * for an unchanged fix would make the dot stutter.
 */
function useGlidingPosition(target: Coordinates | null): Coordinates | null {
  const [shown, setShown] = React.useState<Coordinates | null>(target);
  /** The last drawn point, where the next slide starts from. */
  const drawn = React.useRef<Coordinates | null>(target);

  const latitude = target?.latitude ?? null;
  const longitude = target?.longitude ?? null;

  React.useEffect(() => {
    if (latitude === null || longitude === null) {
      drawn.current = null;
      return;
    }

    // The first fix is a jump by definition — there is nowhere to slide from,
    // so it "slides" from itself and lands on the first frame.
    const from = drawn.current ?? { latitude, longitude };

    const startedAt = Date.now();
    let frame = 0;

    const step = () => {
      const t = Math.min(1, (Date.now() - startedAt) / GLIDE_MS);
      // Ease-out: quick to respond, gentle to arrive.
      const eased = t * (2 - t);

      drawn.current = {
        latitude: from.latitude + (latitude - from.latitude) * eased,
        longitude: from.longitude + (longitude - from.longitude) * eased,
      };
      setShown(drawn.current);

      if (t < 1) {
        frame = requestAnimationFrame(step);
      }
    };

    frame = requestAnimationFrame(step);

    return () => cancelAnimationFrame(frame);
  }, [latitude, longitude]);

  return latitude === null ? null : shown;
}

function MarkerPin({
  children,
  color,
  label,
}: {
  children: React.ReactNode;
  color: string;
  label: string;
}) {
  return (
    <View
      accessibilityLabel={label}
      className="h-9 w-9 items-center justify-center rounded-full border-2 border-white"
      style={{
        backgroundColor: color,
        shadowColor: "#031220",
        shadowOpacity: 0.3,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
      }}
    >
      {children}
    </View>
  );
}

export function DeliveryMap({
  pickup,
  destination,
  rider,
  restaurantName,
  distanceKm,
  height = 260,
}: DeliveryMapProps) {
  const { resolved } = useTheme();
  const cameraRef = React.useRef<CameraRef>(null);

  /**
   * True once the user has moved the camera themselves.
   *
   * A ref, not state: nothing renders differently because of it, and making it
   * state would re-render the map on the first pan for no reason.
   */
  const userMovedCamera = React.useRef(false);

  const [ready, setReady] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  const riderShown = useGlidingPosition(rider);

  /** Every point that should be in frame — the real fix, not the gliding one. */
  const points = React.useMemo(
    () => [pickup, destination, rider].filter((point): point is Coordinates => point !== null),
    [pickup, destination, rider],
  );

  const fitToMarkers = React.useCallback(
    (animated: boolean) => {
      const camera = cameraRef.current;

      if (camera === null || points.length === 0) {
        return;
      }

      const duration = animated ? 500 : 0;
      const view = viewFor(points);

      if ("center" in view) {
        camera.easeTo({ ...view, duration });
        return;
      }

      camera.fitBounds(view.bounds, { padding: view.padding, duration, easing: "ease" });
    },
    [points],
  );

  // Re-fit as points appear — a rider being assigned mid-delivery adds a third
  // marker that would otherwise be off-screen — but never after a manual pan.
  React.useEffect(() => {
    if (!ready || userMovedCamera.current) {
      return;
    }

    fitToMarkers(true);
  }, [ready, fitToMarkers]);

  /** Pinch, pan and double-tap all report as user interaction. */
  const onRegionDidChange: MapProps["onRegionDidChange"] = (event) => {
    if (event.nativeEvent.userInteraction) {
      userMovedCamera.current = true;
    }
  };

  if (points.length === 0) {
    return (
      <View
        className="items-center justify-center rounded-card border border-border-subtle bg-surface-muted"
        style={{ height }}
      >
        <Text className="px-6 text-center font-sans text-[13px] text-muted">
          The map appears once the business confirms your order.
        </Text>
      </View>
    );
  }

  return (
    <View className="overflow-hidden rounded-card border border-border-subtle" style={{ height }}>
      <Map
        style={{ flex: 1 }}
        mapStyle={resolved === "dark" ? MAP_STYLE.dark : MAP_STYLE.light}
        onDidFinishLoadingMap={() => {
          setFailed(false);
          setReady(true);
        }}
        onDidFailLoadingMap={() => setFailed(true)}
        onRegionDidChange={onRegionDidChange}
        // The customer is watching a delivery, not navigating. Every one of
        // these is either useless here or a way to get lost.
        touchRotate={false}
        touchPitch={false}
        compass={false}
        logo={false}
        attribution={false}
        accessibilityLabel="Map showing your order on its way"
      >
        {/* Applied once, on mount; later framing goes through `fitToMarkers`. */}
        <Camera ref={cameraRef} initialViewState={viewFor(points)} />

        {/* Direct distance, not a road route — dashed to say so. */}
        {riderShown !== null && destination !== null ? (
          <GeoJSONSource
            id="rider-leg"
            data={{
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: [toLngLat(riderShown), toLngLat(destination)],
              },
            }}
          >
            <Layer
              id="rider-leg-line"
              type="line"
              layout={{ "line-cap": "round" }}
              paint={{ "line-color": "#5B46D9", "line-width": 3, "line-dasharray": [2, 2] }}
            />
          </GeoJSONSource>
        ) : null}

        {pickup !== null ? (
          <Marker id="pickup" lngLat={toLngLat(pickup)} anchor="center">
            <MarkerPin color="#D9480F" label={`${restaurantName}, picking up from here`}>
              <Store size={17} color="#FFFFFF" />
            </MarkerPin>
          </Marker>
        ) : null}

        {destination !== null ? (
          <Marker id="destination" lngLat={toLngLat(destination)} anchor="center">
            <MarkerPin color="#0E7490" label="Your address">
              <Home size={17} color="#FFFFFF" />
            </MarkerPin>
          </Marker>
        ) : null}

        {/* Last, so the moving dot draws above the restaurant it has just left. */}
        {riderShown !== null ? (
          <Marker id="rider" lngLat={toLngLat(riderShown)} anchor="center">
            <MarkerPin
              color="#5B46D9"
              label={`Your rider${distanceKm !== null ? `, ${distanceKm.toFixed(1)} km away` : ""}`}
            >
              <Bike size={17} color="#FFFFFF" />
            </MarkerPin>
          </Marker>
        ) : null}
      </Map>

      {/*
        Tiles come over the network, so a phone with no signal gets a blank
        canvas. Say so rather than leave an empty box that looks broken.
      */}
      {failed ? (
        <View className="absolute inset-0 items-center justify-center bg-surface-muted/90">
          <Text className="px-6 text-center font-sans text-[13px] text-muted">
            {"The map couldn't load. Check your connection — the rider's position still updates."}
          </Text>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Recentre the map on your delivery"
        onPress={() => {
          userMovedCamera.current = false;
          fitToMarkers(true);
        }}
        className="absolute right-3 top-3 h-10 w-10 items-center justify-center rounded-full border border-border-subtle bg-surface"
        style={{
          shadowColor: "#031220",
          shadowOpacity: 0.2,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 3,
        }}
      >
        <Crosshair size={18} color="#0E7490" />
      </Pressable>

      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Map data copyright OpenStreetMap contributors"
        onPress={() => void Linking.openURL(ATTRIBUTION_URL)}
        className="absolute bottom-0 right-0 rounded-tl bg-white/75 px-1.5 py-0.5"
      >
        <Text className="font-sans text-[9px] text-black/70">{ATTRIBUTION}</Text>
      </Pressable>
    </View>
  );
}
