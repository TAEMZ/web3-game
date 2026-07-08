import Dashboard from "@/components/home/Dashboard";
import PublicGames from "@/components/home/PublicGames/PublicGames";

export const revalidate = 0;

export default function Home() {
  // PublicGames is a server component (fetches on the server); Dashboard is a
  // client gate that only shows it once the visitor is signed in.
  return <Dashboard publicGames={<PublicGames />} />;
}
