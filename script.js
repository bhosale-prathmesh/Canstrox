// =========================
// QUIZ ENGINE (generic)
// Question-type-specific rendering/checking yahan nahi hai —
// wo har type ki apni file me hai (jaise sequence.js, mcq.js, etc.)
// aur questionTypeHandlers registry ke through call hota hai.
//
// Naya question type add karna ho to bas:
//   1. <type>.html  (layout)
//   2. <type>.js    (render + check logic, jo apne aap ko
//                     questionTypeHandlers.<type> me register kare)
// banao — index.html ya is file (script.js) me kuch bhi add/edit
// karne ki zarurat NAHI hai, dono files loadQuestionLayout()
// dynamically load kar leta hai. Engine kisi bhi type ke question
// object ka format nahi jaanta/assume karta — wo sirf poora object
// us type ke apne render()/check() functions ko de deta hai.
//
// Data kahan se aa raha hai (local JSON file ya backend API) — ye
// bhi engine se decouple hai, "DATA SOURCE" section (QuestionSource
// object) dekho neeche.
// =========================

// =========================
// DATA SOURCE
// (Firestore ke "questions" collection se, ek waqt me sirf EK LEVEL
// ke questions fetch hote hain — "level" field par where() aur
// "questionNo" field par orderBy() lagake. Map se jab user koi
// level choose karta hai, tabhi ye call hota hai.
//
// NOTE: where("level"...) + orderBy("questionNo") saath me use
// karne ke liye Firestore ek COMPOSITE INDEX maangega — pehli
// baar chalane par console me ek error aayega jiske saath ek link
// hoga, us link par click karke index create kar dena (1-2 min
// me ban jaata hai).
// =========================
const QuestionSource = {

    collectionName: "questions",

    async fetchByLevel(levelNo) {

        const snapshot = await db
            .collection(this.collectionName)
            .where("level", "==", levelNo)
            .orderBy("questionNo")
            .get();

        if (snapshot.empty) {

            throw new Error(
                `Level ${levelNo} ke liye "${this.collectionName}" me koi questions nahi mile`
            );

        }

        return snapshot.docs.map(doc => doc.data());

    }

};

let solvedQuestions = 0;
let currentQuestion = null;
let currentQuestionIndex = 0;
let allQuestions = [];
const skipBtn = document.querySelector(".skip-btn");

let skippedQuestions = [];
const checkBtn = document.querySelector(".check-btn");
const progressFill = document.querySelector(".progress-fill");
const notification = document.querySelector(".notification");
const terminalOverlay = document.querySelector(".terminal-overlay");
const terminalBody = document.querySelector(".terminal-body");

// Terminal animation timing (CSS transition duration se match hona
// chahiye — style.css me .terminal-overlay ki transition bhi .45s hai)
const TERMINAL_SLIDE_DURATION = 450;
const TERMINAL_TYPE_SPEED = 28;       // ms per character
const TERMINAL_HOLD_DURATION = 3000;  // sab print hone ke baad kitni der ruke

// Har question-type apne aap ko yahan register karega
// (e.g. sequence.js karega: questionTypeHandlers.sequence = {...})
let questionTypeHandlers = {};

// Track karo kaunse type ki JS file already load ho chuki hai,
// taaki wahi <type>.js dubara-dubara load/execute na ho
const loadedTypeScripts = new Set();

// Har type ka fetched HTML layout yahan cache hota hai (type -> html
// string), taaki wahi <type>.html dubara-dubara fetch na ho
const layoutCache = {};

// =========================
// LEVEL PROGRESS (localStorage)
// (abhi koi user-account/backend save nahi hai, isliye sirf
// "kaunsa level tak unlock hai" browser ke localStorage me
// rakha jaata hai. Ek level poora solve hone par next level
// unlock hota hai)
// =========================
const UNLOCKED_LEVEL_KEY = "learnova_unlocked_level";

