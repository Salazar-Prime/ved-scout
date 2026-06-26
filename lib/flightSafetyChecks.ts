export const FAA_MAX_ALTITUDE_METERS = 122; // 400 ft AGL

export interface FlightSafetyCheckInput {
  plot: { id: string; name: string; corners: Array<{ lat: number; lng: number }> };
  mission: {
    id: string;
    name: string;
    type: string;
    flightHeight?: number;
    [key: string]: unknown;
  };
  camera: { id: string; name: string; [key: string]: unknown };
}

export interface SafetyCheckItem {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface FlightSafetyCheckResult {
  passed: boolean;
  checks: SafetyCheckItem[];
}

export function runFlightSafetyChecks(args: FlightSafetyCheckInput): FlightSafetyCheckResult {
  const { plot, mission, camera } = args;
  const checks: SafetyCheckItem[] = [];

  // 1. Plot parameters present
  const plotOk = !!(plot?.id && plot?.name && plot?.corners?.length);
  checks.push({
    id: "plot-params",
    label: "Plot details",
    passed: plotOk,
    detail: plotOk
      ? `${plot.name} — ${plot.corners.length} corner(s)`
      : "id, name, and corners are required",
  });

  // 2. Mission parameters present
  const missionOk = !!(mission?.id && mission?.name && mission?.type);
  checks.push({
    id: "mission-params",
    label: "Mission details",
    passed: missionOk,
    detail: missionOk
      ? `${mission.name} (${mission.type})`
      : "id, name, and type are required",
  });

  // 3. Camera parameters present
  const cameraOk = !!(camera?.id && camera?.name);
  checks.push({
    id: "camera-params",
    label: "Camera sensor details",
    passed: cameraOk,
    detail: cameraOk ? camera.name : "id and name are required",
  });

  // 4. FAA altitude limit
  const height = mission?.flightHeight;
  const heightDefined = height !== undefined;
  const heightOk = !heightDefined || (height as number) <= FAA_MAX_ALTITUDE_METERS;
  checks.push({
    id: "faa-altitude",
    label: "FAA altitude limit (122 m / 400 ft)",
    passed: heightOk,
    detail: heightDefined
      ? heightOk
        ? `${height} m — within limit`
        : `${height} m exceeds ${FAA_MAX_ALTITUDE_METERS} m limit`
      : "No flight height set",
  });

  return { passed: checks.every((c) => c.passed), checks };
}
