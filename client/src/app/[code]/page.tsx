import GameAuthWrapper from "@/components/game/GameAuthWrapper";
import { fetchActiveGame } from "@/lib/game";
import { SITE_URL } from "@/lib/site";
import { notFound } from "next/navigation";

export async function generateMetadata({ params }: { params: { code: string } }) {
  const game = await fetchActiveGame(params.code);
  if (!game) {
    return {
      description: "Game not found",
      robots: {
        index: false,
        follow: false,
        nocache: true,
        noarchive: true
      }
    };
  }
  return {
    description: `Play or watch a game with ${game.host?.name}`,
    openGraph: {
      title: "Chess Arena",
      description: `Play or watch a game with ${game.host?.name}`,
      url: `${SITE_URL}/${game.code}`,
      siteName: "Chess Arena",
      locale: "en_US",
      type: "website"
    },
    robots: {
      index: false,
      follow: false,
      nocache: true,
      noarchive: true
    }
  };
}

export default async function Game({ params }: { params: { code: string } }) {
  const game = await fetchActiveGame(params.code);
  if (!game) {
    notFound();
  }

  return <GameAuthWrapper initialLobby={game} />;
}
