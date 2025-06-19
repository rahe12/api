const http = require('http');
const querystring = require('querystring');
const fs = require('fs');

// Constants for messages
const MESSAGES = {
    english: {const http = require('http');
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
    dishes = { english: { healthy: [], unhealthy: [] }, kinyarwanda: { healthy: [], unhealthy: [] } };
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
    
    // Parse the flow state
    const state = parseFlowState(input);
    
    switch (state.stage) {
        case 'LANGUAGE_SELECTION':
            return handleLanguageSelection(state);
        case 'DISH_MENU':
            return handleDishMenu(state);
        case 'DISH_SELECTION':
            return handleDishSelection(state);
        default:
            return MESSAGES.english.INVALID;
    }
}

function parseFlowState(input) {
    const state = {
        stage: 'LANGUAGE_SELECTION',
        language: null,
        page: 0,
        lastChoice: null,
        isBackNavigation: false
    };
    
    if (input.length === 0) {
        return state;
    }
    
    // Check for back navigation pattern
    let effectiveInput = [...input];
    let backIndex = -1;
    
    // Find the last occurrence of "0" which indicates back navigation
    for (let i = input.length - 1; i >= 0; i--) {
        if (input[i] === "0") {
            backIndex = i;
            break;
        }
    }
    
    // If back navigation found, reset to the state before the back
    if (backIndex !== -1) {
        state.isBackNavigation = true;
        effectiveInput = input.slice(0, backIndex);
        
        // If back was pressed after language selection, return to language selection
        if (effectiveInput.length === 1) {
            state.stage = 'LANGUAGE_SELECTION';
            return state;
        }
    }
    
    // If we have input after handling back navigation
    if (effectiveInput.length > 0) {
        const langChoice = effectiveInput[0];
        if (langChoice === "1") {
            state.language = "english";
        } else if (langChoice === "2") {
            state.language = "kinyarwanda";
        } else {
            state.stage = 'INVALID';
            return state;
        }
        
        // After back navigation, if there's a new choice, it's a new language selection
        if (state.isBackNavigation && input.length > effectiveInput.length + 1) {
            const newChoice = input[input.length - 1];
            if (newChoice === "1") {
                state.language = "english";
                state.stage = 'DISH_MENU';
                state.page = 0;
            } else if (newChoice === "2") {
                state.language = "kinyarwanda";
                state.stage = 'DISH_MENU';
                state.page = 0;
            } else {
                state.stage = 'INVALID';
            }
            return state;
        }
        
        if (effectiveInput.length === 1) {
            state.stage = 'DISH_MENU';
            state.page = 0;
        } else if (effectiveInput.length >= 2) {
            const choice = effectiveInput[effectiveInput.length - 1];
            
            // Check if it's a "More" selection (pagination)
            if (choice === `${ITEMS_PER_PAGE + 1}`) {
                state.stage = 'DISH_MENU';
                state.page = Math.floor((effectiveInput.length - 2) / 2) + 1;
            } else {
                state.stage = 'DISH_SELECTION';
                state.page = Math.floor((effectiveInput.length - 2) / 2);
                state.lastChoice = parseInt(choice);
            }
        }
    }
    
    return state;
}

function handleLanguageSelection(state) {
    return MESSAGES.english.WELCOME;
}

function handleDishMenu(state) {
    if (!state.language) {
        return MESSAGES.english.INVALID;
    }
    
    return getMenu(state.language, state.page);
}

function handleDishSelection(state) {
    if (!state.language || !state.lastChoice) {
        return MESSAGES[state.language || 'english'].INVALID_CHOICE;
    }
    
    const allDishes = [...dishes[state.language].healthy, ...dishes[state.language].unhealthy];
    const choiceIndex = state.page * ITEMS_PER_PAGE + state.lastChoice - 1;
    
    if (state.lastChoice < 1 || state.lastChoice > ITEMS_PER_PAGE || !allDishes[choiceIndex]) {
        return MESSAGES[state.language].INVALID_CHOICE;
    }
    
    const chosen = allDishes[choiceIndex];
    const isHealthy = dishes[state.language].healthy.includes(chosen);
    
    return state.language === "english"
        ? `END ${capitalize(chosen)} is ${isHealthy ? "a healthy dish" : "not a healthy dish"}.\n\nDial again to restart.`
        : `END ${capitalize(chosen)} ${isHealthy ? "ni ifunguro ryiza ku buzima" : "si ifunguro ryiza ku buzima"}.\n\nKanda * ikindi gihe kugirango utangire.`;
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
        menuItems.push(`${ITEMS_PER_PAGE + 1}. ${MESSAGES[lang].MORE}`);
    }
    
    const menu = menuItems.join("\n");
    return `CON ${menu}\n\n${MESSAGES[lang].CHOOSE}`;
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`✅ USSD Dishes app is running on port ${PORT}`);
});
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
    dishes = { english: { healthy: [], unhealthy: [] }, kinyarwanda: { healthy: [], unhealthy: [] } };
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
                let response = "";

                console.log('Received text:', text, 'Parsed input:', input);

                // Reset if empty
                if (text === "") {
                    response = MESSAGES.english.WELCOME;
                } 
                // Check if user has navigated back to language selection
                else if (hasReturnedToLanguageSelection(input)) {
                    // Get the last input (the new language selection)
                    const lastChoice = input[input.length - 1];
                    if (lastChoice === "1") {
                        response = handleFlow("english", ["1"]);
                    } else if (lastChoice === "2") {
                        response = handleFlow("kinyarwanda", ["2"]);
                    } else {
                        response = MESSAGES.english.INVALID;
                    }
                }
                // Normal flow processing
                else if (input[0] === "1") {
                    response = handleFlow("english", input);
                } else if (input[0] === "2") {
                    response = handleFlow("kinyarwanda", input);
                } else {
                    response = MESSAGES.english.INVALID;
                }

                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end(response);
            } catch (error) {
                console.error('Unhandled system error:', error);
                const fallbackResponse = MESSAGES.english.ERROR;
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end(fallbackResponse);
            }
        });
    } else {
        res.writeHead(200);
        res.end("USSD service running.");
    }
});

