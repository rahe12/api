const http = require('http');
const querystring = require('querystring');
const fs = require('fs');

// Constants for messages
const MESSAGES = {
    english: {
        WELCOME: "CON Welcome to the favorite  application.\nPlease select language / Hitamo ururimi\n1. English\n2. Kinyarwanda",
        INVALID: "END Invalid input. Dial again to restart.",
        INVALID_CHOICE: "END Invalid choice. Dial again to restart.",
        NO_DISHES: "END No more dishes. Dial again to restart.",
        BACK: "Go back",
        MORE: "More",
        CHOOSE: "Choose number:"
    },
    kinyarwanda: {
        WELCOME: "CON Welcome to the application.\nPlease select language / Hitamo ururimi\n1. English\n2. Kinyarwanda",
        INVALID: "END Uhisemo nabi. Kanda * ikindi gihe kugirango utangire.",
        INVALID_CHOICE: "END Uhisemo nabi. Kanda * ikindi gihe kugirango utangire.",
        NO_DISHES: "END Nta mafunguro asigaye. Kanda * ikindi gihe kugirango utangire.",
        BACK: "Subira inyuma",
        MORE: "Ibikurikira",
        CHOOSE: "Hitamo:"
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
            const parsedBody = querystring.parse(body);
            const text = (parsedBody.text || "").trim().replace(/[^0-9*]/g, ""); // Sanitize input
            const input = text.split("*");
            let response = "";

            console.log('Received text:', text);

            if (text === "") {
                response = MESSAGES.english.WELCOME;
            } else if (input[0] === "1") {
                response = handleFlow("english", input);
            } else if (input[0] === "2") {
                response = handleFlow("kinyarwanda", input);
            } else {
                response = MESSAGES.english.INVALID;
            }

            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(response);
        });
    } else {
        res.writeHead(200);
        res.end("USSD service running.");
    }
});

// Validate input
function validateInput(input, lang, level) {
    if (!input || input.length > 3) {
        return MESSAGES[lang].INVALID;
    }
    if (level >= 2 && isNaN(parseInt(input[level - 1]))) {
        return MESSAGES[lang].INVALID_CHOICE;
    }
    return null;
}

// Handle dish selection
function handleDishSelection(lang, input, page) {
    const allDishes = [...dishes[lang].healthy, ...dishes[lang].unhealthy];
    const choiceIndex = page * ITEMS_PER_PAGE + parseInt(input[2]) - 1;

    if (isNaN(choiceIndex) || !allDishes[choiceIndex]) {
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

    let menu = items.map((dish, i) => `${i + 1}. ${capitalize(dish)}`).join("\n");
    const hasMore = start + ITEMS_PER_PAGE < allDishes.length;
    const backOption = `0. ${MESSAGES[lang].BACK}`;

    menu = `${backOption}\n${menu}`;

    if (hasMore) {
        menu += `\n${ITEMS_PER_PAGE + 1}. ${MESSAGES[lang].MORE}`;
    }

    return `CON ${menu}\n\n${MESSAGES[lang].CHOOSE}`;
}

// Main flow handler
function handleFlow(lang, input) {
    const validationError = validateInput(input, lang, input.length);
    if (validationError) return validationError;

    const page = input.length > 1 ? parseInt(input[1]) - 1 : 0;

    if (input.length === 1) {
        return getMenu(lang, 0);
    }

    if (input.length === 2 && input[1] === "0") {
        return MESSAGES[lang].WELCOME;
    }

    if (input.length === 3 && input[2] === "0") {
        return getMenu(lang, page);
    }

    if (input.length === 2) {
        return getMenu(lang, page);
    }

    if (input.length === 3) {
        return handleDishSelection(lang, input, page);
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