function getUnlockedLevel() {

    const stored = Number(localStorage.getItem(UNLOCKED_LEVEL_KEY));

    return stored && stored > 0 ? stored : 1;

}

function markLevelComplete(levelNo) {

    const unlockedLevel = getUnlockedLevel();

    // Sirf tabhi aage badhao jab ye level "abhi tak ka sabse aage
    // wala unlocked level" tha — pichla level dobara khelne se
    // unlock progress peeche nahi jaana chahiye
    if (levelNo >= unlockedLevel) {

        localStorage.setItem(UNLOCKED_LEVEL_KEY, String(levelNo + 1));

    }

}


// =========================
// HEARTS (localStorage — sirf LEVEL END par save hota hai)
// (max 3 hearts, GLOBAL — kisi ek level ke saath reset nahi hote.
// Level ke DAURAN galat answer par heart sirf IN-MEMORY (sessionHearts)
// kam hota hai — localStorage tabhi likha jaata hai jab level
// khatam ho (complete ho jaaye YA hearts khatam hoke Game Over ho
// jaaye). Isse localStorage par baar-baar likhna bhi bachta hai
// aur "level ke beech me hi galat state save ho jaana" jaisi
// dikkat bhi nahi hoti.
//
// "Earn Hearts" abhi ek PLACEHOLDER hai — turant full refill kar
// deta hai; real ad/reward-based earning logic future me isi
// function ke andar add hogi, baaki poora flow waisa hi rahega.
// =========================
const HEARTS_KEY = "learnova_hearts";
const MAX_HEARTS = 3;

// localStorage me abhi PERSIST kiya hua hearts count (sirf level
// end par update hota hai)
function getPersistedHearts() {

    const stored = localStorage.getItem(HEARTS_KEY);

    if (stored === null) return MAX_HEARTS;

    const n = Number(stored);

    return Number.isFinite(n) ? Math.max(0, Math.min(MAX_HEARTS, n)) : MAX_HEARTS;

}

function persistHearts(n) {

    const clamped = Math.max(0, Math.min(MAX_HEARTS, n));

    localStorage.setItem(HEARTS_KEY, String(clamped));

    return clamped;

}

// CURRENT level-session ke hearts — startLevel() par localStorage
// se load hote hain, level khatam hone par wapas persistHearts()
// se save hote hain. Beech me sirf yahi variable badalta hai
let sessionHearts = MAX_HEARTS;

function loseHeart() {

    sessionHearts = Math.max(0, sessionHearts - 1);
    updateHeartsDisplay();

    return sessionHearts;

}

function hasHearts() {

    return sessionHearts > 0;

}

// Quiz-view ke top-bar wale hearts display ko current SESSION
// count ke hisaab se update karo (filled ❤️ vs empty 🖤)
function updateHeartsDisplay() {

    const heartsEl = document.querySelector(".hearts");
    if (!heartsEl) return;

    let html = "";

    for (let i = 0; i < MAX_HEARTS; i++) {

        html += i < sessionHearts ? "❤️ " : "🖤 ";

    }

    heartsEl.textContent = html.trim();

}


// =========================
// VIEW SWITCHING (map <-> quiz <-> result <-> gameover)
// =========================
function setActiveView(viewSelector) {

    document.querySelectorAll(".map-view, .quiz-view, .result-view, .practice-result-view, .gameover-view")
        .forEach(el => el.classList.remove("show"));

    document.querySelector(viewSelector).classList.add("show");

}

function showMapView() {

    setActiveView(".map-view");

    // Map dobara dikhne par latest unlocked-level state ke saath
    // refresh ho (jaise level complete karne ke baad)
    if (window.renderMap) window.renderMap();

}

function showQuizView() {

    setActiveView(".quiz-view");

    // Hearts display hamesha latest count ke saath fresh rahe
    updateHeartsDisplay();

}


