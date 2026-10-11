
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Sun, Moon, Zap, Info, Maximize, Minimize, Sliders, Check, Flame, CloudRain, Building2, BatteryCharging, Car, ArrowRight, Plug, TrendingUp } from 'lucide-react';

// ---------- Fixed campus tree positions [x, z, scale] ----------
// Laid out along roads, building perimeters, and campus boundaries
const CAMPUS_TREE_POSITIONS = [
    // ── Main Road Boulevard (z ≈ 0, trees flanking both sides) ──
    [-55, -5, 1.1], [-48, 5, 1.0], [-38, -5, 1.2], [-33, 5, 0.9],
    [33, -5, 1.0], [38, 5, 1.1], [48, -5, 1.2], [55, 5, 0.9],
    // ── West Road Avenue (x ≈ -28, trees on both sides) ──
    [-23, -14, 1.0], [-33, -14, 1.1], [-23, 10, 0.9], [-33, 10, 1.2],
    [-23, 28, 1.1], [-33, 28, 1.0], [-23, 38, 0.9], [-33, 38, 1.2],
    [-23, 55, 1.0], [-33, 55, 1.1],
    // ── East Road Avenue (x ≈ 28, trees on both sides) ──
    [23, -14, 1.1], [33, -14, 1.0], [23, 10, 1.2], [33, 10, 0.9],
    [23, 28, 1.0], [33, 28, 1.1], [23, 38, 1.2], [33, 38, 0.9],
    [23, 55, 1.1], [33, 55, 1.0],
    // ── Front Road Parkway (z ≈ 60) ──
    [-30, 65, 1.0], [-18, 65, 1.2], [-6, 65, 0.9], [6, 65, 1.1],
    [18, 65, 1.0], [30, 65, 1.2],
    // ── North Campus Perimeter ──
    [-52, -40, 1.1], [-38, -42, 1.0], [-20, -40, 0.9],
    [20, -40, 1.2], [38, -42, 1.0], [52, -40, 1.1],
    // ── Courtyards between building rows ──
    [-50, 33, 1.0], [-50, 8, 0.9], [50, 33, 1.1], [50, 8, 1.0],
    // ── South campus scattered ──
    [-5, 78, 1.0], [5, 78, 0.9], [-20, 78, 1.1], [20, 78, 1.2],
];

// ---------- Campus layout (UNCHANGED ids / names / positions / sizes / styles) ----------
// [id, name, x, z, width, depth, style]
const SCHOOL_BLOCKS = [
    ['main', 'Main Academic Block', -41, -18, 15, 10, 'A'],
    ['academic2', 'Academic Block 2', -60, -18, 14, 10, 'B'],
    ['academic3', 'Academic Block 3', -41, -33, 14, 10, 'B'],
    ['admin', 'Administration Block', -60, -33, 13, 9, 'A'],
    ['science', 'Science & Technology Block', 41, -18, 15, 10, 'B'],
    ['academic4', 'Academic Block 4', 60, -18, 14, 10, 'A'],
    ['library', 'Library & Learning Center', 41, -33, 13, 9, 'A'],
    ['academic5', 'Academic Block 5', 60, -33, 14, 10, 'B'],
    ['lab1', 'Physics & Chemistry Lab', -41, 18, 14, 10, 'B'],
    ['lab2', 'Computer Science Lab', -60, 18, 14, 10, 'A'],
    ['class1', 'Classroom Block A', -41, 48, 13, 9, 'B'],
    ['class2', 'Classroom Block B', -60, 48, 13, 9, 'A'],
    ['engineering1', 'Engineering Block', 41, 18, 14, 10, 'B'],
    ['engineering2', 'Innovation Lab', 60, 18, 14, 10, 'A'],
    ['library2', 'Digital Library', 41, 48, 13, 9, 'B'],
    ['faculty1', 'Faculty Block', 60, 48, 13, 9, 'A'],
    ['sports', 'Sports Science Block', -12, 70, 15, 10, 'B'],
    ['arts', 'Arts & Design Block', 12, 70, 15, 10, 'A'],
];

// Footprints used ONLY to keep greenery / lamps clear of buildings & utilities
const FOOTPRINTS = [
    ...SCHOOL_BLOCKS.map(([, , x, z, w, d]) => ({ x, z, w, d })),
    { x: 0, z: 32, w: 48, d: 38 },   // Mega Academic & Research Center (+ plaza, towers, fire escapes)
    { x: 0, z: -22, w: 50, d: 27 },  // EV parking lot
    { x: 8, z: 9, w: 11, d: 8 },     // Battery hub
];

// ---------- Road network (same four roads as before) ----------
const ROAD_W = 7;
const ROADS = [
    { axis: 'x', fixed: 0, a: -65, b: 65 },    // Main road
    { axis: 'z', fixed: -28, a: -18, b: 82 },  // West road
    { axis: 'z', fixed: 28, a: -18, b: 82 },   // East road
    { axis: 'x', fixed: 60, a: -37.5, b: 37.5 }, // Front road
];
const INTERSECTIONS = [[-28, 0], [28, 0], [-28, 60], [28, 60]];

// ---------- Small deterministic helpers ----------
function makeRng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const isBlocked = (x, z, pad = 0) =>
    FOOTPRINTS.some((f) => Math.abs(x - f.x) < f.w / 2 + pad && Math.abs(z - f.z) < f.d / 2 + pad);

const onRoad = (x, z, pad = 0) =>
    ROADS.some((r) => (r.axis === 'x'
        ? Math.abs(z - r.fixed) < ROAD_W / 2 + pad && x > r.a - pad && x < r.b + pad
        : Math.abs(x - r.fixed) < ROAD_W / 2 + pad && z > r.a - pad && z < r.b + pad));

// Grid pole, service cable and the transmission-line corridor
const inUtility = (x, z) => (x > 76 && x < 92) || (x > 8 && x < 74 && Math.abs(z - 8) < 3);

function splitRange(a, b, cuts, gap) {
    let segs = [[a, b]];
    cuts.forEach((c) => {
        const next = [];
        segs.forEach(([s, e]) => {
            const lo = c - gap;
            const hi = c + gap;
            if (hi <= s || lo >= e) { next.push([s, e]); return; }
            if (lo > s) next.push([s, lo]);
            if (hi < e) next.push([hi, e]);
        });
        segs = next;
    });
    return segs.filter(([s, e]) => e - s > 0.5);
}

function crossingsFor(road) {
    return INTERSECTIONS
        .filter(([x, z]) => (road.axis === 'x'
            ? Math.abs(z - road.fixed) < 0.1 && x > road.a && x < road.b
            : Math.abs(x - road.fixed) < 0.1 && z > road.a && z < road.b))
        .map(([x, z]) => (road.axis === 'x' ? x : z));
}

// ---------- Texture helpers (version-safe colour space) ----------
function setSRGB(tex) {
    if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
    else tex.encoding = THREE.sRGBEncoding;
    return tex;
}

function canvasTexture(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    return setSRGB(new THREE.CanvasTexture(c));
}

function makeGlowTexture() {
    return canvasTexture(64, 64, (g) => {
        const q = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        q.addColorStop(0, 'rgba(255,255,255,1)');
        q.addColorStop(0.3, 'rgba(255,255,255,0.45)');
        q.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = q;
        g.fillRect(0, 0, 64, 64);
    });
}

function makeAsphaltTexture(rng) {
    return canvasTexture(128, 128, (g, w, h) => {
        g.fillStyle = '#4b5059';
        g.fillRect(0, 0, w, h);
        for (let i = 0; i < 900; i++) {
            const v = 60 + Math.floor(rng() * 50);
            g.fillStyle = `rgba(${v},${v},${v + 4},0.35)`;
            g.fillRect(rng() * w, rng() * h, 1 + rng() * 2, 1 + rng() * 2);
        }
    });
}

function makeGrassTexture(rng, base, speckA, speckB) {
    return canvasTexture(128, 128, (g, w, h) => {
        g.fillStyle = base;
        g.fillRect(0, 0, w, h);
        for (let i = 0; i < 1400; i++) {
            g.fillStyle = rng() < 0.5 ? speckA : speckB;
            g.globalAlpha = 0.25 + rng() * 0.35;
            g.fillRect(rng() * w, rng() * h, 1 + rng() * 1.5, 2 + rng() * 3);
        }
        g.globalAlpha = 1;
    });
}

function makeSkyTexture(stops) {
    return canvasTexture(8, 256, (g, w, h) => {
        const grad = g.createLinearGradient(0, 0, 0, h);
        stops.forEach(([p, c]) => grad.addColorStop(p, c));
        g.fillStyle = grad;
        g.fillRect(0, 0, w, h);
    });
}

// ---------- Traffic signal timing (seconds) ----------
const SIGNAL_CYCLE = 28;
function signalState(t) {
    const p = t % SIGNAL_CYCLE;
    if (p < 9) return { x: 'g', z: 'r' };
    if (p < 12) return { x: 'a', z: 'r' };
    if (p < 14) return { x: 'r', z: 'r' };
    if (p < 23) return { x: 'r', z: 'g' };
    if (p < 26) return { x: 'r', z: 'a' };
    return { x: 'r', z: 'r' };
}

/**
 * ThreeCampusScene — detailed 3D campus digital twin.
 * Optimized for high performance, smooth local host rendering, realistic Daylight & Thermal Heatmap simulation.
 *
 * Spatial Command Center upgrade: cinematic night/day rendering, textured roads with lane markings,
 * signalled traffic with moving vehicles, instanced greenery, lattice transmission towers and
 * lit windows. Buildings, ids, positions and the energy-flow system are unchanged.
 */
