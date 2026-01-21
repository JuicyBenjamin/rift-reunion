import { define } from "../utils.ts";
import SearchPage from "../islands/SearchPage.tsx";

export default define.page(function Home(ctx) {
  const url = new URL(ctx.req.url);
  const player1 = url.searchParams.get("player1") || "";
  const player2 = url.searchParams.get("player2") || "";
  const region = url.searchParams.get("region") || "euw1";
  const mode = (url.searchParams.get("mode") || "lol") as "lol" | "tft";

  return (
    <div class="min-h-screen bg-base-200">
      <div class="hero min-h-screen">
        <div class="hero-content text-center">
          <div class="max-w-2xl">
            <h1 class="text-5xl font-bold mb-4">⚔️ Rift Reunion</h1>
            <p class="text-lg mb-8">
              Discover if two League of Legends and Teamfight Tactics players have shared the battlefield together
            </p>
            <SearchPage
              initialPlayer1={player1}
              initialPlayer2={player2}
              initialRegion={region}
              initialMode={mode}
            />
          </div>
        </div>
      </div>
    </div>
  );
});
