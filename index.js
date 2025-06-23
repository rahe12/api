const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

// In-memory session store for navigation history
const sessions = {};

app.post('/ussd', (req, res) => {
    const { sessionId, serviceCode, phoneNumber, text } = req.body;
    let response = '';

    // Initialize session if it doesn't exist
    if (!sessions[sessionId]) {
        sessions[sessionId] = { history: [], language: null };
    }

    // Split the input text to track user selections
    const userInput = text.split('*');
    const lastInput = userInput[userInput.length - 1] || '';
    const session = sessions[sessionId];

    // Level 1: Language selection
    if (!text || lastInput === '5' && session.history.length === 0) {
        session.history = [];
        session.language = null;
        response = `CON Welcome to favourite food app, please choose language,
Murakaza neza kuri favourite food app, Hitamo ururimi,
1. English
2. Kinyarwanda`;
    }
    // Level 2: Food selection based on language
    else if (userInput.length === 1 && (lastInput === '1' || lastInput === '2') || lastInput === '5' && session.history.length === 1) {
        if (lastInput === '5' && session.history.length === 1) {
            session.history.pop(); // Remove food menu from history
        } else {
            session.language = lastInput;
            session.history.push('language');
        }
        if (session.language === '1') {
            response = `CON Select the dish you like most
1. Chips and Chicken
2. Beef and green Plantain
3. Rice and beans
4. Cassava Bread and greens
5. Back`;
        } else if (session.language === '2') {
            response = `CON Hitamo ibiryo Ukunda
1. Ifiriti n’Iinkoko
2. Agatogo
3. Umuceri n’ibishyimbo
4. Ubugari n’isombe
5. Gusubira inyuma`;
        }
    }
    // Level 3: Final response based on language and food choice
    else if (userInput.length >= 2 && session.language) {
        if (lastInput === '5') {
            // Navigate back to food selection
            session.history.pop();
            if (session.language === '1') {
                response = `CON Select the dish you like most
1. Chips and Chicken
2. Beef and green Plantain
3. Rice and beans
4. Cassava Bread and greens
5. Back`;
            } else if (session.language === '2') {
                response = `CON Hitamo ibiryo Ukunda
1. Ifiriti n’Iinkoko
2. Agatogo
3. Umuceri n’ibishyimbo
4. Ubugari n’isombe
5. Gusubira inyuma`;
            }
        } else {
            // English responses
            if (session.language === '1') {
                switch (lastInput) {
                    case '1':
                        response = `END Your favourite food is Chips and Chicken, that is so unhealthy, do not eat it regularly.`;
                        break;
                    case '2':
                        response = `END Your favourite food is Beef and green Plantain, that is healthy, as long as you eat it less than 5 times a week.`;
                        break;
                    case '3':
                        response = `END Your favourite food is Rice and beans. That is healthy, as long as you drink a lot of water and eat some green vegetables.`;
                        break;
                    case '4':
                        response = `END Your favourite food is Cassava Bread and greens, that is healthy. Verify that there is not too much oil in the greens.`;
                        break;
                    default:
                        response = `END Invalid input. Please try again.`;
                }
            }
            // Kinyarwanda responses
            else if (session.language === '2') {
                switch (lastInput) {
                    case '1':
                        response = `END Ibiryo ukunda ni ifiriti n’inkoko, Si byiza ku buzima ntukabirye buri kenshi.`;
                        break;
                    case '2':
                        response = `END Ibiryo ukunda ni agatogo ni byiza ku buzima iyo ubiriye utarengeje icuro 5 mu cyumweru.`;
                        break;
                    case '3':
                        response = `END Ibiryo ukunda ni umuceri n’ibishyimbo. Ni byiza ku buzima mu gihe wanyweye amazi menshi ukarya n’imboga.`;
                        break;
                    case '4':
                        response = `END Ibiryo ukunda ni ubugari n’isombe ni byiza ku ubuzima, ugenzure neza niba isombe ritarimo amavuta menshi.`;
                        break;
                    default:
                        response = `END Invalid input. Please try again.`;
                }
            }
            // Clear session after final response
            if (response.startsWith('END')) {
                delete sessions[sessionId];
            }
        }
    }
    else {
        response = `END Invalid input. Please try again.`;
        delete sessions[sessionId];
    }

    res.set('Content-Type', 'text/plain');
    res.send(response);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