// Heart 0 ho jaane par turant ye dikhta hai — level ke beech me
// hi, agle question ka wait kiye bina
function showGameOverView() {

    setActiveView(".gameover-view");

    const statsEl = document.querySelector(".gameover-stats");

    if (statsEl) {

        statsEl.textContent =
            `You solved ${solvedQuestions} of ${totalQuestionsInLevel} question${totalQuestionsInLevel === 1 ? "" : "s"}.`;

    }

}

function safeListen(selector, event, handler) {

    const el = document.querySelector(selector);

    if (el) {

        el.addEventListener(event, handler);

    } else {

        console.error(`safeListen: "${selector}" DOM me nahi mila — listener attach nahi hua.`);

    }

}

safeListen(".gameover-map-btn", "click", showMapView);

safeListen(".gameover-earn-btn", "click", () => {

    // Ab ye instant full-refill NAHI deta — seedha PREVIOUS
    // (already-completed) level ko practice mode me khol deta hai.
    // startLevel() khud hi dekhega ki ye level unlockedLevel se
    // chota hai, isliye isse practice session maan lega — poora
    // karne par heart wapas milega (agar full nahi hain)
    const previousLevel = currentLevel - 1;

    if (previousLevel >= 1) {

        startLevel(previousLevel);

    } else {

        // Safety fallback — level 1 par hearts ka koi consequence
        // hi nahi hai isliye game-over yahan theoretically kabhi
        // nahi aata, lekin phir bhi ek safe rasta rakha hai
        showMapView();

    }

});


// Level poora solve hone par ye dikhta hai — score + agle level
// ka preview, aur seedha agla level start karne ka button
async function showResultView(levelNo) {

    setActiveView(".result-view");

    document.querySelector(".result-level-no").textContent = levelNo;

    const scoreEl = document.querySelector(".result-score");
    scoreEl.textContent = "0";
    animateCountUp(scoreEl, totalQuestionsInLevel);

    const nextTitleEl = document.querySelector(".result-next-title");
    const nextSection = document.querySelector(".result-next");
    const nextBtn = document.querySelector(".result-next-btn");
    const titleEl = document.querySelector(".result-title");

    titleEl.textContent = "Level Complete!";
    nextTitleEl.textContent = "Loading...";
    nextSection.style.display = "";
    nextBtn.style.display = "";

    // Agle level ka data Firestore ke "levels" collection se fetch
    // karo, taaki uska title dikha sakein
    let nextLevelDoc = null;

    try {

        nextLevelDoc = await db.collection("levels").doc(String(levelNo + 1)).get();

    } catch (error) {

        console.error(error);

    }

    if (nextLevelDoc && nextLevelDoc.exists) {

        const nextData = nextLevelDoc.data();
        nextTitleEl.textContent = nextData.title || `Level ${levelNo + 1}`;

        nextBtn.onclick = () => startLevel(levelNo + 1);

    } else {

        // Ye hi aakhri level tha — koi agla level nahi hai
        titleEl.textContent = "All Levels Complete! 🎉";
        nextSection.style.display = "none";
        nextBtn.style.display = "none";

    }

}

// Number ko 0 se target value tak smoothly count-up karo
function animateCountUp(el, targetValue, duration = 700) {

    const start = performance.now();

    function step(now) {

        const progress = Math.min((now - start) / duration, 1);
        el.textContent = Math.round(progress * targetValue);

        if (progress < 1) requestAnimationFrame(step);

    }

    requestAnimationFrame(step);

}

safeListen(".result-map-btn", "click", showMapView);


