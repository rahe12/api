const http = require('http');
const querystring = require('querystring');
const fs = require('fs');

// Load dish list
const dishes = JSON.parse(fs.readFileSync('./dishesList.json', 'utf8'));
const ITEMS_PER_PAGE = 5;

const server = http.createServer((req, res) => {
    if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            const parsedBody = querystring.parse(body);
            const text = parsedBody.text || "";
            const input = text.split("*");
            let response = "";

            // Debug log:
            console.log('Received text:', text);

            // Initial language selection
            if (text === "") {
                response = `CON Welcome to the application.\nPlease select language / Hitamo ururimi
1. English
2. Kinyarwanda`;
            } else if (input[0] === "1") {
                // English
                response = handleFlow("english", input);
            } else if (input[0] === "2") {
                // Kinyarwanda
                response = handleFlow("kinyarwanda", input);
            } else {
                response = "END Invalid input.";
            }

            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(response);
        });
    } else {
        res.writeHead(200);
        res.end("USSD service running.");
    }
});

function handleFlow(lang, input) {
    const allDishes = [...dishes[lang].healthy, ...dishes[lang].unhealthy];
    const page = input.length > 1 ? parseInt(input[1]) - 1 : 0;

    if (input.length === 1) {
        return getMenu(lang, 0);
    } else if (input.length === 2) {
        return getMenu(lang, page);
    } else if (input.length === 3) {
        const choiceIndex = page * ITEMS_PER_PAGE + parseInt(input[2]) - 1;
        if (isNaN(choiceIndex) || !allDishes[choiceIndex]) {
            return lang === "english"
                ? "END Invalid choice."
                : "END Uhisemo nabi.";
        }

        const chosen = allDishes[choiceIndex];
        const isHealthy = dishes[lang].healthy.includes(chosen);
        return lang === "english"
            ? `END ${capitalize(chosen)} is ${isHealthy ? "a healthy dish" : "not a healthy dish"}.`
            : `END ${capitalize(chosen)} ${isHealthy ? "ni ifunguro ryiza ku buzima" : "si ifunguro ryiza ku buzima"}.`;
    }

    return "END Invalid input.";
}

function getMenu(lang, page) {
    const allDishes = [...dishes[lang].healthy, ...dishes[lang].unhealthy];
    const start = page * ITEMS_PER_PAGE;
    const items = allDishes.slice(start, start + ITEMS_PER_PAGE);

    if (items.length === 0) {
        return lang === "english"
            ? "END No more dishes."
            : "END Nta mafunguro asigaye.";
    }

    let menu = items.map((dish, i) => `${i + 1}. ${capitalize(dish)}`).join("\n");
    const hasMore = start + ITEMS_PER_PAGE < allDishes.length;

    if (hasMore) {
        menu += `\n${ITEMS_PER_PAGE + 1}. ${lang === "english" ? "More" : "Ibikurikira"}`;
    }

    return `CON ${menu}\n\n${lang === "english" ? "Choose number:" : "Hitamo:"}`;
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`✅ USSD Dishes app is running on port ${PORT}`);
});
