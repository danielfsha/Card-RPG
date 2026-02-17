import GlossyButton from "./GlossyButton";

export default function Header() {
  return (
    <header className="w-full flex items-center justify-between p-2 fixed top-0 left-0 w-screen">
      <img src="/logo.png" className="h-16" />

      <GlossyButton>Connect wallet</GlossyButton>
    </header>
  );
}