// Check if user has returned to language selection after going back
function hasReturnedToLanguageSelection(input) {
    if (input.length < 3) return false;
    
    // Look for pattern: [lang, "0", new_lang_choice]
    // This indicates user went back to language selection and made a new choice
    for (let i = 1; i < input.length - 1; i++) {
        if (input[i] === "0" && (input[i + 1] === "1" || input[i + 1] === "2")) {
            return true;
        }
    }
    return false;
}

// Validate input
function validateInput(input, lang, level) {
    if (!input || level < 1 || level > 3) {
        return MESSAGES[lang].INVALID;
    }
    if (level >= 2 && input[level - 1] !== "0" && isNaN(parseInt(input[level - 1]))) {
        return MESSAGES[lang].INVALID_CHOICE;
    }
    return null;
}

// Handle dish selection
function handleDishSelection(lang, input, page) {
    const allDishes = [...dishes[lang].healthy, ...dishes[lang].unhealthy];
    const dishChoice = parseInt(input[input.length - 1]); // Get the last choice (dish number)
    const choiceIndex = page * ITEMS_PER_PAGE + dishChoice - 1;

    if (isNaN(dishChoice) || dishChoice < 1 || dishChoice > ITEMS_PER_PAGE || !allDishes[choiceIndex]) {
        return MESSAGES[lang].INVALID_CHOICE;
    }

    const chosen = allDishes[choiceIndex];
    const isHealthy = dishes[lang].healthy.includes(chosen);
    
    return lang === "english"
        ? `END ${capitalize(chosen)} is ${isHealthy ? "a healthy dish" : "not a healthy dish"}.\n\nDial again to restart.`
        : `END ${capitalize(chosen)} ${isHealthy ? "ni ifunguro ryiza ku buzima" : "si ifunguro ryiza ku buzima"}.\n\nKanda * ikindi gihe kugirango utangire.`;
}

// Generate menu
function getMenu(lang, page) {
    const allDishes = [...dishes[lang].healthy, ...dishes[lang].unhealthy];
    const start = page * ITEMS_PER_PAGE;
    const items = allDishes.slice(start, start + ITEMS_PER_PAGE);

    if (items.length === 0) {
        return MESSAGES[lang].NO_DISHES;
    }

    // Build menu items
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
        menuItems.push(`${ITEMS_PER_PAGE + 1}. ${MESSAGES[lang].MORE}`);
    }

    // Join all menu items and add the choose prompt
    const menu = menuItems.join("\n");
    return `CON ${menu}\n\n${MESSAGES[lang].CHOOSE}`;
}

// Main flow handler
function handleFlow(lang, input) {
    const validationError = validateInput(input, lang, input.length);
    if (validationError) return validationError;

    // Step 1: Language selected, show first page of dishes
    if (input.length === 1) {
        return getMenu(lang, 0);
    }

    // Step 2: User made a choice from the dish menu
    if (input.length === 2) {
        const choice = input[1];
        
        if (choice === "0") {
            // Go back to language selection
            return MESSAGES[lang].WELCOME;
        }
        
        if (choice === `${ITEMS_PER_PAGE + 1}`) {
            // Show next page
            return getMenu(lang, 1);
        }
        
        // User selected a dish from page 0
        return handleDishSelection(lang, input, 0);
    }

    // Step 3: User navigating through pages or making final selection
    if (input.length === 3) {
        const pageChoice = input[1];
        const finalChoice = input[2];
        
        // Calculate current page based on navigation
        let currentPage = 0;
        if (pageChoice === `${ITEMS_PER_PAGE + 1}`) {
            currentPage = 1;
        }
        
        if (finalChoice === "0") {
            // Go back to previous page/menu
            if (currentPage > 0) {
                return getMenu(lang, currentPage - 1);
            } else {
                return getMenu(lang, 0);
            }
        }
        
        if (finalChoice === `${ITEMS_PER_PAGE + 1}`) {
            // Show next page
            return getMenu(lang, currentPage + 1);
        }
        
        // User selected a dish
        return handleDishSelection(lang, input, currentPage);
    }

    return MESSAGES[lang].INVALID;
}

// Capitalize string
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`✅ USSD Dishes app is running on port ${PORT}`);
});
