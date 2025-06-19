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
        console.log('Showing welcome screen');
        return MESSAGES.english.WELCOME;
    }

    // First level: Language selection
    if (input.length === 1) {
        const lang = input[0] === "1" ? "english" : input[0] === "2" ? "kinyarwanda" : null;
        if (!lang) {
            console.log('Invalid language selection:', input[0]);
            return MESSAGES.english.INVALID;
        }
        console.log('Language selected:', lang);
        return getMenu(lang, 0);
    }

    // Second level: Menu navigation
    if (input.length === 2) {
        const lang = input[0] === "1" ? "english" : "kinyarwanda";
        const choice = parseInt(input[1]);
        
        if (isNaN(choice)) {
            console.log('Invalid choice at level 2:', input[1]);
            return MESSAGES[lang].INVALID;
        }

        if (choice === 0) {
            console.log('Going back to welcome screen from first menu');
            return MESSAGES.english.WELCOME;
        }

        if (choice === 6) {
            console.log('Navigating to next page (page 1)');
            return getMenu(lang, 1);
        }

        console.log('Selecting dish from page 0, choice:', choice);
        return selectDish(lang, choice, 0);
    }

    // Third level: Handle navigation after back, pagination, or dish selection
    if (input.length === 3) {
        const lang = input[0] === "1" ? "english" : "kinyarwanda";
        const prevChoice = parseInt(input[1]);
        const currentChoice = parseInt(input[2]);

        if (isNaN(prevChoice) || isNaN(currentChoice)) {
            console.log('Invalid input at level 3:', input[1], input[2]);
            return MESSAGES[lang].INVALID;
        }

        // If previous choice was Back (0), treat currentChoice as a new language selection
        if (prevChoice === 0) {
            const newLang = currentChoice === 1 ? "english" : currentChoice === 2 ? "kinyarwanda" : null;
            if (!newLang) {
                console.log('Invalid language selection after back:', currentChoice);
                return MESSAGES.english.INVALID;
            }
            console.log('Language selected after back:', newLang);
            return getMenu(newLang, 0);
        }

        // Determine the page based on previous choice
        const page = prevChoice === 6 ? 1 : 0;

        // If previous choice was a dish selection (1–5), handle back
        if ((prevChoice >= 1 && prevChoice <= 5) && currentChoice === 0) {
            console.log('Going back to menu page', page, 'after dish selection');
            return getMenu(lang, page);
        }

        if (currentChoice === 0) {
            if (page === 1) {
                console.log('Going back to first menu page (page 0)');
                return getMenu(lang, 0);
            } else {
                console.log('Going back to welcome screen from page 0');
                return MESSAGES.english.WELCOME;
            }
        }

        if (currentChoice === 6) {
            console.log('Navigating to next page (page', page + 1, ')');
            return getMenu(lang, page + 1);
        }

        console.log('Selecting dish from page', page, 'choice:', currentChoice);
        return selectDish(lang, currentChoice, page);
    }

    // Fourth level: Handle navigation after back to welcome screen or dish selection
    if (input.length === 4) {
        const firstInput = input[0];
        const secondInput = parseInt(input[1]);
        const thirdInput = parseInt(input[2]);
        const fourthInput = parseInt(input[3]);

        if (isNaN(secondInput) || isNaN(thirdInput) || isNaN(fourthInput)) {
            console.log('Invalid input at level 4:', input[1], input[2], input[3]);
            return MESSAGES.english.INVALID;
        }

        // If second input was Back (0), treat third and fourth inputs as a new sequence (lang, choice)
        if (secondInput === 0) {
            const lang = thirdInput === 1 ? "english" : thirdInput === 2 ? "kinyarwanda" : null;
            if (!lang) {
                console.log('Invalid language selection at level 4:', thirdInput);
                return MESSAGES.english.INVALID;
            }

            if (fourthInput === 0) {
                console.log('Going back to welcome screen from first menu after back');
                return MESSAGES.english.WELCOME;
            }

            if (fourthInput === 6) {
                console.log('Navigating to next page (page 1) after back');
                return getMenu(lang, 1);
            }

            // Handle back after dish selection
            if ((fourthInput >= 1 && fourthInput <= 5) && fourthInput === 0) {
                console.log('Going back to menu page 0 after dish selection at level 4');
                return getMenu(lang, 0);
            }

            console.log('Selecting dish from page 0, choice:', fourthInput, 'after back');
            return selectDish(lang, fourthInput, 0);
        }

        // If third input was a dish selection, handle back
        const lang = firstInput === "1" ? "english" : "kinyarwanda";
        const page = secondInput === 6 ? 1 : 0;

        if ((thirdInput >= 1 && thirdInput <= 5) && fourthInput === 0) {
            console.log('Going back to menu page', page, 'after dish selection at level 4');
            return getMenu(lang, page);
        }

        console.log('Invalid sequence at level 4:', input);
        return MESSAGES[lang].INVALID;
    }

    console.log('Invalid input length:', input.length);
    return MESSAGES.english.INVALID;
}

function getMenu(lang, page) {
    const allDishes = [...dishes[lang].healthy, ...dishes[lang].unhealthy];
    if (allDishes.length === 0) {
        console.log('No dishes available for language:', lang);
        return MESSAGES[lang].NO_DISHES;
    }

    const start = page * ITEMS_PER_PAGE;
    const items = allDishes.slice(start, start + ITEMS_PER_PAGE);
    
    if (items.length === 0) {
        console.log('No more dishes on page:', page);
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
    console.log('Displaying menu for', lang, 'page:', page, '\n', menu);
    return `CON ${menu}\n\n${MESSAGES[lang].CHOOSE}`;
}

function selectDish(lang, choice, page) {
    console.log('selectDish called with lang:', lang, 'choice:', choice, 'page:', page);
    
    const allDishes = [...dishes[lang].healthy, ...dishes[lang].unhealthy];
    const start = page * ITEMS_PER_PAGE;
    const items = allDishes.slice(start, start + ITEMS_PER_PAGE);
    const dishIndex = start + choice - 1;

    console.log('All dishes:', allDishes, 'Start index:', start, 'Items on page:', items, 'Dish index:', dishIndex);

    if (choice < 1 || choice > items.length || !allDishes[dishIndex]) {
        console.log('Invalid dish choice:', choice, 'on page:', page, 'items length:', items.length);
        return MESSAGES[lang].INVALID_CHOICE;
    }
    
    const chosen = allDishes[dishIndex];
    const isHealthy = dishes[lang].healthy.includes(chosen);
    
    const response = `CON ${capitalize(chosen)} ${lang === "english" ? 
        (isHealthy ? "is a healthy dish" : "is not a healthy dish") : 
        (isHealthy ? "ni ifunguro ryiza ku buzima" : "si ifunguro ryiza ku buzima")}.\n0. ${MESSAGES[lang].BACK}\n\n${MESSAGES[lang].CHOOSE}`;
    
    console.log('Dish selected:', chosen, 'Healthy:', isHealthy, 'Response:', response);
    return response;
}

function capitalize(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
}

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`✅ USSD Dishes app is running on port ${PORT}`);
});
