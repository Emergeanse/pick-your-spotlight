import { Suspense, useRef, Component, ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";

interface Pick3DProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  animate?: boolean;
}

const SIZE_PX = {
  sm: { width: 96, height: 96 },
  md: { width: 160, height: 160 },
  lg: { width: 224, height: 224 },
};

function PickModel({ animate = true }: { animate?: boolean }) {
  const { scene } = useGLTF("/models/pick-character.glb");
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!ref.current || !animate) return;
    ref.current.position.y = Math.sin(state.clock.elapsedTime * 1.2) * 0.08;
    ref.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.15;
  });

  return (
    <group ref={ref}>
      <primitive object={scene} scale={1.5} position={[0, -0.5, 0]} />
    </group>
  );
}

class Canvas3DErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}

const Pick3D = ({ size = "md", className = "", animate = true }: Pick3DProps) => {
  const dims = SIZE_PX[size];

  return (
    <Canvas3DErrorBoundary fallback={<div style={{ width: dims.width, height: dims.height }} />}>
      <div style={{ width: dims.width, height: dims.height }} className={className}>
        <Canvas
          camera={{ position: [0, 0.5, 2.5], fov: 40 }}
          gl={{ alpha: true, antialias: true }}
          style={{ background: "transparent", width: "100%", height: "100%" }}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[3, 3, 3]} intensity={1} />
          <directionalLight position={[-2, 1, -1]} intensity={0.3} />
          <Suspense fallback={null}>
            <PickModel animate={animate} />
          </Suspense>
          <OrbitControls
            enableZoom={false}
            enablePan={false}
            minPolarAngle={Math.PI / 3}
            maxPolarAngle={Math.PI / 2}
          />
        </Canvas>
      </div>
    </Canvas3DErrorBoundary>
  );
};

useGLTF.preload("/models/pick-character.glb");

export default Pick3D;
