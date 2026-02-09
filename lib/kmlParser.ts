/* ------------------------------------------------------------------ */
/*  KML Parser — extracts polygon Placemarks from a KML file string   */
/*                                                                     */
/*  KML coordinate format: "lng,lat,alt lng,lat,alt ..."               */
/*  We convert to { lat, lng } for our Firestore schema.              */
/* ------------------------------------------------------------------ */

export interface ParsedPolygon {
  name: string;
  corners: { lat: number; lng: number }[];
}

/**
 * Parse a KML string and return all Placemarks that contain a Polygon.
 * Each polygon's coordinates are extracted from
 * `<Polygon><outerBoundaryIs><LinearRing><coordinates>`.
 */
export function parseKml(kmlText: string): ParsedPolygon[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(kmlText, "application/xml");

  // Check for XML parse errors
  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    throw new Error("Invalid KML file: " + parseError.textContent?.slice(0, 200));
  }

  const placemarks = doc.querySelectorAll("Placemark");
  const results: ParsedPolygon[] = [];

  placemarks.forEach((pm) => {
    const polygon = pm.querySelector("Polygon");
    if (!polygon) return;

    // Get the placemark name (fallback to "Unnamed Plot")
    const nameEl = pm.querySelector("name");
    const name = nameEl?.textContent?.trim() || "Unnamed Plot";

    // Extract coordinates from outerBoundaryIs > LinearRing > coordinates
    const coordsEl = polygon.querySelector(
      "outerBoundaryIs > LinearRing > coordinates"
    );
    if (!coordsEl?.textContent) return;

    const rawCoords = coordsEl.textContent.trim();

    // KML coords are "lng,lat,alt" separated by whitespace
    const corners: { lat: number; lng: number }[] = [];
    const tuples = rawCoords.split(/\s+/).filter(Boolean);

    for (const tuple of tuples) {
      const parts = tuple.split(",");
      if (parts.length < 2) continue;

      const lng = parseFloat(parts[0]);
      const lat = parseFloat(parts[1]);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      corners.push({ lat, lng });
    }

    // KML polygons repeat the first coordinate at the end — remove the duplicate
    if (
      corners.length > 1 &&
      corners[0].lat === corners[corners.length - 1].lat &&
      corners[0].lng === corners[corners.length - 1].lng
    ) {
      corners.pop();
    }

    if (corners.length >= 3) {
      results.push({ name, corners });
    }
  });

  return results;
}
