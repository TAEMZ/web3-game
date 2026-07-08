import ArchivedGame from "@/components/archive/ArchivedGame";
import { fetchArchivedGame } from "@/lib/game";
import { SITE_URL } from "@/lib/site";
import type { Game } from "@arena/types";
import { notFound } from "next/navigation";

export async function generateMetadata({ params }: { params: { id: number } }) {
  const game = (await fetchArchivedGame({ id: params.id })) as Game | undefined;
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
    description: `Archived game: ${game.white?.name} vs ${game.black?.name}`,
    openGraph: {
      title: "Chess Arena",
      description: `Archived game: ${game.white?.name} vs ${game.black?.name}`,
      url: `${SITE_URL}/archive/${game.id}`,
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

export default async function Archive({ params }: { params: { id: number } }) {
  const game = (await fetchArchivedGame({ id: params.id })) as Game | undefined;
  if (!game) {
    notFound();
  }

  return <ArchivedGame game={game} />;
}
