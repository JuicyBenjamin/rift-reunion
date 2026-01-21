import { define } from "../../utils.ts";

const RIOT_API_KEY = Deno.env.get("RIOT_API_KEY");

interface RiotAccount {
  puuid: string;
  gameName: string;
  tagLine: string;
}

const regionToRouting: Record<string, string> = {
  "na1": "americas",
  "br1": "americas",
  "la1": "americas",
  "la2": "americas",
  "euw1": "europe",
  "eun1": "europe",
  "tr1": "europe",
  "ru": "europe",
  "kr": "asia",
  "jp1": "asia",
  "oc1": "sea",
};

async function getAccountByRiotId(gameName: string, tagLine: string, region: string): Promise<RiotAccount> {
  const routing = regionToRouting[region] || "americas";
  const url = `https://${routing}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
  
  const response = await fetch(url, {
    headers: {
      "X-Riot-Token": RIOT_API_KEY!,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch account: ${response.statusText}`);
  }

  return await response.json();
}

async function getMatchHistory(puuid: string, region: string, mode: "lol" | "tft", count: number = 100): Promise<string[]> {
  const routing = regionToRouting[region] || "americas";
  const allMatches: string[] = [];
  let start = 0;
  const batchSize = 100;
  
  const gameType = mode === "tft" ? "tft" : "lol";
  
  while (start < count) {
    const currentBatchSize = Math.min(batchSize, count - start);
    const url = `https://${routing}.api.riotgames.com/${gameType}/match/v1/matches/by-puuid/${puuid}/ids?start=${start}&count=${currentBatchSize}`;
    
    const response = await fetch(url, {
      headers: {
        "X-Riot-Token": RIOT_API_KEY!,
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }
      throw new Error(`Failed to fetch match history: ${response.statusText}`);
    }

    const matches: string[] = await response.json();
    
    if (matches.length === 0) {
      break;
    }
    
    allMatches.push(...matches);
    
    if (matches.length < currentBatchSize) {
      break;
    }
    
    start += currentBatchSize;
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return allMatches;
}

async function getMatchDetails(matchId: string, region: string, mode: "lol" | "tft") {
  const routing = regionToRouting[region] || "americas";
  const gameType = mode === "tft" ? "tft" : "lol";
  const version = mode === "tft" ? "v1" : "v5";
  const url = `https://${routing}.api.riotgames.com/${gameType}/match/${version}/matches/${matchId}`;
  
  const response = await fetch(url, {
    headers: {
      "X-Riot-Token": RIOT_API_KEY!,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch match details: ${response.statusText}`);
  }

  return await response.json();
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

export const handler = define.handlers({
  async POST(ctx) {
    if (!RIOT_API_KEY) {
      return Response.json(
        { error: "Riot API key not configured" },
        { status: 500 }
      );
    }

    try {
      const body = await ctx.req.json();
      const { player1, player2, region, mode = "lol" } = body;

      // Parse player names (format: Name#TAG)
      const [gameName1, tagLine1] = player1.split("#");
      const [gameName2, tagLine2] = player2.split("#");

      if (!gameName1 || !tagLine1 || !gameName2 || !tagLine2) {
        return Response.json(
          { error: "Invalid player format. Use: Name#TAG" },
          { status: 400 }
        );
      }

      // Get account PUUIDs
      const [account1, account2] = await Promise.all([
        getAccountByRiotId(gameName1, tagLine1, region),
        getAccountByRiotId(gameName2, tagLine2, region),
      ]);

      const matches1 = await getMatchHistory(account1.puuid, region, mode, 500);
      const matches2 = await getMatchHistory(account2.puuid, region, mode, 500);

      const sharedMatchIds = matches1.filter((id) => matches2.includes(id));

      const sharedMatches = [];
      for (const id of sharedMatchIds) {
        const match = await getMatchDetails(id, region, mode);
        sharedMatches.push(match);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const matchData = sharedMatches.map((match) => {
        if (mode === "tft") {
          // TFT match data structure
          const player1Data = match.info.participants.find(
            (p: any) => p.puuid === account1.puuid
          );
          const player2Data = match.info.participants.find(
            (p: any) => p.puuid === account2.puuid
          );

          return {
            matchId: match.metadata.match_id,
            gameMode: match.info.tft_set_number ? `Set ${match.info.tft_set_number}` : "TFT",
            timestamp: match.info.game_datetime,
            duration: formatDuration(match.info.game_length),
            players: {
              player1: {
                placement: player1Data?.placement,
                traits: player1Data?.traits?.slice(0, 3).map((t: any) => t.name).join(", ") || "N/A",
              },
              player2: {
                placement: player2Data?.placement,
                traits: player2Data?.traits?.slice(0, 3).map((t: any) => t.name).join(", ") || "N/A",
              },
            },
          };
        } else {
          // LoL match data structure
          const player1Data = match.info.participants.find(
            (p: any) => p.puuid === account1.puuid
          );
          const player2Data = match.info.participants.find(
            (p: any) => p.puuid === account2.puuid
          );

          return {
            matchId: match.metadata.matchId,
            gameMode: match.info.gameMode,
            timestamp: match.info.gameStartTimestamp,
            duration: formatDuration(match.info.gameDuration),
            players: {
              player1: {
                champion: player1Data?.championName,
                team: player1Data?.teamId,
              },
              player2: {
                champion: player2Data?.championName,
                team: player2Data?.teamId,
              },
            },
          };
        }
      });

      return Response.json({
        player1: { gameName: account1.gameName, tagLine: account1.tagLine },
        player2: { gameName: account2.gameName, tagLine: account2.tagLine },
        matches: matchData,
      });
    } catch (error) {
      console.error("Error:", error);
      return Response.json(
        { error: error.message || "An error occurred" },
        { status: 500 }
      );
    }
  },
});
