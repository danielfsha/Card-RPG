import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";

import Card from "./Card";
import { Leva } from "leva";

export interface ExperienceProps {}

const DEBUG = true;

const Experience = (props: ExperienceProps) => {
  return (
    <>
      <Leva hidden={!DEBUG} />
      <Canvas
        className="w-screen h-screen overflow-hidden"
        shadows
        camera={{ position: [3, 3, 3], fov: 30 }}
      >
        <color attach="background" args={["#ececec"]} />

        <OrbitControls />
        <directionalLight position={[1, 2, 3]} castShadow />

        {/* Perspective Grid Floor */}
        {/* <mesh position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[50, 50, 100, 100]} />
          <meshStandardMaterial color="#999" />
        </mesh> */}

        {/* Card Model */}
        <Card position={[0, 0.5, 0]} rotation={[Math.PI / 2, 0, 0]} />
      </Canvas>
    </>
  );
};

export default Experience;
