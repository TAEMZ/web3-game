import Dashboard from "@/components/home/Dashboard";
import PublicGames from "@/components/home/PublicGames/PublicGames";

export const revalidate = 0;

// Casual hub — reached by choosing "Casual" on the landing choice page.
export default function CasualHome() {
  return <Dashboard publicGames={<PublicGames />} />;
}
