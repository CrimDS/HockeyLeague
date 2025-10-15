// This function fetches detailed team game statistics for a specific NHL game.
// It's designed to be robust and handle cases where stats may not be available.
export const config = {
  runtime: 'edge',
};

// A helper function to safely find and extract a statistic.
// If the stat is not found or the stats array is missing, it returns a default value.
const getStat = (statsArray, statName, defaultValue) => {
  if (!statsArray) {
    return defaultValue;
  }
  const stat = statsArray.find(s => s.name === statName);
  return stat ? stat.displayValue : defaultValue;
};

// The main handler for the serverless function.
export default async function handler(request) {
  const { searchParams } = new URL(request.url);
  const gameId = searchParams.get('id');

  if (!gameId) {
    return new Response(JSON.stringify({ error: 'Game ID is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const GAME_URL = `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/summary?event=${gameId}`;

  try {
    const response = await fetch(GAME_URL, {
      headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch game data. Status: ${response.status}`);
    }
    const data = await response.json();

    const homeTeam = data.boxscore?.teams?.find(t => t.team.homeAway === 'home');
    const awayTeam = data.boxscore?.teams?.find(t => t.team.homeAway === 'away');

    // If team data is missing, we cannot proceed.
    if (!homeTeam || !awayTeam) {
      console.warn(`Incomplete data for game ID ${gameId}: Missing home or away team.`);
      return new Response(JSON.stringify({ error: 'Detailed stats are not yet available for this game.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // --- TEAM STATS ---
    const teamStats = {
      shotsOnGoal: {
        away: getStat(awayTeam.statistics, 'shotsOnGoal', '0'),
        home: getStat(homeTeam.statistics, 'shotsOnGoal', '0'),
      },
      hits: {
        away: getStat(awayTeam.statistics, 'hits', '0'),
        home: getStat(homeTeam.statistics, 'hits', '0'),
      },
      blockedShots: {
        away: getStat(awayTeam.statistics, 'blockedShots', '0'),
        home: getStat(homeTeam.statistics, 'blockedShots', '0'),
      },
      penaltyMinutes: {
        away: getStat(awayTeam.statistics, 'penaltyMinutes', '0'),
        home: getStat(homeTeam.statistics, 'penaltyMinutes', '0'),
      },
      powerPlays: {
        away: getStat(awayTeam.statistics, 'powerPlay', '0/0').replace(' / ', '/'),
        home: getStat(homeTeam.statistics, 'powerPlay', '0/0').replace(' / ', '/'),
      },
    };

    return new Response(JSON.stringify({ teamStats }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=5',
      },
    });

  } catch (error) {
    console.error(`Error fetching game stats for ID ${gameId}:`, error);
    return new Response(JSON.stringify({ error: 'Could not fetch game stats.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

