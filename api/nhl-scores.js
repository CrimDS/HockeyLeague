// This is a Vercel Serverless Function that uses the undocumented ESPN API.
// It will handle requests to the URL: /api/nhl-scores

export default async function handler(request, response) {
  // ESPN API endpoint for today's NHL scoreboard
  const url = `http://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard`;

  try {
    // Fetch the data from the API
    const apiResponse = await fetch(url);
    if (!apiResponse.ok) {
      // If the API returns an error, forward it
      return response.status(apiResponse.status).json({ error: `API failed with status: ${apiResponse.status}` });
    }
    
    const data = await apiResponse.json();

    // The API returns an 'events' property which might be empty if there are no games today
    if (!data.events || data.events.length === 0) {
        return response.status(200).json({ scores: [] }); // Return empty array if no games
    }

    // Transform the data into a cleaner format for our website
    const transformedScores = data.events.map(event => {
      const competition = event.competitions[0];
      const homeCompetitor = competition.competitors.find(c => c.homeAway === 'home');
      const awayCompetitor = competition.competitors.find(c => c.homeAway === 'away');
      const status = competition.status.type;

      return {
        id: event.id,
        homeTeam: homeCompetitor.team.displayName,
        homeScore: homeCompetitor.score,
        homeLogo: homeCompetitor.team.logo,
        awayTeam: awayCompetitor.team.displayName,
        awayScore: awayCompetitor.score,
        awayLogo: awayCompetitor.team.logo,
        status: status.detail, // e.g., "Final", "2nd - 10:34", "Scheduled"
        isCompleted: status.completed,
        time: event.date, // This is a full ISO 8601 timestamp (e.g., "2025-10-15T23:00Z")
      };
    });

    // Send the transformed data back to the user
    response.status(200).json({ scores: transformedScores });
    
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: "Failed to fetch data from the API." });
  }
}

