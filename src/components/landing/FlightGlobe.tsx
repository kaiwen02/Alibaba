'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Worldwide airport network (lat, lon)
const AIRPORTS: Record<string, [number, number]> = {
  SIN: [1.36, 103.99],
  KUL: [2.75, 101.71],
  BKK: [13.69, 100.75],
  HKT: [8.11, 98.31],
  SYD: [-33.94, 151.18],
  HKG: [22.31, 113.91],
  NRT: [35.77, 140.39],
  ICN: [37.46, 126.44],
  DEL: [28.55, 77.1],
  BOM: [19.09, 72.87],
  DXB: [25.25, 55.36],
  DOH: [25.27, 51.61],
  LHR: [51.47, -0.45],
  CDG: [49.01, 2.55],
  FRA: [50.03, 8.56],
  AMS: [52.31, 4.76],
  JFK: [40.64, -73.78],
  ORD: [41.97, -87.91],
  LAX: [33.94, -118.41],
  SFO: [37.62, -122.38],
  YVR: [49.19, -123.18],
  GRU: [-23.44, -46.47],
  EZE: [-34.82, -58.54],
  JNB: [-26.14, 28.25],
  NBO: [-1.32, 36.93],
};

// Routes spanning every continent
const ROUTES: [string, string][] = [
  ['SIN', 'KUL'], ['BKK', 'HKT'], ['SYD', 'SIN'], ['SIN', 'BKK'],
  ['SIN', 'HKG'], ['HKG', 'NRT'], ['NRT', 'ICN'], ['ICN', 'YVR'],
  ['SIN', 'DXB'], ['DXB', 'LHR'], ['DXB', 'JNB'], ['DOH', 'NBO'],
  ['DEL', 'SIN'], ['BOM', 'DXB'], ['LHR', 'JFK'], ['CDG', 'JFK'],
  ['FRA', 'ORD'], ['AMS', 'JFK'], ['JFK', 'LAX'], ['LAX', 'NRT'],
  ['SFO', 'NRT'], ['GRU', 'EZE'], ['GRU', 'LHR'], ['SYD', 'NRT'],
];

function latLonToVec3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

interface RouteData {
  line: THREE.Line;
  curve: THREE.QuadraticBezierCurve3;
}

/** Build all route lines + curves ONCE (fixes the per-render re-creation glitch). */
function useRoutes(radius: number): RouteData[] {
  return useMemo(() => {
    const material = new THREE.LineBasicMaterial({
      color: '#F4F4F0',
      transparent: true,
      opacity: 0.32,
    });

    return ROUTES.map(([from, to]) => {
      const [latA, lonA] = AIRPORTS[from];
      const [latB, lonB] = AIRPORTS[to];
      const start = latLonToVec3(latA, lonA, radius);
      const end = latLonToVec3(latB, lonB, radius);

      const mid = start.clone().add(end).multiplyScalar(0.5).normalize();
      mid.multiplyScalar(radius + start.distanceTo(end) * 0.22); // lower arcs → globe fits frame

      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(48));
      return { line: new THREE.Line(geometry, material), curve };
    });
  }, [radius]);
}

/** The dot fleet: one traveling light per route — lime = monitored, amber = at risk. */
function RouteDots({ routes }: { routes: RouteData[] }) {
  const dotsRef = useRef<(THREE.Mesh | null)[]>([]);
  const offsets = useMemo(
    () => routes.map((_, i) => (i * 0.37) % 1), // deterministic stagger, no random jumps
    [routes]
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.09;
    routes.forEach((r, i) => {
      const dot = dotsRef.current[i];
      if (!dot) return;
      dot.position.copy(r.curve.getPoint((t + offsets[i]) % 1));
    });
  });

  return (
    <group>
      {routes.map((_, i) => {
        const atRisk = i % 4 === 3; // every 4th flight reads as elevated risk
        return (
          <mesh key={i} ref={(el) => { dotsRef.current[i] = el; }}>
            <sphereGeometry args={[0.026, 8, 8]} />
            <meshBasicMaterial color={atRisk ? '#FFB454' : '#D4FF3F'} />
          </mesh>
        );
      })}
    </group>
  );
}

function AirportNodes({ radius }: { radius: number }) {
  const geometry = useMemo(() => {
    const positions = Object.values(AIRPORTS).flatMap(([lat, lon]) => {
      const v = latLonToVec3(lat, lon, radius);
      return [v.x, v.y, v.z];
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, [radius]);

  return (
    <points geometry={geometry}>
      <pointsMaterial color="#F4F4F0" size={0.042} sizeAttenuation />
    </points>
  );
}

function Globe({ scrollRef }: { scrollRef: React.MutableRefObject<number> }) {
  const groupRef = useRef<THREE.Group>(null);
  const RADIUS = 1.45;
  const routes = useRoutes(RADIUS);

  // Higher segment count → crisper wireframe, no pixelation
  const wireGeometry = useMemo(() => new THREE.SphereGeometry(RADIUS, 48, 48), []);

  // Dispose GPU resources on unmount
  useEffect(() => {
    return () => {
      wireGeometry.dispose();
      routes.forEach((r) => {
        r.line.geometry.dispose();
        (r.line.material as THREE.Material).dispose();
      });
    };
  }, [wireGeometry, routes]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const d = Math.min(delta, 0.05); // clamp tab-switch spikes — kills the jump glitch
    groupRef.current.rotation.y += d * 0.05;
    const targetX = scrollRef.current * 0.35 + 0.22; // gentle tilt so the top stays in frame
    groupRef.current.rotation.x += (targetX - groupRef.current.rotation.x) * 0.05;
  });

  return (
    <group ref={groupRef} rotation={[0.22, 0, 0]}>
      <mesh geometry={wireGeometry}>
        <meshBasicMaterial color="#F4F4F0" wireframe transparent opacity={0.26} />
      </mesh>
      <mesh>
        <sphereGeometry args={[RADIUS * 0.985, 48, 48]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.92} />
      </mesh>
      <AirportNodes radius={RADIUS} />
      {routes.map((r, i) => (
        <primitive key={i} object={r.line} />
      ))}
      <RouteDots routes={routes} />
    </group>
  );
}

export default function FlightGlobe({ scrollRef }: { scrollRef: React.MutableRefObject<number> }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 4.7], fov: 40 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      style={{ background: 'transparent' }}
    >
      <ambientLight intensity={0.6} />
      <Globe scrollRef={scrollRef} />
    </Canvas>
  );
}
