# Tool call schema

Flight-assistant tools (see `app/api/tools` and `app/api/flight-assistant/route.ts`).

---

## Copy-paste (plain text)

```
plotManagement
  action (required): "add" | "update" | "delete" | "list"
  name (required): string
  corners (required): { lat: number; lng: number }[]
  id (auto-generated): string — omit for add; required for update/delete

missionManagement
  action (required): "add" | "update" | "delete" | "list"
  id (auto-generated): string — omit for add; required for update/delete
  name (required): string
  cameraId (required): string — must be an id from cameraSensors (list cameraSensors for valid IDs)
  cameraName (required): string — display name of the camera from cameraSensors
  type (required): "mapping" | "dsm" | "imagePoint" | "recordVideo"
  frontOverlap (required): number 0–100
  sideOverlap (required): number 0–100
  flightHeight (required): number
  flightSpeed (required): number

cameraSensors
  action (required): "add" | "update" | "delete" | "list"
  id (auto-generated): string — omit for add; required for update/delete
  name (required): string
  imageWidth (required): number
  imageHeight (required): number
  focalLength (required): number
  sensorWidth (required): number

executeFlightScript
  procedure (required): "test-flight-script-1"
  parameters (required): Record<string, unknown>
```

---

## plotManagement

Manage agricultural plots — add, update, delete, or list. List first to get IDs for update/delete.


| Parameter | Required | Type                                         |
| --------- | -------- | -------------------------------------------- |
| action    | yes      | `"add"` | `"update"` | `"delete"` | `"list"` |
| name      | yes      | string                                       |
| corners   | yes      | `{ lat: number; lng: number }[]`             |
| id        | auto-generated | string (omit for add; required for update/delete) |


---

## missionManagement

Manage mission types — add, update, delete, or list. List first to get IDs for update/delete. cameraId must be from the set of cameraSensors (list cameraSensors to get valid IDs).


| Parameter    | Required | Type                                                     |
| ------------ | -------- | -------------------------------------------------------- |
| action       | yes      | `"add"` | `"update"` | `"delete"` | `"list"`             |
| id           | auto-generated | string (omit for add; required for update/delete)       |
| name         | yes      | string                                                   |
| cameraId     | yes      | string (id from cameraSensors)                           |
| cameraName   | yes      | string (display name of camera from cameraSensors)       |
| type         | yes      | `"mapping"` | `"dsm"` | `"imagePoint"` | `"recordVideo"` |
| frontOverlap | yes      | number 0–100                                             |
| sideOverlap  | yes      | number 0–100                                             |
| flightHeight | yes      | number                                                   |
| flightSpeed  | yes      | number                                                   |


---

## cameraSensors

Manage camera sensors — add, update, delete, or list. List first to get IDs for update/delete.


| Parameter   | Required | Type                                         |
| ----------- | -------- | -------------------------------------------- |
| action      | yes      | `"add"` | `"update"` | `"delete"` | `"list"` |
| id          | auto-generated | string (omit for add; required for update/delete) |
| name        | yes      | string                                       |
| imageWidth  | yes      | number                                       |
| imageHeight | yes      | number                                       |
| focalLength | yes      | number                                       |
| sensorWidth | yes      | number                                       |


---

## executeFlightScript

Execute the test flight procedure on the drone via WebSocket. Only when WebSocket is connected.


| Parameter  | Required | Type                      |
| ---------- | -------- | ------------------------- |
| procedure  | yes      | `"test-flight-script-1"`  |
| parameters | yes      | `Record<string, unknown>` |


