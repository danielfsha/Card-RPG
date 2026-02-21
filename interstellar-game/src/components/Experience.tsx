import { Environment, KeyboardControls, OrthographicCamera } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { CharacterController } from "./characters/CharacterController";
import { Physics } from "@react-three/rapier";
import { Map } from "./map";
import { useGameEngine } from "../hooks/useGameEngine";
import { Bullet } from "./Bullet";
import { BulletHit } from "./BulletHit";
import { isHost } from "playroomkit";

export interface ExperienceProps {}

const Experience = (_props: ExperienceProps) => {
  const {
    players,
    bullets,
    hits,
    networkBullets,
    networkHits,
    myPlayer,
    onFire,
    onHit,
    onHitEnded,
    onKilled,
  } = useGameEngine();

  console.log("[Experience] Rendering with players:", players.length);
  console.log("[Experience] Players:", players.map(p => ({ id: p.state.id, character: p.state.getState?.("character") })));
  console.log("[Experience] My player ID:", myPlayer?.id);

  const keyboardMap = [
    { name: "forward", keys: ["ArrowUp", "KeyW"] },
    { name: "backward", keys: ["ArrowDown", "KeyS"] },
    { name: "left", keys: ["ArrowLeft", "KeyA"] },
    { name: "right", keys: ["ArrowRight", "KeyD"] },
    { name: "run", keys: ["Shift"] },
    { name: "jump", keys: ["Space"] },
    { name: "fire", keys: ["Mouse0"] }, // Left mouse button for firing
  ];

  // Use host's bullets/hits or network-synced versions
  const activeBullets = isHost() ? bullets : networkBullets;
  const activeHits = isHost() ? hits : networkHits;

  return (
    <div className="w-screen h-screen overflow-hidden">
      <KeyboardControls map={keyboardMap}>
        <Canvas
          className="w-full h-full"
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
          <Physics key="physics-world">
            <Map key="game-map" />
            {players.length === 0 && (
              <group>
                <mesh position={[0, 2, 0]}>
                  <boxGeometry args={[1, 1, 1]} />
                  <meshStandardMaterial color="red" />
                </mesh>
              </group>
            )}
            {players.map(({ state, joystick }) => {
              console.log("[Experience] Rendering character for player:", state.id, "userPlayer:", state.id === myPlayer?.id);
              return (
                <CharacterController
                  key={state.id}
                  controls={joystick}
                  userPlayer={state.id === myPlayer?.id}
                  playerState={state}
                  onFire={onFire}
                  onKilled={onKilled}
                />
              );
            })}
            {activeBullets.map((bullet) => (
              <Bullet
                key={bullet.id}
                {...bullet}
                onHit={(position) => onHit(bullet.id, position)}
              />
            ))}
            {activeHits.map((hit) => (
              <BulletHit
                key={hit.id}
                {...hit}
                onEnded={() => onHitEnded(hit.id)}
              />
            ))}
          </Physics>
        </Canvas>
      </KeyboardControls>
    </div>
  );
};

export default Experience;
