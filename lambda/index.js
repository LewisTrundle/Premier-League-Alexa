const Alexa = require('ask-sdk-core');
const axios = require('axios');
const persistenceAdapter = require('ask-sdk-s3-persistence-adapter');
require('dotenv').config();

const baseUrl = "https://api-football-v1.p.rapidapi.com/v3/";


const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
        const speakOutput = 'Hi, how can I help you?';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const getManager = (sessionAttributes) => {
    return sessionAttributes.team.coaches[0].name;
};
const getTeamName = (sessionAttributes) => {
    return sessionAttributes.team.name;
};

const getRankSuffix = (sessionAttributes) => {
    const rank = sessionAttributes.team.currentLeague.rank.toString();
    const lastNumber = rank[rank.length-1];
    console.log(rank, lastNumber);
    if (lastNumber === '1') {
        return 'st';
    }
    else if (lastNumber === "2") {
        return 'nd';
    }
    else if (lastNumber === "3") {
        return 'rd';
    }
    else {
        return 'th';
    }
}


const GoodbyeRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'GoodbyeIntent'; 
    },
    handle(handlerInput) {
        let speakOutput = "Goodbye!";
        
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};



const GetInfoRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'GetInfoIntent'; 
    },
    async handle(handlerInput) {
        let speakOutput = 'Please provide me with additional details.';
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const infoType = getInfoType(sessionAttributes, handlerInput);
        
    
        if (infoType === "general" || infoType === "winLossRecord" || infoType === "leaguePosition") {
            await getRequiredInfo(sessionAttributes, handlerInput, {teamDetails: true, teamSeasons: true, teamStandings: true});
            const team = sessionAttributes.team;
            speakOutput = `${team.name}'s record is currently in ${team.currentLeague.rank}${getRankSuffix(sessionAttributes)} place in the ${team.currentLeague.name}, with ${team.currentLeague.wins} wins,  ${team.currentLeague.draws} draws, and ${team.currentLeague.losses} losses.`;
        }
        else if (infoType === "lastScore") {
            await getRequiredInfo(sessionAttributes, handlerInput, {teamDetails: true, teamSeasons: true, teamFixtures: true});
            const team = sessionAttributes.team;
            speakOutput = getScore(team, "previous");
        }
        else if (infoType === "nextGame" || infoType === "nextOpponent") {
            await getRequiredInfo(sessionAttributes, handlerInput, {teamDetails: true, teamSeasons: true, teamFixtures: true});
            const team = sessionAttributes.team;
            speakOutput = formatDate(team, "next");
        }
        else if (infoType === "manager") {
            await getRequiredInfo(sessionAttributes, handlerInput, {teamDetails: true, teamCoaches: true});
            const manager = getManager(sessionAttributes);
            speakOutput = `${getTeamName(sessionAttributes)}'s manager is ${manager}.`;
        }
        else if (infoType === "playingNow") {
            await getRequiredInfo(sessionAttributes, handlerInput, {teamDetails: true, teamSeasons: true, teamFixtures: true});
            console.log("got info ", sessionAttributes);
            if (playingNow(sessionAttributes)) {
                speakOutput = `Yes, ${sessionAttributes.team.name} are playing right now.`;
            } else {
                speakOutput = `No, ${sessionAttributes.team.name} are not playing right now.`;
            }
        }
        else if (infoType === "lastOpponent") {
            await getRequiredInfo(sessionAttributes, handlerInput, {teamDetails: true, teamSeasons: true, teamFixtures: true});
            speakOutput = playedAgainst(sessionAttributes.team, "previous");
        }
        else if (infoType === "numGamesPlayed") {
            await getRequiredInfo(sessionAttributes, handlerInput, {teamDetails: true, teamSeasons: true, teamFixtures: true});
            speakOutput = `They have played ${sessionAttributes.team.fixtures.gamesPlayed} matches.`
        }
        
        speakOutput += ` --------------------
        INTENT: GetInfoIntent ---
        SLOTS: {team: ${sessionAttributes.team.name}, info: ${infoType}}`;
        
        console.log(sessionAttributes);
        
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};


const playingNow = (sessionAttributes) => {
    const previousGame = sessionAttributes.team.fixtures.previousGame;
    console.log("prev ", previousGame);
    if (previousGame.fixture.status.long !== "Match Finished") {
        return true;
    }
    return false;
};


const playedAgainst = (team, g) => {
    const game = team.fixtures[`${g}Game`];
    const otherTeam = game.teams.home.id === team.id ? game.teams.away.name : game.teams.home.name;
    
    return `They played against ${otherTeam}.`;
};


