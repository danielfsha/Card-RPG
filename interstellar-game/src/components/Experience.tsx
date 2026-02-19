import { Environment, KeyboardControls, OrthographicCamera } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { CharacterController } from "./characters/CharacterController";
import { useRef } from "react";
import { Physics, RigidBody } from "@react-three/rapier";

export interface ExperienceProps {}

const Experience = (_props: ExperienceProps) => {
  const shadowCameraRef = useRef(null);
  const characterRef = useRef<any>(null);
  
  const keyboardMap = [
    { name: "forward", keys: ["ArrowUp", "KeyW"] },
    { name: "backward", keys: ["ArrowDown", "KeyS"] },
    { name: "left", keys: ["ArrowLeft", "KeyA"] },
    { name: "right", keys: ["ArrowRight", "KeyD"] },
    { name: "run", keys: ["Shift"] },
    { name: "jump", keys: ["Space"] },
  ];

  return (
    <>
      <KeyboardControls map={keyboardMap}>
        <Canvas
          className="w-screen h-screen overflow-hidden"
          shadows
          camera={{ position: [0, 5, -8], fov: 50 }}
        >
          <Environment preset="dawn"/>
          <directionalLight
            intensity={0.65}
            castShadow
            position={[-15, 10, 15]}
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-bias={-0.00005}
          >
            <OrthographicCamera
              left={-22}
              right={15}
              top={100}
              bottom={-20}
              ref={shadowCameraRef}
              attach={"shadow-camera"}
            />
          </directionalLight>
          <Physics>
            <CharacterController ref={characterRef} />
            {/* Ground plane with physics collider */}
            <RigidBody type="fixed" colliders="cuboid">
              <mesh receiveShadow position={[0, 0, 0]} rotation-x={-Math.PI / 2}>
                <planeGeometry args={[50, 50]} />
                <meshStandardMaterial color="#3a8c3a" />
              </mesh>
            </RigidBody>
          </Physics>
        </Canvas>
      </KeyboardControls>
    </>
  );
};

export default Experience;
