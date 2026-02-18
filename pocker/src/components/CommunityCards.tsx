import cardsData from "../../public/cards.json";

interface CommunityCardsProps {
  phase: string;
  communityCards: number[];
}

export function CommunityCards({ phase, communityCards }: CommunityCardsProps) {
  // Determine how many cards to show based on phase
  const getCardCount = () => {
    if (phase === "Commit" || phase === "Preflop") return 0;
    if (phase === "Flop") return 3;
    if (phase === "Turn") return 4;
    if (phase === "River" || phase === "Showdown" || phase === "Complete") return 5;
    return 0;
  };

  const cardCount = getCardCount();

  if (cardCount === 0) return null;

  // Get the actual cards to display (only show first N based on phase)
  const cardsToShow = communityCards.slice(0, cardCount);

  return (
    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 mt-16">
      <div className="flex gap-2 items-center justify-center">
        {cardsToShow.map((cardIndex, i) => {
          const card = cardsData.cards[cardIndex];
          return (
            <div
              key={i}
              className="w-28 h-40 sm:w-32 sm:h-44"
              style={{
                filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))',
              }}
            >
              <img 
                src={card.image}
                alt={`${card.value} of ${card.suit}`}
                className="w-full h-full object-contain"
              />
            </div>
          );
        })}
      </div>
      <div className="text-center text-white/60 text-xs mt-2 px-3 py-1 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 inline-block">
        Community Cards
      </div>
    </div>
  );
}
