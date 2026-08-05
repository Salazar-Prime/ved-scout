# Orthomosaic Flight-Plan and DJI OSDK Integration Plan

Yes—I mapped the full path. The missing integration is:

```text
AOI + mission + camera
        ↓
Soysan flight-plan generation
        ↓
validated canonical waypoint plan
        ↓
operator reviews and confirms
        ↓
OSDK Waypoint V2 upload + camera actions
        ↓
mission-state telemetry back to web/mobile
```

A DJI KMZ should remain a review/export artifact; OSDK needs the generated points converted into Waypoint V2 structures and uploaded through `vehicle->waypointV2Mission`.

## Implementation status — August 5, 2026

The software integration described below is implemented. The web, DevChat, and
mobile clients now prepare a plan before confirmation and execute only the
reviewed `planId`/SHA-256 pair. Soysan runs the pinned HOT planner, stores an
immutable canonical plan plus KML/KMZ review artifacts, and adapts the plan to
DJI M300 Waypoint V2 camera/gimbal actions. Mission state callbacks are streamed
back to clients, and stop/pause/resume are supported by the OSDK adapter.

Soysan's command service is installed on its Tailscale address at port `8765`,
but `SOYSAN_LIVE_FLIGHT_ENABLED=0` remains enforced. Dummy end-to-end execution
uses the real planner and intentionally stops at the OSDK boundary. Before live
flight is enabled, the remaining gates are a shared server-side command-signing
secret, a props-off upload test, DJI simulator testing where available, and a
small operator-supervised hardware flight.

The live C++ preflight rejects execution unless both M300 batteries are healthy
and at least 50%, GPS control level is at least 4, a valid home point exists, a
connected RTK unit has a fixed solution, and the camera at payload index 0
accepts shoot-photo mode. OSDK 4.1 does not expose an SD-card state API, so
camera storage remains an explicit operator checklist item rather than a claim
made by the automated preflight.

Rollback checkpoints:

- Monorepo: commit `0ebbe34`, tag `pre-flightplan-integration-20260805`.
- Soysan: commit `afb0721`, tag `pre-flightplan-integration-20260805`.

## SSH access completed

I created and installed a dedicated Ed25519 key:

- Alias: `soysan-tailscale`
- Host/user: `usr@100.83.255.62`
- Identity: `~/.ssh/soysan_ed25519`
- Fingerprint: `SHA256:bO7Ev38b6MBIZn0aUXgEYiDck3CsehHLzVAfj8YYMWI`
- Passwordless login verified with `ssh -o BatchMode=yes soysan-tailscale`

No existing SSH credentials were overwritten.

## What exists now

The current request path is:

1. The assistant fetches the plot, mission, and camera and returns an `executeFlightScript` intent from [executeFlightScriptTool.ts](../app/api/tools/executeFlightScriptTool.ts).
2. The DevChat confirmation path correctly sends those objects to Soysan in [page.tsx](../app/dev-ws-chat/page.tsx).
3. The regular flight-script screen drops the plot, mission, and camera before sending in [flightScriptChat.tsx](../features/flightScript/flightScriptChat.tsx).
4. Mobile nests them inside `parameters`, while Soysan expects them at the top level, in [chat.tsx](../mobile/src/app/chat.tsx).
5. Soysan maps `orthomosaic-field-mission` to DJI’s generic flight-control sample and launches it with only `UserConfig.txt`; it never passes the AOI or creates a mission. See [webscoket-for-soysan.py](../webscoket-for-soysan.py).

Soysan itself contains an uncommitted June prototype with:

- A custom dependency-free lawnmower planner.
- Generated waypoint JSON/KML/KMZ examples.
- A custom `soysan-single-command` OSDK binary.
- Initial M300 Waypoint V2 upload, start, and photo-action code.

However, that code is not tracked, not the active service, and does not use the HOT package. The only active Soysan service is the WebSocket latency benchmark on port `8766`; the command/planning server is not running.

## Recommended integration plan

### 1. Define one shared wire contract

Add versioned schemas to `packages/shared` and use them in web, DevChat, mobile, tests, and Soysan.

The main operations will be:

- `prepare_flight_plan`: send plot, mission, camera, and planning options.
- `execute_flight_plan`: send the immutable `planId` and plan hash after review.
- `abort_flight_plan`: stop an active mission.
- Mission events: `planning`, `plan_ready`, `uploading`, `uploaded`, `started`, `in_progress`, `completed`, `aborted`, or `failed`.

This fixes the current client inconsistencies and prevents duplicate execution through command-ID idempotency.

### 2. Integrate the HOT planner on Soysan

