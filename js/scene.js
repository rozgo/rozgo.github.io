// Live simulation background: LiDAR-style terrain, drones and rovers with sensor footprints,
// and a scan pulse from a base station. The camera follows page scroll.
import * as THREE from './vendor/three.module.min.js';

const canvas = document.getElementById('world');
const mode = document.body.dataset.scene || 'ambient';
const small = window.matchMedia('(max-width: 760px)').matches;

function hasWebGL() {
    try {
        const test = document.createElement('canvas');
        return !!(test.getContext('webgl2') || test.getContext('webgl'));
    } catch (error) {
        return false;
    }
}

if (canvas && hasWebGL()) {
    start();
} else if (canvas) {
    canvas.remove();
}

/* Value noise with fractal sum, enough for rolling terrain. */
function hash(x, z) {
    const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
    return s - Math.floor(s);
}

function noise(x, z) {
    const xi = Math.floor(x);
    const zi = Math.floor(z);
    const xf = x - xi;
    const zf = z - zi;
    const u = xf * xf * (3 - 2 * xf);
    const v = zf * zf * (3 - 2 * zf);
    const a = hash(xi, zi);
    const b = hash(xi + 1, zi);
    const c = hash(xi, zi + 1);
    const d = hash(xi + 1, zi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function height(x, z) {
    let amp = 1;
    let freq = 0.012;
    let sum = 0;
    for (let i = 0; i < 5; i++) {
        sum += amp * noise(x * freq, z * freq);
        amp *= 0.5;
        freq *= 2.03;
    }
    const ridge = Math.abs(noise(x * 0.006 + 13.1, z * 0.006 - 7.7) - 0.5) * 2;
    const basin = Math.exp(-(x * x + z * z) / 1800);
    return (sum - 0.9) * 26 + ridge * 18 - basin * 10;
}

function start() {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x060607, 1);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x060607, 0.0042);
    const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 900);

    const SIZE = 420;
    const GRID = small ? 150 : 230;
    const AGENTS = small ? 10 : 18;
    const ROVERS = small ? 4 : 7;
    const MAX_SENSORS = 32;

    /* Terrain as a point cloud. */
    const count = GRID * GRID;
    const positions = new Float32Array(count * 3);
    const heights = new Float32Array(count);
    let i = 0;
    for (let gz = 0; gz < GRID; gz++) {
        for (let gx = 0; gx < GRID; gx++) {
            const x = (gx / (GRID - 1) - 0.5) * SIZE + (hash(gx, gz) - 0.5) * 0.9;
            const z = (gz / (GRID - 1) - 0.5) * SIZE + (hash(gz, gx) - 0.5) * 0.9;
            const y = height(x, z);
            positions.set([x, y, z], i * 3);
            heights[i] = y;
            i++;
        }
    }
    const terrainGeometry = new THREE.BufferGeometry();
    terrainGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    terrainGeometry.setAttribute('aHeight', new THREE.BufferAttribute(heights, 1));

    const sensorUniform = [];
    for (let s = 0; s < MAX_SENSORS; s++) sensorUniform.push(new THREE.Vector4(0, -999, 0, 0));

    const terrainMaterial = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
            uTime: { value: 0 },
            uPulse: { value: 0 },
            uDim: { value: 1 },
            uPixel: { value: renderer.getPixelRatio() },
            uSensors: { value: sensorUniform },
            uAccent: { value: new THREE.Color(0xff5a1f) },
            uFogDensity: { value: scene.fog.density },
        },
        vertexShader: `
            uniform float uTime;
            uniform float uPulse;
            uniform float uPixel;
            uniform vec4 uSensors[${MAX_SENSORS}];
            uniform float uFogDensity;
            attribute float aHeight;
            varying float vBase;
            varying float vHot;
            varying float vFog;
            void main() {
                vec4 mv = modelViewMatrix * vec4(position, 1.0);
                float dist = length(position.xz);
                float ring = exp(-abs(dist - uPulse) * 0.45) * smoothstep(210.0, 60.0, uPulse);
                float hot = 0.0;
                for (int s = 0; s < ${MAX_SENSORS}; s++) {
                    vec4 sn = uSensors[s];
                    vec2 d = position.xz - sn.xz;
                    hot += exp(-dot(d, d) / max(sn.w, 0.001)) * step(0.001, sn.w);
                }
                vHot = clamp(hot, 0.0, 1.0);
                vBase = 0.38 + clamp((aHeight + 20.0) / 60.0, 0.0, 1.0) * 0.55 + ring * 1.1;
                float fogDepth = -mv.z;
                vFog = 1.0 - exp(-uFogDensity * uFogDensity * fogDepth * fogDepth);
                gl_PointSize = (2.2 + vHot * 2.4 + ring * 1.6) * uPixel * (230.0 / max(fogDepth, 1.0));
                gl_Position = projectionMatrix * mv;
            }
        `,
        fragmentShader: `
            uniform vec3 uAccent;
            uniform float uDim;
            varying float vBase;
            varying float vHot;
            varying float vFog;
            void main() {
                vec2 c = gl_PointCoord - 0.5;
                float a = smoothstep(0.5, 0.1, length(c));
                vec3 base = vec3(0.86, 0.88, 0.92) * vBase;
                vec3 color = mix(base, uAccent * 1.4, vHot * 0.85);
                float alpha = a * (0.75 + vHot * 0.25) * (1.0 - vFog * 0.85) * uDim;
                gl_FragColor = vec4(color * alpha, alpha);
            }
        `,
    });
    scene.add(new THREE.Points(terrainGeometry, terrainMaterial));

    /* Base station with scan pulse origin. */
    const station = new THREE.Group();
    const mastMaterial = new THREE.MeshBasicMaterial({ color: 0x9a9ea6 });
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, 9, 6), mastMaterial);
    mast.position.y = height(0, 0) + 4.5;
    station.add(mast);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff5a1f }));
    beacon.position.y = height(0, 0) + 9.4;
    station.add(beacon);
    scene.add(station);

    /* Agents: drones fly between waypoints, rovers follow the ground. */
    const agents = [];
    const droneGeometry = new THREE.OctahedronGeometry(0.6, 0);
    const droneMaterial = new THREE.MeshBasicMaterial({ color: 0xf2f2f2 });
    const roverGeometry = new THREE.BoxGeometry(1.5, 0.6, 1.0);
    const roverMaterial = new THREE.MeshBasicMaterial({ color: 0xff5a1f });
    const TRAIL = 70;

    function randomTarget() {
        const r = 15 + Math.random() * 80;
        const t = Math.random() * Math.PI * 2;
        return new THREE.Vector3(Math.cos(t) * r, 0, Math.sin(t) * r);
    }

    for (let a = 0; a < AGENTS + ROVERS; a++) {
        const drone = a < AGENTS;
        const mesh = new THREE.Mesh(drone ? droneGeometry : roverGeometry, drone ? droneMaterial : roverMaterial);
        const start = randomTarget();
        const agent = {
            drone,
            mesh,
            pos: new THREE.Vector3(start.x, height(start.x, start.z) + (drone ? 14 : 0.8), start.z),
            vel: new THREE.Vector3(),
            target: randomTarget(),
            speed: drone ? 9 + Math.random() * 6 : 3.5 + Math.random() * 2,
            alt: 10 + Math.random() * 10,
            trail: new Float32Array(TRAIL * 3),
        };
        for (let k = 0; k < TRAIL; k++) agent.trail.set([agent.pos.x, agent.pos.y, agent.pos.z], k * 3);
        const trailGeometry = new THREE.BufferGeometry();
        trailGeometry.setAttribute('position', new THREE.BufferAttribute(agent.trail, 3));
        const fade = new Float32Array(TRAIL * 3);
        for (let k = 0; k < TRAIL; k++) {
            const f = 1 - k / TRAIL;
            const c = drone ? [0.75 * f, 0.77 * f, 0.8 * f] : [1.0 * f, 0.35 * f, 0.12 * f];
            fade.set(c, k * 3);
        }
        trailGeometry.setAttribute('color', new THREE.BufferAttribute(fade, 3));
        agent.trailLine = new THREE.Line(trailGeometry, new THREE.LineBasicMaterial({
            vertexColors: true, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        if (drone) {
            const rayGeometry = new THREE.BufferGeometry();
            rayGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
            agent.ray = new THREE.Line(rayGeometry, new THREE.LineBasicMaterial({
                color: 0xff5a1f, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false,
            }));
            scene.add(agent.ray);
        }
        scene.add(mesh, agent.trailLine);
        agents.push(agent);
    }

    const tmp = new THREE.Vector3();
    function stepAgent(agent, dt) {
        tmp.copy(agent.target).sub(agent.pos);
        tmp.y = 0;
        if (tmp.length() < 8) agent.target = randomTarget();
        tmp.normalize().multiplyScalar(agent.speed);
        agent.vel.lerp(tmp, Math.min(1, dt * (agent.drone ? 0.9 : 1.6)));
        agent.pos.x += agent.vel.x * dt;
        agent.pos.z += agent.vel.z * dt;
        const ground = height(agent.pos.x, agent.pos.z);
        const desired = agent.drone ? ground + agent.alt : ground + 0.7;
        agent.pos.y += (desired - agent.pos.y) * Math.min(1, dt * (agent.drone ? 1.5 : 8));
        agent.mesh.position.copy(agent.pos);
        agent.mesh.rotation.y = Math.atan2(-agent.vel.z, agent.vel.x);
        if (agent.drone) agent.mesh.rotation.x += dt * 2;
        agent.trail.copyWithin(3, 0, (TRAIL - 1) * 3);
        agent.trail.set([agent.pos.x, agent.pos.y, agent.pos.z], 0);
        agent.trailLine.geometry.attributes.position.needsUpdate = true;
        if (agent.ray) {
            const arr = agent.ray.geometry.attributes.position.array;
            arr.set([agent.pos.x, agent.pos.y, agent.pos.z, agent.pos.x, ground, agent.pos.z]);
            agent.ray.geometry.attributes.position.needsUpdate = true;
        }
    }

    /* Camera: slow orbit, pointer parallax, and a scroll path that descends toward the terrain. */
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    window.addEventListener('pointermove', (event) => {
        pointer.tx = event.clientX / window.innerWidth - 0.5;
        pointer.ty = event.clientY / window.innerHeight - 0.5;
    }, { passive: true });

    let scroll = 0;
    function readScroll() {
        const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        scroll = Math.min(1, window.scrollY / max);
    }
    window.addEventListener('scroll', readScroll, { passive: true });
    readScroll();

    function resize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        // On wide screens, move the scene's center to the right of the hero text.
        if (mode === 'hero' && w > 960) camera.setViewOffset(w, h, -w * 0.17, h * 0.04, w, h);
        else camera.clearViewOffset();
        camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', resize);
    resize();

    const hud = {
        time: document.querySelector('[data-hud="time"]'),
        agents: document.querySelector('[data-hud="agents"]'),
        points: document.querySelector('[data-hud="points"]'),
        rate: document.querySelector('[data-hud="rate"]'),
    };
    if (hud.agents) hud.agents.textContent = String(AGENTS + ROVERS);
    if (hud.points) hud.points.textContent = count.toLocaleString('en-US');

    const clock = new THREE.Clock();
    let simTime = 0;
    let frames = 0;
    let lastHud = 0;
    let running = true;
    const look = new THREE.Vector3();

    function frame() {
        if (!running) return;
        const dt = Math.min(clock.getDelta(), 0.05);
        simTime += dt;
        frames++;

        agents.forEach((agent) => stepAgent(agent, dt));
        let s = 0;
        agents.forEach((agent) => {
            if (s >= MAX_SENSORS) return;
            const radius = agent.drone ? 28 + agent.alt : 10;
            sensorUniform[s].set(agent.pos.x, 0, agent.pos.z, radius);
            s++;
        });

        terrainMaterial.uniforms.uTime.value = simTime;
        terrainMaterial.uniforms.uPulse.value = (simTime * 42) % 260;
        beacon.scale.setScalar(1 + Math.sin(simTime * 6) * 0.25);

        pointer.x += (pointer.tx - pointer.x) * 0.04;
        pointer.y += (pointer.ty - pointer.y) * 0.04;
        const hero = mode === 'hero';
        const p = hero ? scroll : 0.35;
        const angle = simTime * 0.025 + p * 1.6 + pointer.x * 0.35;
        const radius = hero ? 122 - p * 22 : 175;
        const lift = (hero ? 46 - p * 14 : 72) - pointer.y * 10;
        camera.position.set(Math.cos(angle) * radius, lift, Math.sin(angle) * radius);
        look.set(Math.cos(angle + 2.4) * p * 30, 4 - p * 6, Math.sin(angle + 2.4) * p * 30);
        camera.lookAt(look);
        terrainMaterial.uniforms.uDim.value = hero ? 1 - p * 0.3 : 0.65;

        renderer.render(scene, camera);

        if (simTime - lastHud > 0.25) {
            if (hud.time) {
                const m = Math.floor(simTime / 60);
                const sec = (simTime % 60).toFixed(1).padStart(4, '0');
                hud.time.textContent = `${String(m).padStart(2, '0')}:${sec}`;
            }
            if (hud.rate) hud.rate.textContent = `${Math.round(frames / (simTime - lastHud))} Hz`;
            frames = 0;
            lastHud = simTime;
        }
        requestAnimationFrame(frame);
    }

    document.addEventListener('visibilitychange', () => {
        const visible = !document.hidden;
        if (visible && !running) {
            running = true;
            clock.getDelta();
            requestAnimationFrame(frame);
        } else if (!visible) {
            running = false;
        }
    });

    document.documentElement.classList.add('has-world');
    requestAnimationFrame(frame);
}
