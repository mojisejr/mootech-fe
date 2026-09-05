// features/v2-service/components/SacredMapLeaflet.tsx — แผนที่ Leaflet สำหรับ sacred-map
// โหลดแบบ dynamic(ssr:false) จาก SacredMapScreen (leaflet ต้องการ window). หมุด = สีตามธาตุ.
import { useEffect } from "react"
import L from "leaflet"
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet"

export type MapPin = {
  id: string
  name: string
  deity: string | null
  lat: number
  lng: number
  element: string | null
}

const EL_COLOR: Record<string, string> = {
  wood: "#22c55e", fire: "#ef4444", earth: "#eab308", metal: "#94a3b8", water: "#3b82f6",
}

function pinIcon(element: string | null): L.DivIcon {
  const color = (element && EL_COLOR[element]) || "#1455A4"
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:20px;height:20px;border-radius:50% 50% 50% 0;background:${color};transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)"></span>`,
    iconSize: [20, 20],
    iconAnchor: [10, 20],
    popupAnchor: [0, -18],
  })
}

/** จัดกรอบแผนที่ให้เห็นหมุดทั้งหมด */
function FitBounds({ pins }: { pins: MapPin[] }) {
  const map = useMap()
  useEffect(() => {
    if (!pins.length) return
    if (pins.length === 1) {
      map.setView([pins[0].lat, pins[0].lng], 14)
      return
    }
    const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number]))
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 15 })
  }, [pins, map])
  return null
}

export default function SacredMapLeaflet({ pins, onSelect }: { pins: MapPin[]; onSelect?: (id: string) => void }) {
  const center: [number, number] = pins.length ? [pins[0].lat, pins[0].lng] : [13.7563, 100.5018]
  return (
    <MapContainer center={center} zoom={11} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds pins={pins} />
      {pins.map((p) => (
        <Marker key={p.id} position={[p.lat, p.lng]} icon={pinIcon(p.element)} eventHandlers={{ click: () => onSelect?.(p.id) }}>
          <Popup>
            <b>{p.name}</b>
            {p.deity ? <><br />{p.deity}</> : null}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
