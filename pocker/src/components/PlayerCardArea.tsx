import React from "react";
import cardsData from "../../public/cards.json";

interface CardData {
  rank: string;
  suit: string;
  display: string;
  color: string;
  image: string;
}

interface PlayerCardAreaProps {
  label: string;
  cards: number[]; // Array of indices mapping to JSON keys
  showCards: boolean;
  position: "top" | "bottom";
}

export function PlayerCardArea({ label, cards, showCards, position }: PlayerCardAreaProps) {
  const isOpponent = position === "top";

  // Helper to fetch card data from the JSON based on index
  const getCardInfo = (cardIndex: number): CardData | null => {
    const card = (cardsData.cards as any)[cardIndex.toString()];
    return card || null;
  };

  /**
   * Renders a single card (face up or face down) with fan physics
   */
  const renderCardItem = (isBack: boolean, cardIndex: number, index: number, totalCards: number) => {
    const cardInfo = !isBack ? getCardInfo(cardIndex) : null;
    
    // Safety check for face-up cards
    if (!isBack && !cardInfo) return null;

    // --- FAN CALCULATIONS ---
    const middleIndex = (totalCards - 1) / 2;
    const offset = index - middleIndex;
    
    // Rotation: Spread cards by ~12 degrees. 
    const rotation = offset * 12; 
    
    // Arch effect: Move cards slightly "down" the further they are from center
    // to create that rounded fan top seen in your second image.
    const translateY = Math.abs(offset) * 12;

    return (
      <div
        key={`${isBack ? 'back' : 'front'}-${index}`}
        className="absolute w-28 h-40 sm:w-32 sm:h-44"
        style={{
          left: '50%',
          // Crucial: The pivot point is the bottom-center of the card
          transformOrigin: 'bottom center',
          transform: `translateX(-50%) translateY(${translateY}px) rotate(${rotation}deg)`,
          filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.4))',
          zIndex: index,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <img 
          src={isBack ? cardsData.cardBack : cardInfo?.image} 
          alt={isBack ? "Card back" : cardInfo?.display}
          className="w-full h-full object-contain"
        />
      </div>
    );
  };

  // Layout logic based on player position
  const containerStyle = isOpponent 
    ? "absolute top-12 left-1/2 -translate-x-1/2 flex-col-reverse" 
    : "absolute bottom-12 left-1/2 -translate-x-1/2 flex-col";

  return (
    <div className={`${containerStyle} flex items-center`}>
      {/* The Fan Container */}
      <div 
        className="relative w-64 h-48 flex items-center justify-center"
        style={{ 
          // If opponent, flip the entire fan container 180 degrees
          transform: isOpponent ? 'rotate(180deg)' : 'none' 
        }}
      >
        {showCards && cards.length > 0 ? (
          // Render actual cards
          cards.map((cardId, i) => renderCardItem(false, cardId, i, cards.length))
        ) : !showCards ? (
          // Render backs (default to 5 cards for "Waiting" state)
          [0, 1, 2, 3, 4].map((i) => renderCardItem(true, 0, i, 5))
        ) : (
          <div className="text-white/40 text-xs italic">No cards dealt</div>
        )}
      </div>

      {/* Label - Positioned below the fan for player, above for opponent */}
      <div className={`
        mt-6 px-4 py-1 rounded-full bg-black/50 text-white font-medium text-sm
        backdrop-blur-sm border border-white/10
      `}>
        {label}
      </div>
    </div>
  );
}