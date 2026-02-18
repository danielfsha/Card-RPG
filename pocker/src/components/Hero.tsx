import GlossyButton from "./GlossyButton";
import GlossySlider from "./GlossySlider";

export default function Hero() {
  return (
    <div className="w-full min-h-[50vh] flex flex-col items-center justify-center space-y-12">
      <img src="/logo.png" className="h-22" />

      <p className="max-w-md w-full text-white w-full px-4 text-center text-2xl">
        Stellar pocker is a multiplayer pocker game build on stellar blockchain
        using
      </p>

   <div className="w-128">
       <GlossySlider value={0} min={0} max={0} onChange={() => {}} />
   </div>

      <div className="flex flex-col items-center justify-center space-y-2 w-128">
        <GlossyButton className="w-full">Create game</GlossyButton>
        <GlossyButton className="w-full">Join game</GlossyButton>
        <GlossyButton className="w-full">Settings</GlossyButton>
      </div>
    </div>
  );
}