const getScore = (team, g) => {
    const game = team.fixtures[`${g}Game`];
    let date = new Date(game.fixture.date);
    
    const day = date.getDate();
    const daySuffix = {one:'st',two:'nd',few:'rd',other:'th'}[new Intl.PluralRules('en-GB', { type: 'ordinal' }).select(date.getDate())];
    const month = new Intl.DateTimeFormat("en-GB", { month: "long" }).format(date);
    const time = date.toLocaleString('en-GB', { hour: 'numeric', minute: 'numeric', hour12: true });
    
    let speakOutput;
    const winningTeam = game.teams.home.winner === true ? "home" :  game.teams.home.winner === false ? "away" : null;
    if (winningTeam === "home") {
        speakOutput = `In ${team.name}'s ${g} game on ${month} ${day}${daySuffix} at ${time}, ${game.teams.home.name} won against  ${game.teams.away.name}, by ${game.goals.home} goals to ${game.goals.away}`;
    }
    else if (winningTeam === "away") {
        speakOutput = `In ${team.name}'s ${g} game on ${month} ${day}${daySuffix} at ${time}, ${game.teams.away.name} won against  ${game.teams.home.name}, by ${game.goals.away} goals to ${game.goals.home}`;
    }
    else {
        speakOutput = `They have not played their ${g} game yet.`
    }
    return speakOutput;
};


const formatDate = (team, g) => {
    const game = team.fixtures[`${g}Game`];
    let date = new Date(game.fixture.date);
    
    const day = date.getDate();
    const daySuffix = {one:'st',two:'nd',few:'rd',other:'th'}[new Intl.PluralRules('en-GB', { type: 'ordinal' }).select(date.getDate())];
    const month = new Intl.DateTimeFormat("en-GB", { month: "long" }).format(date);
    const time = date.toLocaleString('en-GB', { hour: 'numeric', minute: 'numeric', hour12: true });
    
    const otherTeam = game.teams.home.id === team.id ? game.teams.away.name : game.teams.home.name;
    
    return `In the ${g} game, ${team.name} will be playing against ${otherTeam} at ${time} on ${month} ${day}${daySuffix}.`
};


const getRequiredInfo = async (sessionAttributes, handlerInput, requiredInfo) => {
    if (!sessionAttributes.gotTeamDetails && requiredInfo.teamDetails) {
        console.log("getting team details");
        await getTeamDetails(sessionAttributes, handlerInput);
    }
    if (!sessionAttributes.gotTeamSeasons && requiredInfo.teamSeasons) {
        // get available seasons for a team 
        console.log("getting team seasons");
        await getTeamSeasons(sessionAttributes, handlerInput);
    }
    if (!sessionAttributes.gotTeamStandings && requiredInfo.teamStandings) {
        // get standings for team in current season
        console.log("getting team standings");
        await getTeamStandings(sessionAttributes, handlerInput);
    }
    if (!sessionAttributes.gotTeamFixtures && requiredInfo.teamFixtures) {
        console.log("getting team fixtures");
        // get fixtures for a team
        await getTeamFixtures(sessionAttributes, handlerInput);
    }
    if (!sessionAttributes.gotTeamCoaches && requiredInfo.teamCoaches) {
        console.log("getting team coaches");
        // get fixtures for a team
        await getTeamCoaches(sessionAttributes, handlerInput);
    }
};


function compare(a, b) {
  if (a.fixture.date < b.fixture.date){
    return -1;
  }
  if (a.fixture.date > b.fixture.date){
    return 1;
  }
  return 0;
}


const getTeamCoaches = async (sessionAttributes, handlerInput) => {
    const team = sessionAttributes.team;
    const data = await getData("coachs", {team: team.id});
    const coaches = data.data.response;
    console.log(coaches)
    
    sessionAttributes.team.coaches = coaches;
    sessionAttributes.gotTeamCoaches = true;
    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
};


const getTeamFixtures = async (sessionAttributes, handlerInput) => {
    const team = sessionAttributes.team;
    const season = team.seasons[team.seasons.length - 1];
    if (team) {
        const data = await getData("fixtures", {team: team.id, season: season});
        const fixtures = data.data.response;
        
        if (fixtures) {
            // sort the fixtures by date
            fixtures.sort(compare);
            sessionAttributes.team.fixtures = {};
            sessionAttributes.team.fixtures.fixtures = fixtures;
            sessionAttributes.team.fixtures.totalFixtures = fixtures.length;
            
            // get the first and last game of the season
            sessionAttributes.team.fixtures.firstGame = fixtures[0];
            sessionAttributes.team.fixtures.lastGame = fixtures[fixtures.length-1];
            
            // get the previous and next game using todays date
            let currentDate = new Date();
            const nextGame = fixtures.find(fix => new Date(fix.fixture.date) > currentDate);
            sessionAttributes.team.fixtures.nextGame = nextGame;
            
            const gamesPlayed = fixtures.indexOf(nextGame);
            const previousGame = fixtures[gamesPlayed-1];
            sessionAttributes.team.fixtures.previousGame = previousGame;
            sessionAttributes.team.fixtures.gamesPlayed = gamesPlayed+1;

        }
        sessionAttributes.gotTeamFixtures = true;
    }
    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
};