export function ThreeCampusScene({ sceneData, onBuildingClick }) {
    const wrapperRef = useRef(null);
    const containerRef = useRef(null);
    const navigate = useNavigate();

    // Mutable ref for callbacks — always current, never triggers re-init
    const callbacksRef = useRef({ onBuildingClick, navigate });
    callbacksRef.current = { onBuildingClick, navigate };

    const [hoveredInfo, setHoveredInfo] = useState(null);
    const [selectedBuildingInfo, setSelectedBuildingInfo] = useState(null);
    const [isOrbitLocked, setIsOrbitLocked] = useState(false); // Touch scroll lock mode
    const [isNightMode, setIsNightMode] = useState(true); // Default: Spatial Command Center night view (toggle for daylight)
    const [isHeatmapMode, setIsHeatmapMode] = useState(false); // Thermal Energy Heatmap Overlay Mode
    const [isExpanded, setIsExpanded] = useState(false);
    const [resolutionScale, setResolutionScale] = useState(1.0);

    const nightRef = useRef(isNightMode);
    nightRef.current = isNightMode;
    const heatRef = useRef(isHeatmapMode);
    heatRef.current = isHeatmapMode;

    const refs = useRef({
        scene: null,
        camera: null,
        renderer: null,
        controls: null,
        raycaster: new THREE.Raycaster(),
        mouse: new THREE.Vector2(),
        animationFrameId: null,
        twinObjects: {
            buildings: [],
            solarPanels: [],
            batteries: [],
            evs: [],
            flows: [],
            particles: [],
            clouds: [],
        },
        lights: { ambient: null, sun: null, sunMeshGroup: null },
        rainMesh: null,
        env: null,
        latestSceneData: null,
    });

    refs.current.latestSceneData = sceneData;

    // Sync fullscreen state with native browser fullscreen events
    useEffect(() => {
        const handleFullscreenChange = () => {
            const isFull = !!document.fullscreenElement;
            setIsExpanded(isFull);
            setTimeout(() => window.dispatchEvent(new Event('resize')), 150);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            if (wrapperRef.current?.requestFullscreen) {
                wrapperRef.current.requestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    };

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const { twinObjects, lights } = refs.current;
        twinObjects.buildings = [];
        twinObjects.solarPanels = [];
        twinObjects.batteries = [];
        twinObjects.evs = [];
        twinObjects.flows = [];
        twinObjects.particles = [];
        twinObjects.clouds = [];

        const rng = makeRng(20261010);

        const scene = new THREE.Scene();
        refs.current.scene = scene;
        scene.background = new THREE.Color(0x0a1630);
        scene.fog = new THREE.FogExp2(0x0a1630, 0.0042);

        const camera = new THREE.PerspectiveCamera(
            55,
            container.clientWidth / Math.max(container.clientHeight, 1),
            0.1,
            400
        );
        refs.current.camera = camera;
        camera.position.set(70, 50, 70);

        // WebGL Renderer optimized for local host low GPU overhead
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
        refs.current.renderer = renderer;

        const activeScale = resolutionScale === 'auto' ? Math.min(window.devicePixelRatio, 1.0) : Math.min(resolutionScale, 1.0);
        renderer.setPixelRatio(activeScale);
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = activeScale <= 0.75 ? THREE.BasicShadowMap : THREE.PCFShadowMap;
        // Cinematic output
        if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
        else renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.05;
        // Older three builds use "legacy" (non-physical) light units; compensate so the look is identical
        const Lk = renderer.useLegacyLights === true ? 1 / Math.PI : 1;

        while (container.firstChild) container.removeChild(container.firstChild);
        container.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        refs.current.controls = controls;
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.target.set(0, 4, 10);
        controls.maxPolarAngle = Math.PI / 2.15;
        controls.minDistance = 15;
        controls.maxDistance = 140;

        const ambient = new THREE.HemisphereLight(0x5878b8, 0x0e1d14, 1.9 * Lk);
        lights.ambient = ambient;
        scene.add(ambient);

        const sun = new THREE.DirectionalLight(0xfff5d6, 3.2 * Lk);
        lights.sun = sun;
        sun.position.set(45, 75, 40);
        sun.castShadow = true;
        const shadowRes = activeScale <= 0.75 ? 1024 : 2048;
        sun.shadow.mapSize.width = shadowRes;
        sun.shadow.mapSize.height = shadowRes;
        sun.shadow.camera.near = 10;
        sun.shadow.camera.far = 320;
        sun.shadow.camera.left = -100;
        sun.shadow.camera.right = 100;
        sun.shadow.camera.top = 100;
        sun.shadow.camera.bottom = -100;
        sun.shadow.bias = -0.0005;
        sun.shadow.normalBias = 0.04;
        sun.shadow.camera.updateProjectionMatrix();
        scene.add(sun);

        // ---------- Visible 3D Celestial Sun Mesh (Daylight Mode) ----------
        const sunGroup = new THREE.Group();
        sunGroup.position.set(45, 75, 40);

        const sunCoreMesh = new THREE.Mesh(
            new THREE.SphereGeometry(4.2, 32, 32),
            new THREE.MeshBasicMaterial({ color: 0xffea79 })
        );
        sunGroup.add(sunCoreMesh);

        const sunCoronaMesh = new THREE.Mesh(
            new THREE.SphereGeometry(6.8, 32, 32),
            new THREE.MeshBasicMaterial({
                color: 0xff9900,
                transparent: true,
                opacity: 0.35,
                side: THREE.BackSide
            })
        );
        sunGroup.add(sunCoronaMesh);

        scene.add(sunGroup);
        lights.sunMeshGroup = sunGroup;

        // ---------- Sky dome, stars & moon (follow the camera) ----------
        const glowTex = makeGlowTexture();
        const skyDayTex = makeSkyTexture([[0, '#2c68b0'], [0.3, '#5f9fdc'], [0.46, '#b9ddf2'], [0.5, '#dcefF7'], [0.52, '#5d7a45'], [1, '#2c3e24']]);
        const skyNightTex = makeSkyTexture([[0, '#01030a'], [0.3, '#050f26'], [0.45, '#12284d'], [0.5, '#223f6b'], [0.52, '#07120c'], [1, '#040a07']]);
        const skyGroup = new THREE.Group();
        const skyMat = new THREE.MeshBasicMaterial({ map: skyNightTex, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false });
        const skyDome = new THREE.Mesh(new THREE.SphereGeometry(340, 32, 24), skyMat);
        skyDome.renderOrder = -10;
        skyGroup.add(skyDome);

        const starPos = [];
        for (let i = 0; i < 900; i++) {
            const th = rng() * Math.PI * 2;
            const ph = Math.acos(0.04 + rng() * 0.96); // upper hemisphere only
            starPos.push(Math.sin(ph) * Math.cos(th) * 320, Math.cos(ph) * 320, Math.sin(ph) * Math.sin(th) * 320);
        }
        const starGeo = new THREE.BufferGeometry();
        starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
        const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
            color: 0xffffff, size: 1.7, sizeAttenuation: false, transparent: true, opacity: 0.85,
            fog: false, depthWrite: false, toneMapped: false,
        }));
        skyGroup.add(stars);

        const moonGroup = new THREE.Group();
        const moonDir = new THREE.Vector3(-60, 95, 45).normalize().multiplyScalar(310);
        moonGroup.position.copy(moonDir);
        moonGroup.add(new THREE.Mesh(new THREE.SphereGeometry(8, 24, 24), new THREE.MeshBasicMaterial({ color: 0xf1f4ff, fog: false, toneMapped: false })));
        const moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({
            map: glowTex, color: 0x8fa8ff, transparent: true, opacity: 0.55,
            blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false,
        }));
        moonHalo.scale.set(80, 80, 1);
        moonGroup.add(moonHalo);
        skyGroup.add(moonGroup);
        scene.add(skyGroup);

        // ---------- Weather Engine: Clouds & Rain ----------
        const cloudMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.55, roughness: 0.9 });
        const cloudGeo = new THREE.DodecahedronGeometry(5, 1);
        for (let i = 0; i < 12; i++) {
            const cloud = new THREE.Mesh(cloudGeo, cloudMat.clone());
            const x = (Math.random() - 0.5) * 160;
            const z = (Math.random() - 0.5) * 160;
            cloud.position.set(x, 40 + Math.random() * 6, z);
            cloud.scale.set(1.6 + Math.random() * 0.8, 0.6, 1.2 + Math.random() * 0.6);
            scene.add(cloud);
            twinObjects.clouds.push(cloud);
        }

        const rainGeo = new THREE.BufferGeometry();
        const rainPositions = new Float32Array(300 * 3);
        for (let i = 0; i < 300; i++) {
            rainPositions[i * 3] = (Math.random() - 0.5) * 180;
            rainPositions[i * 3 + 1] = Math.random() * 50;
            rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 180;
        }
        rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
        const rainMat = new THREE.PointsMaterial({ color: 0x38bdf8, size: 0.4, transparent: true, opacity: 0.7 });
        const rainPoints = new THREE.Points(rainGeo, rainMat);
        rainPoints.visible = false;
        scene.add(rainPoints);
        refs.current.rainMesh = rainPoints;

        // ---------- Window-light registry (lit panes drawn over / beside the original glass) ----------
        const glassPanes = []; // aligned to the original glass windows (night only)
        const plainPanes = []; // extra windows on blank walls (day + night)
        const regPane = (list, group, lx, ly, lz, w, h, face) =>
            list.push({ x: group.position.x + lx, y: ly, z: group.position.z + lz, w, h, face });
        // face: 0 = -z, 1 = +x, 2 = +z, 3 = -x

        // ---------- Shared helpers ----------
        function createRoofSolarArray(group, width, depth, y, buildingId) {
            const panelMaterial = new THREE.MeshStandardMaterial({
                color: 0x102f4d,
                emissive: 0x06233a,
                emissiveIntensity: 0.8,
                metalness: 0.45,
                roughness: 0.28,
            });
            for (let x = -width / 2; x <= width / 2; x += 1.65) {
                for (let z = -depth / 2; z <= depth / 2; z += 1.45) {
                    const panel = new THREE.Mesh(
                        new THREE.BoxGeometry(1.35, 0.08, 1.05),
                        panelMaterial.clone()
                    );
                    panel.position.set(x, y, z);
                    panel.rotation.x = -0.08;
                    panel.userData = { type: 'solar', building: buildingId };
                    panel.castShadow = true;
                    group.add(panel);
                    twinObjects.solarPanels.push(panel);
                }
            }
        }

        function createMegaSolarArray(group) {
            for (let x = -14; x <= 14; x += 2.3) {
                for (let z = -5; z <= 5; z += 2) {
                    const panel = new THREE.Mesh(
                        new THREE.BoxGeometry(1.9, 0.08, 1.25),
                        new THREE.MeshStandardMaterial({
                            color: 0x102f4d,
                            emissive: 0x06243a,
                            emissiveIntensity: 0.8,
                            metalness: 0.45,
                            roughness: 0.28,
                        })
                    );
                    panel.position.set(x, 12.35, z);
                    panel.rotation.x = -0.08;
                    panel.userData = { type: 'solar', building: 'mega_academic' };
                    panel.castShadow = true;
                    group.add(panel);
                    twinObjects.solarPanels.push(panel);
                }
            }
        }

        function createPitchedRoof(width, depth, material) {
            const group = new THREE.Group();
            const left = new THREE.Mesh(new THREE.BoxGeometry(width / 2, 0.22, depth), material);
            left.rotation.z = 0.38;
            left.position.x = -width * 0.19;
            group.add(left);
            const right = new THREE.Mesh(new THREE.BoxGeometry(width / 2, 0.22, depth), material);
            right.rotation.z = -0.38;
            right.position.x = width * 0.19;
            group.add(right);
            return group;
        }

        function createBalcony(group, x, y, z, width, depth, material) {
            const floor = new THREE.Mesh(new THREE.BoxGeometry(width, 0.18, depth), material);
            floor.position.set(x, y, z);
            floor.castShadow = true;
            group.add(floor);
            for (let i = -width / 2; i <= width / 2; i += 0.7) {
                const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.9, 0.06), material);
                post.position.set(x + i, y + 0.48, z - depth / 2);
                group.add(post);
            }
            const rail = new THREE.Mesh(new THREE.BoxGeometry(width, 0.08, 0.08), material);
            rail.position.set(x, y + 0.9, z - depth / 2);
            group.add(rail);
        }

        function createWindowGrid(group, x, y, z, width, height, material) {
            const frame = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.12), material);
            frame.position.set(x, y, z);
            group.add(frame);
            const mullionMat = new THREE.MeshStandardMaterial({ color: 0x24313a });
            for (let i = -width / 3; i <= width / 3; i += width / 3) {
                const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.07, height, 0.16), mullionMat);
                mullion.position.set(x + i, y, z - 0.08);
                group.add(mullion);
            }
            const horizontal = new THREE.Mesh(new THREE.BoxGeometry(width, 0.07, 0.16), mullionMat);
            horizontal.position.set(x, y, z - 0.08);
            group.add(horizontal);

            // Lit panes sitting exactly in the mullion cells (4 columns x 2 rows)
            const cols = [[-5 * width / 12, width / 6], [-width / 6, width / 3], [width / 6, width / 3], [5 * width / 12, width / 6]];
            [-1, 1].forEach((r) => cols.forEach(([cx, cw]) => {
                regPane(glassPanes, group, x + cx, y + (r * height) / 4, z - 0.18, cw - 0.14, height / 2 - 0.14, 0);
            }));
        }

        function createSideWindows(group, x, depth, height, material) {
            for (let z = -depth / 2 + 2; z < depth / 2 - 1; z += 2.8) {
                const win = new THREE.Mesh(new THREE.BoxGeometry(0.12, height, 1.8), material);
                win.position.set(x, 3.5, z);
                group.add(win);
                [-1, 1].forEach((r) => regPane(glassPanes, group, x + 0.07, 3.5 + (r * height) / 4, z, 1.6, height / 2 - 0.2, 1));
            }
        }

        // Windows on the otherwise blank back (+z) and left (-x) walls
        function addPlainWindows(group, width, depth, rows, winH) {
            rows.forEach((y) => {
                for (let px = -width / 2 + 2; px <= width / 2 - 2 + 0.01; px += 2.8) {
                    regPane(plainPanes, group, px, y, depth / 2 + 0.04, 1.6, winH, 2);
                }
                for (let pz = -depth / 2 + 2; pz <= depth / 2 - 2 + 0.01; pz += 2.8) {
                    regPane(plainPanes, group, -width / 2 - 0.04, y, pz, 1.6, winH, 3);
                }
            });
        }

        function createEntrance(group, x, z, wallMat, glassMat) {
            const frame = new THREE.Mesh(new THREE.BoxGeometry(2.8, 3, 0.5), wallMat);
            frame.position.set(x, 1.5, z);
            group.add(frame);
            const door = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.5, 0.12), glassMat);
            door.position.set(x, 1.35, z - 0.3);
            group.add(door);
            regPane(glassPanes, group, x, 1.35, z - 0.37, 1.3, 2.3, 0);
        }

        function createExternalStairs(group, x, y, z, height, material) {
            const staircase = new THREE.Group();
            staircase.position.set(x, y, z);
            for (let i = 0; i < 13; i++) {
                const step = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.65), material);
                step.position.set(0, i * 0.34, i * 0.25);
                staircase.add(step);
            }
            const railing1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, height, height * 0.35), material);
            railing1.position.set(-1.1, height / 2, height * 0.15);
            staircase.add(railing1);
            const railing2 = railing1.clone();
            railing2.position.x = 1.1;
            staircase.add(railing2);
            group.add(staircase);
        }

        function createIndustrialBalconies(group, width, depth, concreteMat, metalMat) {
            for (let level = 1; level <= 2; level++) {
                const y = level * 2.8;
                const slab = new THREE.Mesh(new THREE.BoxGeometry(width * 0.86, 0.18, 1.5), concreteMat);
                slab.position.set(0, y, -depth / 2 - 0.7);
                group.add(slab);
                const railing = new THREE.Mesh(new THREE.BoxGeometry(width * 0.86, 0.08, 0.08), metalMat);
                railing.position.set(0, y + 0.85, -depth / 2 - 1.3);
                group.add(railing);
            }
        }

        function createWaterTank(group, x, z, y, material) {
            const tank = new THREE.Mesh(
                new THREE.CylinderGeometry(0.9, 0.9, 1.8, 24),
                new THREE.MeshStandardMaterial({ color: 0x5b4b45, metalness: 0.72, roughness: 0.38 })
            );
            tank.position.set(x, y, z);
            tank.castShadow = true;
            group.add(tank);
            const support = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.2, 16), material);
            support.position.set(x, y - 1.5, z);
            group.add(support);
        }

        function createTerraceSchool(id, name, x, z, width, depth) {
            const group = new THREE.Group();
            group.position.set(x, 0, z);
            group.userData = { type: 'building', id, name };
            const wallMat = new THREE.MeshStandardMaterial({ color: 0xc9c0aa, roughness: 0.78 });
            const whiteMat = new THREE.MeshStandardMaterial({ color: 0xe6e1d4, roughness: 0.7 });
            const glassMat = new THREE.MeshStandardMaterial({
                color: 0x4da7c9, metalness: 0.15, roughness: 0.2,
                transparent: true, opacity: 0.86, emissive: 0x082f42, emissiveIntensity: 0.35,
            });
            const roofMat = new THREE.MeshStandardMaterial({ color: 0x4d5157, roughness: 0.9 });
            const balconyMat = new THREE.MeshStandardMaterial({ color: 0xb8b8b0, roughness: 0.72 });

            const main = new THREE.Mesh(new THREE.BoxGeometry(width, 6.5, depth), wallMat);
            main.position.y = 3.25; main.castShadow = true; main.receiveShadow = true; group.add(main);
            const core = new THREE.Mesh(new THREE.BoxGeometry(width * 0.25, 8, depth * 0.72), whiteMat);
            core.position.set(0, 4, 0); core.castShadow = true; group.add(core);
            const roofDeck = new THREE.Mesh(new THREE.BoxGeometry(width + 0.8, 0.5, depth + 0.8), whiteMat);
            roofDeck.position.y = 6.75; group.add(roofDeck);
            const roofLeft = createPitchedRoof(width * 0.38, depth * 0.48, roofMat);
            roofLeft.position.set(-width * 0.23, 9.0, 0); group.add(roofLeft);
            const roofRight = createPitchedRoof(width * 0.38, depth * 0.48, roofMat);
            roofRight.position.set(width * 0.23, 9.0, 0); group.add(roofRight);

            createBalcony(group, -width * 0.27, 2.1, -depth / 2 - 0.5, width * 0.42, 2.5, balconyMat);
            createBalcony(group, width * 0.27, 2.1, -depth / 2 - 0.5, width * 0.42, 2.5, balconyMat);
            createBalcony(group, -width * 0.27, 4.25, -depth / 2 - 0.5, width * 0.42, 2.5, balconyMat);
            createBalcony(group, width * 0.27, 4.25, -depth / 2 - 0.5, width * 0.42, 2.5, balconyMat);
            createWindowGrid(group, -width * 0.27, 2.5, -depth / 2 - 0.08, width * 0.34, 2.8, glassMat);
            createWindowGrid(group, width * 0.27, 2.5, -depth / 2 - 0.08, width * 0.34, 2.8, glassMat);
            createWindowGrid(group, -width * 0.27, 4.55, -depth / 2 - 0.08, width * 0.34, 2.8, glassMat);
            createWindowGrid(group, width * 0.27, 4.55, -depth / 2 - 0.08, width * 0.34, 2.8, glassMat);
            createSideWindows(group, width / 2 + 0.08, depth, 2.8, glassMat);
            createEntrance(group, 0, -depth / 2 - 0.25, whiteMat, glassMat);
            addPlainWindows(group, width, depth, [2.4, 4.9], 1.7);
            createRoofSolarArray(group, width * 0.52, depth * 0.45, 6.98, id);
            scene.add(group);
            twinObjects.buildings.push(group);
        }

        function createIndustrialSchool(id, name, x, z, width, depth) {
            const group = new THREE.Group();
            group.position.set(x, 0, z);
            group.userData = { type: 'building', id, name };
            const brickMat = new THREE.MeshStandardMaterial({ color: 0x873f2e, roughness: 0.88 });
            const darkBrick = new THREE.MeshStandardMaterial({ color: 0x633126, roughness: 0.92 });
            const concreteMat = new THREE.MeshStandardMaterial({ color: 0xa5a59d, roughness: 0.78 });
            const metalMat = new THREE.MeshStandardMaterial({ color: 0x363b42, metalness: 0.8, roughness: 0.35 });
            const glassMat = new THREE.MeshStandardMaterial({
                color: 0x3e9bc0, metalness: 0.18, roughness: 0.22,
                transparent: true, opacity: 0.87, emissive: 0x062d40, emissiveIntensity: 0.4,
            });

            const main = new THREE.Mesh(new THREE.BoxGeometry(width, 8, depth), brickMat);
            main.position.y = 4; main.castShadow = true; main.receiveShadow = true; group.add(main);
            const centralBlock = new THREE.Mesh(new THREE.BoxGeometry(width * 0.28, 9, depth * 0.78), darkBrick);
            centralBlock.position.set(0, 4.5, 0); centralBlock.castShadow = true; group.add(centralBlock);
            const roof = new THREE.Mesh(new THREE.BoxGeometry(width + 0.8, 0.45, depth + 0.8), concreteMat);
            roof.position.y = 8.2; group.add(roof);
            createExternalStairs(group, -width / 2 - 1.3, 0, 0, 4.5, metalMat);
            createIndustrialBalconies(group, width, depth, concreteMat, metalMat);
            createWindowGrid(group, -width * 0.28, 2.9, -depth / 2 - 0.08, width * 0.35, 3, glassMat);
            createWindowGrid(group, width * 0.28, 2.9, -depth / 2 - 0.08, width * 0.35, 3, glassMat);
            createWindowGrid(group, -width * 0.28, 5.7, -depth / 2 - 0.08, width * 0.35, 3, glassMat);
            createWindowGrid(group, width * 0.28, 5.7, -depth / 2 - 0.08, width * 0.35, 3, glassMat);
            createSideWindows(group, width / 2 + 0.08, depth, 3.2, glassMat);
            addPlainWindows(group, width, depth, [2.8, 5.6], 2.0);
            createWaterTank(group, -width * 0.28, depth * 0.15, 9.3, metalMat);
            createWaterTank(group, width * 0.28, depth * 0.15, 9.3, metalMat);
            createRoofSolarArray(group, width * 0.46, depth * 0.35, 8.52, id);
            scene.add(group);
            twinObjects.buildings.push(group);
        }

        function createSchoolBuilding(id, name, x, z, width, depth, style = 'A') {
            if (style === 'B') createIndustrialSchool(id, name, x, z, width, depth);
            else createTerraceSchool(id, name, x, z, width, depth);
        }

        // ---------- Ground & lawns ----------
        const grassTex = makeGrassTexture(rng, '#26452b', '#3b6b3a', '#1b3320');
        grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
        grassTex.repeat.set(170, 170);
        grassTex.anisotropy = 4;
        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(2000, 2000),
            new THREE.MeshStandardMaterial({ map: grassTex, color: 0xffffff, roughness: 0.96 })
        );
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene.add(ground);

        const lawnTex = makeGrassTexture(rng, '#2f5c34', '#4a8248', '#264d2b');
        lawnTex.wrapS = lawnTex.wrapT = THREE.RepeatWrapping;
        lawnTex.repeat.set(34, 30);
        lawnTex.anisotropy = 4;
        const lawn = new THREE.Mesh(
            new THREE.PlaneGeometry(156, 140),
            new THREE.MeshStandardMaterial({
                map: lawnTex, roughness: 0.95,
                polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
            })
        );
        lawn.rotation.x = -Math.PI / 2;
        lawn.position.set(0, 0.03, 22);
        lawn.receiveShadow = true;
        scene.add(lawn);

        // ---------- Roads (same four roads, textured asphalt) ----------
        const asphaltTex = makeAsphaltTexture(rng);
        asphaltTex.wrapS = asphaltTex.wrapT = THREE.RepeatWrapping;
        asphaltTex.anisotropy = 4;
        const makeRoadMat = (repX, repZ) => {
            const t = asphaltTex.clone();
            t.needsUpdate = true;
            t.wrapS = t.wrapT = THREE.RepeatWrapping;
            t.repeat.set(repX, repZ);
            return new THREE.MeshStandardMaterial({ map: t, color: 0xffffff, roughness: 0.88, metalness: 0.05 });
        };
        const mainRoad = new THREE.Mesh(new THREE.BoxGeometry(130, 0.15, 7), makeRoadMat(130 / 12, 7 / 12));
        mainRoad.position.set(0, 0.08, 0); mainRoad.receiveShadow = true; scene.add(mainRoad);
        const westRoad = new THREE.Mesh(new THREE.BoxGeometry(7, 0.15, 100), makeRoadMat(7 / 12, 100 / 12));
        westRoad.position.set(-28, 0.09, 32); westRoad.receiveShadow = true; scene.add(westRoad);
        const eastRoad = new THREE.Mesh(new THREE.BoxGeometry(7, 0.15, 100), makeRoadMat(7 / 12, 100 / 12));
        eastRoad.position.set(28, 0.09, 32); eastRoad.receiveShadow = true; scene.add(eastRoad);
        const frontRoad = new THREE.Mesh(new THREE.BoxGeometry(75, 0.15, 6), makeRoadMat(75 / 12, 6 / 12));
        frontRoad.position.set(0, 0.08, 60); frontRoad.receiveShadow = true; scene.add(frontRoad);

        // Lane markings, edge lines, zebra crossings (one instanced mesh)
        {
            const marks = []; // [x, z, sx, sz]
            ROADS.forEach((r) => {
                const cross = crossingsFor(r);
                splitRange(r.a, r.b, cross, 6.6).forEach(([s, e]) => {
                    const along = (v) => (r.axis === 'x' ? [v, r.fixed] : [r.fixed, v]);
                    // dashed centre line
                    for (let t = s + 1.6; t + 2.2 <= e - 1; t += 4.8) {
                        const [px, pz] = along(t + 1.1);
                        marks.push([px, pz, r.axis === 'x' ? 2.2 : 0.18, r.axis === 'x' ? 0.18 : 2.2]);
                    }
                    // solid edge lines
                    [-1, 1].forEach((side) => {
                        const off = side * (ROAD_W / 2 - 0.35);
                        const [px, pz] = r.axis === 'x' ? [(s + e) / 2, r.fixed + off] : [r.fixed + off, (s + e) / 2];
                        marks.push([px, pz, r.axis === 'x' ? e - s : 0.15, r.axis === 'x' ? 0.15 : e - s]);
                    });
                });
            });
            INTERSECTIONS.forEach(([cx, cz]) => {
                [-1, 1].forEach((sd) => {
                    for (let k = -3; k <= 3; k++) {
                        marks.push([cx + sd * 4.8, cz + k, 2.2, 0.55]); // crossing the x-road
                        marks.push([cx + k, cz + sd * 4.8, 0.55, 2.2]); // crossing the z-road
                    }
                });
            });
            const markGeo = new THREE.PlaneGeometry(1, 1);
            markGeo.rotateX(-Math.PI / 2);
            const markMesh = new THREE.InstancedMesh(markGeo, new THREE.MeshStandardMaterial({
                color: 0xe4e4dc, emissive: 0x30302c, emissiveIntensity: 0.6, roughness: 0.7,
                polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
            }), marks.length);
            const o = new THREE.Object3D();
            marks.forEach(([x, z, sx, sz], i) => {
                o.position.set(x, 0.2, z);
                o.scale.set(sx, 1, sz);
                o.updateMatrix();
                markMesh.setMatrixAt(i, o.matrix);
            });
            markMesh.instanceMatrix.needsUpdate = true;
            markMesh.frustumCulled = false;
            scene.add(markMesh);

            // Sidewalks along both sides of every road
            const walks = [];
            ROADS.forEach((r) => {
                splitRange(r.a, r.b, crossingsFor(r), ROAD_W / 2).forEach(([s, e]) => {
                    [-1, 1].forEach((side) => {
                        const off = side * (ROAD_W / 2 + 0.7);
                        walks.push(r.axis === 'x'
                            ? [(s + e) / 2, r.fixed + off, e - s, 1.4]
                            : [r.fixed + off, (s + e) / 2, 1.4, e - s]);
                    });
                });
            });
            const walkMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1),
                new THREE.MeshStandardMaterial({ color: 0x8b9099, roughness: 0.92 }), walks.length);
            walks.forEach(([x, z, sx, sz], i) => {
                o.position.set(x, 0.15, z);
                o.scale.set(sx, 0.3, sz);
                o.updateMatrix();
                walkMesh.setMatrixAt(i, o.matrix);
            });
            walkMesh.instanceMatrix.needsUpdate = true;
            walkMesh.receiveShadow = true;
            walkMesh.frustumCulled = false;
            scene.add(walkMesh);
        }

        // ---------- 18 academic / research blocks (unchanged) ----------
        SCHOOL_BLOCKS.forEach(([id, name, x, z, w, d, style]) => createSchoolBuilding(id, name, x, z, w, d, style));

        // ---------- Restored detailed Mega Academic building ----------
        function createClockTower(group, x, z) {
            const tower = new THREE.Mesh(
                new THREE.BoxGeometry(3.2, 15, 3.2),
                new THREE.MeshStandardMaterial({ color: 0x733a2b, roughness: 0.82 })
            );
            tower.position.set(x, 7.5, z);
            group.add(tower);

            const clock = new THREE.Mesh(
                new THREE.CylinderGeometry(0.9, 0.9, 0.18, 32),
                new THREE.MeshStandardMaterial({ color: 0xe9e3cf })
            );
            clock.rotation.z = Math.PI / 2;
            clock.position.set(x, 10.5, z - 1.65);
            group.add(clock);
        }

        function createMegaWindows(group, x, z) {
            const glassMat = new THREE.MeshStandardMaterial({
                color: 0x4da7c7, emissive: 0x062d3f,
                emissiveIntensity: 0.45, transparent: true, opacity: 0.85,
            });
            for (let y = 2.5; y <= 10; y += 3) {
                for (let i = -6; i <= 6; i += 3) {
                    const windowMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 1.8, 0.15), glassMat);
                    windowMesh.position.set(x + i, y, z);
                    group.add(windowMesh);
                    regPane(glassPanes, group, x + i, y, z + (z < 0 ? -0.1 : 0.1), 1.75, 1.55, z < 0 ? 0 : 2);
                }
            }
        }

        function createMegaFireEscape(group, x, z) {
            const metal = new THREE.MeshStandardMaterial({ color: 0x3e454b, metalness: 0.75, roughness: 0.35 });
            for (let level = 0; level < 3; level++) {
                const platform = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.18, 3), metal);
                platform.position.set(x, 2 + level * 4, z);
                group.add(platform);
            }
            const staircase = new THREE.Mesh(new THREE.BoxGeometry(0.22, 12, 10), metal);
            staircase.position.set(x, 6, z);
            staircase.rotation.x = -0.6;
            group.add(staircase);
        }

        function createMegaAcademicBuilding(x, z) {
            const group = new THREE.Group();
            group.position.set(x, 0, z);
            group.userData = { type: 'building', id: 'mega_academic', name: 'Mega Academic & Research Center' };

            const brick = new THREE.MeshStandardMaterial({ color: 0x7b3f2c, roughness: 0.85 });
            const darkBrick = new THREE.MeshStandardMaterial({ color: 0x52291f, roughness: 0.9 });
            const concrete = new THREE.MeshStandardMaterial({ color: 0xb4aea1, roughness: 0.75 });
            const glass = new THREE.MeshStandardMaterial({
                color: 0x4da7c7, transparent: true, opacity: 0.82,
                metalness: 0.2, roughness: 0.18, emissive: 0x073348, emissiveIntensity: 0.45,
            });

            const leftWing = new THREE.Mesh(new THREE.BoxGeometry(18, 12, 15), brick);
            leftWing.position.set(-11, 6, 0); leftWing.castShadow = true; leftWing.receiveShadow = true; group.add(leftWing);
            const rightWing = new THREE.Mesh(new THREE.BoxGeometry(18, 12, 15), brick);
            rightWing.position.set(11, 6, 0); rightWing.castShadow = true; rightWing.receiveShadow = true; group.add(rightWing);

            const atriumFrame = new THREE.Mesh(new THREE.BoxGeometry(9, 15, 13), darkBrick);
            atriumFrame.position.y = 7.5; group.add(atriumFrame);
            const atriumGlass = new THREE.Mesh(new THREE.BoxGeometry(7.5, 13, 0.25), glass);
            atriumGlass.position.set(0, 7, -6.7); group.add(atriumGlass);
            const frontAtrium = new THREE.Mesh(new THREE.BoxGeometry(8, 13, 2.5), glass);
            frontAtrium.position.set(0, 7, -8); group.add(frontAtrium);
            // Glowing atrium panes on the glass front
            [-3, -1, 1, 3].forEach((px) => [1.8, 4.3, 6.8, 9.3, 11.8].forEach((py) => {
                regPane(glassPanes, group, px, py, -9.3, 1.75, 2.15, 0);
            }));

            createClockTower(group, -7, 14);
            createClockTower(group, 7, 14);
            createMegaWindows(group, -11, -7.6);
            createMegaWindows(group, 11, -7.6);
            createMegaWindows(group, -11, 7.6);
            createMegaWindows(group, 11, 7.6);
            createMegaFireEscape(group, -20, 0);
            createMegaFireEscape(group, 20, 0);

            const plaza = new THREE.Mesh(
                new THREE.BoxGeometry(26, 0.25, 10),
                new THREE.MeshStandardMaterial({ color: 0x5b6570, roughness: 0.92 })
            );
            plaza.position.set(0, 0.12, -13); group.add(plaza);

            for (let i = 0; i < 4; i++) {
                const step = new THREE.Mesh(new THREE.BoxGeometry(14 - i * 2, 0.35, 1), concrete);
                step.position.set(0, 0.2 + i * 0.35, -8.5 - i);
                group.add(step);
            }

            createMegaSolarArray(group);
            scene.add(group);
            twinObjects.buildings.push(group);
        }

        createMegaAcademicBuilding(0, 33);

        // ---------- Lit windows (instanced) ----------
        const winColor = new THREE.Color();
        const WIN_NIGHT_LIT = [0xffc977, 0xffdfa0, 0xcfe6ff];
        function buildWindowMesh(list) {
            const mat = new THREE.MeshBasicMaterial({
                color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false,
                polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, toneMapped: false,
            });
            const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, Math.max(list.length, 1));
            const o = new THREE.Object3D();
            const faceRot = [Math.PI, Math.PI / 2, 0, -Math.PI / 2];
            mesh.userData.lit = new Uint8Array(list.length);
            mesh.userData.variant = new Uint8Array(list.length);
            list.forEach((p, i) => {
                o.position.set(p.x, p.y, p.z);
                o.rotation.set(0, faceRot[p.face], 0);
                o.scale.set(p.w, p.h, 1);
                o.updateMatrix();
                mesh.setMatrixAt(i, o.matrix);
                mesh.userData.lit[i] = rng() < 0.62 ? 1 : 0;
                mesh.userData.variant[i] = Math.floor(rng() * 3);
            });
            mesh.count = list.length;
            mesh.instanceMatrix.needsUpdate = true;
            mesh.frustumCulled = false;
            mesh.renderOrder = 5; // draw after the (transparent) glass so the light isn't tinted by it
            return mesh;
        }
        const paintWindow = (mesh, i, night) => {
            const lit = mesh.userData.lit[i] === 1;
            let hex;
            if (night) hex = lit ? WIN_NIGHT_LIT[mesh.userData.variant[i]] : 0x0b1424;
            else hex = lit ? 0x7fb2cf : 0x4d7a96;
            mesh.setColorAt(i, winColor.setHex(hex));
        };
        const paintAllWindows = (mesh, night) => {
            for (let i = 0; i < mesh.count; i++) paintWindow(mesh, i, night);
            if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        };
        const glassWindows = buildWindowMesh(glassPanes);
        const plainWindows = buildWindowMesh(plainPanes);
        scene.add(glassWindows, plainWindows);

        // ---------- Greenery (instanced: conifers, broadleaf trees, bushes) ----------
        const treeSpots = [];
        CAMPUS_TREE_POSITIONS.forEach(([x, z, s]) => {
            if (isBlocked(x, z, 2) || onRoad(x, z, 1.5) || inUtility(x, z)) return;
            treeSpots.push([x, z, s * 1.15, rng() < 0.5 ? 0 : 1]);
        });
        // Avenue trees just outside the sidewalks of every road
        ROADS.forEach((r) => {
            const cross = crossingsFor(r);
            let k = 0;
            for (let t = r.a + 5; t <= r.b - 4; t += 10, k++) {
                if (cross.some((c) => Math.abs(t - c) < 9)) continue;
                [-1, 1].forEach((side) => {
                    const off = side * (ROAD_W / 2 + 3.4);
                    const x = r.axis === 'x' ? t + (side > 0 ? 5 : 0) : r.fixed + off;
                    const z = r.axis === 'x' ? r.fixed + off : t + (side > 0 ? 5 : 0);
                    if (isBlocked(x, z, 1.5) || inUtility(x, z) || onRoad(x, z, 1.2)) return;
                    treeSpots.push([x, z, 0.95 + rng() * 0.3, 1]);
                });
            }
        });
        let tries = 0;
        while (treeSpots.length < 470 && tries < 12000) {
            tries++;
            const x = -118 + rng() * 240;
            const z = -98 + rng() * 205;
            const insideCampus = x > -76 && x < 78 && z > -46 && z < 92;
            if (isBlocked(x, z, 3) || onRoad(x, z, 3) || inUtility(x, z)) continue;
            if (insideCampus && rng() > 0.1) continue;
            treeSpots.push([x, z, 0.8 + rng() * 0.95, rng() < 0.5 ? 0 : 1]);
        }

        const foliageMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, flatShading: true });
        const trunkMat2 = new THREE.MeshStandardMaterial({ color: 0x4a3426, roughness: 1.0 });
        const dummy = new THREE.Object3D();
        const tint = new THREE.Color();
        function addInstanced(geo, mat, spots, withColor, hueBase) {
            const mesh = new THREE.InstancedMesh(geo, mat, Math.max(spots.length, 1));
            spots.forEach((sp, i) => {
                dummy.position.set(sp[0], 0, sp[1]);
                dummy.rotation.set(0, (sp[0] * 12.9898 + sp[1] * 78.233) % 6.28, 0);
                dummy.scale.setScalar(sp[2]);
                dummy.updateMatrix();
                mesh.setMatrixAt(i, dummy.matrix);
                if (withColor) {
                    const k = (Math.sin(sp[0] * 3.7 + sp[1] * 1.3) + 1) / 2;
                    mesh.setColorAt(i, tint.setHSL(hueBase + k * 0.07, 0.5, 0.26 + k * 0.1));
                }
            });
            mesh.count = spots.length;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.frustumCulled = false;
            mesh.instanceMatrix.needsUpdate = true;
            if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
            scene.add(mesh);
            return mesh;
        }
        const conifers = treeSpots.filter((s) => s[3] === 0);
        const broadleaf = treeSpots.filter((s) => s[3] === 1);
        // conifer: trunk + 3 stacked cones
        addInstanced(new THREE.CylinderGeometry(0.22, 0.3, 1.4, 6).translate(0, 0.7, 0), trunkMat2, conifers, false);
        addInstanced(new THREE.ConeGeometry(1.7, 2.6, 7).translate(0, 2.4, 0), foliageMat, conifers, true, 0.3);
        addInstanced(new THREE.ConeGeometry(1.35, 2.3, 7).translate(0, 3.7, 0), foliageMat, conifers, true, 0.3);
        addInstanced(new THREE.ConeGeometry(0.95, 2.0, 7).translate(0, 4.9, 0), foliageMat, conifers, true, 0.3);
        // broadleaf: trunk + two canopy blobs
        addInstanced(new THREE.CylinderGeometry(0.25, 0.36, 2.2, 6).translate(0, 1.1, 0), trunkMat2, broadleaf, false);
        addInstanced(new THREE.IcosahedronGeometry(1.9, 1).scale(1, 0.9, 1).translate(0, 3.5, 0), foliageMat, broadleaf, true, 0.24);
        addInstanced(new THREE.IcosahedronGeometry(1.25, 1).translate(0.9, 4.4, 0.3), foliageMat, broadleaf, true, 0.24);

        // bushes along building fronts
        const bushSpots = [];
        SCHOOL_BLOCKS.forEach(([, , bx, bz, w, d]) => {
            for (let px = -w / 2 + 1.5; px <= w / 2 - 1.4; px += 3.1) {
                if (Math.abs(px) < 2.8) continue;
                const x = bx + px;
                const z = bz - d / 2 - 3.4;
                if (!isBlocked(x, z, -0.2) && !onRoad(x, z, 1) && !inUtility(x, z)) bushSpots.push([x, z, 0.8 + rng() * 0.5]);
                const zb = bz + d / 2 + 1.8;
                if (!isBlocked(x, zb, -0.2) && !onRoad(x, zb, 1) && !inUtility(x, zb)) bushSpots.push([x, zb, 0.7 + rng() * 0.4]);
            }
        });
        addInstanced(new THREE.IcosahedronGeometry(0.95, 0).scale(1.2, 0.8, 1).translate(0, 0.65, 0), foliageMat, bushSpots, true, 0.28);

        // ---------- Street lamps (instanced poles/heads + glow) ----------
        const lampSpots = []; // [poleX, poleZ, headX, headZ, rotY]
        ROADS.forEach((r) => {
            const cross = crossingsFor(r);
            let k = 0;
            for (let t = r.a + 6; t <= r.b - 4; t += 13, k++) {
                if (cross.some((c) => Math.abs(t - c) < 8)) continue;
                const side = k % 2 === 0 ? -1 : 1;
                const off = side * (ROAD_W / 2 + 0.9);
                const toRoad = -side * 1.1;
                const spot = r.axis === 'x'
                    ? [t, r.fixed + off, t, r.fixed + off + toRoad, Math.PI / 2]
                    : [r.fixed + off, t, r.fixed + off + toRoad, t, 0];
                if (isBlocked(spot[0], spot[1], 0.3) || inUtility(spot[0], spot[1])) continue;
                lampSpots.push(spot);
            }
        });
        const lampPoleMat = new THREE.MeshStandardMaterial({ color: 0x4b5563, metalness: 0.6, roughness: 0.5 });
        const lampHeadMat = new THREE.MeshBasicMaterial({ color: 0xffe2a8, toneMapped: false });
        const lampPoles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.16, 7, 8).translate(0, 3.5, 0), lampPoleMat, lampSpots.length);
        const lampArms = new THREE.InstancedMesh(new THREE.BoxGeometry(1.2, 0.12, 0.12), lampPoleMat, lampSpots.length);
        const lampHeads = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, 0.16, 0.5), lampHeadMat, lampSpots.length);
        const poolGeo = new THREE.PlaneGeometry(12, 12);
        poolGeo.rotateX(-Math.PI / 2);
        const lampPools = new THREE.InstancedMesh(poolGeo, new THREE.MeshBasicMaterial({
            map: glowTex, color: 0xffc880, transparent: true, opacity: 0.5,
            blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
        }), lampSpots.length);
        const glowPts = [];
        lampSpots.forEach(([px, pz, hx, hz, rot], i) => {
            dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
            dummy.position.set(px, 0, pz); dummy.updateMatrix(); lampPoles.setMatrixAt(i, dummy.matrix);
            dummy.rotation.set(0, rot, 0);
            dummy.position.set((px + hx) / 2, 7.05, (pz + hz) / 2); dummy.updateMatrix(); lampArms.setMatrixAt(i, dummy.matrix);
            dummy.position.set(hx, 6.95, hz); dummy.updateMatrix(); lampHeads.setMatrixAt(i, dummy.matrix);
            dummy.rotation.set(0, 0, 0);
            dummy.position.set(hx, 0.22, hz); dummy.updateMatrix(); lampPools.setMatrixAt(i, dummy.matrix);
            glowPts.push(hx, 6.8, hz);
        });
        [lampPoles, lampArms, lampHeads, lampPools].forEach((m) => { m.frustumCulled = false; scene.add(m); });
        lampPoles.castShadow = true;
        const lampGlowGeo = new THREE.BufferGeometry();
        lampGlowGeo.setAttribute('position', new THREE.Float32BufferAttribute(glowPts, 3));
        const lampGlow = new THREE.Points(lampGlowGeo, new THREE.PointsMaterial({
            size: 6, map: glowTex, transparent: true, blending: THREE.AdditiveBlending,
            depthWrite: false, color: 0xffd89a, toneMapped: false,
        }));
        lampGlow.frustumCulled = false;
        scene.add(lampGlow);

        // ---------- Traffic signals (instanced, colours driven by the signal timer) ----------
        const sigDims = { r: 5.6, a: 5.15, g: 4.7 };
        const sigColors = {
            r: { on: 0xff3b30, off: 0x3a0d0b },
            a: { on: 0xffb020, off: 0x3a2808 },
            g: { on: 0x2cff7a, off: 0x0b3a1c },
        };
        const sigLampGeo = new THREE.SphereGeometry(0.2, 10, 8);
        const sigMats = { x: {}, z: {} };
        const sigMeshes = { x: {}, z: {} };
        const sigHeads = { x: [], z: [] };
        INTERSECTIONS.forEach(([cx, cz]) => {
            sigHeads.x.push([cx + 4.7, cz - 4.7], [cx - 4.7, cz + 4.7]);
            sigHeads.z.push([cx - 4.7, cz - 4.7], [cx + 4.7, cz + 4.7]);
        });
        ['x', 'z'].forEach((axis) => {
            ['r', 'a', 'g'].forEach((c) => {
                sigMats[axis][c] = new THREE.MeshBasicMaterial({ color: sigColors[c].off, toneMapped: false });
                const m = new THREE.InstancedMesh(sigLampGeo, sigMats[axis][c], sigHeads[axis].length * 2);
                sigHeads[axis].forEach(([hx, hz], i) => {
                    [-1, 1].forEach((s, j) => {
                        dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
                        dummy.position.set(axis === 'x' ? hx + s * 0.3 : hx, sigDims[c], axis === 'x' ? hz : hz + s * 0.3);
                        dummy.updateMatrix();
                        m.setMatrixAt(i * 2 + j, dummy.matrix);
                    });
                });
                m.frustumCulled = false;
                scene.add(m);
                sigMeshes[axis][c] = m;
            });
        });
        {
            const all = [...sigHeads.x, ...sigHeads.z];
            const sigPoles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.13, 5.6, 8).translate(0, 2.8, 0), lampPoleMat, all.length);
            const sigBoxes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 1.7, 0.5), new THREE.MeshStandardMaterial({ color: 0x15191f, roughness: 0.6 }), all.length);
            all.forEach(([hx, hz], i) => {
                dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
                dummy.position.set(hx, 0, hz); dummy.updateMatrix(); sigPoles.setMatrixAt(i, dummy.matrix);
                dummy.position.set(hx, 5.15, hz); dummy.updateMatrix(); sigBoxes.setMatrixAt(i, dummy.matrix);
            });
            sigPoles.frustumCulled = false; sigBoxes.frustumCulled = false;
            scene.add(sigPoles, sigBoxes);
        }

        // ---------- Electrical towers: lattice pylons + sagging conductors ----------
        const strutMat = new THREE.MeshStandardMaterial({ color: 0x97a3b4, metalness: 0.6, roughness: 0.5 });
        const wireMat = new THREE.MeshStandardMaterial({ color: 0x9aa5b4, metalness: 0.7, roughness: 0.4 });
        const insulatorMat = new THREE.MeshStandardMaterial({ color: 0xd7dde6, roughness: 0.4 });
        const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, toneMapped: false });
        const TOWER_X = 84;
        const TOWER_ZS = [-56, -24, 8, 40, 72, 104];
        const TOWER_H = 24;
        const hw = (y) => 2.6 - (1.8 * y) / TOWER_H;
        const corners = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
        const strutList = []; // [ax, ay, az, bx, by, bz]
        TOWER_ZS.forEach((tz) => {
            const P = (cx, cz, y) => [TOWER_X + cx * hw(y), y, tz + cz * hw(y)];
            const levels = [0, 6, 12, 18, 24];
            corners.forEach(([cx, cz]) => strutList.push([...P(cx, cz, 0), ...P(cx, cz, TOWER_H)]));
            levels.forEach((y, l) => {
                for (let i = 0; i < 4; i++) {
                    const a = corners[i];
                    const b = corners[(i + 1) % 4];
                    strutList.push([...P(a[0], a[1], y), ...P(b[0], b[1], y)]);
                    if (l < levels.length - 1) {
                        const y2 = levels[l + 1];
                        strutList.push([...P(a[0], a[1], y), ...P(b[0], b[1], y2)]);
                        strutList.push([...P(b[0], b[1], y), ...P(a[0], a[1], y2)]);
                    }
                }
            });
            strutList.push([TOWER_X, TOWER_H, tz, TOWER_X, 29, tz]); // peak
            strutList.push([TOWER_X - 6, 20, tz, TOWER_X + 6, 20, tz]); // lower cross-arm
            strutList.push([TOWER_X - 3.8, 25, tz, TOWER_X + 3.8, 25, tz]); // upper cross-arm
        });
        const strutMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 5), strutMat, strutList.length);
        const upV = new THREE.Vector3(0, 1, 0);
        const va = new THREE.Vector3();
        const vb = new THREE.Vector3();
        const vd = new THREE.Vector3();
        strutList.forEach((s, i) => {
            va.set(s[0], s[1], s[2]);
            vb.set(s[3], s[4], s[5]);
            vd.subVectors(vb, va);
            const len = vd.length();
            dummy.position.copy(va).addScaledVector(vd, 0.5);
            dummy.quaternion.setFromUnitVectors(upV, vd.normalize());
            const thick = s[1] === s[4] && Math.abs(s[0] - s[3]) > 7 ? 0.14 : 0.1; // cross-arms a bit chunkier
            dummy.scale.set(thick, len, thick);
            dummy.updateMatrix();
            strutMesh.setMatrixAt(i, dummy.matrix);
        });
        dummy.quaternion.identity();
        strutMesh.instanceMatrix.needsUpdate = true;
        strutMesh.frustumCulled = false;
        scene.add(strutMesh);

        // insulators + beacons
        const attach = [[-5.8, 18.2], [5.8, 18.2], [-3.8, 23.2], [3.8, 23.2]]; // [dx, y]
        const insGeo = new THREE.CylinderGeometry(0.14, 0.14, 1.6, 6);
        const beaconGeo = new THREE.SphereGeometry(0.45, 10, 8);
        const beaconHalo = new THREE.SpriteMaterial({
            map: glowTex, color: 0xff3030, transparent: true, opacity: 0.8,
            blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
        });
        TOWER_ZS.forEach((tz) => {
            attach.forEach(([dx, y]) => {
                const ins = new THREE.Mesh(insGeo, insulatorMat);
                ins.position.set(TOWER_X + dx, y + 0.8, tz);
                scene.add(ins);
            });
            const beacon = new THREE.Mesh(beaconGeo, beaconMat);
            beacon.position.set(TOWER_X, 29.4, tz);
            scene.add(beacon);
            const halo = new THREE.Sprite(beaconHalo);
            halo.scale.set(7, 7, 1);
            halo.position.copy(beacon.position);
            scene.add(halo);
        });
        const addWire = (p0, p1, sag) => {
            const mid = new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5);
            mid.y -= sag;
            const curve = new THREE.QuadraticBezierCurve3(p0, mid, p1);
            scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 18, 0.07, 4, false), wireMat));
        };
        for (let i = 0; i < TOWER_ZS.length - 1; i++) {
            attach.forEach(([dx, y]) => {
                addWire(new THREE.Vector3(TOWER_X + dx, y, TOWER_ZS[i]), new THREE.Vector3(TOWER_X + dx, y, TOWER_ZS[i + 1]), 3.2);
            });
            addWire(new THREE.Vector3(TOWER_X, 28, TOWER_ZS[i]), new THREE.Vector3(TOWER_X, 28, TOWER_ZS[i + 1]), 2.6); // earth wire
        }
        // service drop from the line down to the campus grid pole (70, 8)
        addWire(new THREE.Vector3(TOWER_X - 5.8, 18.2, 8), new THREE.Vector3(70, 8.4, 7.6), 1.6);
        addWire(new THREE.Vector3(TOWER_X - 3.8, 23.2, 8), new THREE.Vector3(70, 8.4, 8.4), 2.2);

        // ---------- Battery ----------
        const batteryGroup = new THREE.Group();
        batteryGroup.position.set(8, 0, 9);
        batteryGroup.userData = { type: 'battery', name: 'Shared Campus BESS Battery Hub' };
        const batteryBase = new THREE.Mesh(new THREE.BoxGeometry(8, 6, 5), new THREE.MeshStandardMaterial({ color: 0x0d1520, roughness: 0.7 }));
        batteryBase.position.y = 3; batteryBase.castShadow = true; batteryGroup.add(batteryBase);
        const batteryGlow = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.35, 3), new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x059669, emissiveIntensity: 1.5 }));
        batteryGlow.position.y = 6.2; batteryGroup.add(batteryGlow);
        scene.add(batteryGroup);
        twinObjects.batteries.push(batteryGroup);

        // ---------- EV parking ----------
        const lot = new THREE.Group();
        lot.position.set(0, 0, -22);
        const asphalt = new THREE.Mesh(new THREE.BoxGeometry(48, 0.18, 25), new THREE.MeshStandardMaterial({ color: 0x20252b, roughness: 0.92 }));
        asphalt.position.y = 0.08; lot.add(asphalt);
        const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        for (let row = -9; row <= 9; row += 6) {
            for (let col = -20; col <= 20; col += 5) {
                const line = new THREE.Mesh(new THREE.BoxGeometry(4, 0.025, 0.12), lineMat);
                line.position.set(col, 0.2, row); lot.add(line);
            }
        }
        const parkingPositions = [
            [-18, -9], [-12, -9], [-6, -9], [0, -9], [6, -9], [12, -9], [18, -9],
            [-18, 9], [-12, 9], [-6, 9], [0, 9], [6, 9], [12, 9], [18, 9],
        ];
        const carColors = [0x245a9c, 0xe7e7e7, 0x626b73, 0x9f2929, 0x292d32, 0xd5b44d];
        parkingPositions.forEach((pos, idx) => {
            const car = new THREE.Group();
            const body = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.75, 1.7), new THREE.MeshStandardMaterial({ color: carColors[idx % carColors.length], metalness: 0.35, roughness: 0.35 }));
            body.position.y = 0.65; body.castShadow = true; car.add(body);
            const cabin = new THREE.Mesh(new THREE.BoxGeometry(2, 0.65, 1.35), new THREE.MeshStandardMaterial({ color: 0x18232c, transparent: true, opacity: 0.82 }));
            cabin.position.y = 1.25; car.add(cabin);
            for (const wheelX of [-1.25, 1.25]) {
                const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.25, 16), new THREE.MeshStandardMaterial({ color: 0x111111 }));
                wheel.rotation.z = Math.PI / 2; wheel.position.set(wheelX, 0.38, 0.85); car.add(wheel);
                const wheel2 = wheel.clone(); wheel2.position.z = -0.85; car.add(wheel2);
            }
            car.position.set(pos[0], 0, pos[1]);
            car.userData = { type: 'ev', id: `EV-BAY-${idx + 1}` };
            lot.add(car);
            if (idx < 8) twinObjects.evs.push(car);
        });
        for (let x = -18; x <= 18; x += 6) {
            const charger = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.7, 0.45), new THREE.MeshStandardMaterial({ color: 0x39e6a0, emissive: 0x0b704f, emissiveIntensity: 1.4 }));
            charger.position.set(x, 0.85, 12); lot.add(charger);
        }
        scene.add(lot);

        // ---------- Grid connection (unchanged pole + cable, plus insulated cross-arm) ----------
        const pole = new THREE.Mesh(new THREE.BoxGeometry(1, 7, 1), new THREE.MeshStandardMaterial({ color: 0x536678 }));
        pole.position.set(70, 5, 8); pole.castShadow = true; scene.add(pole);
        const poleArm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 3.2), new THREE.MeshStandardMaterial({ color: 0x3f4d5c, metalness: 0.5 }));
        poleArm.position.set(70, 8.2, 8); scene.add(poleArm);
        const cable = new THREE.Mesh(new THREE.BoxGeometry(60, 0.25, 0.25), new THREE.MeshStandardMaterial({ color: 0xffba4b, emissive: 0x633700, emissiveIntensity: 1 }));
        cable.position.set(40, 6, 8); scene.add(cable);

        // ---------- Pre-allocated Live Telemetry Flow Paths & Particles (UNCHANGED) ----------
        const flowPaths = [];
        const batteryPos = new THREE.Vector3(8, 3, 9);
        const evPos = new THREE.Vector3(0, 1, -22);
        const gridPos = new THREE.Vector3(70, 5, 8);

        twinObjects.buildings.forEach((b, i) => {
            if (i % 3 === 0) {
                const bPos = b.position.clone(); bPos.y = 5;
                flowPaths.push({ start: bPos, end: batteryPos, type: 'solar', color: 0x10b981 });
            }
        });
        flowPaths.push({ start: batteryPos, end: evPos, type: 'ev', color: 0xa855f7 });
        flowPaths.push({ start: gridPos, end: batteryPos, type: 'grid', color: 0xf59e0b });

        const sharedParticleGeo = new THREE.SphereGeometry(0.35, 8, 8);
        flowPaths.forEach((fp) => {
            const dir = new THREE.Vector3().subVectors(fp.end, fp.start);
            const len = dir.length();
            const cylMat = new THREE.MeshBasicMaterial({ color: fp.color, transparent: true, opacity: 0.65, toneMapped: false });
            const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, len, 8), cylMat);
            cyl.position.copy(fp.start.clone().add(fp.end.clone().sub(fp.start).multiplyScalar(0.5)));
            cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
            cyl.userData = { flowType: fp.type, offset: Math.random() * Math.PI * 2 };
            scene.add(cyl);
            twinObjects.flows.push(cyl);

            const pMat = new THREE.MeshStandardMaterial({ color: fp.color, emissive: fp.color, emissiveIntensity: 0.9, toneMapped: false });
            for (let p = 0; p < 2; p++) {
                const pMesh = new THREE.Mesh(sharedParticleGeo, pMat);
                pMesh.userData = {
                    flowType: fp.type,
                    start: fp.start.clone(),
                    end: fp.end.clone(),
                    speed: 0.8 + Math.random() * 0.4,
                    progress: p * 0.5,
                };
                scene.add(pMesh);
                twinObjects.particles.push(pMesh);
            }
        });

        // ---------- Moving vehicles on the roads (left-hand traffic, signal-aware) ----------
        const vehicleBodyMats = [0xc8d0d8, 0x1f3a5f, 0x9b2226, 0x2b2f36, 0xe5e5e5, 0x3a6ea5, 0xc79a2b, 0x2f6b4f]
            .map((c) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.5, roughness: 0.35 }));
        const busBodyMat = new THREE.MeshStandardMaterial({ color: 0xe8a317, metalness: 0.3, roughness: 0.45 });
        const cabinMat = new THREE.MeshStandardMaterial({ color: 0x10171f, metalness: 0.3, roughness: 0.2 });
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.9 });
        const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2c8, toneMapped: false });
        const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a, toneMapped: false });
        const busWinMat = new THREE.MeshBasicMaterial({ color: 0xffe6a8, toneMapped: false });
        const carPoolMat = new THREE.MeshBasicMaterial({
            map: glowTex, color: 0xffe0a0, transparent: true, opacity: 0.5,
            blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
        });
        const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
        wheelGeo.rotateX(Math.PI / 2);
        const lampBoxGeo = new THREE.BoxGeometry(0.12, 0.22, 0.34);
        const carPoolGeo = new THREE.PlaneGeometry(11, 5.5);
        carPoolGeo.rotateX(-Math.PI / 2);
        const vehicleParts = {
            carBody: new THREE.BoxGeometry(4.2, 0.8, 1.8),
            carCabin: new THREE.BoxGeometry(2.3, 0.7, 1.55),
            busBody: new THREE.BoxGeometry(9.5, 2.4, 2.5),
            busWin: new THREE.BoxGeometry(9.1, 0.8, 2.56),
        };
        const nightOnly = [lampGlow, lampPools]; // objects shown only at night
        const vehicles = [];

        function makeVehicle(kind, idx) {
            const g = new THREE.Group();
            const add = (geo, mat, x, y, z, shadow) => {
                const m = new THREE.Mesh(geo, mat);
                m.position.set(x, y, z);
                if (shadow) m.castShadow = true;
                g.add(m);
                return m;
            };
            let len;
            if (kind === 'bus') {
                len = 9.5;
                add(vehicleParts.busBody, busBodyMat, 0, 1.7, 0, true);
                add(vehicleParts.busWin, busWinMat, 0, 2.35, 0, false);
                [-3.1, 3.1].forEach((x) => [-1.1, 1.1].forEach((z) => {
                    const w = add(wheelGeo, wheelMat, x, 0.5, z, false);
                    w.scale.set(1.3, 1.3, 1);
                }));
                [-0.8, 0.8].forEach((z) => {
                    add(lampBoxGeo, headMat, 4.78, 0.95, z, false);
                    add(lampBoxGeo, tailMat, -4.78, 0.95, z, false);
                });
            } else {
                len = 4.2;
                add(vehicleParts.carBody, vehicleBodyMats[idx % vehicleBodyMats.length], 0, 0.65, 0, true);
                add(vehicleParts.carCabin, cabinMat, -0.25, 1.35, 0, false);
                [-1.3, 1.3].forEach((x) => [-0.85, 0.85].forEach((z) => add(wheelGeo, wheelMat, x, 0.38, z, false)));
                [-0.6, 0.6].forEach((z) => {
                    add(lampBoxGeo, headMat, 2.12, 0.7, z, false);
                    add(lampBoxGeo, tailMat, -2.12, 0.7, z, false);
                });
            }
            const pool = new THREE.Mesh(carPoolGeo, carPoolMat);
            pool.position.set(len / 2 + 5, 0.24, 0);
            g.add(pool);
            nightOnly.push(pool);
            scene.add(g);
            return { group: g, len };
        }

        const lanes = [];
        let vIdx = 0;
        ROADS.forEach((r, ri) => {
            const cross = crossingsFor(r);
            [1, -1].forEach((dir) => {
                const off = r.axis === 'x' ? (dir === 1 ? -1.75 : 1.75) : (dir === 1 ? 1.75 : -1.75);
                const lane = {
                    axis: r.axis,
                    dir,
                    a: r.a,
                    b: r.b,
                    len: r.b - r.a,
                    fixed: r.fixed + off,
                    crossS: cross.map((c) => (dir === 1 ? c - r.a : r.b - c)),
                    cars: [],
                };
                const count = ri === 0 ? 3 : ri === 3 ? 1 : 2;
                for (let i = 0; i < count; i++) {
                    const kind = rng() < 0.14 ? 'bus' : 'car';
                    const v = makeVehicle(kind, vIdx++);
                    lane.cars.push({
                        group: v.group,
                        len: v.len,
                        s: ((i + rng() * 0.35) / count) * lane.len,
                        v: 0,
                        commit: [],
                        maxSpeed: 7 + rng() * 3,
                    });
                }
                lanes.push(lane);
            });
        });

        const ACCEL = 3.2;
        const DECEL = 5.5;       // hardest braking available
        const PLAN_DECEL = 3.0;  // comfortable braking used when planning a stop
        function updateTraffic(dt, simTime) {
            const sig = signalState(simTime);
            lanes.forEach((lane) => {
                const L = lane.len;
                const state = sig[lane.axis];
                lane.cars.forEach((c) => {
                    let allowed = c.maxSpeed;
                    // keep distance to the car ahead
                    lane.cars.forEach((o) => {
                        if (o === c) return;
                        const gap = ((o.s - c.s) % L + L) % L - (c.len + o.len) / 2 - 2.2;
                        if (gap < 60) allowed = Math.min(allowed, Math.sqrt(2 * DECEL * Math.max(0, gap)));
                    });
                    // stop at red / amber (a car committed at amber keeps going until it clears the crossing)
                    lane.crossS.forEach((cs, ci) => {
                        const ahead = cs - c.s;
                        if (ahead < -(c.len + 4)) c.commit[ci] = false;
                        if (state === 'g' || c.commit[ci]) return;
                        const stopLine = 4.8 + c.len / 2;
                        if (ahead <= stopLine - 2.0 || ahead > 60) return;
                        const brakeDist = (c.v * c.v) / (2 * DECEL) + 0.5;
                        if (state === 'a' && ahead - stopLine < brakeDist) { c.commit[ci] = true; return; } // too late to stop
                        allowed = Math.min(allowed, Math.sqrt(2 * PLAN_DECEL * Math.max(0, ahead - stopLine))); // brake early & comfortably
                    });
                    c.v += Math.max(-DECEL * dt, Math.min(ACCEL * dt, allowed - c.v));
                    if (c.v < 0) c.v = 0;
                    c.s += c.v * dt;
                    if (c.s >= L) { c.s -= L; c.v = Math.min(c.v, 3); c.commit.length = 0; } // re-enter slowly (fades in)

                    const coord = lane.dir === 1 ? lane.a + c.s : lane.b - c.s;
                    const g = c.group;
                    if (lane.axis === 'x') {
                        g.position.set(coord, 0.16, lane.fixed);
                        g.rotation.y = lane.dir === 1 ? 0 : Math.PI;
                    } else {
                        g.position.set(lane.fixed, 0.16, coord);
                        g.rotation.y = lane.dir === 1 ? -Math.PI / 2 : Math.PI / 2;
                    }
                    const fade = Math.min(1, Math.min(c.s, L - c.s) / 5);
                    g.visible = fade > 0.04;
                    g.scale.setScalar(Math.max(fade, 0.01));
                });
            });
            ['x', 'z'].forEach((axis) => {
                ['r', 'a', 'g'].forEach((c) => {
                    sigMats[axis][c].color.setHex(sig[axis] === c ? sigColors[c].on : sigColors[c].off);
                });
            });
        }

        // ---------- Environment (day / night) ----------
        const env = {
            isNight: true,
            apply(night, heat) {
                env.isNight = night;
                const bg = night ? 0x0a1630 : 0x9cc7e6;
                scene.background.set(bg);
                scene.fog.color.set(bg);
                scene.fog.density = night ? 0.0042 : 0.0028;
                skyMat.map = night ? skyNightTex : skyDayTex;
                skyMat.needsUpdate = true;
                stars.visible = night;
                moonGroup.visible = night;
                if (lights.sunMeshGroup) lights.sunMeshGroup.visible = !night;

                if (night) {
                    ambient.color.set(0x5878b8); ambient.groundColor.set(0x0e1d14); ambient.intensity = 1.9 * Lk;
                    sun.color.set(0x9db4ff); sun.intensity = 1.7 * Lk; sun.position.set(-60, 95, 45);
                    renderer.toneMappingExposure = 1.05;
                } else {
                    ambient.color.set(0xbfe0ff); ambient.groundColor.set(0x4a5a3a); ambient.intensity = 2.3 * Lk;
                    sun.color.set(0xfff1d0); sun.intensity = 3.6 * Lk; sun.position.set(45, 75, 40);
                    renderer.toneMappingExposure = 0.95;
                }

                nightOnly.forEach((o) => { o.visible = night; });
                lampHeadMat.color.setHex(night ? 0xffe2a8 : 0x8a8a7a);
                headMat.color.setHex(night ? 0xfff2c8 : 0x9c9c90);
                tailMat.color.setHex(night ? 0xff2a2a : 0x7a2a2a);
                busWinMat.color.setHex(night ? 0xffe6a8 : 0x4a5a66);
                moonHalo.visible = night;

                twinObjects.clouds.forEach((cl) => { cl.material.color.setHex(night ? 0x475569 : 0xcbd5e1); });

                glassWindows.visible = night && !heat;
                plainWindows.visible = !heat;
                glassWindows.material.opacity = 0.95;
                plainWindows.material.opacity = night ? 0.95 : 0.8;
                paintAllWindows(glassWindows, night);
                paintAllWindows(plainWindows, night);
            },
        };
        refs.current.env = env;
        env.apply(nightRef.current, heatRef.current);

        // ---------- Throttled Raycasting ----------
        let rafMoveId = null;
        const handlePointerMove = (e) => {
            if (rafMoveId) return;
            const clientX = e.clientX;
            const clientY = e.clientY;
            rafMoveId = requestAnimationFrame(() => {
                rafMoveId = null;
                if (!container || !renderer) return;
                const rect = renderer.domElement.getBoundingClientRect();
                refs.current.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
                refs.current.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
                refs.current.raycaster.setFromCamera(refs.current.mouse, refs.current.camera);
                const clickable = [...twinObjects.buildings, ...twinObjects.batteries, ...twinObjects.evs, ...twinObjects.solarPanels];
                const hits = refs.current.raycaster.intersectObjects(clickable, true);
                if (hits.length > 0) {
                    let obj = hits[0].object;
                    while (obj.parent && !obj.userData.type) obj = obj.parent;

                    let type = obj.userData.type;
                    let id = obj.userData.id;
                    let name = obj.userData.name;

                    if (type === 'solar') {
                        type = 'building';
                        id = obj.userData.building || 'mega_academic';
                        const bObj = twinObjects.buildings.find(b => b.userData.id === id);
                        if (bObj) name = bObj.userData.name;
                    }

                    if (type) {
                        setHoveredInfo({
                            type,
                            id: id || 'building',
                            name: name || id || 'Building',
                            x: clientX - rect.left,
                            y: clientY - rect.top,
                        });
                        container.style.cursor = 'pointer';
                        return;
                    }
                }
                setHoveredInfo(null);
                container.style.cursor = 'grab';
            });
        };

        const handleClick = () => {
            refs.current.raycaster.setFromCamera(refs.current.mouse, refs.current.camera);
            const clickable = [...twinObjects.buildings, ...twinObjects.batteries, ...twinObjects.evs, ...twinObjects.solarPanels];
            const hits = refs.current.raycaster.intersectObjects(clickable, true);
            if (hits.length === 0) return;
            let obj = hits[0].object;
            while (obj.parent && !obj.userData.type) obj = obj.parent;

            let type = obj.userData.type;
            let id = obj.userData.id;
            if (type === 'solar') {
                type = 'building';
                id = obj.userData.building || 'mega_academic';
            }

            if (type === 'building') {
                const cb = callbacksRef.current;
                if (cb.onBuildingClick) cb.onBuildingClick(id || 'main');
                else cb.navigate(`/fairness?block=${id || 'main'}`);
            } else if (type === 'battery') {
                callbacksRef.current.navigate('/optimization');
            }
        };

        renderer.domElement.addEventListener('pointermove', handlePointerMove);
        renderer.domElement.addEventListener('click', handleClick);

        const handleResize = () => {
            if (!container || !renderer || !camera) return;
            camera.aspect = container.clientWidth / Math.max(container.clientHeight, 1);
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        };
        window.addEventListener('resize', handleResize);
        handleResize();

        let lastMs = performance.now();
        let simTime = 0;
        let flickerAcc = 0;
        const animate = () => {
            refs.current.animationFrameId = requestAnimationFrame(animate);
            const nowMs = performance.now();
            const dt = Math.min((nowMs - lastMs) / 1000, 0.05);
            lastMs = nowMs;
            simTime += dt;
            const time = nowMs * 0.002;

            // Solar panel glow animation
            twinObjects.solarPanels.forEach((panel, i) => {
                if (panel.material) panel.material.emissiveIntensity = 0.6 + Math.sin(time + i * 0.15) * 0.3;
            });

            // Flow line pulse animation
            twinObjects.flows.forEach((flow) => {
                if (flow.visible && flow.userData?.offset) {
                    const pulse = 0.8 + Math.sin(time * 2 + flow.userData.offset) * 0.2;
                    flow.scale.set(pulse, 1, pulse);
                }
            });

            // 1. Flow Glowing Particles Movement
            twinObjects.particles.forEach((p) => {
                if (p.visible) {
                    p.userData.progress = (p.userData.progress + 0.004 * p.userData.speed) % 1;
                    p.position.lerpVectors(p.userData.start, p.userData.end, p.userData.progress);
                }
            });

            // 2. Procedural Cloud Drifting
            twinObjects.clouds.forEach((cloud) => {
                cloud.position.x += 0.025;
                if (cloud.position.x > 90) cloud.position.x = -90;
            });

            // 3. Rain Particle Fall Animation
            if (refs.current.rainMesh && refs.current.rainMesh.visible) {
                const pos = refs.current.rainMesh.geometry.attributes.position.array;
                for (let i = 0; i < 300; i++) {
                    pos[i * 3 + 1] -= 1.1;
                    if (pos[i * 3 + 1] < 0) pos[i * 3 + 1] = 50;
                }
                refs.current.rainMesh.geometry.attributes.position.needsUpdate = true;
            }

            // 4. Traffic + signals
            updateTraffic(dt, simTime);

            // 5. Tower beacons
            beaconMat.opacity = 0.3 + 0.7 * Math.max(0, Math.sin(time * 1.6));
            beaconHalo.opacity = 0.15 + 0.7 * Math.max(0, Math.sin(time * 1.6));

            // 6. Living windows (a few lights switch on/off)
            flickerAcc += dt;
            if (env.isNight && flickerAcc > 0.5) {
                flickerAcc = 0;
                for (let k = 0; k < 4; k++) {
                    const mesh = Math.random() < 0.5 ? glassWindows : plainWindows;
                    if (!mesh.visible || mesh.count === 0) continue;
                    const i = Math.floor(Math.random() * mesh.count);
                    mesh.userData.lit[i] ^= 1;
                    paintWindow(mesh, i, true);
                    mesh.instanceColor.needsUpdate = true;
                }
            }

            skyGroup.position.copy(camera.position);
            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        return () => {
            if (refs.current.animationFrameId) cancelAnimationFrame(refs.current.animationFrameId);
            window.removeEventListener('resize', handleResize);
            if (renderer.domElement) {
                renderer.domElement.removeEventListener('pointermove', handlePointerMove);
                renderer.domElement.removeEventListener('click', handleClick);
                if (container.contains(renderer.domElement)) {
                    container.removeChild(renderer.domElement);
                }
            }
            controls.dispose();

            if (scene) {
                scene.traverse((obj) => {
                    if (obj.geometry) obj.geometry.dispose();
                    if (obj.material) {
                        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
                        mats.forEach((mat) => {
                            if (mat.map) mat.map.dispose();
                            mat.dispose();
                        });
                    }
                    if (obj.isInstancedMesh && obj.dispose) obj.dispose();
                });
            }
            [skyDayTex, skyNightTex, glowTex].forEach((t) => t.dispose());

            renderer.forceContextLoss();
            renderer.dispose();
            refs.current.scene = null;
            refs.current.renderer = null;
            refs.current.camera = null;
            refs.current.controls = null;
            refs.current.env = null;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ---------- DAY / NIGHT + HEATMAP ENVIRONMENT (no mesh recreation) ----------
    useEffect(() => {
        if (refs.current.env) refs.current.env.apply(isNightMode, isHeatmapMode);
    }, [isNightMode, isHeatmapMode]);

    // ---------- LIVE TELEMETRY VISIBILITY & MATERIAL UPDATES (ZERO MESH RECREATION) ----------
    useEffect(() => {
        const { scene, twinObjects } = refs.current;
        if (!scene || !twinObjects || !sceneData) return;

        const hasEvLoad = (sceneData.flexibleLoadKw ?? 0) > 0 || (sceneData.evLoad ?? 0) > 0;
        const hasGridImport = (sceneData.gridImportKw ?? 0) > 0;

        twinObjects.flows.forEach((f) => {
            if (f.userData.flowType === 'ev') f.visible = hasEvLoad;
            else if (f.userData.flowType === 'grid') f.visible = hasGridImport;
        });

        twinObjects.particles.forEach((p) => {
            if (p.userData.flowType === 'ev') p.visible = hasEvLoad;
            else if (p.userData.flowType === 'grid') p.visible = hasGridImport;
        });

        const soc = sceneData.batterySocPct ?? 50;
        const battMat = twinObjects.batteries[0]?.children[1]?.material;
        if (battMat) {
            if (soc < 30) {
                battMat.color.setHex(0xef4444); battMat.emissive.setHex(0xb91c1c);
            } else if (soc < 50) {
                battMat.color.setHex(0xf59e0b); battMat.emissive.setHex(0xd97706);
            } else {
                battMat.color.setHex(0x10b981); battMat.emissive.setHex(0x059669);
            }
        }

        const evLoad = sceneData.flexibleLoadKw ?? 15;
        twinObjects.evs.forEach((ev, idx) => {
            const active = idx < Math.max(2, Math.round(evLoad / 3));
            const carBody = ev.children[0];
            if (carBody?.material) {
                if (active) {
                    carBody.material.emissive.setHex(0x059669);
                    carBody.material.emissiveIntensity = 0.6;
                } else {
                    carBody.material.emissive.setHex(0x000000);
                    carBody.material.emissiveIntensity = 0;
                }
            }
        });

        // Weather Rain toggle during Storm
        if (refs.current.rainMesh) {
            refs.current.rainMesh.visible = Boolean(sceneData.anomalyFlag || (sceneData.cloudCover && sceneData.cloudCover > 0.7));
        }
    }, [sceneData]);

    // ---------- SHARED REUSABLE THERMAL HEATMAP MATERIALS ----------
    const sharedHeatmapMats = useRef(null);
    if (!sharedHeatmapMats.current) {
        sharedHeatmapMats.current = {
            emerald: new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x10b981, emissiveIntensity: 0.6, roughness: 0.35 }),
            cyan: new THREE.MeshStandardMaterial({ color: 0x06b6d4, emissive: 0x06b6d4, emissiveIntensity: 0.6, roughness: 0.35 }),
            amber: new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.6, roughness: 0.35 }),
            rose: new THREE.MeshStandardMaterial({ color: 0xf43f5e, emissive: 0xf43f5e, emissiveIntensity: 0.7, roughness: 0.35 }),
        };
    }

    useEffect(() => {
        const { twinObjects } = refs.current;
        if (!twinObjects || !twinObjects.buildings) return;

        const blockMap = {};
        (sceneData?.blocks || []).forEach((b) => {
            blockMap[b.block_id || b.blockId] = b;
        });

        twinObjects.buildings.forEach((group) => {
            const bId = group.userData.id;
            const bData = blockMap[bId];
            const sat = bData?.satisfaction_ratio ?? bData?.satisfactionRatio ?? 1.0;
            const isCrit = bData?.is_critical_now ?? bData?.isCriticalNow ?? group.userData.always_critical;

            let heatMat = sharedHeatmapMats.current.emerald;
            if (isCrit) heatMat = sharedHeatmapMats.current.rose;
            else if (sat < 0.6) heatMat = sharedHeatmapMats.current.amber;
            else if (sat < 0.85) heatMat = sharedHeatmapMats.current.cyan;

            group.traverse((child) => {
                if (child.isMesh && child.userData.type !== 'solar') {
                    if (!child.userData.origMaterial) {
                        child.userData.origMaterial = child.material;
                    }
                    if (isHeatmapMode) {
                        child.material = heatMat;
                    } else if (child.userData.origMaterial) {
                        child.material = child.userData.origMaterial;
                    }
                }
            });
        });
    }, [isHeatmapMode, sceneData]);

    // Dynamic resolution scaling update
    useEffect(() => {
        if (refs.current.renderer) {
            const scale = resolutionScale === 'auto' ? Math.min(window.devicePixelRatio, 1.5) : resolutionScale;
            refs.current.renderer.setPixelRatio(scale);
            if (refs.current.lights.sun) {
                const shadowRes = scale <= 0.75 ? 1024 : 2048;
                refs.current.lights.sun.shadow.mapSize.width = shadowRes;
                refs.current.lights.sun.shadow.mapSize.height = shadowRes;
                if (refs.current.lights.sun.shadow.map) { refs.current.lights.sun.shadow.map.dispose(); refs.current.lights.sun.shadow.map = null; }
            }
        }
    }, [resolutionScale]);

    const handleResetCamera = () => {
        if (refs.current.camera && refs.current.controls) {
            refs.current.camera.position.set(70, 50, 70);
            refs.current.controls.target.set(0, 4, 10);
            refs.current.controls.update();
        }
    };

    return (
        <div
            ref={wrapperRef}
            className={
                isExpanded
                    ? "fixed top-0 left-0 w-[100vw] h-[100vh] z-[9999] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 transition-all duration-300"
                    : "relative w-full h-full flex-1 min-h-0 rounded-lg overflow-hidden border border-border-default shadow-md bg-slate-950 transition-all duration-300"
            }
        >
            {/* The actual 3D Canvas Container */}
            <div
                className={
                    isExpanded
                        ? "w-full h-full rounded-xl overflow-hidden shadow-2xl relative border border-slate-700/50"
                        : "w-full h-full absolute inset-0"
                }
            >
                <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

                {/* Top Left Toolbar */}
                <div className="absolute top-3.5 left-[108px] sm:left-32 flex items-center gap-2 z-20">
                  <span className="bg-slate-900/80 backdrop-blur-md border border-slate-700/60 px-2.5 py-1.5 rounded text-xs font-mono font-bold text-emerald-400 flex items-center gap-1.5 shadow-sm">
                    <Zap className="w-4 h-4 text-emerald-400" />
                    CAMPUS TWIN
                  </span>
                    {sceneData?.anomalyFlag && (
                        <span className="bg-rose-950/90 backdrop-blur-md border border-rose-600 px-3 py-1.5 rounded-md text-xs font-heading font-semibold text-rose-300 animate-pulse">
                          ANOMALY DETECTED
                        </span>
                    )}
                    {isHeatmapMode && (
                        <span className="bg-amber-950/90 backdrop-blur-md border border-amber-600 px-3 py-1.5 rounded-md text-xs font-heading font-semibold text-amber-300">
                          HEATMAP OVERLAY ACTIVE
                        </span>
                    )}
                </div>

                {/* Top Right Toolbar with Controls */}
                <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
                    {/* Thermal Heatmap Mode Toggle Button */}
                    <button
                        onClick={() => setIsHeatmapMode(!isHeatmapMode)}
                        className={`p-2 rounded-md transition-all shadow-sm border ${
                            isHeatmapMode
                                ? 'bg-amber-950 text-amber-300 border-amber-500 font-semibold'
                                : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-700/80'
                        }`}
                        title={isHeatmapMode ? 'Disable Thermal Heatmap View' : 'Enable Energy Load Heatmap Overlay'}
                    >
                        <Flame className="w-4 h-4 text-amber-400" />
                    </button>

                    {/* Small Square Box Resolution Selector Dropdown */}
                    <div className="relative group">
                        <button
                            className="w-8 h-8 flex items-center justify-center rounded-md border border-slate-700/80 bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors shadow-sm focus:outline-none"
                            title={`Render Resolution: ${resolutionScale === 'auto' ? 'Native' : resolutionScale + 'x'}`}
                        >
                            <Sliders className="w-4 h-4 text-sky-400" />
                        </button>

                        {/* Hover / Click Dropdown Menu */}
                        <div className="absolute right-0 top-full mt-1.5 hidden group-hover:block group-focus-within:block z-50 bg-slate-900/95 border border-slate-700/80 backdrop-blur-md p-1.5 rounded-lg shadow-2xl text-xs font-mono w-44">
                            <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 mb-1">
                                Render Resolution
                            </div>
                            <button
                                onClick={() => setResolutionScale(0.75)}
                                className={`w-full text-left px-2.5 py-1.5 rounded flex items-center justify-between transition-colors ${
                                    resolutionScale === 0.75 ? 'bg-emerald-950/90 text-emerald-400 font-semibold' : 'text-slate-300 hover:bg-slate-800'
                                }`}
                            >
                                <span>0.75x (Performance)</span>
                                {resolutionScale === 0.75 && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                            </button>
                            <button
                                onClick={() => setResolutionScale(1.0)}
                                className={`w-full text-left px-2.5 py-1.5 rounded flex items-center justify-between transition-colors ${
                                    resolutionScale === 1.0 ? 'bg-emerald-950/90 text-emerald-400 font-semibold' : 'text-slate-300 hover:bg-slate-800'
                                }`}
                            >
                                <span>1.0x (Standard)</span>
                                {resolutionScale === 1.0 && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                            </button>
                            <button
                                onClick={() => setResolutionScale(1.25)}
                                className={`w-full text-left px-2.5 py-1.5 rounded flex items-center justify-between transition-colors ${
                                    resolutionScale === 1.25 ? 'bg-emerald-950/90 text-emerald-400 font-semibold' : 'text-slate-300 hover:bg-slate-800'
                                }`}
                            >
                                <span>1.25x (High Detail)</span>
                                {resolutionScale === 1.25 && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                            </button>
                            <button
                                onClick={() => setResolutionScale('auto')}
                                className={`w-full text-left px-2.5 py-1.5 rounded flex items-center justify-between transition-colors ${
                                    resolutionScale === 'auto' ? 'bg-emerald-950/90 text-emerald-400 font-semibold' : 'text-slate-300 hover:bg-slate-800'
                                }`}
                            >
                                <span>Native (Full DPI)</span>
                                {resolutionScale === 'auto' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                            </button>
                        </div>
                    </div>

                    <button
                        onClick={() => {
                            setIsExpanded(!isExpanded);
                            setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
                        }}
                        className="bg-slate-950/40 hover:bg-slate-800/60 text-slate-300 hover:text-white border border-slate-700/40 p-2 rounded-md transition-colors shadow-sm"
                        title={isExpanded ? 'Minimize View' : 'Expand to Fullscreen'}
                    >
                        {isExpanded ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                    </button>

                    <button
                        onClick={() => setIsNightMode(!isNightMode)}
                        className="bg-slate-950/40 hover:bg-slate-800/60 text-slate-300 hover:text-white border border-slate-700/40 p-2 rounded-md transition-colors shadow-sm"
                        title={isNightMode ? 'Switch to Day Light' : 'Switch to Night Lighting'}
                    >
                        {isNightMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-sky-400" />}
                    </button>
                </div>

                {/* Professional Interactive Hover Info Tooltip */}
                {hoveredInfo && (() => {
                    const blockData = sceneData?.blocks?.find(b => (b.block_id || b.blockId) === hoveredInfo.id)
                        || sceneData?.allocation?.blocks?.find(b => (b.block_id || b.blockId) === hoveredInfo.id);

                    const dem = blockData ? (blockData.current_demand_kw ?? blockData.demandKw ?? 0) : 0;
                    const sol = blockData ? (blockData.solar_contribution_kw ?? blockData.solarContributionKw ?? 0) : 0;
                    const pred = blockData ? (blockData.predicted_next_demand_kw ?? blockData.predictedNextDemandKw ?? (dem * 1.05)) : 0;
                    const srvClean = blockData ? (blockData.served_clean_kw ?? blockData.servedCleanKw ?? (dem * 0.8)) : 0;
                    const gridDraw = blockData ? (blockData.grid_supplement_kw ?? blockData.gridSupplementKw ?? Math.max(0, dem - srvClean)) : 0;
                    const satRatio = blockData ? (blockData.satisfaction_ratio ?? blockData.satisfactionRatio ?? (dem > 0 ? srvClean / dem : 1.0)) : 1.0;
                    const layerName = blockData ? (blockData.layer || blockData.allocationLayer || 'baseline') : 'baseline';
                    const isCrit = blockData ? (blockData.is_critical_now || blockData.isCriticalNow || blockData.always_critical) : false;

                    return (
                        <div
                            className="absolute pointer-events-none z-50 bg-slate-900/95 border border-slate-700/80 backdrop-blur-md p-3.5 rounded-lg shadow-2xl text-xs font-sans transition-all transform -translate-x-1/2 -translate-y-full min-w-[270px] max-w-[320px]"
                            style={{ left: hoveredInfo.x, top: hoveredInfo.y - 15 }}
                        >
                            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                                <span className="text-slate-100 font-heading font-semibold uppercase tracking-wider text-xs flex items-center gap-2 truncate">
                                    {hoveredInfo.type === 'building' && <Building2 className="w-4 h-4 text-sky-400 shrink-0" />}
                                    {hoveredInfo.type === 'battery' && <BatteryCharging className="w-4 h-4 text-emerald-400 shrink-0" />}
                                    {hoveredInfo.type === 'ev' && <Car className="w-4 h-4 text-purple-400 shrink-0" />}
                                    {hoveredInfo.name}
                                </span>
                                {isCrit && (
                                    <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 px-1.5 py-0.5 rounded text-[9px] font-semibold tracking-wider uppercase font-mono shrink-0 ml-1">
                                        CRITICAL
                                    </span>
                                )}
                            </div>

                            {hoveredInfo.type === 'building' && (
                                <div className="space-y-1.5 text-slate-200 font-sans">
                                    <div className="flex justify-between items-center text-[11px]">
                                        <span className="text-slate-400">Current Load:</span>
                                        <span className="font-mono font-semibold text-amber-400 tabular-nums">{dem.toFixed(1)} kW</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[11px]">
                                        <span className="text-slate-400">Solar Output:</span>
                                        <span className="font-mono font-semibold text-emerald-400 tabular-nums">{sol.toFixed(1)} kW</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[11px]">
                                        <span className="text-slate-400">Forecast (15m):</span>
                                        <span className="font-mono font-semibold text-sky-400 tabular-nums">{pred.toFixed(1)} kW</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[11px]">
                                        <span className="text-slate-400">Clean Served:</span>
                                        <span className="font-mono font-semibold text-emerald-400 tabular-nums">{srvClean.toFixed(1)} kW ({Math.round(satRatio * 100)}%)</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[11px]">
                                        <span className="text-slate-400">Grid Supplement:</span>
                                        <span className="font-mono font-semibold text-amber-500 tabular-nums">{gridDraw.toFixed(1)} kW</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-1.5 border-t border-slate-800 text-[10px]">
                                        <span className="text-slate-400">Allocation Layer:</span>
                                        <span className="uppercase font-semibold text-sky-300 font-mono">{layerName}</span>
                                    </div>
                                </div>
                            )}

                            {hoveredInfo.type === 'battery' && (
                                <div className="space-y-1.5 text-slate-200 font-sans">
                                    <div className="flex justify-between items-center text-[11px]">
                                        <span className="text-slate-400">State of Charge:</span>
                                        <span className="font-mono font-semibold text-emerald-400 tabular-nums">{sceneData?.batterySocPct?.toFixed(1) ?? '50.0'}%</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[11px]">
                                        <span className="text-slate-400">Stored Capacity:</span>
                                        <span className="font-mono font-semibold text-slate-200 tabular-nums">{(sceneData?.batteryKwh ?? (sceneData?.batterySocPct * 5 || 250)).toFixed(0)} / 500 kWh</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[11px]">
                                        <span className="text-slate-400">Optimization:</span>
                                        <span className="font-semibold text-sky-400">Tariff & Carbon Aware</span>
                                    </div>
                                </div>
                            )}

                            {hoveredInfo.type === 'ev' && (
                                <div className="space-y-1.5 text-slate-200 font-sans">
                                    <div className="flex justify-between items-center text-[11px]">
                                        <span className="text-slate-400">Connected Fleet:</span>
                                        <span className="font-semibold text-purple-300">8 Smart Fast Chargers</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[11px]">
                                        <span className="text-slate-400">Fleet Power Demand:</span>
                                        <span className="font-mono font-semibold text-purple-400 tabular-nums">{sceneData?.flexibleLoadKw ?? 15.0} kW</span>
                                    </div>
                                </div>
                            )}
                            
                            <div className="mt-2.5 pt-2 border-t border-slate-800 text-[11px] text-sky-400 font-sans font-medium flex items-center justify-between">
                                <span>Click to view allocation breakdown</span>
                                <ArrowRight className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                            </div>
                        </div>
                    );
                })()}

                {/* Bottom Legend & Mobile Touch Controls */}
                <div className="absolute bottom-2 left-2 right-2 sm:bottom-3 sm:left-3 sm:right-3 bg-slate-950/40 backdrop-blur-md border border-slate-700/40 px-3 py-1.5 rounded-lg flex items-center justify-between text-xs z-20 flex-wrap gap-2 shadow-lg">
                    <div className="flex items-center gap-3 sm:gap-5 text-slate-200 font-sans font-medium text-xs overflow-x-auto">
                        <span className="flex items-center gap-1.5 shrink-0"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Solar Flow</span>
                        <span className="flex items-center gap-1.5 shrink-0"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> Grid Import</span>
                        <span className="flex items-center gap-1.5 shrink-0"><span className="w-2.5 h-2.5 rounded-sm bg-purple-500" /> EV Fleet</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const nextState = !isOrbitLocked;
                            setIsOrbitLocked(nextState);
                            if (refs.current.controls) {
                              refs.current.controls.enabled = !nextState;
                            }
                          }}
                          className={`px-3 py-1 rounded text-xs font-heading font-semibold border transition-all flex items-center gap-1.5 ${
                            isOrbitLocked
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-md'
                              : 'bg-slate-900/50 hover:bg-slate-800/70 text-slate-200 border-slate-700/50'
                          }`}
                          title={isOrbitLocked ? "Unlock 3D Orbit Controls" : "Lock 3D Orbit to scroll mobile page easily"}
                        >
                          {isOrbitLocked ? '🔒 Scroll Mode' : '🔓 3D Orbit Mode'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ThreeCampusScene;
