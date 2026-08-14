# M300 Waypoint V2 USB ACM troubleshooting

Last validated: 2026-08-14

## Failure signatures

| Error | Meaning in this setup |
| --- | --- |
| `Failed to initialize ACM Linker channel` followed by SDK code `4294967295` (`0xFFFFFFFF`) | The DJI USB ACM transport is absent or owned by VirtualHere. |
| Waypoint V2 `init()` SDK code `3` (`Request timeout`) | The ACM node exists, but the aircraft did not complete the OSDK firewall-policy exchange. Check the E-Port switch, cable, and USB ownership. |
| Service startup times out near 45 seconds | The initial ACM/firewall handshake can exceed the old timeout. The simulator service uses 75 seconds. |

UART `/dev/ttyUSB0` is enough for telemetry and basic flight control. M300
Waypoint V2 also requires the E-Port USB ACM connection. This matches
[DJI Onboard-SDK issue 616](https://github.com/dji-sdk/Onboard-SDK/issues/616).

## Working simulator wiring

```text
M300 maintenance USB -> Alienware -> DJI Assistant 2 simulator
M300 E-Port UART -> Soysan /dev/ttyUSB0
M300 E-Port USB, USB ID switch set to Device -> Soysan /dev/dji_ACM
operator -> Moonlight -> Alienware
```

Keep `virtualhere.service` stopped in this mode. VirtualHere exports the entire
`2ca3:001f` device and prevents Soysan from owning its `cdc_acm` interface.

## Stable ACM path

`ttyACM0` can return as `ttyACM1` after a power cycle. Install
[`soysan/99-dji-acm.rules`](../soysan/99-dji-acm.rules) on Soysan as
`/etc/udev/rules.d/99-dji-acm.rules`, reload udev, and configure both OSDK
`UserConfig.txt` files with:

```text
acm_port: /dev/dji_ACM
```

Do not print or copy the app key while checking the configuration.

## Recovery procedure

1. Confirm the aircraft is grounded. Stop the simulator and power off the M300.
2. Set the E-Port kit USB ID switch to **Device** and use a USB data cable to
   Soysan.
3. Stop `virtualhere.service` so Soysan can bind the DJI interfaces locally.
4. Power on the controller and aircraft. Start DJI Assistant and reset/start
   the simulator.
5. Verify the local links:

   ```bash
   test -c /dev/ttyUSB0 && echo "OSDK UART ready"
   test -c /dev/dji_ACM && echo "OSDK USB ACM ready"
   readlink -f /dev/dji_ACM
   ```

6. Restart `soysan-command.service` once. Keep the simulator-only startup
   timeout at 75 seconds.
7. Connect a telemetry client and confirm these startup events:

   ```text
   request upload policy file type:0
   request upload policy file type:1
   request upload policy file type:2
   request upload policy file success
   Activation successful
   Start package 6 result: 0
   ```

8. Require fresh grounded telemetry: aircraft connected, motors off, relative
   altitude within ±0.2 m, and speed below 0.1 m/s.
9. Run the four-waypoint, 30 m `plot720` mission first. Verify init, upload,
   start, all four corners, return-to-home, and final grounded telemetry.

Do not retry `0xFFFFFFFF` without repairing the USB path. Do not substitute
sequential `goto_waypoint` commands and call that a Waypoint V2 pass.

## Validated plot 720 result

The first run had no ACM node and failed with `0xFFFFFFFF`. Manually exposing
an ACM node changed the failure to SDK code `3`, but the firewall policy was
still not exchanged. The successful recovery was:

1. Stop VirtualHere.
2. Power-cycle the aircraft with the E-Port USB ID switch set to **Device**.
3. Let `rndis_host`, `usb-storage`, and `cdc_acm` bind automatically.
4. Use the stable `/dev/dji_ACM` path and restart the command service.

The 2026-08-14 simulator test then completed the native four-waypoint plot 720
mission at 30 m, returned home, and landed. Final telemetry reported flight
status `0`, motors off, relative altitude `-0.00025 m`, speed below
`0.000002 m/s`, 15 satellites, and GPS control level 5. The service started
shared package 6 once, created no package 0, and logged no
`SUBSCRIBER_MULTIPLE_SUBSCRIBE` error.

Simulator overrides skipped five payload actions (one gimbal action and four
photo actions) and allowed GPS fallback for simulator RTK. The route and native
Waypoint V2 lifecycle passed; camera capture and real-aircraft RTK did not.

## Switching back to VirtualHere

Ground the simulator and stop OSDK mission activity before starting
`virtualhere.service`. Once VirtualHere owns `2ca3:001f`, `/dev/dji_ACM` is not
available to Soysan, so native Waypoint V2 cannot run through that same USB
device. Restart the local-ACM recovery sequence before the next Waypoint V2
test.
