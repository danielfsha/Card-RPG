import { useKeyboardControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  CapsuleCollider,
  RigidBody,
  euler,
  quat,
  vec3,
} from "@react-three/rapier";
import { useControls } from "leva";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Vector3 } from "three";
import { Character, type CharacterType } from "./Character";

const MOVEMENT_SPEED = 4.2;
const JUMP_FORCE = 8;
const ROTATION_SPEED = 2.5;
const vel = new Vector3();

interface CharacterControllerProps {
  controls?: any; // PlayroomKit Joystick controls (optional)
}

export const CharacterController = forwardRef<any, CharacterControllerProps>(({ controls }, ref) => {
  const { CHARACTER } = useControls("Character Control", {
    CHARACTER: {
      value: 'Astronaut_FinnTheFrog' as CharacterType,
      options: [
        'Astronaut_FinnTheFrog',
        'Astronaut_BarbaraTheBee',
        'Astronaut_FernandoTheFlamingo',
        'Astronaut_RaeTheRedPanda',
        'Mech_FinnTheFrog',
        'Mech_BarbaraTheBee',
        'Mech_FernandoTheFlamingo',
        'Mech_RaeTheRedPanda',
      ] as CharacterType[],
    },
  });

  const [animation, setAnimation] = useState("Idle");
  const [, get] = useKeyboardControls();
  const rb = useRef<any>(null);
  const inTheAir = useRef(true);
  const landed = useRef(false);
  const cameraPosition = useRef<any>(null);
  const cameraLookAt = useRef<Vector3 | null>(null);

  useFrame(({ camera }) => {
    if (!rb.current) return;

    // Camera follow
    const rbPosition = vec3(rb.current.translation());
    // Look at a point higher on the character (add offset to Y)
    const lookAtTarget = new Vector3(rbPosition.x, rbPosition.y + 1.5, rbPosition.z);
    
    if (!cameraLookAt.current) {
      cameraLookAt.current = lookAtTarget;
    }
    cameraLookAt.current.lerp(lookAtTarget, 0.05);
    camera.lookAt(cameraLookAt.current);
    const worldPos = rbPosition;
    cameraPosition.current.getWorldPosition(worldPos);
    camera.position.lerp(worldPos, 0.05);

    const rotVel = {
      x: 0,
      y: 0,
      z: 0,
    };

    const curVel = rb.current.linvel();
    vel.x = 0;
    vel.y = 0;
    vel.z = 0;

    // PlayroomKit joystick support
    let joystickX = 0;
    let joystickY = 0;
    if (controls) {
      const angle = controls.angle();
      joystickX = Math.sin(angle);
      joystickY = Math.cos(angle);
    }

    if (get().forward || (controls?.isJoystickPressed() && joystickY < -0.1)) {
      vel.z += MOVEMENT_SPEED;
    }
    if (get().backward || (controls?.isJoystickPressed() && joystickY > 0.1)) {
      vel.z -= MOVEMENT_SPEED;
    }
    if (get().left || (controls?.isJoystickPressed() && joystickX < -0.1)) {
      rotVel.y += ROTATION_SPEED;
    }
    if (get().right || (controls?.isJoystickPressed() && joystickX > 0.1)) {
      rotVel.y -= ROTATION_SPEED;
    }

    rb.current.setAngvel(rotVel, true);
    
    // Apply rotation to x and z to go in the right direction
    const eulerRot = euler().setFromQuaternion(quat(rb.current.rotation()));
    vel.applyEuler(eulerRot);
    
    if ((get().jump || controls?.isPressed("Jump")) && !inTheAir.current && landed.current) {
      vel.y += JUMP_FORCE;
      inTheAir.current = true;
      landed.current = false;
    } else {
      vel.y = curVel.y;
    }
    
    if (Math.abs(vel.y) > 1) {
      inTheAir.current = true;
      landed.current = false;
    } else {
      inTheAir.current = false;
    }
    
    rb.current.setLinvel(vel, true);

    // ANIMATION
    const movement = Math.abs(vel.x) + Math.abs(vel.z);
    if (inTheAir.current && vel.y > 2) {
      setAnimation("Jump");
    } else if (inTheAir.current && vel.y < -5) {
      setAnimation("Jump");
    } else if (movement > 1 || inTheAir.current) {
      setAnimation("Run");
    } else {
      setAnimation("Idle");
    }
  });

  // Expose translation method for camera
  useImperativeHandle(ref, () => ({
    translation: () => {
      if (rb.current) {
        return rb.current.translation();
      }
      return { x: 0, y: 2, z: 0 };
    }
  }));

  return (
    <RigidBody
      position={[0, 6, 1]}
      colliders={false}
      canSleep={false}
      enabledRotations={[false, true, false]}
      ref={rb}
      onCollisionEnter={(_e) => {
        inTheAir.current = false;
        landed.current = true;
        const curVel = rb.current.linvel();
        curVel.y = 0;
        rb.current.setLinvel(curVel, true);
      }}
      gravityScale={2.5}
    >
      <group ref={cameraPosition} position={[-1.5, 1.5, -3]} />
      <Character
        character={CHARACTER}
        scale={0.42}
        position-y={0.34}
        animation={animation}
      />
      <CapsuleCollider args={[0.1, 0.28]} position={[0, 0.68, 0]} />
    </RigidBody>
  );
});
