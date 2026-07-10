import PlayPlans from "./play/page";

// The landing page is the Casual-vs-Wager choice. Picking "Casual" goes to
// /casual (the game hub); "Wager Arena" opens the pass/wager flow.
export default function Home() {
  return <PlayPlans />;
}
