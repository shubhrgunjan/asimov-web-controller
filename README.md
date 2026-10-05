# ASIMOV Web Controller

A lightweight, minimal browser-based 3D controller for the local **Virtual Asimov 1 (VASIMOV)** MuJoCo simulation.

Built with **Three.js** and **Vite / TypeScript**, this application serves as an ultra-fast thin client that auto-discovers and connects to your local running simulation session.

---

## Key Features

- **Authoritative PAIR Lab 3D Environment**: Direct reuse of the high-fidelity PAIR Lab environment asset (`pair_lab.glb`) with realistic soft shadow mapping and lighting.
- **Canonical 25-Joint Asimov 1 Humanoid**: Realtime kinematic articulation driven directly by the MuJoCo physics engine at 50 Hz.
- **Zero Local Physics**: The browser maintains **no independent simulation**. The MuJoCo simulation running in VASIMOV is the sole ground truth.
- **Automatic Local Discovery**: Automatically detects running simulation sessions on `http://127.0.0.1:8852/session` without requiring manual IP or port entry.
- **High-Frequency Binary Protocol**:
  - Subscribes to **50 Hz 288-byte `VAS1`** binary state packets.
  - Dispatches **25 Hz 32-byte `VAC1`** binary teleoperation command packets.
- **Clean, Minimal Light UI**: Clean Scandinavian/Apple-style light aesthetic (subtle borders, off-white background, clean typography).
- **Multi-Camera Rig**:
  - `1`: First-Person Head View (POV).
  - `2`: Third-Person Chase Follow View.
  - `3`: Free Orbit Overview.
- **F1 Developer Overlay**: Realtime telemetry diagnostics (FPS, latency, state rate, command rate, 6-DoF base pose, joint states).
- **Safety Interlocks**: Automatic control zero-clamp and release on window blur, tab switch, page visibility loss, connection drop, or `Esc`.

---

## Quick Start

### 1. Ensure Local VASIMOV Simulation is Running

In your `vasimov` directory:
```bash
./run_sim.sh --web
# or headless:
./run_sim.sh --no-viewer
```

This starts the simulation with the HTTP gateway on port `8852` and binary WebSocket streaming on port `8854`.

### 2. Launch the Web Controller

In `asimov-web-controller`:
```bash
npm install
npm run dev
```

Open your browser to:
[http://localhost:5173/](http://localhost:5173/)

The web controller will immediately discover the session, connect, display the PAIR Lab 3D scene, and synchronize the robot.

---

## Controls

| Key | Action |
| :--- | :--- |
| **W** | Move Forward ($v_x = 0.60\text{ m/s}$) |
| **S** | Move Backward ($v_x = -0.35\text{ m/s}$) |
| **A** | Turn Left ($w_z = 0.55\text{ rad/s}$) |
| **D** | Turn Right ($w_z = -0.55\text{ rad/s}$) |
| **Space** | Instant Brake / Neutral Stand |
| **R** | Reset Simulation to Nominal Stance |
| **Esc** | Release All Controls |
| **1** | First-Person View (Head Mount) |
| **2** | Third-Person Chase Follow View |
| **3** | Free Orbit Camera |
| **F1** | Toggle Developer Telemetry HUD |

---

## Project Structure

```
asimov-web-controller/
├── public/
│   └── assets/
│       ├── pair_lab.glb          # Authoritative PAIR Lab 3D visual model
│       └── asimov_1_mobile.glb   # 25-joint Asimov 1 humanoid model
├── src/
│   ├── main.ts                   # App entrypoint and 60 FPS render loop
│   ├── style.css                 # Clean, minimal full-window styles
│   ├── scene/
│   │   ├── Environment.ts        # PAIR Lab environment loader and studio lights
│   │   ├── Robot.ts              # 25-joint Asimov 1 model & coordinate mapper
│   │   └── CameraManager.ts      # Multi-camera rig (FPS, TPS, Orbit)
│   ├── connection/
│   │   ├── SessionDiscovery.ts   # Local session auto-discovery
│   │   └── AsimovConnection.ts   # 50 Hz binary WebSocket client
│   ├── controls/
│   │   ├── KeyboardController.ts # Key state tracker & safety interlocks
│   │   └── CommandPublisher.ts   # 25 Hz VAC1 command dispatcher
│   ├── protocol/
│   │   └── AsimovStateProtocol.ts# Official binary wire protocol (VAS1 / VAC1)
│   ├── synchronization/
│   │   └── StateBuffer.ts        # Temporal jitter buffer & Hermite interpolator
│   └── ui/
│       ├── StatusIndicator.ts    # Minimal top-left status pill
│       └── DeveloperOverlay.ts   # F1 telemetry HUD
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```
