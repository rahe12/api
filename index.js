const http = require('http');
const querystring = require('querystring');

// Constants for messages
const MESSAGES = {
  english: {
    WELCOME: `CON Welcome to favourite food app, please choose language,
Murakaza neza kuri favourite food app, Hitamo ururimi,
1. English
2. Kinyarwanda`,
    FOOD_MENU: `CON Select the dish you like most
1. Chips and Chicken
2. Beef and green Plantain
3. Rice and beans
4. Cassava Bread and greens
5. Back`,
    RESULTS: {
      chips_and_chicken: `END Your favourite food is Chips and Chicken, that is so unhealthy, do not eat it regularly.`,
      beef_and_plantain: `END Your favourite food is Beef and green Plantain, that is healthy, as long as you eat it less than 5 times a week.`,
      rice_and_beans: `END Your favourite food is Rice and beans. That is healthy, as long as you drink a lot of water and eat some green vegetables.`,
      cassava_and_greens: `END Your favourite food is Cassava Bread and greens, that is healthy. Verify that there is not too much oil in the greens.`
    },
    INVALID: `END Invalid input. Please try again.`,
    ERROR: `END The system is under maintenance. Please try again later.`,
    BACK: `Back`
  },
  kinyarwanda: {
    WELCOME: `CON Murakaza neza kuri favourite food app, Hitamo ururimi,
1. English
2. Kinyarwanda`,
    FOOD_MENU: `CON Hitamo ibiryo Ukunda
1. Ifiriti n’Iinkoko
2. Agatogo
3. Umuceri n’ibishyimbo
4. Ubugari n’isombe
5. Gusubira inyuma`,
    RESULTS: {
      chips_and_chicken: `END Ibiryo ukunda ni ifiriti n’inkoko, Si byiza ku buzima ntukabirye buri kenshi.`,
      beef_and_plantain: `END Ibiryo ukunda ni agatogo ni byiza ku buzima iyo ubiriye utarengeje icuro 5 mu cyumweru.`,
      rice_and_beans: `END Ibiryo ukunda ni umuceri n’ibishyimbo. Ni byiza ku buzima mu gihe wanyweye amazi menshi ukarya n’imboga.`,
      cassava_and_greens: `END Ibiryo ukunda ni ubugari n’isombe ni byiza ku ubuzima, ugenzure neza niba isombe ritarimo amavuta menshi.`
    },
    INVALID: `END Injiza nabi. Ongera ugerageze.`,
    ERROR: `END Sisitemu iri mu bikorwa byo kuyisana. Ongera ugerageze nyuma.`,
    BACK: `Gusubira inyuma`
  }
};

// In-memory session storage
const sessions = {};

const server = http.createServer((req, res) => {
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        const parsedBody = querystring.parse(body);
        const text = (parsedBody.text || "").trim();
        const sessionId = parsedBody.sessionId || Date.now().toString();
        const phoneNumber = parsedBody.phoneNumber || 'unknown';
        const input = text.split("*").filter(segment => segment.match(/^[0-9]+$/));

        console.log('Received text:', text, 'Parsed input:', input, 'Session ID:', sessionId);

        let response = processUSSDFlow(input, sessionId, phoneNumber);

        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(response);
      } catch (error) {
        console.error('Unhandled system error:', error);
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(MESSAGES.english.ERROR);
      }
    });
  } else {
    res.writeHead(200);
    res.end("USSD Favourite Food App service running.");
  }
});

function processUSSDFlow(input, sessionId, phoneNumber) {
  // Initialize session if not exists
  if (!sessions[sessionId]) {
    sessions[sessionId] = {
      state: 'welcome',
      language: 'english',
      history: [],
      lastInputLevel: 0
    };
  }

  const session = sessions[sessionId];

  // Clean up old sessions (older than 30 minutes)
  const now = Date.now();
  for (const sid in sessions) {
    if (now - (sessions[sid].lastActivity || now) > 30 * 60 * 1000) {
      delete sessions[sid];
    }
  }
  session.lastActivity = now;

  // Level 1: Language selection
  if (input.length === 0 || (input[input.length - 1] === '5' && session.history.length === 0)) {
    console.log('Showing welcome screen');
    session.state = 'welcome';
    session.language = 'english';
    session.history = [];
    session.lastInputLevel = 0;
    return MESSAGES.english.WELCOME;
  }

  // Level 2: Language selection or back from food menu
  if (input.length === 1) {
    const choice = input[0];
    if (choice === '5' && session.history.length === 1) {
      console.log('Going back to welcome screen from food menu');
      session.history.pop();
      session.state = 'welcome';
      session.lastInputLevel = 1;
      return MESSAGES.english.WELCOME;
    }
    if (choice === '1') {
      session.language = 'english';
      session.state = 'food';
      session.history.push('language');
      session.lastInputLevel = 1;
      console.log('Language selected: English');
      return MESSAGES.english.FOOD_MENU;
    } else if (choice === '2') {
      session.language = 'kinyarwanda';
      session.state = 'food';
      session.history.push('language');
      session.lastInputLevel = 1;
      console.log('Language selected: Kinyarwanda');
      return MESSAGES.kinyarwanda.FOOD_MENU;
    } else {
      console.log('Invalid language selection:', choice);
      delete sessions[sessionId];
      return MESSAGES.english.INVALID;
    }
  }

  // Level 3: Food selection or back
  if (input.length === 2) {
    const lang = session.language;
    const prevChoice = input[0];
    const choice = input[1];

    // Handle back from language selection
    if (prevChoice === '5') {
      if (choice === '1') {
        session.language = 'english';
        session.state = 'food';
        session.history = ['language'];
        session.lastInputLevel = 2;
        console.log('Language selected after back: English');
        return MESSAGES.english.FOOD_MENU;
      } else if (choice === '2') {
        session.language = 'kinyarwanda';
        session.state = 'food';
        session.history = ['language'];
        session.lastInputLevel = 2;
        console.log('Language selected after back: Kinyarwanda');
        return MESSAGES.kinyarwanda.FOOD_MENU;
      } else {
        console.log('Invalid language selection after back:', choice);
        delete sessions[sessionId];
        return MESSAGES[lang].INVALID;
      }
    }

    // Handle food selection or back
    if (choice === '5') {
      console.log('Going back to welcome screen from food menu');
      session.state = 'welcome';
      session.history.pop();
      session.lastInputLevel = 2;
      return MESSAGES.english.WELCOME;
    }

    const foodChoices = {
      '1': 'chips_and_chicken',
      '2': 'beef_and_plantain',
      '3': 'rice_and_beans',
      '4': 'cassava_and_greens'
    };

    if (foodChoices[choice]) {
      console.log('Food selected:', foodChoices[choice]);
      const response = MESSAGES[lang].RESULTS[foodChoices[choice]];
      delete sessions[sessionId];
      return response;
    } else {
      console.log('Invalid food selection:', choice);
      delete sessions[sessionId];
      return MESSAGES[lang].INVALID;
    }
  }

  console.log('Invalid input length:', input.length);
  delete sessions[sessionId];
  return MESSAGES.english.INVALID;
}

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`✅ USSD Favourite Food App is running on port ${PORT}`);
});
