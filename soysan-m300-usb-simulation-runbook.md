# Soysan M300 USB simulation connection runbook

Last verified: 2026-08-14

This runbook documents both supported DJI Assistant simulator connections:

- Direct USB to Alienware, operated remotely through Moonlight.
- The `soysan-4-m300 simulation` VirtualHere connection to mockingbeat.

Use one method at a time. Soysan retains its separate OSDK serial connection
for Ved Scout commands and telemetry in either method.

## What "simulation" means here

The connection name is a working label. VirtualHere does **not** emulate an
M300 and does not make hardware operations safe by itself. It transports the
real USB device and allows local software to communicate with it.

| Layer | What it does | What it does not do |
| --- | --- | --- |
| VirtualHere | Exposes Soysan's real DJI USB device on the Mac | Emulate an aircraft or block commands |
| DJI Assistant 2 | Communicates with the attached DJI device | Put Ved Scout into dummy mode |
| Ved Scout dummy mode | Runs authentication, validation, safety checks, and logging, then skips the final OSDK dispatch | Prevent other programs from accessing the real USB device |
| DJI simulator | Provides aircraft simulation when configured separately | Start automatically through this USB runbook |

Ved Scout dummy mode is described in
[the repository README](../README.md#soysan-dummy-mode-osdk-bypass). Keep it
enabled when the intent is to exercise the application without dispatching an
OSDK command. Treat DJI Assistant as a real maintenance connection even while
dummy mode is active.

## Choose a simulator host

| Method | Use when | DJI USB path | Operator access |
| --- | --- | --- | --- |
| Alienware direct USB | Alienware is available near the aircraft | M300 directly to Alienware | Moonlight remote desktop |
| mockingbeat over VirtualHere | The USB cable must remain on Soysan | M300 to Soysan, then VirtualHere over Tailscale | Local mockingbeat desktop |

Do not move the USB cable or switch hosts during a simulator test. Stop the
simulator and quit DJI Assistant before switching methods.

## Alienware direct USB through Moonlight

Moonlight carries the Alienware display and input only. It does not forward
USB, DJI telemetry, or OSDK commands.

```text
M300 USB -> Alienware -> DJI Assistant 2 simulator
M300 OSDK serial -> Soysan -> Ved Scout WebSocket service
operator computer -> Moonlight -> Alienware desktop
```

Start a session in this order:

1. Connect the M300 directly to Alienware by USB and power the aircraft.
2. Connect to the Alienware desktop with Moonlight.
3. Open DJI Assistant 2 (Enterprise Series) on Alienware.
4. Confirm that DJI Assistant shows the M300 before opening the simulator.
5. Power and pair the remote controller and select the required flight mode.
6. Open the M300 simulator, reset it on the ground, and start it.
7. Confirm live Soysan telemetry before sending any simulated flight command.

Keep Moonlight connected while visually monitoring the simulator. A Moonlight
disconnect does not intentionally stop Soysan, but visual confirmation is lost;
pause command testing until the remote desktop is restored.

## VirtualHere connection path

```text
DJI USB device "e1e" (USB ID 2ca3:001f)
    -> physical USB port on Soysan
    -> VirtualHere USB Server 4.8.8 on TCP 7575
    -> Soysan tailscale0 interface and host firewall allowlist
    -> Tailscale encrypted network path
    -> VirtualHere Universal Client 6.0.2 on macOS
    -> dynamic /dev/cu.usbmodem* device
    -> DJI Assistant 2 (Enterprise Series)
```

No flight-control process is required to establish this path.

## Incident: DJI Assistant did not detect the M300

On 2026-08-13, VirtualHere showed `e1e (2ca3:001f)` as attached and macOS
created `/dev/cu.usbmodem80105`, but DJI Assistant repeatedly logged
`GetDeviceVersion time out!` on USB endpoint `0x85`. The same failure occurred
on Vendetta, ruling out a Tailscale policy or current-Mac-only DJI installation
problem.

The device recovered after a real USB power cycle. On the current Mac, stopping
ADB before the next attachment prevented it from competing with DJI Assistant
during device initialization. The successful order was:

1. Quit DJI Assistant.
2. Run `adb kill-server`.
3. Release `e1e` in VirtualHere.
4. Power-cycle Soysan's physical USB port. If remote port-power control is not
   available, unplug and reconnect the USB cable.
5. Confirm Soysan sees `2ca3:001f` and that the device returned at 480 Mb/s.
6. Attach `e1e` in VirtualHere, then open DJI Assistant.
7. Confirm `pgrep -alf 'VisionStarter2.*pm430m'` returns a process and the M300
   appears in the app.

Releasing and reattaching through VirtualHere alone does not reset a stuck
physical USB device. DJI Assistant did receive hot-plug events, so it does not
require a special physical-plug trigger after a clean re-enumeration.

## Verified configuration

### Soysan

| Item | Value |
| --- | --- |
| SSH alias | `soysan-tailscale` |
| Tailscale address | `100.83.255.62` |
| VirtualHere executable | `/usr/local/sbin/vhusbdarm64` |
| VirtualHere version | `4.8.8` |
| Service | `virtualhere.service`, enabled at boot |
| Service unit | `/etc/systemd/system/virtualhere.service` |
| Server configuration | `/usr/local/etc/virtualhere/config.ini` |
| TCP listener | `7575` |
| Allowed USB ID | `2ca3:001f` only |
| Server name | `soysan-4-m300 simulation` |
| License state | Unlicensed, maximum one shared device |

The server configuration uses `AllowedDevices=2ca3/1f`, so other USB devices
on Soysan are not offered by this VirtualHere instance. It also uses
`AutoAttachToKernel=0` so the exported DJI interface is not automatically
claimed by a local kernel driver.

### Current Mac

| Item | Value |
| --- | --- |
| Tailscale node | `mockingbeat` / `100.82.9.106` |
| VirtualHere app | `/Applications/VirtualHereUniversal.app` |
| VirtualHere client | `6.0.2`, bundle ID `com.virtualhere.client` |
| DJI app | `/Applications/DJI Assistant 2 (Enterprise Series).app` |
| DJI USB identity | Vendor `DJI`, product `e1e`, ID `2ca3:001f` |
| Last observed serial node | `/dev/cu.usbmodem80105` |

The serial node and VirtualHere device address can change after a USB reconnect,
service restart, or device re-enumeration. Discover them each time instead of
hard-coding `/dev/cu.usbmodem80105` or `soysan.124` in automation.

## Start or reconnect the session

### 1. Check the Tailscale path

The Mac App Store build of Tailscale exposes its CLI inside the app bundle:

```bash
soysan_ts=/Applications/Tailscale.app/Contents/MacOS/Tailscale
"$soysan_ts" status | grep -i soysan
"$soysan_ts" ping -c 3 soysan
nc -G 5 -vz 100.83.255.62 7575
```

Expected results:

- Soysan is active in `tailscale status`.
- Tailscale ping receives a response.
- TCP port `7575` accepts the connection.

### 2. Check the server and physical USB device

```bash
ssh -o BatchMode=yes soysan-tailscale \
  'systemctl is-active virtualhere.service; \
   systemctl is-enabled virtualhere.service; \
   lsusb -d 2ca3:001f'
```

Expected results are `active`, `enabled`, and an `lsusb` entry for
`2ca3:001f`. If the USB entry is absent, check the cable, the aircraft-side
port, and device power before changing network or VirtualHere settings.

### 3. Start the Mac client and specify Soysan

VirtualHere discovery broadcasts do not need to cross Tailscale because the
hub is configured explicitly:

```bash
open -a /Applications/VirtualHereUniversal.app

soysan_vh=/Applications/VirtualHereUniversal.app/Contents/MacOS/VirtualHereUniversal
"$soysan_vh" -t 'MANUAL HUB ADD,100.83.255.62:7575'
"$soysan_vh" -t LIST
```

The list should contain a server named `soysan-4-m300 simulation` and one
device named `e1e`.

### 4. Attach only the DJI device

Read the current VirtualHere address from `LIST`, then use that address. The
observed address at the time of verification was `soysan.124`:

```bash
"$soysan_vh" -t LIST
"$soysan_vh" -t 'USE,soysan.124'
"$soysan_vh" -t LIST
```

The final list should show all three indicators:

```text
soysan-4-m300 simulation (soysan:7575)
   --> (/dev/cu.usbmodem...) e1e (...) (In-use by you)
```

Do not use an address copied from this document if `LIST` reports a different
one.

### 5. Open DJI Assistant 2

Attach the USB device before launching DJI Assistant so the app sees a fresh
device enumeration:

```bash
open -a '/Applications/DJI Assistant 2 (Enterprise Series).app'
```

Confirm that DJI Assistant shows the expected M300 or DJI device before
performing any maintenance operation. Device detection was verified at the USB
and serial layers; the model displayed inside the DJI Assistant UI must be
checked visually.

## Verify the active connection

### VirtualHere

```bash
soysan_vh=/Applications/VirtualHereUniversal.app/Contents/MacOS/VirtualHereUniversal
"$soysan_vh" -t LIST
"$soysan_vh" -t 'GET CLIENT STATE'
```

Look for `In-use by you`, device state `3`, vendor `DJI`, and product `e1e`.
The XML state represents the USB IDs as decimal values: vendor `11427` and
product `31` correspond to hexadecimal `2ca3:001f`.

### macOS USB and serial layers

```bash
system_profiler SPUSBDataType | grep -i -A12 -B2 e1e
ioreg -p IOUSB -l -w 0 | grep -i -A20 -B2 e1e
ls -l /dev/cu.usbmodem*
```

The USB inventory should report:

- Manufacturer: `DJI`
- Product: `e1e`
- Vendor ID: `0x2ca3`
- Product ID: `0x001f`
- Speed: up to 480 Mb/s in the last verified session

### Soysan server log

```bash
ssh soysan-tailscale \
  'journalctl -u virtualhere.service --since "10 minutes ago" --no-pager | \
   grep -Ei "2ca3:001f|connected|BOUND|UNBOUND|error"'
```

A successful session records the Mac's Tailscale address connecting and device
`2ca3:001f` becoming `BOUND`.

## Disconnect cleanly

Quit DJI Assistant first, then release the device with its current VirtualHere
address:

```bash
soysan_vh=/Applications/VirtualHereUniversal.app/Contents/MacOS/VirtualHereUniversal
"$soysan_vh" -t LIST
"$soysan_vh" -t 'STOP USING,soysan.124'
```

Verify that `In-use by you` disappears. The server can remain running for the
next session.

Auto-use is intentionally disabled. This prevents the Mac from unexpectedly
claiming the DJI device when another approved workstation needs it.

## Network access and a new client Mac

Two independent controls must allow the connection:

1. The tailnet policy must permit the client node to reach Soysan on TCP 7575.
2. Soysan's `VH_DJI` iptables chain must allow the client's Tailscale IP.

Soysan's base service unit permits the previously approved client
`100.114.139.59`. The current Mac is persisted through this systemd drop-in:

```text
/etc/systemd/system/virtualhere.service.d/10-current-mac.conf
```

```ini
[Service]
ExecStartPre=/usr/sbin/iptables -I VH_DJI 1 -i tailscale0 -s 100.82.9.106/32 -j ACCEPT
```

For a replacement Mac, obtain its Tailscale IPv4 address, create an equivalent
root-owned drop-in using that address, then reload and restart the service:

```bash
sudo systemctl daemon-reload
sudo systemctl restart virtualhere.service
sudo iptables -S VH_DJI
```

Keep the rule limited to `tailscale0` and the specific client `/32`. Do not
publish port 7575 to the public internet. Do not put sudo passwords, VirtualHere
remote-access identifiers, or other credentials in this repository.

## Troubleshooting

### Tailscale ping works but port 7575 times out

Check both the tailnet policy and Soysan's host allowlist:

```bash
ssh soysan-tailscale 'sudo iptables -S VH_DJI'
```

The client IP must appear in an `ACCEPT` rule before the final `DROP` rule. The
initial failure on 2026-08-13 was caused by this chain allowing only an older
Mac's Tailscale address.

An SSH port-forward is not a workaround for the current rules: the broad
`VH_DJI` input chain also drops a connection to Soysan's local port 7575 unless
its source is explicitly allowed.

### VirtualHere lists Soysan but not `e1e`

```bash
ssh soysan-tailscale 'lsusb -d 2ca3:001f'
ssh soysan-tailscale 'journalctl -u virtualhere.service -n 100 --no-pager'
```

If `lsusb` sees the target but VirtualHere does not, restart only the forwarding
service and inspect its log:

```bash
ssh -t soysan-tailscale 'sudo systemctl restart virtualhere.service'
```

### The device is in use by another client

VirtualHere permits only one client to own a USB device at a time, and this
unlicensed server is limited to one exported device. Coordinate with the other
operator and ask them to stop using the device. Do not force-disconnect another
operator during a firmware update, calibration, log transfer, or other active
operation.

### The serial path changed

This is expected after re-enumeration. Use `VirtualHere -t LIST` or list
`/dev/cu.usbmodem*` again and pass the newly reported path to any local tooling.

### DJI Assistant does not show the device

1. Confirm VirtualHere says `In-use by you`.
2. Confirm `system_profiler` reports `DJI e1e` with ID `2ca3:001f`.
3. Check whether an Android Debug Bridge server is running:

   ```bash
   pgrep -alf adb
   ```

4. Quit DJI Assistant, stop ADB, and then release and reattach the device:

   ```bash
   osascript -e 'tell application id "DJI.Assistant" to quit'
   adb kill-server

   soysan_vh=/Applications/VirtualHereUniversal.app/Contents/MacOS/VirtualHereUniversal
   "$soysan_vh" -t LIST
   "$soysan_vh" -t 'STOP USING,soysan.124'
   "$soysan_vh" -t 'USE,soysan.124'
   open -b DJI.Assistant
   ```

   Replace `soysan.124` with the address reported by `LIST`. Stopping ADB before
   attachment matters: the 2026-08-13 failure was an initialization race in
   which another USB-aware process opened the newly forwarded composite device
   before DJI Assistant completed its handshake.

5. Confirm DJI recognized the M300 generation rather than relying only on the
   presence of the serial device:

   ```bash
   pgrep -alf 'VisionStarter2.*pm430m'
   ```

   A running `VisionStarter2` process containing `pm430m` was the verified
   success signal on both the current Mac and Vendetta.

6. If DJI still logs repeated `GetDeviceVersion time out!` messages or USB
   endpoint `0x85` timeouts, fully power-cycle the physical USB port before
   trying the sequence again. Releasing the device in VirtualHere is not the
   same as removing USB power. The working session used a real port-power cycle
   on Soysan and the device returned at 480 Mb/s. If remote port-power control
   is unavailable, wait until someone can physically unplug and reconnect it.

7. Inspect the Soysan service journal for a disconnect or `UNBOUND` event.

The device-arrival event itself was detected correctly during the failed
attempts. DJI Assistant does react to hot-plug events; no separate physical-plug
trigger is required once the USB device has re-enumerated cleanly.

### OSDK rejects motor start with `0xb0000000091`

This occurred while the simulator, controller, command authorization, and OSDK
control authority all appeared ready. Motor start and automatic takeoff were
rejected, but telemetry stayed grounded and motor-off remained safe.

Power-cycle the aircraft, wait for Soysan to report fresh grounded telemetry,
then retry motor-on once. On 2026-08-14 the existing Soysan service recovered
without a manual restart, recreated shared subscription package 6 once, and
then completed motor-on and motor-off successfully. If the code repeats after
one power cycle, stop flight testing and inspect DJI Assistant and controller
warnings rather than repeatedly sending flight commands.

### DJI Assistant is running but its window is absent from screenshots

DJI Assistant's `DJIBrowser` window can opt out of macOS window sharing. In that
case, screenshots and screen-sharing software may show the desktop underneath
the app even though its window is frontmost and visible on the local display.
This does not indicate a USB failure. Verify the live device module instead:

```bash
pgrep -alf 'VisionStarter2.*pm430m'
```

On 2026-08-13 the local display showed the window and connected device while
macOS screenshots omitted the window contents.

## Safety and security notes

- This path exposes a real DJI USB device. The word `simulation` in the
  connection name is not a safety interlock.
- Ved Scout dummy mode stops its own final OSDK dispatch only. It does not
  restrict DJI Assistant or other software with access to the forwarded USB
  device.
- Do not update firmware, calibrate, reset, or change aircraft settings unless
  that operation is explicitly intended and the aircraft is prepared according
  to DJI's procedures.
- VirtualHere reports its application-layer connection as standard TCP. The
  private network path is protected by Tailscale; keep the port scoped to the
  Tailscale interface and approved nodes.
- The Mac VirtualHere client currently runs as an application, not a background
  service. The USB device disconnects when the app exits or the network session
  ends.
- Credentials and remote-access identifiers are intentionally omitted from this
  document.

## Reference

- [VirtualHere USB Client](https://www.virtualhere.com/usb_client_software)
- [VirtualHere Client API](https://www.virtualhere.com/client_api)
- [Ved Scout dummy-mode documentation](../README.md#soysan-dummy-mode-osdk-bypass)
