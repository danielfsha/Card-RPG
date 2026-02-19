import { useEffect, useRef } from "react";
import { Group } from "three";

interface BulletHitProps {
  id: string;
  position: [number, number, number];
  onEnded: () => void;
}

export const BulletHit = ({ position, onEnded }: BulletHitProps) => {
  const group = useRef<Group>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      onEnded();
    }, 500);
    return () => clearTimeout(timeout);
  }, [onEnded]);

  return (
    <group ref={group} position={position}>
      <mesh>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial
          color="orange"
          emissive="orange"
          emissiveIntensity={3}
          transparent
          opacity={0.8}
        />
      </mesh>
    </group>
  );
};