// Practice level (already-completed level dobara khela) poora
// hone par ye dikhta hai — result-view jaisa hi hai, bas "Next Up"
// ki jagah ek hearts-row hai. heartsBefore se sab hearts render
// karo, phir agar heart badha hai to thodi der ruk ke usi naye
// heart ko "pop" animation ke saath fill karke dikhao
function showPracticeResultView(levelNo, heartsBefore, heartsAfter) {

    setActiveView(".practice-result-view");

    document.querySelector(".practice-result-level-no").textContent = levelNo;

    const scoreEl = document.querySelector(".practice-result-score");
    scoreEl.textContent = "0";
    animateCountUp(scoreEl, totalQuestionsInLevel);

    const heartEls = [...document.querySelectorAll(".practice-heart")];
    const captionEl = document.querySelector(".practice-hearts-caption");
    const gained = heartsAfter > heartsBefore;

    heartEls.forEach((el, i) => {

        el.classList.remove("pop");
        el.textContent = i < heartsBefore ? "❤️" : "🖤";

    });

    if (gained) {

        captionEl.textContent = "+1 Heart Earned!";

        // Thodi der ruk ke naya heart fill karo, saath me "pop" —
        // taaki user pehle purani state dekhe, phir change ho
        setTimeout(() => {

            const newHeartEl = heartEls[heartsBefore];

            if (newHeartEl) {

                newHeartEl.textContent = "❤️";
                newHeartEl.classList.add("pop");

            }

        }, 500);

    } else {

        captionEl.textContent = "Hearts already full!";

    }

}

safeListen(".practice-result-map-btn", "click", showMapView);


// Map se level select hone par ye call hota hai (map.js isko
// window.startLevel ke through call karta hai)
let currentLevel = null;
let totalQuestionsInLevel = 0;

// Kya ye ek "practice" session hai (pehle se completed level ko
// DOBARA khelna)? Isi se decide hota hai level complete hone par
// kaunsa result-view dikhega (normal "Next Up" wala, ya practice
// wala jisme heart earn hone ki animation hai)
let isPracticeSession = false;

// Kya is session me hearts ka consequence (heart lose hona, skip-
// to-end mechanic, game-over) apply hota hai? Practice levels
// (dobara khela hua koi bhi level) is se hamesha azaad hain.
// LEVEL 1 bhi hamesha azaad hai — chahe pehli baar hi kyun na
// khela jaa raha ho — kyunki agar yahin par hearts khatam ho
// jaayein to koi bhi completed level hi nahi hota jisse heart
// wapas kamaya ja sake, aur poora game hamesha ke liye atak jaata
let heartsFeatureActive = true;

async function startLevel(levelNo) {

    isPracticeSession = levelNo < getUnlockedLevel();
    heartsFeatureActive = !isPracticeSession && levelNo !== 1;

    // Safety net — map.js already hearts check karke hi yahan tak
    // aata hai, lekin agar kabhi startLevel() seedha call ho jaaye
    // to bhi 0-hearts state me current level shuru na ho (yahan
    // PERSISTED value check karo, sessionHearts abhi tak set hi
    // nahi hui). Level 1 aur practice levels is check se bilkul
    // azaad hain — hearts na hone par bhi wo khelne layak rehte hain
    if (heartsFeatureActive && getPersistedHearts() <= 0) {

        console.warn("Hearts khatam hain — current level start nahi kiya.");
        return;

    }

    try {

        allQuestions = await QuestionSource.fetchByLevel(levelNo);

        // Is level me jitne bhi UNIQUE question-types hain, unka
        // html+js ek saath (parallel) preload kar do — taaki quiz
        // shuru hone ke baad beech-beech me koi network fetch na ho
        // (jo pehle "1 by 1 loading" jaisa lagta tha)
        await preloadLevelAssets(allQuestions);

        currentLevel = levelNo;
        totalQuestionsInLevel = allQuestions.length;
        solvedQuestions = 0;
        skippedQuestions = [];
        currentQuestionIndex = 0;

        // localStorage se hearts is session ke liye load karo — ab
        // se level khatam hone tak sirf yahi in-memory value badlegi
        sessionHearts = getPersistedHearts();

        showQuizView();
        loadQuestion(0);

    } catch (error) {

        console.error(error);

    }

}
window.startLevel = startLevel;


