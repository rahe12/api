const http = require('http');
const querystring = require('querystring');
const fs = require('fs');

// In-memory session store (use Redis or database in production)
const sessions = new Map();

// Session timeout (30 minutes)
const SESSION_TIMEOUT = 30 * 60 * 1000;

// Constants for messages
const MESSAGES = {
    english: {
        WELCOME: "CON Welcome to the favorite application.\nPlease select language / Hitamo ururimi\n1. English\n2. Kinyarwanda",
        INVALID: "END Invalid input. Dial again to restart.",
        INVALID_CHOICE: "END Invalid choice. Dial again to restart.",
        NO_DISHES: "END No more dishes. Dial again to restart.",
        BACK: "Go back",
        MORE: "More",
        CHOOSE: "Choose number:",
        ERROR: "END The system is under maintenance. Please try again later."
    },
    kinyarwanda: {
        WELCOME: "CON Welcome to the application.\nPlease select language / Hitamo ururimi\n1. English\n2. Kinyarwanda",
        INVALID: "END Uhisemo nabi. Kanda * ikindi gihe kugirango utangire.",
        INVALID_CHOICE: "END Uhisemo nabi. Kanda * ikindi gihe kugirango utangire.",
        NO_DISHES: "END Nta mafunguro asigaye. Kanda * ikindi gihe kugirango utangire.",
        BACK: "Subira inyuma",
        MORE: "Ibikurikira",
        CHOOSE: "Hitamo:",
        ERROR: "END Sisitemu iri mu bikorwa byo kuyisana. Ongera ugerageze nyuma gato."
    }
};

// Load dish list with error handling
let dishes;
try {
    dishes = JSON.parse(fs.readFileSync('./dishesList.json', 'utf8'));
} catch (err) {
    console.error('Error reading dishesList.json:', err);
    dishes = { 
        english: { healthy: [], unhealthy: [] }, 
        kinyarwanda: { healthy: [], unhealthy: [] } 
    };
}

const ITEMS_PER_PAGE = 5;

// Clean up expired sessions every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [sessionId, session] of sessions.entries()) {
        if (now - session.lastActivity > SESSION_TIMEOUT) {
            sessions.delete(sessionId);
            console.log(`Session ${sessionId} expired and removed`);
        }
    }
}, 5 * 60 * 1000);

const server = http.createServer((req, res) => {
    if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const parsedBody = querystring.parse(body);
                const sessionId = parsedBody.sessionId || parsedBody.phoneNumber || 'default';
                const text = (parsedBody.text || "").trim();
                
                console.log(`Session: ${sessionId}, Input: "${text}"`);
                
                let response = processUSSDRequest(sessionId, text);
                
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
        res.end("USSD service running.");
    }
});

function processUSSDRequest(sessionId, text) {
    // Get or create session
    let session = getSession(sessionId);
    
    // Parse current input
    const input = text.trim();
    
    // Handle empty input (new session)
    if (input === "") {
        resetSession(session);
        return MESSAGES.english.WELCOME;
    }
    
    // Update session activity
    session.lastActivity = Date.now();
    
    // Process based on current state
    switch (session.state) {
        case 'LANGUAGE_SELECTION':
            return handleLanguageSelection(session, input);
        case 'DISH_MENU':
            return handleDishMenu(session, input);
        default:
            resetSession(session);
            return MESSAGES.english.WELCOME;
    }
}

function getSession(sessionId) {
    if (!sessions.has(sessionId)) {
        sessions.set(sessionId, createNewSession());
    }
    return sessions.get(sessionId);
}

function createNewSession() {
    return {
        state: 'LANGUAGE_SELECTION',
        language: null,
        page: 0,
        lastActivity: Date.now()
    };
}

function resetSession(session) {
    session.state = 'LANGUAGE_SELECTION';
    session.language = null;
    session.page = 0;
    session.lastActivity = Date.now();
}

function handleLanguageSelection(session, input) {
    if (input === "1") {
        session.language = "english";
        session.state = 'DISH_MENU';
        session.page = 0;
        return getMenu(session.language, session.page);
    } else if (input === "2") {
        session.language = "kinyarwanda";
        session.state = 'DISH_MENU';
        session.page = 0;
        return getMenu(session.language, session.page);
    } else {
        return MESSAGES.english.INVALID;
    }
}

function handleDishMenu(session, input) {
    const choice = parseInt(input);
    
    if (input === "0") {
        // Go back to language selection
        resetSession(session);
        return MESSAGES.english.WELCOME;
    }
    
    // Check if it's the "More" option
    if (choice === 6) {
        const allDishes = [...dishes[session.language].healthy, ...dishes[session.language].unhealthy];
        const nextPageStart = (session.page + 1) * ITEMS_PER_PAGE;
        
        if (nextPageStart < allDishes.length) {
            session.page++;
            return getMenu(session.language, session.page);
        } else {
            return MESSAGES[session.language].NO_DISHES;
        }
    }
    
    // Check if it's a valid dish selection (1-5)
    if (choice >= 1 && choice <= 5) {
        return selectDish(session, choice);
    }
    
    return MESSAGES[session.language].INVALID_CHOICE;
}

function getMenu(lang, page) {
    const allDishes = [...dishes[lang].healthy, ...dishes[lang].unhealthy];
    const start = page * ITEMS_PER_PAGE;
    const items = allDishes.slice(start, start + ITEMS_PER_PAGE);
    
    if (items.length === 0) {
        return MESSAGES[lang].NO_DISHES;
    }
    
    let menuItems = [];
    
    // Add back option
    menuItems.push(`0. ${MESSAGES[lang].BACK}`);
    
    // Add dish items
    items.forEach((dish, i) => {
        menuItems.push(`${i + 1}. ${capitalize(dish)}`);
    });
    
    // Add more option if there are more items
    const hasMore = start + ITEMS_PER_PAGE < allDishes.length;
    if (hasMore) {
        menuItems.push(`6. ${MESSAGES[lang].MORE}`);
    }
    
    const menu = menuItems.join("\n");
    return `CON ${menu}\n\n${MESSAGES[lang].CHOOSE}`;
}

function selectDish(session, choice) {
    const allDishes = [...dishes[session.language].healthy, ...dishes[session.language].unhealthy];
    const dishIndex = session.page * ITEMS_PER_PAGE + choice - 1;
    
    if (!allDishes[dishIndex]) {
        return MESSAGES[session.language].INVALID_CHOICE;
    }
    
    const chosen = allDishes[dishIndex];
    const isHealthy = dishes[session.language].healthy.includes(chosen);
    
    // End session after selection
    sessions.delete(session.sessionId);
    
    return session.language === "english"
        ? `END ${capitalize(chosen)} is ${isHealthy ? "a healthy dish" : "not a healthy dish"}.\n\nDial again to restart.`
        : `END ${capitalize(chosen)} ${isHealthy ? "ni ifunguro ryiza ku buzima" : "si ifunguro ryiza ku buzima"}.\n\nKanda * ikindi gihe kugirango utangire.`;
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`✅ USSD Dishes app with sessions is running on port ${PORT}`);
    console.log(`✅ Session cleanup runs every 5 minutes`);
});
