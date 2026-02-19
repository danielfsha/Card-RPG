import { useFrame } from "@react-three/fiber";
import { isHost } from "playroomkit";
import { useEffect, useRef } from "react";
import { Group, Vector3 } from "three";
import { RigidBody, CuboidCollider } from "@react-three/rapier";

const BULLET_SPEED = 20;

interface BulletProps {
  id: string;
  position: [number, number, number];
  angle: number;
  player: string;
  onHit: (position: [number, number, number]) => void;
}

export const Bullet = ({ id, position, angle, player, onHit }: BulletProps) => {
  const rigidbody = useRef<any>(null);

  useEffect(() => {
    const velocity = {
      x: Math.sin(angle) * BULLET_SPEED,
      y: 0,
      z: Math.cos(angle) * BULLET_SPEED,
    };
    rigidbody.current?.setLinvel(velocity, true);
  }, [angle]);

  useFrame(() => {
    if (!isHost()) return;
    
    if (rigidbody.current) {
      const position = rigidbody.current.translation();
      if (position.y < -1) {
        onHit([position.x, position.y, position.z]);
      }
    }
  });

  return (
    <group position={position}>
      <RigidBody
        ref={rigidbody}
        gravityScale={0}
        sensor
        onIntersectionEnter={(e) => {
          if (isHost() && e.other.rigidBodyObject?.name !== player) {
            const pos = rigidbody.current.translation();
            onHit([pos.x, pos.y, pos.z]);
          }
        }}
      >
        <CuboidCollider args={[0.05, 0.05, 0.05]} />
        <mesh castShadow>
          <boxGeometry args={[0.1, 0.1, 0.1]} />
          <meshStandardMaterial color="yellow" emissive="yellow" emissiveIntensity={2} />
        </mesh>
      </RigidBody>
    </group>
  );
};
