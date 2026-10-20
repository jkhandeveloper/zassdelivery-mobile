import {
  Camera,
  Map,
  Marker,
  type CameraRef,
} from "@maplibre/maplibre-react-native";
import { Check, Crosshair, Store, TriangleAlert } from "lucide-react-native";
import * as React from "react";
import { Text, View } from "react-native";

import { useTheme } from "@/components/providers/theme-provider";
import { Button } from "@/components/ui/button";
import { Body } from "@/components/ui/primitives";
import { useGeolocation, useZones } from "@/hooks/use-geo";
import { resolveZone, type Coordinates } from "@/types/geo";

/** OpenFreeMap: the same keyless tiles the delivery map draws with. */
const MAP_STYLE = {
  light: "https://tiles.openfreemap.org/styles/liberty",
  dark: "https://tiles.openfreemap.org/styles/dark",
} as const;

/** Pabbi, where the first zones are, before anything better is known. */
const DEFAULT_CENTER: Coordinates = { latitude: 34.0088, longitude: 71.7881 };

/** Close enough to see the street the shop is on. */
const PIN_ZOOM = 16;

/**
 * Where the shop is, to the doorstep.
 *
 * Riders are sent here to collect and every delivery is priced from it, so the
 * vendor taps the exact spot on the map — or starts from the phone's position
 * and taps to correct it. The point is checked against the published zones as
 * it moves, the same way the API checks it, so an out-of-area pin is caught
 * here rather than on save.
 */
export function ShopLocationPicker({
  value,
  onChange,
}: {
  value: Coordinates | null;
  onChange: (point: Coordinates) => void;
}) {
  const { resolved } = useTheme();
  const zones = useZones();
  const geolocation = useGeolocation();
  const cameraRef = React.useRef<CameraRef>(null);

  const zoneList = React.useMemo(() => zones.data ?? [], [zones.data]);
  const match = value === null ? null : resolveZone(value, zoneList);

  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // A device fix becomes the pin, once, when it lands — and the map follows it.
  const fix = geolocation.status === "ready" ? geolocation.coordinates : null;
  React.useEffect(() => {
    if (fix === null) return;
    onChangeRef.current(fix);
    cameraRef.current?.easeTo({
      center: [fix.longitude, fix.latitude],
      zoom: PIN_ZOOM,
      duration: 500,
    });
  }, [fix]);

  const start =
    value ??
    (zoneList.length > 0
      ? { latitude: zoneList[0].centerLat, longitude: zoneList[0].centerLng }
      : DEFAULT_CENTER);

  return (
    <View className="gap-2">
      <Text className="font-sans text-[14px] font-semibold text-primary">
        Shop location
      </Text>
      <Body muted className="text-[13px]">
        Tap the map where your shop is. Riders come here to collect, and
        delivery is priced from it.
      </Body>

      <Button
        size="sm"
        variant="outline"
        loading={geolocation.status === "locating"}
        onPress={geolocation.locate}
        icon={<Crosshair size={15} color="#0E7490" />}
      >
        Use my current location
      </Button>

      {geolocation.status === "error" ? (
        <Text className="font-sans text-[13px] text-warning">
          {geolocation.message} You can tap the map instead.
        </Text>
      ) : null}

      <View className="h-64 overflow-hidden rounded-input border border-border-subtle">
        <Map
          style={{ flex: 1 }}
          mapStyle={resolved === "dark" ? MAP_STYLE.dark : MAP_STYLE.light}
          onPress={(event) => {
            const [longitude, latitude] = event.nativeEvent.lngLat;
            onChange({ latitude, longitude });
          }}
          touchRotate={false}
          touchPitch={false}
          compass={false}
          logo={false}
          attribution={false}
          accessibilityLabel="Map: tap to place your shop"
        >
          <Camera
            ref={cameraRef}
            initialViewState={{
              center: [start.longitude, start.latitude],
              zoom: value === null ? 13 : PIN_ZOOM,
            }}
          />

          {value !== null ? (
            <Marker
              id="shop"
              lngLat={[value.longitude, value.latitude]}
              anchor="center"
            >
              <View
                accessibilityLabel="Your shop"
                className="h-9 w-9 items-center justify-center rounded-full border-2 border-white"
                style={{ backgroundColor: "#0E7490", elevation: 4 }}
              >
                <Store size={17} color="#FFFFFF" />
              </View>
            </Marker>
          ) : null}
        </Map>
      </View>
      <Text className="font-sans text-[10px] text-muted">
        © OpenFreeMap © OpenMapTiles © OpenStreetMap
      </Text>

      {value === null ? (
        <Text className="font-sans text-[13px] text-muted">
          No location set yet.
        </Text>
      ) : zones.isPending ? null : match === null ? (
        <View className="flex-row items-start gap-2 rounded-input bg-danger-soft px-3 py-2">
          <TriangleAlert size={15} color="#B91C1C" />
          <Text className="flex-1 font-sans text-[13px] font-medium text-danger">
            This spot is outside every area we deliver in. Tap where your shop
            actually is.
          </Text>
        </View>
      ) : (
        <View className="flex-row items-start gap-2 rounded-input bg-success-soft px-3 py-2">
          <Check size={15} color="#047857" />
          <Text className="flex-1 font-sans text-[13px] font-medium text-success">
            In {match.zone.name}, {match.zone.city.name} ·{" "}
            {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}
          </Text>
        </View>
      )}
    </View>
  );
}

/** Whether a point lies inside a delivery zone, for gating the save button. */
export function useIsInServiceArea(point: Coordinates | null): boolean {
  const zones = useZones();
  return point !== null && resolveZone(point, zones.data ?? []) !== null;
}
