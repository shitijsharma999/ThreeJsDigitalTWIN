import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import ThreeCampusScene from './ThreeCampusScene.jsx';
import './index.css';

// Standalone preview-only telemetry. This makes the source scene's EV and
// grid energy paths visible without requiring Twinergy's backend or APIs.
const PREVIEW_SCENE_DATA = {
  flexibleLoadKw: 18,
  evLoad: 18,
  gridImportKw: 65,
  batterySocPct: 76,
  batteryKwh: 380,
  anomalyFlag: false,
  cloudCover: 0.18,
  blocks: [],
};

function PreviewApp() {
  return (
    <main className="preview-root" aria-label="Twinergy 3D campus preview">
      <ThreeCampusScene
        sceneData={PREVIEW_SCENE_DATA}
        onBuildingClick={(buildingId) => {
          // Keep this isolated preview in place. The original click/navigation
          // behaviour can be connected when the scene is intentionally integrated.
          console.info(`[Twinergy preview] Selected building: ${buildingId}`);
        }}
      />
    </main>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <PreviewApp />
    </BrowserRouter>
  </React.StrictMode>,
);
