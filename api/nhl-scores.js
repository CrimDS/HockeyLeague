// This is a Vercel Serverless Function.
// It will handle requests to the URL: /api/nhl-scores

export default function handler(request, response) {
  // This is where we will eventually fetch data from the live NHL API.
  // For now, we are just sending back a simple success message.

  const placeholderData = {
    message: "API endpoint is working!",
    scores: [
      {
        homeTeam: "New York Rangers",
        homeScore: 2,
        awayTeam: "Boston Bruins",
        awayScore: 1,
        status: "LIVE",
      },
    ],
  };

  // Vercel functions need to send back a response.
  // We send a 200 status (which means "OK") and the placeholder data as JSON.
  response.status(200).json(placeholderData);
}