// Level ke saare questions me jitne UNIQUE "type" hain (jaise
// "sequence", "match", "fill-blank"), un sabka html+js EK SAATH
// (Promise.all — parallel) fetch/load kar deta hai. Firestore se
// questions to pehle se hi ek hi query me aa jaate hain — ye
// function unke LAYOUT FILES (html/js) ko bhi usi tarah "sab ek
// saath" bana deta hai, taaki level open hone ke baad quiz ke
// beech me koi bhi mid-quiz network wait na aaye
async function preloadLevelAssets(questions) {

    const uniqueTypes = [...new Set(questions.map(q => q.type))];

    await Promise.all(uniqueTypes.map(async type => {

        if (!layoutCache[type]) {

            const response = await fetch(`${type}.html`);
            layoutCache[type] = await response.text();

        }

        await loadTypeScript(type);

    }));

}


// Question transition timing (CSS transition duration se match
// hona chahiye — style.css me .content-area ki transition bhi
// yahi duration use karti hai)
const QUESTION_SLIDE_OUT_DURATION = 300;

// Load Question
// (purana content LEFT ki taraf glide-fade karke hatta hai, phir
// naya question RIGHT se glide karke center me aata hai — jaise
// ek "page turn". Har jagah se yahi function call hota hai
// (next question, skip, retry), isliye animation sab jagah
// consistently apply hoti hai)
async function loadQuestion(index) {

    const contentArea = document.querySelector(".content-area");
    const hasExistingContent = contentArea.innerHTML.trim() !== "";

    // Pehli baar (khaali content-area) slide-out ki zaroorat nahi —
    // seedha slide-in se shuru karo
    if (hasExistingContent) {

        contentArea.classList.add("content-slide-out");

        await new Promise(resolve => setTimeout(resolve, QUESTION_SLIDE_OUT_DURATION));

    }

    currentQuestionIndex = index;
    currentQuestion = allQuestions[index];

    // Layout (drop-zone/drag-zone markup) + uski JS dono
    // question type ke hisaab se dynamically load karo
    await loadQuestionLayout(currentQuestion.type);

    // Ab us type ka apna render function call karo
    // (e.g. sequence.js ka renderSequenceQuestion)
    const handler = questionTypeHandlers[currentQuestion.type];

    if (!handler) {

        console.error(
            `"${currentQuestion.type}" naam ka koi question-type handler register nahi hai. ` +
            `Check karo ki "${currentQuestion.type}.html" aur "${currentQuestion.type}.js" ` +
            `dono files exist karte hain aur ".js" file khud ko ` +
            `questionTypeHandlers["${currentQuestion.type}"] me register kar rahi hai.`
        );
        return;

    }

    handler.render(currentQuestion);

    updateProgressBar();

    // Naya content abhi normal position par render hua hai — usse
    // pehle RIGHT side par (bina transition ke) instantly teleport
    // karo, phir "slide-in-prep" hatate hi wo apni normal jagah
    // (center) ki taraf transition karega — yehi glide-in effect hai
    contentArea.classList.remove("content-slide-out");
    contentArea.classList.add("content-slide-in-prep");

    // Forced reflow — taaki browser upar wali "prep" position ko
    // pehle paint kare, tabhi neeche wali class-removal transition
    // ki tarah animate hogi (warna dono ek saath apply ho jaate)
    void contentArea.offsetWidth;

    contentArea.classList.remove("content-slide-in-prep");

}


