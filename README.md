# Twinergy 3D Campus — isolated preview

This is a standalone local preview of the supplied `ThreeCampusScene.jsx`. It does not connect to, overwrite, or modify your existing Twinergy project.

## What is included

- The supplied `ThreeCampusScene.jsx`, copied into `src/` without source edits.
- Vite + React as a lightweight local dev server.
- Three.js and its bundled `OrbitControls` module.
- `react-router-dom` and a `BrowserRouter` provider required by `useNavigate()`.
- `lucide-react` for the source's existing icons.
- Tailwind CSS 3 for the source component's existing utility classes.
- Preview-only sample telemetry so the EV and grid energy-flow lines/particles are visible without a backend.

No separate 3D models, textures, external assets, API, database, or backend are imported by this file. Road/grass/sky textures and campus geometry are generated in code.

## Run on Windows

1. Install Node.js (prefer a current LTS version) if it is not installed.
2. Extract this ZIP to a convenient folder, for example `C:\Twinergy-3D-Preview`.
3. Open that extracted folder in VS Code.
4. In VS Code, choose **Terminal → New Terminal** and make sure the terminal is in the folder containing `package.json`.
5. Run the following commands, one at a time:

```powershell
npm install
npm run dev
```

6. Open the local URL shown by Vite. It should be `http://127.0.0.1:5173/`.
7. Keep the terminal open while you explore the scene. Press `Ctrl+C` in that terminal to stop the local server.

If port 5173 is already in use, Vite may display a different local port; open the URL it actually prints.

## Camera controls

- Drag with the left mouse button: orbit around the campus.
- Scroll the mouse wheel: zoom in/out.
- Drag with the right mouse button: pan (or use the trackpad equivalent).
- Use the source's top-right icons to toggle day/night, heatmap, and fullscreen. The resolution menu is available by hovering over its sliders icon.

The initial energy values are synthetic demo values for preview visibility, not live campus telemetry.

## If something fails

- Run `node -v` and `npm -v` and note the versions.
- Copy the complete terminal error (including the first error line) and the browser DevTools Console error if present.
- Do not copy this folder over the existing Twinergy project. This directory is a disposable preview sandbox.
