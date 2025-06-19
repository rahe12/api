const http = require('http');
const querystring = require('querystring');
const fs = require('fs');

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

const server = http.createServer((req, res) => {
    if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const parsedBody = querystring.parse(body);
                const text = (parsedBody.text || "").trim().replace(/[^0-9*]/g, "");
                const input = text.split("*").filter(segment => segment !== "");
                
                console.log('Received text:', text, 'Parsed input:', input);
                
                let response = processUSSDFlow(input);
                
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

function processUSSDFlow(input) {
    // Empty input - show welcome screen
    if (input.length === 0) {
        return MESSAGES.english.WELCOME;
    }
    
    // Simple flow logic
    if (input.length === 1) {
        // Language selection
        if (input[0] === "1") {
            return getMenu("english", 0);
        } else if (input[0] === "2") {
            return getMenu("kinyarwanda", 0);
        } else {
            return MESSAGES.english.INVALID;
        }
    }
    
    if (input.length === 2) {
        const lang = input[0] === "1" ? "english" : "kinyarwanda";
        const choice = input[1];
        
        if (choice === "0") {
            // Go back to language selection
            return MESSAGES.english.WELCOME;
        }
        
        if (choice === "6") { // More option
            return getMenu(lang, 1);
        }
        
        // Select dish from first page
        return selectDish(lang, parseInt(choice), 0);
    }
    
    if (input.length === 3) {
        const lang = input[0] === "1" ? "english" : "kinyarwanda";
        const prevChoice = input[1];
        const currentChoice = input[2];
        
        if (currentChoice === "0") {
            // Go back
            if (prevChoice === "6") {
                return getMenu(lang, 0); // Back to first page
            } else {
                return MESSAGES.english.WELCOME; // Back to language
            }
        }
        
        // Determine which page we're on
        let page = 0;
        if (prevChoice === "6") {
            page = 1;
        }
        
        if (currentChoice === "6") {
            return getMenu(lang, page + 1);
        }
        
        return selectDish(lang, parseInt(currentChoice), page);
    }
    
    return MESSAGES.english.INVALID;
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

function selectDish(lang, choice, page) {
    const allDishes = [...dishes[lang].healthy, ...dishes[lang].unhealthy];
    const dishIndex = page * ITEMS_PER_PAGE + choice - 1;
    
    if (choice < 1 || choice > 5 || !allDishes[dishIndex]) {
        return MESSAGES[lang].INVALID_CHOICE;
    }
    
    const chosen = allDishes[dishIndex];
    const isHealthy = dishes[lang].healthy.includes(chosen);
    
    return lang === "english"
        ? `END ${capitalize(chosen)} is ${isHealthy ? "a healthy dish" : "not a healthy dish"}.\n\nDial again to restart.`
        : `END ${capitalize(chosen)} ${isHealthy ? "ni ifunguro ryiza ku buzima" : "si ifunguro ryiza ku buzima"}.\n\nKanda * ikindi gihe kugirango utangire.`;
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`✅ USSD Dishes app is running on port ${PORT}`);
});
