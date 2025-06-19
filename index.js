const http = require('http');
const querystring = require('querystring');
const fs = require('fs');

// Constants for messages
const MESSAGES = {
    english: {
        WELCOME: "CON Welcome to the favorite application.\nPlease select language / Hitamo ururimi\n1. English\n2. Kinyarwanda",
        INVALID: "END Invalid input. Dial again to restart.",
        INVALID_CHOICE: "END Invalid choice. Dial again to restart.",
        NO_DISHES: "END No dishes available. Dial again to restart.",
        BACK: "Go back",
        MORE: "More",
        CHOOSE: "Choose a number:",
        ERROR: "END The system is under maintenance. Please try again later."
    },
    kinyarwanda: {
        WELCOME: "CON Murakaza neza kuri application.\nPlease select language / Hitamo ururimi\n1. English\n2. Kinyarwanda",
        INVALID: "END Injiza nabi. Kanda * ukongere utangire.",
        INVALID_CHOICE: "END Guhitamo nabi. Kanda * ukongere utangire.",
        NO_DISHES: "END Nta bifungurwa birahari. Kanda * ukongere utangire.",
        BACK: "Subira inyuma",
        MORE: "Ibikurikira",
        CHOOSE: "Hitamo nimero:",
        ERROR: "END Sisitemu iri mu bikorwa byo kuyisana. Ongera ugerageze nyuma."
    }
};

// Load dish list with error handling
let dishes;
try {
    dishes = JSON.parse(fs.readFileSync('./dishesList.json', 'utf8'));
    // Validate dish structure
    if (!dishes.english || !dishes.kinyarwanda || !dishes.english.healthy || !dishes.english.unhealthy ||
        !dishes.kinyarwanda.healthy || !dishes.kinyarwanda.unhealthy) {
        throw new Error('Invalid dishesList.json structure');
    }
} catch (err) {
    console.error('Error reading or validating dishesList.json:', err);
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
                const text = (parsedBody.text || "").trim();
                const input = text.split("*").filter(segment => segment.match(/^[0-9]+$/));
                
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
    
    // Validate first input (language selection)
    if (input.length >= 1) {
        const lang = input[0] === "1" ? "english" : input[0] === "2" ? "kinyarwanda" : null;
        if (!lang) {
            return MESSAGES.english.INVALID;
        }
        
        // Check if dishes are available
        const allDishes = [...dishes[lang].healthy, ...dishes[lang].unhealthy];
        if (allDishes.length === 0) {
            return MESSAGES[lang].NO_DISHES;
        }
        
        // Language selected, show first menu page
        if (input.length === 1) {
            return getMenu(lang, 0);
        }
        
        // Menu navigation
        if (input.length === 2) {
            const choice = parseInt(input[1]);
            if (isNaN(choice)) {
                return MESSAGES[lang].INVALID;
            }
            
            if (choice === 0) {
                return MESSAGES.english.WELCOME; // Back to language selection
            }
            
            if (choice === 6) {
                return getMenu(lang, 1); // Next page
            }
            
            return selectDish(lang, choice, 0);
        }
        
        // Deeper navigation (e.g., after selecting "More")
        if (input.length === 3) {
            const prevChoice = parseInt(input[1]);
            const currentChoice = parseInt(input[2]);
            
            if (isNaN(prevChoice) || isNaN(currentChoice)) {
                return MESSAGES[lang].INVALID;
            }
            
            let page = prevChoice === 6 ? 1 : 0;
            
            if (currentChoice === 0) {
                // Back navigation
                if (prevChoice === 6) {
                    return getMenu(lang, 0); // Back to first page
                }
                return MESSAGES.english.WELCOME; // Back to language selection
            }
            
            if (currentChoice === 6) {
                return getMenu(lang, page + 1); // Next page
            }
            
            return selectDish(lang, currentChoice, page);
        }
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
    
    let menuItems = [`0. ${MESSAGES[lang].BACK}`];
    
    items.forEach((dish, i) => {
        menuItems.push(`${i + 1}. ${capitalize(dish)}`);
    });
    
    const hasMore = start + ITEMS_PER_PAGE < allDishes.length;
    if (hasMore) {
        menuItems.push(`6. ${MESSAGES[lang].MORE}`);
    }
    
    const menu = menuItems.join("\n");
    return `CON ${menu}\n\n${MESSAGES[lang].CHOOSE}`;
}

function selectDish(lang, choice, page) {
    const allDishes = [...dishes[lang].healthy, ...dishes[lang].unhealthy];
    const start = page * ITEMS_PER_PAGE;
    const items = allDishes.slice(start, start + ITEMS_PER_PAGE);
    const dishIndex = start + choice - 1;
    
    if (choice < 1 || choice > items.length || !allDishes[dishIndex]) {
        return MESSAGES[lang].INVALID_CHOICE;
    }
    
    const chosen = allDishes[dishIndex];
    const isHealthy = dishes[lang].healthy.includes(chosen);
    
    return `END ${capitalize(chosen)} ${lang === "english" ? 
        (isHealthy ? "is a healthy dish" : "is not a healthy dish") : 
        (isHealthy ? "ni ifunguro ryiza ku buzima" : "si ifunguro ryiza ku buzima")}.\n\n${MESSAGES[lang].INVALID.split("END ")[1]}`;
}

function capitalize(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
}

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`✅ USSD Dishes app is running on port ${PORT}`);
});
