import { useRef, useEffect, type JSX } from 'react'
import { useGLTF, useAnimations } from '@react-three/drei'
import * as THREE from 'three'

type GLTFResult = {
  nodes: {
    RaeTheRedPanda: THREE.SkinnedMesh
    Root: THREE.Bone
  }
  materials: {
    Atlas: THREE.MeshStandardMaterial
  }
}

type ModelProps = JSX.IntrinsicElements['group'] & {
  animation?: string;
}

export function Model({ animation = 'Idle', ...props }: ModelProps) {
  const group = useRef<THREE.Group>(null)
  const { nodes, materials, animations } = useGLTF('/Characters/GLTF/Mech_RaeTheRedPanda.gltf') as unknown as GLTFResult & { animations: THREE.AnimationClip[] }
  const { actions } = useAnimations(animations, group)

  useEffect(() => {
    const action = actions[animation];
    if (action) {
      action.reset().fadeIn(0.24);
      
      // Don't loop Jump animation - pause at end
      if (animation === 'Jump') {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      } else {
        action.setLoop(THREE.LoopRepeat, Infinity);
      }
      
      action.play();
    }
    
    return () => {
      actions?.[animation]?.fadeOut(0.24);
    };
  }, [animation, actions]);

  return (
    <group ref={group} {...props} dispose={null}>
      <group name="Scene">
        <group name="CharacterArmature">
          <skinnedMesh
            name="RaeTheRedPanda"
            geometry={nodes.RaeTheRedPanda.geometry}
            material={materials.Atlas}
            skeleton={nodes.RaeTheRedPanda.skeleton}
            castShadow
            receiveShadow
          />
          <primitive object={nodes.Root} />
        </group>
      </group>
    </group>
  )
}

useGLTF.preload('/Characters/GLTF/Mech_RaeTheRedPanda.gltf')
