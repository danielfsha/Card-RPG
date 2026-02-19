import { useState, useEffect } from "react";
import { useWallet } from "../hooks/useWallet";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "./ui/dialog";
import GlossyButton from "./GlossyButton";
import toast from "react-hot-toast";
import { ClipboardCopyIcon } from "lucide-react";

export function WalletModal() {
  const { publicKey, disconnect } = useWallet();
  const [open, setOpen] = useState(false);
  const [balance, setBalance] = useState<string | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  const truncateAddress = (address: string) => {
    if (!address) return "";
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

  const copyAddress = async () => {
    if (publicKey) {
      await navigator.clipboard.writeText(publicKey);
      toast.success("Address copied to clipboard!");
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setOpen(false);
    toast.success("Wallet disconnected");
  };

  // Fetch balance when modal opens
  useEffect(() => {
    if (!open || !publicKey) {
      return;
    }

    const fetchBalance = async () => {
      setLoadingBalance(true);
      try {
        const { NETWORK } = await import("../utils/constants");
        const horizonUrl = NETWORK === "mainnet" 
          ? "https://horizon.stellar.org"
          : "https://horizon-testnet.stellar.org";

        const response = await fetch(`${horizonUrl}/accounts/${publicKey}`);
        
        if (!response.ok) {
          throw new Error("Failed to fetch account");
        }

        const accountData = await response.json();
        const xlmBalance = accountData.balances.find(
          (b: any) => b.asset_type === "native"
        );

        if (xlmBalance) {
          setBalance(parseFloat(xlmBalance.balance).toFixed(2));
        } else {
          setBalance("0.00");
        }
      } catch (error) {
        console.error("Error fetching balance:", error);
        setBalance("Error");
      } finally {
        setLoadingBalance(false);
      }
    };

    fetchBalance();
  }, [open, publicKey]);

  if (!publicKey) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <GlossyButton title="Wallet Info">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
          >
            <g
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              strokeDasharray="30"
            >
              <path d="M7 6h2v12h-2Z">
                <animate
                  attributeName="stroke-dashoffset"
                  dur="0.4s"
                  fill="freeze"
                  values="30;0"
                />
              </path>
              <path d="M15 6h2v12h-2Z" strokeDashoffset="30">
                <animate
                  attributeName="stroke-dashoffset"
                  begin="0.4s"
                  dur="0.4s"
                  fill="freeze"
                  to="0"
                />
              </path>
            </g>
          </svg>
        </GlossyButton>
      </DialogTrigger>
      <DialogContent className="bg-gradient-to-br from-gray-900 to-green-900 border-2 border-white/20 text-white">

        <div className="space-y-6 mt-4">
          {/* Balance Section */}
          <div className="text-3xl text-center mx-auto">
                {loadingBalance ? (
                  <span className="text-white/50">Loading...</span>
                ) : balance !== null ? (
                  `${balance} XLM`
                ) : (
                  <span className="text-white/50">--</span>
                )}
              </div>

          {/* Address Section */}
          <div className="space-y-2">
            <label className="text-sm text-white/70">Wallet Address</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 text-2xl text-white/90">
                {truncateAddress(publicKey)}
              </div>
              <GlossyButton
                onClick={copyAddress}
                className="px-4 py-3 bg-blue-600 hover:bg-blue-700"
                title="Copy address"
              >
                <ClipboardCopyIcon />
              </GlossyButton>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <GlossyButton
              onClick={handleDisconnect}
              className="flex-1 py-3 bg-red-600 hover:bg-red-700"
            >
              Disconnect
            </GlossyButton>
            <GlossyButton
              onClick={() => setOpen(false)}
              className="flex-1 py-3 bg-gray-600 hover:bg-gray-700"
            >
              Close
            </GlossyButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
