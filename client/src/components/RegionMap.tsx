import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export type MapMode = "impact" | "investment" | "initiatives" | "risks" | "maturity";
export type RegionMetric = { code: string; nameAr: string; impact: number; investment: number; initiatives: number; risks: number; status: string; maturity?: number };

const KINGDOM_BOUNDS: [[number, number], [number, number]] = [[34.4, 15.9], [55.8, 32.3]];

/** Color scales per mode — impact uses the legend thresholds; others interpolate over the data range. */
function fillExpression(mode: MapMode, max: number): any {
  if (mode === "impact") return ["step", ["get", "impact"], "#C63B3B", 60, "#E2792C", 75, "#C9A227", 85, "#0F6B4B"];
  if (mode === "maturity") return ["step", ["get", "maturity"], "#C63B3B", 1.5, "#E2792C", 2.5, "#C9A227", 3.5, "#3E8E5E", 4.5, "#0E3F36"];
  const ramp = mode === "risks" ? ["#F6DADA", "#C63B3B"] : ["#D8E9DF", "#0E3F36"];
  return ["interpolate", ["linear"], ["get", mode], 0, ramp[0], Math.max(1, max), ramp[1]];
}

function bbox(geom: any): [[number, number], [number, number]] {
  let minX = 180, minY = 90, maxX = -180, maxY = -90;
  const walk = (c: any) => { if (typeof c[0] === "number") { minX = Math.min(minX, c[0]); maxX = Math.max(maxX, c[0]); minY = Math.min(minY, c[1]); maxY = Math.max(maxY, c[1]); } else c.forEach(walk); };
  walk(geom.coordinates);
  return [[minX, minY], [maxX, maxY]];
}

export default function RegionMap({ geojson, metrics, mode, selected, onSelect }: {
  geojson: any; metrics: Record<string, RegionMetric>; mode: MapMode; selected: string | null; onSelect: (code: string | null) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const onSelectRef = useRef(onSelect); onSelectRef.current = onSelect;

  const merged = () => ({ ...geojson, features: geojson.features.map((f: any) => ({ ...f, properties: { ...f.properties, ...(metrics[f.properties.code] ?? {}) } })) });

  // Init once
  useEffect(() => {
    if (!el.current || map.current) return;
    const m = new maplibregl.Map({
      container: el.current, attributionControl: false, dragRotate: false, pitchWithRotate: false,
      style: { version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": "#F5F5F0" } }] },
      bounds: KINGDOM_BOUNDS, fitBoundsOptions: { padding: 24 },
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
    m.on("load", () => {
      m.addSource("regions", { type: "geojson", data: merged(), promoteId: "code" });
      m.addLayer({ id: "regions-fill", type: "fill", source: "regions", paint: { "fill-color": fillExpression(mode, 1), "fill-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.92, 0.8] } });
      m.addLayer({ id: "regions-line", type: "line", source: "regions", paint: { "line-color": "#F5F5F0", "line-width": 1.2 } });
      m.addLayer({ id: "regions-selected", type: "line", source: "regions", filter: ["==", ["get", "code"], ""], paint: { "line-color": "#C9A227", "line-width": 3 } });
      let hovered: string | null = null;
      const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8 });
      m.on("mousemove", "regions-fill", (e) => {
        const f = e.features?.[0]; if (!f) return;
        m.getCanvas().style.cursor = "pointer";
        if (hovered && hovered !== f.properties.code) m.setFeatureState({ source: "regions", id: hovered }, { hover: false });
        hovered = f.properties.code; m.setFeatureState({ source: "regions", id: hovered! }, { hover: true });
        const p = f.properties;
        popup.setLngLat(e.lngLat).setHTML(p.maturity !== undefined ? `<div dir="rtl" style="font-family:inherit;font-size:11px;line-height:1.5"><b>${p.nameAr}</b><br/>نضج الابتكار: ${p.maturity} / 5</div>` : `<div dir="rtl" style="font-family:inherit;font-size:11px;line-height:1.5"><b>${p.nameAr}</b><br/>الأثر المحقق: ${p.impact ?? "—"}% · مبادرات: ${p.initiatives ?? "—"}</div>`).addTo(m);
      });
      m.on("mouseleave", "regions-fill", () => { m.getCanvas().style.cursor = ""; if (hovered) m.setFeatureState({ source: "regions", id: hovered }, { hover: false }); hovered = null; popup.remove(); });
      m.on("click", "regions-fill", (e) => { const code = e.features?.[0]?.properties.code; if (code) onSelectRef.current(code); });
      m.on("click", (e) => { if (!m.queryRenderedFeatures(e.point, { layers: ["regions-fill"] }).length) onSelectRef.current(null); });
      // Arabic labels as HTML markers — avoids needing a glyph server (air-gap)
      for (const f of geojson.features) {
        const d = document.createElement("div");
        d.className = "rounded-md bg-white/85 border border-brand-border px-1.5 py-0.5 text-[9.5px] font-semibold text-brand-text whitespace-nowrap shadow-sm pointer-events-none";
        d.textContent = f.properties.nameAr.replace("منطقة ", "");
        markers.current.push(new maplibregl.Marker({ element: d }).setLngLat([f.properties.labelLng, f.properties.labelLat]).addTo(m));
      }
    });
    map.current = m;
    return () => { markers.current.forEach((x) => x.remove()); m.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geojson]);

  // Data / mode updates
  useEffect(() => {
    const m = map.current; if (!m) return;
    const apply = () => {
      const src = m.getSource("regions") as maplibregl.GeoJSONSource | undefined; if (!src) return;
      src.setData(merged());
      const max = Math.max(...Object.values(metrics).map((x) => (x[mode] as number) ?? 0), 1);
      m.setPaintProperty("regions-fill", "fill-color", fillExpression(mode, max));
    };
    if (m.isStyleLoaded()) apply(); else m.once("load", apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrics, mode]);

  // Selection: highlight + auto-zoom
  useEffect(() => {
    const m = map.current; if (!m) return;
    const apply = () => {
      m.setFilter("regions-selected", ["==", ["get", "code"], selected ?? ""]);
      if (selected) { const f = geojson.features.find((x: any) => x.properties.code === selected); if (f) m.fitBounds(bbox(f.geometry), { padding: 40, duration: 600, maxZoom: 7 }); }
      else m.fitBounds(KINGDOM_BOUNDS, { padding: 24, duration: 600 });
    };
    if (m.isStyleLoaded()) apply(); else m.once("load", apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  return <div ref={el} className="h-full w-full rounded-lg overflow-hidden border border-brand-border" />;
}
