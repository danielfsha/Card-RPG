import React, { type JSX, useRef } from "react";
import { useGLTF } from "@react-three/drei";

export default function Card(props: JSX.IntrinsicElements["group"]) {
  const { nodes, materials } = useGLTF("/models/card.glb") as any;
  return (
    <group {...props} dispose={null}>
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.Plane_1.geometry}
        material={materials.body}
      />
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.Plane_2.geometry}
        material={materials.face}
      />
    </group>
  );
}

useGLTF.preload("/models/card.glb");