// Check Answer
async function checkAnswer() {

    // Current question ke type ka apna check function call karo
    // (e.g. sequence.js ka checkSequenceAnswer)
    const handler = questionTypeHandlers[currentQuestion.type];

    if (!handler) {

        console.error(
            `"${currentQuestion.type}" naam ka koi question-type handler register nahi hai.`
        );
        return;

    }

    const isCorrect = handler.check(currentQuestion);

    if (isCorrect) {

        solvedQuestions++;
        updateProgressBar();

        showNotification("success", "Correct!");

        // Agar is question ke JSON me "terminal" array diya gaya
        // hai, to agla question load karne se PEHLE terminal
        // animation dikhao aur uske complete hone ka wait karo
        if (Array.isArray(currentQuestion.terminal) && currentQuestion.terminal.length > 0) {

            checkBtn.disabled = true;
            skipBtn.disabled = true;

            await playTerminalAnimation(currentQuestion.terminal);

            checkBtn.disabled = false;
            skipBtn.disabled = false;

        }

        goToNextQuestionOrFinish();

    } else if (!heartsFeatureActive) {

        // Level 1 (hamesha) ya koi bhi practice/replay level — hearts
        // ka yahan koi role nahi. Bas "Try Again" dikhao aur wahi
        // SAME question dobara try karne do — koi skip-to-end, koi
        // heart loss nahi
        showNotification("error", "Wrong Answer! Try Again.");

        await loadQuestion(currentQuestionIndex);

    } else {

        showNotification("error", "Wrong Answer! -1 ❤️");

        loseHeart();

        if (!hasHearts()) {

            // Level yahin khatam ho gaya (fail) — jo bhi hearts
            // bache hain (0) unhe save karo
            persistHearts(sessionHearts);

            showGameOverView();
            return;

        }

        // Galat answer wapas turant retry karne ke liye NAHI rukta —
        // ye question skip jaisa hi "end me dobara pucho" wali list
        // me chala jaata hai, aur turant agle question par badh
        // jaate hain
        skippedQuestions.push(currentQuestion);

        goToNextQuestionOrFinish();

    }

}


// Current question ke baad: agar aur questions bache hain to agla
// load karo; warna agar koi skipped/wrong-answered questions hain
// to unhi ka ek nayi round shuru karo; warna level poora ho gaya
function goToNextQuestionOrFinish() {

    if (currentQuestionIndex < allQuestions.length - 1) {

        loadQuestion(currentQuestionIndex + 1);

    } else if (skippedQuestions.length > 0) {

        allQuestions = skippedQuestions;
        skippedQuestions = [];

        currentQuestionIndex = 0;

        loadQuestion(0);

    } else {

        markLevelComplete(currentLevel);

        if (isPracticeSession) {

            // Practice level poora hone par — agar hearts pehle se
            // full nahi hain — ek heart wapas mil jaata hai (max
            // MAX_HEARTS tak). Alag "practice complete" result-view
            // dikhta hai jisme hearts-row par ye earn hona animate
            // hoke dikhta hai
            const heartsBefore = getPersistedHearts();
            const heartsAfter = heartsBefore < MAX_HEARTS ? heartsBefore + 1 : heartsBefore;

            persistHearts(heartsAfter);

            showPracticeResultView(currentLevel, heartsBefore, heartsAfter);

        } else {

            // Current level (level 1 samet) poora ho gaya — ab
            // jitne bhi hearts session me bache hain, unhi ko
            // localStorage me save karo
            persistHearts(sessionHearts);

            showResultView(currentLevel);

        }

    }

}


// Check Button
checkBtn.addEventListener("click", checkAnswer);

function updateProgressBar() {

    const progress =
        (solvedQuestions / allQuestions.length) * 100;

    progressFill.style.width = progress + "%";

}

function skipQuestion() {

    // Current question ko skip list me save karo (jaise galat
    // answer bhi ab is list me jaate hain — dono "end me dobara
    // pucho" wale queue me merge hote hain)
    skippedQuestions.push(currentQuestion);

    showNotification("skip", "Question Skipped!");

    goToNextQuestionOrFinish();

}
skipBtn.addEventListener("click", skipQuestion);

function showNotification(type, message, duration = 1500) {

    notification.className = "notification";

    notification.classList.add(type);
    notification.classList.add("show");

    notification.textContent = message;

    setTimeout(() => {

        notification.classList.remove("show");

    }, duration);

}

