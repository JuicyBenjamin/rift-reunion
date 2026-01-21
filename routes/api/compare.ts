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

async function getMatchHistory(puuid: string, region: string, count: number = 100): Promise<string[]> {
  const routing = regionToRouting[region] || "americas";
  const allMatches: string[] = [];
  let start = 0;
  const batchSize = 100; // Max per request
  
  // Fetch up to 'count' matches in batches of 100
  while (start < count) {
    const currentBatchSize = Math.min(batchSize, count - start);
    const url = `https://${routing}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=${start}&count=${currentBatchSize}`;
    
    const response = await fetch(url, {
      headers: {
        "X-Riot-Token": RIOT_API_KEY!,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch match history: ${response.statusText}`);
    }

    const matches: string[] = await response.json();
    
    // If we got fewer matches than requested, we've reached the end
    if (matches.length === 0) {
      break;
    }
    
    allMatches.push(...matches);
    
    // If we got fewer than the batch size, there are no more matches
    if (matches.length < currentBatchSize) {
      break;
    }
    
    start += currentBatchSize;
    
    // Small delay to respect rate limits (development key: 20 req/sec)
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  return allMatches;
}

async function getMatchDetails(matchId: string, region: string) {
  const routing = regionToRouting[region] || "americas";
  const url = `https://${routing}.api.riotgames.com/lol/match/v5/matches/${matchId}`;
  
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
      const { player1, player2, region } = body;

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

      // Get match histories (max 500 matches per player to stay within reasonable limits)
      const [matches1, matches2] = await Promise.all([
        getMatchHistory(account1.puuid, region, 500),
        getMatchHistory(account2.puuid, region, 500),
      ]);

      console.log(`Match history for ${account1.gameName}:`, matches1);
      console.log(`Match history for ${account2.gameName}:`, matches2);
      console.log(`Total matches found - ${account1.gameName}: ${matches1.length}, ${account2.gameName}: ${matches2.length}`);

      // Find shared matches
      const sharedMatchIds = matches1.filter((id) => matches2.includes(id));
      
      console.log(`Shared match IDs:`, sharedMatchIds);

      // Get details for shared matches
      const sharedMatches = await Promise.all(
        sharedMatchIds.map((id) => getMatchDetails(id, region))
      );

      const matchData = sharedMatches.map((match) => {
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
