// =========================
// MATCH QUESTION TYPE
// (rendering + answer-check logic specific to "match" type questions)
//
// User left item par click karta hai (select), phir right item par
// click karta hai (connect) — dono ke beech ek SVG line kheenchi
// jaati hai. Already connected item par dobara click karne se
// connection toot jaata hai, taaki user reselect kar sake.
// =========================

// Shuffle Array (Fisher-Yates)
function shuffleArray(array) {

    const shuffled = [...array];

    for (let i = shuffled.length - 1; i > 0; i--) {

        const j = Math.floor(Math.random() * (i + 1));

        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];

    }

    return shuffled;

}

// Module-level state — match.js sirf ek baar load hota hai
// (loadedTypeScripts isko dobara load nahi karega), isliye har
// naye "match" question par renderMatchQuestion() inhe reset karega
let matchConnections = [];
let selectedLeftEl = null;
let resizeListenerAttached = false;


// Render Match Question
function renderMatchQuestion(question) {

    const leftColumn = document.querySelector(".left-column");
    const rightColumn = document.querySelector(".right-column");
    const svg = document.querySelector(".match-lines");

    leftColumn.innerHTML = "";
    rightColumn.innerHTML = "";
    svg.innerHTML = "";

    // State reset (naya question)
    matchConnections = [];
    selectedLeftEl = null;

    // Original id (1-based) ke saath items pair karo,
    // taaki shuffle hone ke baad bhi correctSequence check sahi rahe
    const leftItems = question.left.map((text, i) => ({ text, id: i + 1 }));
    const rightItems = question.right.map((text, i) => ({ text, id: i + 1 }));

    // Dono columns ko independently shuffle karo
    const shuffledLeft = shuffleArray(leftItems);
    const shuffledRight = shuffleArray(rightItems);

    // Left Column Items
    shuffledLeft.forEach(({ text, id }) => {

        const item = document.createElement("button");

        item.className = "match-item";
        item.textContent = text;
        item.dataset.id = id;
        item.dataset.side = "left";

        item.addEventListener("click", () => handleLeftClick(item));

        leftColumn.appendChild(item);

    });

    // Right Column Items
    shuffledRight.forEach(({ text, id }) => {

        const item = document.createElement("button");

        item.className = "match-item";
        item.textContent = text;
        item.dataset.id = id;
        item.dataset.side = "right";

        item.addEventListener("click", () => handleRightClick(item));

        rightColumn.appendChild(item);

    });

    // Resize hone par lines ko realign karo (sirf ek baar listener lagao)
    if (!resizeListenerAttached) {

        window.addEventListener("resize", drawMatchLines);
        resizeListenerAttached = true;

    }

}


// Left Item Click
function handleLeftClick(item) {

    // Already connected -> disconnect karo, phir reselect ke liye ready
    if (item.classList.contains("connected")) {

        removeConnectionByLeftId(item.dataset.id);
        clearSelection();
        selectItem(item);
        return;

    }

    // Same item dobara click -> deselect
    if (selectedLeftEl === item) {

        clearSelection();
        return;

    }

    clearSelection();
    selectItem(item);

}


// Right Item Click
function handleRightClick(item) {

    // Koi left item select nahi hai
    if (!selectedLeftEl) {

        // Agar ye already connected hai, disconnect kar do
        if (item.classList.contains("connected")) {

            removeConnectionByRightId(item.dataset.id);

        }

        return;

    }

    // Ye right item pehle se kisi aur se connected hai -> purana connection hatao
    if (item.classList.contains("connected")) {

        removeConnectionByRightId(item.dataset.id);

    }

    addConnection(selectedLeftEl, item);
    clearSelection();

}


// Selection Helpers
function selectItem(item) {

    selectedLeftEl = item;
    item.classList.add("selected");

}

function clearSelection() {

    if (selectedLeftEl) {

        selectedLeftEl.classList.remove("selected");
        selectedLeftEl = null;

    }

}


// Connection Helpers
function addConnection(leftEl, rightEl) {

    matchConnections.push({
        leftId: Number(leftEl.dataset.id),
        rightId: Number(rightEl.dataset.id),
        leftEl,
        rightEl
    });

    leftEl.classList.add("connected");
    rightEl.classList.add("connected");

    drawMatchLines();

}

function removeConnectionByLeftId(leftId) {

    const index = matchConnections.findIndex(
        c => c.leftId === Number(leftId)
    );

    if (index === -1) return;

    const connection = matchConnections[index];
    connection.leftEl.classList.remove("connected");
    connection.rightEl.classList.remove("connected");

    matchConnections.splice(index, 1);

    drawMatchLines();

}

function removeConnectionByRightId(rightId) {

    const index = matchConnections.findIndex(
        c => c.rightId === Number(rightId)
    );

    if (index === -1) return;

    const connection = matchConnections[index];
    connection.leftEl.classList.remove("connected");
    connection.rightEl.classList.remove("connected");

    matchConnections.splice(index, 1);

    drawMatchLines();

}


// Draw SVG Lines Between Connected Items
function drawMatchLines() {

    const svg = document.querySelector(".match-lines");
    const container = document.querySelector(".match-container");

    if (!svg || !container) return;

    svg.innerHTML = "";

    const containerRect = container.getBoundingClientRect();

    matchConnections.forEach(({ leftEl, rightEl }) => {

        const leftRect = leftEl.getBoundingClientRect();
        const rightRect = rightEl.getBoundingClientRect();

        const x1 = leftRect.right - containerRect.left;
        const y1 = (leftRect.top + leftRect.height / 2) - containerRect.top;

        const x2 = rightRect.left - containerRect.left;
        const y2 = (rightRect.top + rightRect.height / 2) - containerRect.top;

        const line = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "line"
        );

        line.setAttribute("x1", x1);
        line.setAttribute("y1", y1);
        line.setAttribute("x2", x2);
        line.setAttribute("y2", y2);
        line.setAttribute("stroke", "#7C5CFF");
        line.setAttribute("stroke-width", "3");
        line.setAttribute("stroke-linecap", "round");

        svg.appendChild(line);

    });

}


// Check Match Answer -> true/false return karta hai
function checkMatchAnswer(question) {

    // Sab left items connected hone chahiye
    if (matchConnections.length !== question.left.length) {

        return false;

    }

    // Har left id ke liye connection ka rightId, question.correctSequence
    // (jo 1-based right-index store karta hai) se match hona chahiye
    return question.left.every((_, i) => {

        const leftId = i + 1;
        const expectedRightId = question.correctSequence[i];

        const connection = matchConnections.find(
            c => c.leftId === leftId
        );

        return connection && connection.rightId === expectedRightId;

    });

}


// Apne aap ko registry me register karo
questionTypeHandlers.match = {
    render: renderMatchQuestion,
    check: checkMatchAnswer
};