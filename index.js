const http = require('http');
const querystring = require('querystring');

// Constants for messages
const MESSAGES = {
  english: {
    WELCOME: `CON Welcome to favourite food app, please choose language
Murakaza neza kuri favourite food app, Hitamo ururimi
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
    ERROR: `END The system is under maintenance. Please try again later.`
  },
  kinyarwanda: {
    WELCOME: `CON Murakaza neza kuri favourite food app, Hitamo ururimi
1. English
2. Kinyarwanda`,
    FOOD_MENU: `CON Hitamo ibiryo ukunda
1. Ifiriti n'Inkoko
2. Agatogo
3. Umuceri n'ibishyimbo
4. Ubugari n'isombe
5. Gusubira inyuma`,
    RESULTS: {
      chips_and_chicken: `END Ibiryo ukunda ni ifiriti n'inkoko, Si byiza ku buzima ntukabirye buri kenshi.`,
      beef_and_plantain: `END Ibiryo ukunda ni agatogo ni byiza ku buzima iyo ubiriye utarengeje icuro 5 mu cyumweru.`,
      rice_and_beans: `END Ibiryo ukunda ni umuceri n'ibishyimbo. Ni byiza ku buzima mu gihe wanyweye amazi menshi ukarya n'imboga.`,
      cassava_and_greens: `END Ibiryo ukunda ni ubugari n'isombe ni byiza ku ubuzima, ugenzure neza niba isombe ritarimo amavuta menshi.`
    },
    INVALID: `END Injiza nabi. Ongera ugerageze.`,
    ERROR: `END Sisitemu iri mu bikorwa byo kuyisana. Ongera ugerageze nyuma.`
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

        console.log('Received text:', text, 'Session ID:', sessionId);

        let response = processUSSDFlow(text, sessionId, phoneNumber);

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

function processUSSDFlow(text, sessionId, phoneNumber) {
  // Clean up old sessions (older than 30 minutes)
  const now = Date.now();
  for (const sid in sessions) {
    if (sessions[sid] && now - (sessions[sid].lastActivity || now) > 30 * 60 * 1000) {
      delete sessions[sid];
    }
  }

  // Initialize session if not exists or if text is empty (new session)
  if (!sessions[sessionId] || text === '') {
    sessions[sessionId] = {
      state: 'welcome',
      language: null,
      lastActivity: now
    };
    console.log('New session initialized');
    return MESSAGES.english.WELCOME;
  }

  const session = sessions[sessionId];
  session.lastActivity = now;

  // Parse the input - split by * and get the last choice
  const inputs = text ? text.split('*') : [];
  const currentInput = inputs[inputs.length - 1];
  const level = inputs.length;

  console.log('Input array:', inputs, 'Current input:', currentInput, 'Level:', level);

  // Level 1: Language selection (first input)
  if (level === 1) {
    if (currentInput === '1') {
      session.language = 'english';
      session.state = 'food_menu';
      console.log('Language selected: English');
      return MESSAGES.english.FOOD_MENU;
    } else if (currentInput === '2') {
      session.language = 'kinyarwanda';
      session.state = 'food_menu';
      console.log('Language selected: Kinyarwanda');
      return MESSAGES.kinyarwanda.FOOD_MENU;
    } else {
      console.log('Invalid language selection:', currentInput);
      delete sessions[sessionId];
      return MESSAGES.english.INVALID;
    }
  }

  // Level 2: Food selection or back to language selection
  if (level === 2) {
    const lang = session.language || 'english';
    
    // Handle back to language selection
    if (currentInput === '5') {
      console.log('Going back to language selection');
      session.state = 'welcome';
      session.language = null;
      return MESSAGES.english.WELCOME;
    }

    // Handle food selection
    const foodChoices = {
      '1': 'chips_and_chicken',
      '2': 'beef_and_plantain', 
      '3': 'rice_and_beans',
      '4': 'cassava_and_greens'
    };

    if (foodChoices[currentInput]) {
      console.log('Food selected:', foodChoices[currentInput], 'Language:', lang);
      const response = MESSAGES[lang].RESULTS[foodChoices[currentInput]];
      delete sessions[sessionId]; // End session
      return response;
    } else {
      console.log('Invalid food selection:', currentInput);
      delete sessions[sessionId];
      return MESSAGES[lang].INVALID;
    }
  }

  // Level 3+: Handle navigation after going back
  if (level === 3) {
    const previousInput = inputs[inputs.length - 2];
    
    // If previous input was '5' (back), we're now selecting language again
    if (previousInput === '5') {
      if (currentInput === '1') {
        session.language = 'english';
        session.state = 'food_menu';
        console.log('Language selected after back: English');
        return MESSAGES.english.FOOD_MENU;
      } else if (currentInput === '2') {
        session.language = 'kinyarwanda';
        session.state = 'food_menu';
        console.log('Language selected after back: Kinyarwanda');
        return MESSAGES.kinyarwanda.FOOD_MENU;
      } else {
        console.log('Invalid language selection after back:', currentInput);
        delete sessions[sessionId];
        return MESSAGES.english.INVALID;
      }
    }
  }

  // Level 4: Handle food selection after going back and selecting language again
  if (level === 4) {
    const lang = session.language || 'english';
    
    // Handle back to language selection
    if (currentInput === '5') {
      console.log('Going back to language selection from level 4');
      session.state = 'welcome';
      session.language = null;
      return MESSAGES.english.WELCOME;
    }

    // Handle food selection
    const foodChoices = {
      '1': 'chips_and_chicken',
      '2': 'beef_and_plantain',
      '3': 'rice_and_beans', 
      '4': 'cassava_and_greens'
    };

    if (foodChoices[currentInput]) {
      console.log('Food selected at level 4:', foodChoices[currentInput], 'Language:', lang);
      const response = MESSAGES[lang].RESULTS[foodChoices[currentInput]];
      delete sessions[sessionId]; // End session
      return response;
    } else {
      console.log('Invalid food selection at level 4:', currentInput);
      delete sessions[sessionId];
      return MESSAGES[lang].INVALID;
    }
  }

  // If we reach here, something went wrong
  console.log('Unexpected flow state. Level:', level, 'Inputs:', inputs);
  delete sessions[sessionId];
  return MESSAGES.english.INVALID;
}

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`✅ USSD Favourite Food App is running on port ${PORT}`);
});
