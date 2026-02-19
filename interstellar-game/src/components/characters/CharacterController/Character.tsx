import React, { Suspense } from 'react';
import { Model as AstronautFinn } from '../Astronaut_FinnTheFrog';
import { Model as AstronautBarbara } from '../Astronaut_BarbaraTheBee';
import { Model as AstronautFernando } from '../Astronaut_FernandoTheFlamingo';
import { Model as AstronautRae } from '../Astronaut_RaeTheRedPanda';
import { Model as MechFinn } from '../Mech_FinnTheFrog';
import { Model as MechBarbara } from '../Mech_BarbaraTheBee';
import { Model as MechFernando } from '../Mech_FernandoTheFlamingo';
import { Model as MechRae } from '../Mech_RaeTheRedPanda';

export type CharacterType = 
  | 'Astronaut_FinnTheFrog'
  | 'Astronaut_BarbaraTheBee'
  | 'Astronaut_FernandoTheFlamingo'
  | 'Astronaut_RaeTheRedPanda'
  | 'Mech_FinnTheFrog'
  | 'Mech_BarbaraTheBee'
  | 'Mech_FernandoTheFlamingo'
  | 'Mech_RaeTheRedPanda';

interface CharacterProps {
  character?: CharacterType;
  scale?: number;
  'position-y'?: number;
  animation?: string;
}

const characterComponents: Record<CharacterType, React.ComponentType<any>> = {
  Astronaut_FinnTheFrog: AstronautFinn,
  Astronaut_BarbaraTheBee: AstronautBarbara,
  Astronaut_FernandoTheFlamingo: AstronautFernando,
  Astronaut_RaeTheRedPanda: AstronautRae,
  Mech_FinnTheFrog: MechFinn,
  Mech_BarbaraTheBee: MechBarbara,
  Mech_FernandoTheFlamingo: MechFernando,
  Mech_RaeTheRedPanda: MechRae,
};

export function Character({ 
  character = 'Astronaut_FinnTheFrog', 
  scale = 0.18, 
  'position-y': positionY = -0.25,
  animation = 'Idle'
}: CharacterProps) {
  const CharacterModel = characterComponents[character];

  return (
    <Suspense fallback={null}>
      <CharacterModel 
        scale={scale} 
        position-y={positionY}
        animation={animation}
      />
    </Suspense>
  );
}
