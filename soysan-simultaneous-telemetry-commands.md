# Simultaneous Soysan telemetry and commands

## Previous flow

The C++ daemon used package 6 only when Python requested
`telemetry_snapshot`. Takeoff, landing, return-to-home, goto, and Waypoint V2
preflight opened package 0 independently. DJI permits only one active
subscription package in this setup, so the two paths could return
`SUBSCRIBER_MULTIPLE_SUBSCRIBE`. Early command failures could also skip the
package-0 cleanup.

Python sent every snapshot request through `send_command()`. Its command lock
correctly serialized flight actions, but it also prevented telemetry polling
while a long-running action was waiting for completion.

## Current flow

```text
DJI OSDK package 6 (5 Hz, initialized once)
       |
       +--> thread-safe latest snapshot --> command monitors
       |
       +--> SOYSAN_TELEMETRY JSON (about 1 Hz on stderr)
                                      |
                                      v
                         Python stderr reader
                                      |
                                      v
                     bounded per-client push queues
```

The shared package contains flight state, display mode, fused position and
height, velocity, attitude, GPS quality, obstacle-down data, home point, RTK
state, and aggregate battery data. RTK position status limits the union to
5 Hz. C++ reads the package on one background thread; command monitors only
read copied snapshots under a mutex.

Command requests and responses remain serialized on stdin/stdout. Telemetry
uses the independent stderr prefix `SOYSAN_TELEMETRY:`. Python validates and
caches each event, then queues it immediately for every subscribed WebSocket
client. A slow client can lose an old queued push but cannot block OSDK reads
or flight commands.

`telemetry_snapshot` remains available for compatibility. It returns the
latest cached push and never creates a subscription. A watchdog reports
`checking`, `connected`, `stale`, or `disconnected` without routing health
checks through the command lock. C++ emits only after a real package-receive
callback, so a disconnected serial link cannot replay an old sample as fresh.
Python marks the link stale after 3 seconds and recreates the daemon after 8
seconds by default. Override them with `SOYSAN_TELEMETRY_STALE_SECONDS` and
`SOYSAN_TELEMETRY_RECONNECT_SECONDS`.

OSDK startup allows 45 seconds by default for M300 firewall-policy
initialization. Override it with `SOYSAN_OSDK_STARTUP_TIMEOUT_SECONDS`.

The shared package is removed once during orderly shutdown. Failed
initialization removes any partially started package. A dead daemon is
recreated through one start lock, producing one new shared package after the
serial or aircraft link returns.

## Simulator gate

Build and contract tests do not move the aircraft. Before simulator acceptance
tests, select one DJI Assistant connection and explicitly confirm every item:

- Alienware has the M300 attached directly by USB and is accessible through
  Moonlight, or mockingbeat VirtualHere shows the DJI device in use locally.
- DJI Assistant 2 shows the M300 and its simulator is running.
- The remote controller is powered, paired, and in the required mode.
- The simulator is reset on the ground with motors off.

Moonlight carries only the Alienware screen and input. Soysan commands and
telemetry continue through the separate OSDK serial and WebSocket paths. Do
not switch simulator hosts during a test.

Automatic takeoff starts with motors off. Do not send `motors_on` before
`takeoff`.

## Verified simulator result

On 2026-08-14, the Alienware-hosted M300 simulator completed automatic takeoff
to 10 m, a short waypoint, return-to-home, landing, and final motor-off. The run
produced 63 telemetry samples at a 1.007 s average interval. Telemetry arrived
during every long command, the waypoint finished 0.143 m from its target, and
the final state was connected, grounded, near-zero altitude and speed, with
motors off. The service journal contained no subscription conflicts, telemetry
errors, service restarts, or package restarts during the flight.
