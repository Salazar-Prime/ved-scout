"""
Test script for local drone_flightplan package.
Builds an AOI from corner coordinates, gets waypoints via create_waypoint, writes a KML file.
See: https://github.com/hotosm/drone-flightplan/tree/main?tab=readme-ov-file#modules
"""
import json
import os
import sys
import xml.etree.ElementTree as ET

# Prefer local drone_flightplan over pip-installed
_scriptDir = os.path.dirname(os.path.abspath(__file__))
if _scriptDir not in sys.path:
    sys.path.insert(0, _scriptDir)

from drone_flightplan.waypoints import create_waypoint

# Plot corner coordinates (lat, lng)
corners = [
    # {"lat": 40.47143272051172, "lng": -86.99444453182494},
    # {"lat": 40.47143104263331, "lng": -86.99414336541017},
    # {"lat": 40.47150290119256, "lng": -86.99414761203109},
    # {"lat": 40.47149665549312, "lng": -86.99444728538874},
    ### SET 2
    {"lat": 40.472427, "lng": -86.99420036983601},
    {"lat": 40.47255932254134, "lng": -86.99360813836627},
    {"lat": 40.472427413383, "lng": -86.99360799999999},
    {"lat": 40.472559, "lng": -86.99385806292733},
]

AGL_M = 10
FORWARD_OVERLAP = 80
SIDE_OVERLAP = 80


def buildAoiGeojson(corners):
    """Build GeoJSON dict with a Polygon AOI. Coordinates: [lng, lat], closed."""
    coords = [[c["lng"], c["lat"]] for c in corners]
    coords.append(coords[0])
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {},
                "geometry": {"type": "Polygon", "coordinates": [coords]},
            }
        ],
    }


def waypointsGeojsonToCoords(waypointsGeojsonStr, altitudeM):
    """Parse create_waypoint GeoJSON string; return list of (lng, lat, alt)."""
    data = json.loads(waypointsGeojsonStr)
    coords = []
    for f in data.get("features", []):
        geom = f.get("geometry")
        if not geom or geom.get("type") != "Point":
            continue
        xy = geom.get("coordinates")  # [lng, lat]
        if xy and len(xy) >= 2:
            coords.append((float(xy[0]), float(xy[1]), altitudeM))
    return coords


def writeKml(coords, outPath):
    """Write a KML file with one LineString. coords: list of (lng, lat, alt)."""
    coordStr = "\n".join(f"{lon},{lat},{alt}" for lon, lat, alt in coords)
    doc = ET.Element("kml", attrib={"xmlns": "http://www.opengis.net/kml/2.2"})
    document = ET.SubElement(doc, "Document")
    nameEl = ET.SubElement(document, "name")
    nameEl.text = "Flight waypoints"
    placemark = ET.SubElement(document, "Placemark")
    ET.SubElement(placemark, "name").text = "Planned path"
    line = ET.SubElement(placemark, "LineString")
    ET.SubElement(line, "coordinates").text = coordStr
    tree = ET.ElementTree(doc)
    ET.indent(tree, space="  ")
    tree.write(outPath, encoding="unicode", method="xml")
    print(f"KML saved to {outPath}")


def main():
    aoi = buildAoiGeojson(corners)
    waypointsStr = create_waypoint(
        aoi,
        AGL_M,
        None,  # gsd
        FORWARD_OVERLAP,
        SIDE_OVERLAP,
        rotation_angle=0.0,
        generate_3d=False,
        no_fly_zones=None,
        take_off_point=None,
        mode="waylines",
    )
    coords = waypointsGeojsonToCoords(waypointsStr, AGL_M)
    if not coords:
        print("No waypoints generated")
        return
    kmlPath = os.path.join(_scriptDir, "path_planner_drone_flightplan.kml")
    writeKml(coords, kmlPath)


if __name__ == "__main__":
    main()
