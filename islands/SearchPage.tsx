import { useSignal } from "@preact/signals";

interface SearchPageProps {
  initialPlayer1: string;
  initialPlayer2: string;
  initialRegion: string;
  initialMode: "lol" | "tft";
}

export default function SearchPage(props: SearchPageProps) {
  const player1 = useSignal(props.initialPlayer1);
  const player2 = useSignal(props.initialPlayer2);
  const region = useSignal(props.initialRegion);
  const mode = useSignal<"lol" | "tft">(props.initialMode);
  const isLoading = useSignal(false);
  const results = useSignal<any>(null);
  const error = useSignal("");

  const updateURL = () => {
    const params = new URLSearchParams();
    if (player1.value) params.set("player1", player1.value);
    if (player2.value) params.set("player2", player2.value);
    if (region.value) params.set("region", region.value);
    params.set("mode", mode.value);
    
    const newURL = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, "", newURL);
  };

  const handleModeToggle = (newMode: "lol" | "tft") => {
    mode.value = newMode;
    results.value = null;
    updateURL();
  };

  const handlePlayer1Change = (e: Event) => {
    player1.value = (e.target as HTMLInputElement).value;
    updateURL();
  };

  const handlePlayer2Change = (e: Event) => {
    player2.value = (e.target as HTMLInputElement).value;
    updateURL();
  };

  const handleRegionChange = (e: Event) => {
    region.value = (e.target as HTMLSelectElement).value;
    updateURL();
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!player1.value.trim() || !player2.value.trim()) {
      error.value = "Please enter both player names";
      return;
    }

    updateURL();

    isLoading.value = true;
    error.value = "";
    results.value = null;

    try {
      const response = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player1: player1.value.trim(),
          player2: player2.value.trim(),
          region: region.value,
          mode: mode.value,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        error.value = data.error || "Failed to fetch data";
        return;
      }

      results.value = data;
    } catch (err) {
      error.value = "An error occurred. Please try again.";
    } finally {
      isLoading.value = false;
    }
  };

  const handleButtonClick = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    handleSubmit(e);
  };

  return (
    <div class="w-full max-w-2xl">
      {/* Game Mode Toggle */}
      <div class="flex justify-center mb-6">
        <div class="join">
          <button
            type="button"
            onClick={() => handleModeToggle("lol")}
            class={`btn join-item ${mode.value === "lol" ? "btn-primary" : "btn-ghost"}`}
          >
            ⚔️ League of Legends
          </button>
          <button
            type="button"
            onClick={() => handleModeToggle("tft")}
            class={`btn join-item ${mode.value === "tft" ? "btn-primary" : "btn-ghost"}`}
          >
            🐧 Teamfight Tactics
          </button>
        </div>
      </div>

      {/* Search Form */}
      <div class="card bg-base-100 shadow-xl">
        <div class="card-body">
          <form onSubmit={handleSubmit} class="space-y-4">
            <div class="form-control">
              <label class="label">
                <span class="label-text">Region</span>
              </label>
              <select
                class="select select-bordered w-full"
                value={region.value}
                onChange={handleRegionChange}
              >
                <option value="na1">North America</option>
                <option value="euw1">Europe West</option>
                <option value="eun1">Europe Nordic & East</option>
                <option value="kr">Korea</option>
                <option value="br1">Brazil</option>
                <option value="la1">Latin America North</option>
                <option value="la2">Latin America South</option>
                <option value="oc1">Oceania</option>
                <option value="tr1">Turkey</option>
                <option value="ru">Russia</option>
                <option value="jp1">Japan</option>
              </select>
            </div>

            <div class="form-control">
              <label class="label">
                <span class="label-text">Player 1</span>
              </label>
              <input
                type="text"
                placeholder="Summoner Name#TAG"
                class="input input-bordered w-full"
                value={player1.value}
                onInput={handlePlayer1Change}
              />
            </div>

            <div class="form-control">
              <label class="label">
                <span class="label-text">Player 2</span>
              </label>
              <input
                type="text"
                placeholder="Summoner Name#TAG"
                class="input input-bordered w-full"
                value={player2.value}
                onInput={handlePlayer2Change}
              />
            </div>

            {error.value && (
              <div class="alert alert-error">
                <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error.value}</span>
              </div>
            )}

            <button
              type="button"
              class="btn btn-primary w-full"
              disabled={isLoading.value}
              onClick={handleButtonClick}
            >
              {isLoading.value ? (
                <>
                  <span class="loading loading-spinner"></span>
                  Searching...
                </>
              ) : (
                "Search Matches"
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Results */}
      {results.value && (
        <div class="card bg-base-100 shadow-xl mt-6">
          <div class="card-body">
            <h2 class="card-title text-2xl">Results</h2>
            
            {results.value.matches.length === 0 ? (
              <div class="alert alert-info">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <span>No shared matches found between these players</span>
              </div>
            ) : (
              <>
                <div class="stats shadow">
                  <div class="stat">
                    <div class="stat-title">Shared Matches</div>
                    <div class="stat-value">{results.value.matches.length}</div>
                  </div>
                </div>

                <div class="divider">Match History</div>

                <div class="space-y-4">
                  {results.value.matches.map((match: any, idx: number) => (
                    <div key={idx} class="card bg-base-200">
                      <div class="card-body">
                        <div class="flex justify-between items-center">
                          <div>
                            <p class="font-bold">{match.gameMode}</p>
                            <p class="text-sm opacity-70">
                              {new Date(match.timestamp).toLocaleString()}
                            </p>
                          </div>
                          <div class="badge badge-lg">
                            {match.duration}
                          </div>
                        </div>
                        {match.players && (
                          <div class="mt-2">
                            {mode.value === "tft" ? (
                              <>
                                <p class="text-sm">
                                  <span class="font-semibold">{results.value.player1.gameName}</span>: #{match.players.player1.placement} - {match.players.player1.traits}
                                </p>
                                <p class="text-sm">
                                  <span class="font-semibold">{results.value.player2.gameName}</span>: #{match.players.player2.placement} - {match.players.player2.traits}
                                </p>
                              </>
                            ) : (
                              <>
                                <p class="text-sm">
                                  <span class="font-semibold">{results.value.player1.gameName}</span>: {match.players.player1.champion}
                                </p>
                                <p class="text-sm">
                                  <span class="font-semibold">{results.value.player2.gameName}</span>: {match.players.player2.champion}
                                </p>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
