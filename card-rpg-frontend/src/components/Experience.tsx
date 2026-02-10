import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";

export interface ExperienceProps {}

const Experience = (props: ExperienceProps) => {
  return (
    <>
      <Canvas
        className="w-screen h-screen overflow-hidden"
        shadows
        camera={{ position: [3, 3, 3], fov: 30 }}
      >
        <color attach="background" args={["#ececec"]} />
        <OrbitControls />
        <mesh>
          <boxGeometry />
          <meshNormalMaterial />
        </mesh>
      </Canvas>
    </>
  );
};

export default Experience;