Pin the linked package to a specific commit rather than following the moving `dev` branch. Its core API accepts an AOI, overlap, AGL, rotation, and takeoff point and can produce placemarks and DJI WPML/KMZ. [HOT drone-flightplan](https://github.com/hotosm/drone-tm/tree/dev/src/backend/packages/drone-flightplan)

Necessary adaptation:

- Convert plot corners from `{lat, lng}` into a GeoJSON Polygon using `[lng, lat]`.
- Use waypoint mode with explicit photo points, automatic grid rotation, and a nadir gimbal angle.
- Use the actual mission height, overlap, and speed.
- Extend the planner wrapper for the configured camera intrinsics. Upstream currently models several consumer drones but not the M300 RTK/Zenmuse P1 combination found on Soysan.
- Produce:
  - Canonical `plan.json` for OSDK.
  - KML/KMZ for review and diagnostics.
  - Plan summary: waypoint count, route length, duration, photo count, coverage spacing, and battery estimate.
- Store each plan under a server-controlled directory with a plan ID and SHA-256 hash.

The package requires Python 3.10+, Shapely, PyProj, and GDAL 3.10.3, while Soysan currently has Python 3.8 and none of those dependencies. [Upstream pyproject](https://github.com/hotosm/drone-tm/blob/dev/src/backend/packages/drone-flightplan/pyproject.toml) I recommend a pinned Python 3.11/3.12 environment and making GDAL an optional terrain-following dependency for the initial constant-AGL deployment.

### 3. Build the planner-to-OSDK adapter

The HOT-generated placemarks will be normalized into a strict plan schema containing:

- Latitude/longitude in degrees.
- Height relative to the takeoff point.
- Waypoint heading and speed.
- Gimbal pitch.
- `takePhoto` action.
- Finish action and RC-loss behavior.

The existing Soysan C++ prototype will be imported into tracked source and hardened:

- Replace its string-search JSON parser with a real JSON parser.
- Validate every waypoint and parameter before OSDK sees it.
- Query action memory before uploading photo actions.
- Treat action-upload errors as fatal.
- Configure camera mode and nadir gimbal before starting.
- Upload and start the M300 Waypoint V2 mission.
- Implement pause, resume, stop, and emergency abort.
- Register DJI mission-state and mission-event callbacks so “completed” means the aircraft completed the mission—not merely that `start()` returned successfully.

DJI documents Waypoint V2 as supporting waypoint-triggered camera actions and up to 65,535 waypoints/actions, along with start, pause, resume, stop, and mission-state handling. [DJI motion-planning documentation](https://developer.dji.com/onboard-sdk/documentation/tutorial/motion-planning.html)

### 4. Change the operator flow

Planning itself does not move the aircraft, so it can happen before the dangerous-action confirmation:

1. User requests the orthomosaic.
2. Soysan generates and validates the route.
3. Web/mobile displays the route overlay and summary.
4. Operator confirms the generated plan once.
5. Soysan reruns live preflight checks and dispatches it to OSDK.
6. Progress and final state are streamed back.

Dummy mode will still run the real HOT planner and produce the plan artifacts, but stop at the OSDK boundary.

### 5. Add real preflight gates

Before OSDK upload:

- Valid, non-self-intersecting polygon with at least three unique corners.
- Latitude/longitude range and coordinate-order validation.
- Required camera intrinsics and mapping parameters.
- Altitude, overlap, speed, route-length, waypoint-count, and action-count limits.
- Actual OSDK battery, GPS/RTK health, home position, aircraft model, camera readiness, and storage status.
- Route-duration versus battery reserve.
- Exactly one active aircraft mission.
- Recheck safety between plan preparation and execution.

The current hard-coded `82%` battery value must not be used for live dispatch.

### 6. Secure and deploy the command service

Before enabling live mode:

- Replace the browser-exposed long-lived private key with a short-lived signed command token.
- Bind the service to the Tailscale interface and expose WSS for browser compatibility.
- Install a systemd-managed Soysan command service on port `8765`.
- Keep port `8766` for the existing latency benchmark.
- Add health/capability endpoints, journald logging, plan retention, and rollback configuration.
- Preserve the current remote prototype before replacing anything.

### 7. Verification sequence

Implementation will be validated in this order:

1. Unit and golden-route tests for rectangular and concave AOIs, coordinate ordering, overlaps, camera geometry, and deterministic plan hashes.
2. Shared contract tests covering web, DevChat, mobile, and Soysan.
3. Soysan dummy-mode end-to-end test: request → HOT planner → artifacts → no OSDK.
4. ARM64 build and mocked OSDK tests.
5. OSDK upload-only test with mission start disabled.
6. DJI simulator test where available.
7. Controlled hardware test with an operator present, beginning with props-off/upload validation and then a very small test plot.

Live aircraft execution will remain a separate explicit gate; approving this software plan will not itself authorize a flight.

## Completion criteria

The integration is complete when:

- All clients send the same validated payload.
- Soysan generates a reproducible plan from the requested AOI and mission settings.
- The operator can inspect the actual route before execution.
- OSDK reports successful mission and photo-action upload.
- Mission progress and true completion return to the client.
- Abort works.
- Dummy mode exercises everything except aircraft dispatch.
- No long-lived drone-control secret is embedded in the client.

Assumed target: DJI M300 RTK with Zenmuse P1, waypoint-triggered photos, nadir gimbal, and one plan-review confirmation. Once you approve this plan, I’ll begin with the shared contract and recovery of the existing Soysan prototype into tracked source.