// scenarios
// 1st any team is mentioned - API call plus update currentTeam
// a team is mentioned again but is the same as one mentioned previosly - no updating required
// a team is mentioned which is new - should be added to teams array and currentTeam updated
// a team is mentioned which is one mentioned a while ago - no API call needed, but should update currentTeam

const getTeamDetails = async (sessionAttributes, handlerInput) => {
    const teamValue = Alexa.getSlotValue(handlerInput.requestEnvelope, "team");
    if (teamValue) {
        const data = await getData("teams", {name: teamValue});
        sessionAttributes.team = data.data.response[0].team;
        sessionAttributes.team.venue = data.data.response[0].venue;
        sessionAttributes.gotTeamDetails = true;
    }
    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
};


const getTeamSeasons = async (sessionAttributes, handlerInput) => {
    const team = sessionAttributes.team;
    if (team) {
        const data = await getData("teams/seasons", {team: team.id});
        sessionAttributes.team.seasons = data.data.response;
        sessionAttributes.gotTeamSeasons = true;
    }
    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
};


const getTeamStandings = async (sessionAttributes, handlerInput) => {
    const team = sessionAttributes.team;
    const season = team.seasons[team.seasons.length - 1];
    if (team) {
        const data = await getData("standings", {team: team.id, season: season});
        const league = data.data.response[0].league;
        const standings = league.standings[0][0];
        sessionAttributes.team.currentLeague = league;
        sessionAttributes.team.currentLeague.rank = standings.rank;
        sessionAttributes.team.currentLeague.wins = standings.all.win;
        sessionAttributes.team.currentLeague.losses = standings.all.lose;
        sessionAttributes.team.currentLeague.draws = standings.all.draw;
        sessionAttributes.gotTeamStandings = true;
    }
    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
};


const getInfoType = (sessionAttributes, handlerInput) => {
    const infoValue = Alexa.getSlotValue(handlerInput.requestEnvelope, "info");
    let infoId = "general";
    if (infoValue) {
        infoId = getSlotId(handlerInput, "info");
    }
    sessionAttributes.info = infoId;
    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
    return infoId;
};


const getData = async (url, params) => {
    axios.defaults.headers.common = {'X-RapidAPI-Key': process.env.XRAPIDAPIKEY, 'X-RapidAPI-Host': process.env.XRAPIDAPIHOST};
    const data = await axios({
        method: "get",
        url: baseUrl+url,
        params: params,
    });
    return data;
};


const getSlotId = (handlerInput, slot) => {
    const resolution = handlerInput.requestEnvelope.request.intent.slots[slot].resolutions.resolutionsPerAuthority[0];
    let id;
    
    if (resolution.status.code === "ER_SUCCESS_MATCH") {
        id = resolution.values[0].value.id;
    }
    
    return id;
};







const HelloWorldIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'HelloWorldIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'Hello World!';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
            .getResponse();
    }
};

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'You can say hello to me! How can I help?';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        const speakOutput = 'Goodbye!';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};
/* *
 * FallbackIntent triggers when a customer says something that doesn’t map to any intents in your skill
 * It must also be defined in the language model (if the locale supports it)
 * This handler can be safely added but will be ingnored in locales that do not support it yet 
 * */
const FallbackIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'Sorry, I don\'t know about that. Please try again.';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};
/* *
 * SessionEndedRequest notifies that a session was ended. This handler will be triggered when a currently open 
 * session is closed for one of the following reasons: 1) The user says "exit" or "quit". 2) The user does not 
 * respond or says something that does not match an intent defined in your voice model. 3) An error occurs 
 * */
const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.log(`~~~~ Session ended: ${JSON.stringify(handlerInput.requestEnvelope)}`);
        // Any cleanup logic goes here.
        return handlerInput.responseBuilder.getResponse(); // notice we send an empty response
    }
};
/* *
 * The intent reflector is used for interaction model testing and debugging.
 * It will simply repeat the intent the user said. You can create custom handlers for your intents 
 * by defining them above, then also adding them to the request handler chain below 
 * */
const IntentReflectorHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest';
    },
    handle(handlerInput) {
        const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
        const speakOutput = `You just triggered ${intentName}`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
            .getResponse();
    }
};
/**
 * Generic error handling to capture any syntax or routing errors. If you receive an error
 * stating the request handler chain is not found, you have not implemented a handler for
 * the intent being invoked or included it in the skill builder below 
 * */
const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        const speakOutput = 'Sorry, I had trouble doing what you asked. Please try again.';
        console.log(`~~~~ Error handled: ${JSON.stringify(error)}`);

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

/**
 * This handler acts as the entry point for your skill, routing all request and response
 * payloads to the handlers above. Make sure any new handlers or interceptors you've
 * defined are included below. The order matters - they're processed top to bottom 
 * */
exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        GetInfoRequestHandler,
        HelloWorldIntentHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        FallbackIntentHandler,
        SessionEndedRequestHandler,
        IntentReflectorHandler)
    .addErrorHandlers(
        ErrorHandler)
    .withCustomUserAgent('sample/hello-world/v1.2')
    .lambda();