// Question-type ka HTML layout (e.g. sequence.html) fetch karke
// content-area me daal do — file naam hamesha "<type>.html" hoga
async function loadQuestionLayout(type) {

    // startLevel() ke preloadLevelAssets() ne already fetch kar
    // liya hoga (level shuru hote hi) — isliye yahan zyaadatar
    // bas cache se hi turant mil jaata hai, koi network wait nahi
    if (!layoutCache[type]) {

        const response = await fetch(`${type}.html`);
        layoutCache[type] = await response.text();

    }

    document.querySelector(".content-area").innerHTML = layoutCache[type];

    // Layout ke saath uski JS bhi load karo ("<type>.js")
    // — sirf pehli baar; dobara zarurat nahi (functions already registered hain)
    await loadTypeScript(type);

}

// "<type>.js" ko dynamically <script> tag ke through load karta hai
// aur load hone tak wait karta hai (Promise)
function loadTypeScript(type) {

    if (loadedTypeScripts.has(type)) {

        // Already load ho chuki hai, dobara load karne ki zarurat nahi
        return Promise.resolve();

    }

    return new Promise((resolve, reject) => {

        const script = document.createElement("script");
        script.src = `${type}.js`;

        script.onload = () => {
            loadedTypeScripts.add(type);
            resolve();
        };

        script.onerror = () => {
            reject(new Error(`Failed to load ${type}.js`));
        };

        document.body.appendChild(script);

    });

}


// =========================
// TERMINAL OUTPUT ANIMATION
// (correct answer ke baad, agar question.terminal diya gaya hai,
// to ye poora sequence chalta hai: slide-in -> type sabhi lines ->
// 3 sec ruko -> slide-out. Poora Promise return karta hai jise
// checkAnswer() await karta hai, taaki agla question tabhi load ho
// jab ye animation completely khatam ho jaaye)
// =========================

function playTerminalAnimation(lines) {

    return new Promise(resolve => {

        terminalBody.innerHTML = "";
        terminalOverlay.classList.add("show");

        // Slide-in transition khatam hone tak ruko, phir typing shuru karo
        setTimeout(async () => {

            for (const line of lines) {

                await typeLine(String(line));

            }

            // Sab print hone ke baad thodi der ruko (jaisa asked hai)
            setTimeout(() => {

                terminalOverlay.classList.remove("show");

                // Slide-out transition khatam hone tak ruko, phir resolve
                setTimeout(resolve, TERMINAL_SLIDE_DURATION);

            }, TERMINAL_HOLD_DURATION);

        }, TERMINAL_SLIDE_DURATION);

    });

}


// Ek line ko character-by-character type karo (jaise real terminal),
// cursor ko aage badhate hue
function typeLine(text) {

    return new Promise(resolve => {

        const lineEl = document.createElement("div");
        lineEl.className = "terminal-line";

        const promptSpan = document.createElement("span");
        promptSpan.className = "terminal-prompt";
        promptSpan.textContent = ">";

        const textSpan = document.createElement("span");
        textSpan.className = "terminal-text";

        const cursorSpan = document.createElement("span");
        cursorSpan.className = "terminal-cursor";

        lineEl.appendChild(promptSpan);
        lineEl.appendChild(textSpan);
        lineEl.appendChild(cursorSpan);

        terminalBody.appendChild(lineEl);
        terminalBody.scrollTop = terminalBody.scrollHeight;

        let charIndex = 0;

        function typeNextChar() {

            if (charIndex < text.length) {

                textSpan.textContent += text[charIndex];
                charIndex++;

                terminalBody.scrollTop = terminalBody.scrollHeight;

                setTimeout(typeNextChar, TERMINAL_TYPE_SPEED);

            } else {

                // Is line ka typing khatam — cursor agli line me
                // dikhega, isliye yaha se hata do
                cursorSpan.remove();
                resolve();

            }

        }

        typeNextChar();

    });

}

// Page load hote hi hearts display ko current localStorage
// value ke hisaab se turant sync kar do
updateHeartsDisplay();