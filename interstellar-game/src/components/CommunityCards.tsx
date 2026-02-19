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
    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
      <div className="flex gap-2 items-center justify-center">
        {cardsToShow.map((cardIndex, i) => {
          const card = cardsData.cards[cardIndex.toString() as keyof typeof cardsData.cards];
          return (
            <div
              key={i}
              className="w-32 h-46"
              style={{
                filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))',
              }}
            >
              <img 
                src={card.image}
                alt={`${card.rank} of ${card.suit}`}
                className="w-full h-full object-contain"
              />
            </div>
          );
        })}
      </div>

    </div>
  );
}
