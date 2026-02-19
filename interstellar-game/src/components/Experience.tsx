import { Environment, KeyboardControls, OrthographicCamera } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { CharacterController } from "./characters/CharacterController";
import { Physics } from "@react-three/rapier";
import { Map } from "./map";
import { useGameEngine } from "../hooks/useGameEngine";
import { Bullet } from "./Bullet";
import { BulletHit } from "./BulletHit";

export interface ExperienceProps {}

const Experience = (_props: ExperienceProps) => {
  const {
    players,
    bullets,
    hits,
    gameStarted,
    myPlayer,
    onFire,
    onHit,
    onHitEnded,
    onKilled,
  } = useGameEngine();

  const keyboardMap = [
    { name: "forward", keys: ["ArrowUp", "KeyW"] },
    { name: "backward", keys: ["ArrowDown", "KeyS"] },
    { name: "left", keys: ["ArrowLeft", "KeyA"] },
    { name: "right", keys: ["ArrowRight", "KeyD"] },
    { name: "run", keys: ["Shift"] },
    { name: "jump", keys: ["Space"] },
  ];

  if (!gameStarted) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-gradient-to-b from-blue-900 to-purple-900">
        <div className="text-white text-2xl">Loading game...</div>
      </div>
    );
  }

  return (
    <>
      <KeyboardControls map={keyboardMap}>
        <Canvas
          className="w-screen h-screen overflow-hidden"
          shadows
          camera={{ position: [0, 5, -8], fov: 50 }}
        >
          <Environment preset="sunset"/>
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
              attach={"shadow-camera"}
            />
          </directionalLight>
          <Physics>
            <Map />
            {players.map(({ state, joystick }) => (
              <CharacterController
                key={state.id}
                controls={joystick}
                userPlayer={state.id === myPlayer?.id}
                playerState={state}
                onFire={onFire}
                onKilled={onKilled}
              />
            ))}
            {bullets.map((bullet) => (
              <Bullet
                key={bullet.id}
                {...bullet}
                onHit={(position) => onHit(bullet.id, position)}
              />
            ))}
            {hits.map((hit) => (
              <BulletHit
                key={hit.id}
                {...hit}
                onEnded={() => onHitEnded(hit.id)}
              />
            ))}
          </Physics>
        </Canvas>
      </KeyboardControls>
    </>
  );
};

export default Experience;
