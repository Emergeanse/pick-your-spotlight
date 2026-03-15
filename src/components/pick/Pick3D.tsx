import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF, Environment } from "@react-three/drei";
import * as THREE from "three";

interface Pick3DProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  animate?: boolean;
}

const SIZE_MAP = {
  sm: "w-24 h-24",
  md: "w-40 h-40",
  lg: "w-56 h-56",
};

function PickModel({ animate = true }: { animate?: boolean }) {
  const { scene } = useGLTF("/models/pick-character.glb");
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!ref.current || !animate) return;
    // Gentle floating animation
    ref.current.position.y = Math.sin(state.clock.elapsedTime * 1.2) * 0.08;
    // Subtle rotation
    ref.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.15;
  });

  return (
    <group ref={ref}>
      <primitive object={scene} scale={1.5} position={[0, -0.5, 0]} />
    </group>
  );
}

const Pick3D = ({ size = "md", className = "", animate = true }: Pick3DProps) => {
  return (
    <div className={`${SIZE_MAP[size]} ${className}`}>
      <Canvas
        camera={{ position: [0, 0.5, 2.5], fov: 40 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 3, 3]} intensity={1} />
        <directionalLight position={[-2, 1, -1]} intensity={0.3} />
        <Suspense fallback={null}>
          <PickModel animate={animate} />
          <Environment preset="city" />
        </Suspense>
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          minPolarAngle={Math.PI / 3}
          maxPolarAngle={Math.PI / 2}
        />
      </Canvas>
    </div>
  );
};

useGLTF.preload("/models/pick-character.glb");

export default Pick3D;
