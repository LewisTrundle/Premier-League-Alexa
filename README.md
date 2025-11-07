# Premier League Alexa Skill

## Overview

This Alexa skill allows users to query real-time information about Premier League teams, such as standings, fixtures, scores, and team details, using voice commands. It integrates with the RapidAPI Football API to fetch live data about teams, matches, standings, and more.

## Features

The skill supports the following information requests:

- **Win/Loss Record & League Position**: Get a team's current standing, wins, draws, and losses
- **Last Score**: Retrieve the score and details of a team's most recent match
- **Next Game**: Find out when and who a team plays next
- **Next Opponent**: Get information about the upcoming opponent
- **Last Opponent**: Find out who a team played against in their previous match
- **Manager**: Get the name of a team's current manager
- **Playing Now**: Check if a team is currently playing
- **Games Played**: Find out how many matches a team has played this season

## Architecture

### Intents

1. **GetInfoIntent**: Main intent for querying team information
   - **Slots**:
     - `team`: The Premier League team name (supports all current and many historical PL teams)
     - `info`: The type of information requested (e.g., winLossRecord, leaguePosition, lastScore, etc.)

2. **Standard Amazon Intents**:
   - AMAZON.HelpIntent
   - AMAZON.CancelIntent
   - AMAZON.StopIntent
   - AMAZON.FallbackIntent
   - AMAZON.NavigateHomeIntent

### Info Slot Values

The `info` slot supports the following values:

- `winLossRecord` (synonyms: "record")
- `leaguePosition` (synonyms: "place")
- `lastScore` (synonyms: "last game what was the score", "score of the last game")
- `nextGame` (synonyms: "when will they play their next game")
- `nextOpponent` (synonyms: "play against next")
- `lastOpponent` (synonyms: "who did they play last")
- `manager` (synonyms: "who's their manager", "who is the manager")
- `playingNow` (synonyms: "playing right now")
- `numGamesPlayed` (synonyms: "how many games")
- `general` (default when no specific info type is provided)

## Implementation Details

### Session State Management

The skill maintains session state to optimize API calls and provide context-aware responses:

- **Team Details**: Cached team information (ID, name, venue)
- **Team Seasons**: Available seasons for the selected team
- **Team Standings**: Current league standings and statistics
- **Team Fixtures**: All matches for the current season
- **Team Coaches**: Current coaching staff

### API Integration

The skill uses the RapidAPI Football API (api-football-v1.p.rapidapi.com/v3/) with the following endpoints:

- `/teams` - Fetch team details by name
- `/teams/seasons` - Get available seasons for a team
- `/standings` - Retrieve league standings
- `/fixtures` - Get match fixtures and results
- `/coachs` - Fetch coaching staff information

### Data Flow

1. User invokes skill: "Alexa, open Premier League"
2. User requests information: "What's Watford's record?"
3. Skill identifies intent (GetInfoIntent) and extracts slots (team: "Watford", info: "winLossRecord")
4. Skill checks session state and makes required API calls
5. Data is processed and formatted into natural language response
6. Response is spoken to user with relevant statistics

### Smart Caching

The skill implements intelligent caching to minimize API calls:

- Flags track what information has been fetched (`gotTeamDetails`, `gotTeamSeasons`, etc.)
- Only required information is fetched based on the query type
- Session attributes persist data across multiple turns

### Date and Fixture Handling

- Fixtures are sorted chronologically
- Current date comparison identifies previous and next games
- Ordinal date formatting (1st, 2nd, 3rd, etc.) for natural speech
- Time formatting in 12-hour format with AM/PM

## Usage Examples

### Example Dialogues

**Example 1: Getting Team Record**
```
User: "Alexa, open Premier League"
Alexa: "Hi, how can I help you?"
User: "I'd like to know the record of Watford please"
Alexa: "Watford's record is currently in 10th place in the Championship, 
        with 14 wins, 15 draws, and 11 losses."
```

**Example 2: Checking if Team is Playing**
```
User: "Alexa, ask Premier League are Watford playing right now?"
Alexa: "No, Watford are not playing right now."
```

**Example 3: Next Opponent**
```
User: "Alexa, ask Premier League who are Watford playing next?"
Alexa: "In the next game, Watford will be playing against Luton at 11:30 AM 
        on April 1st."
```

**Example 4: Manager Information**
```
User: "Alexa, ask Premier League who's Watford's manager?"
Alexa: "Watford's manager is R. Hodgson."
```

**Example 5: Multiple Queries in One Session**
```
User: "Alexa, open Premier League"
Alexa: "Hi, how can I help you?"
User: "What place are Watford in?"
Alexa: "Watford's record is currently in 10th place..."
User: "Who are they playing next?"
Alexa: "In the next game, Watford will be playing against..."
User: "How many games has Watford played so far?"
Alexa: "They have played 48 matches."
User: "Goodbye"
Alexa: "Goodbye!"
```

## Supported Teams

The skill supports queries about all current Premier League teams and many historical teams, including:

- Arsenal, Aston Villa, Bournemouth, Brentford, Brighton & Hove Albion
- Burnley, Chelsea, Crystal Palace, Everton, Fulham
- Leeds United, Leicester City, Liverpool, Manchester City, Manchester United
- Newcastle United, Norwich City, Nottingham Forest, Sheffield United
- Southampton, Tottenham Hotspur, Watford, West Ham United, Wolverhampton Wanderers
- And many more historical Premier League teams

## Technical Notes

### Rank Suffix Calculation

The skill includes logic to properly format ordinal numbers in speech:
- 1st, 2nd, 3rd use "st", "nd", "rd"
- All others use "th"
- Handles numbers ending in 11, 12, 13 correctly

### Fixture Status Detection

The skill checks fixture status to determine:
- If a match has finished (`Match Finished`)
- If a match is currently in play (any status other than finished)
- Future fixtures vs. past fixtures based on date comparison

### Error Handling

- Generic error handler catches all unhandled errors
- Fallback intent for unrecognized utterances
- Session validation before API calls
