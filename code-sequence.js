// =========================
// CODE-SEQUENCE QUESTION TYPE
// (code-editor jaisa UI — lines shuffled order me dikhti hain,
// user unhe drag karke sahi line-by-line sequence me arrange
// karta hai. Mouse aur touch dono Pointer Events se handle
// hote hain, isliye mobile par bhi real drag kaam karta hai)
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


// Module-level drag state
let draggingRow = null;
let draggingGhost = null;
let pointerOffsetY = 0;
let lastPointerClientY = 0;

// Auto-scroll state (jab drag karte waqt pointer box ke top/bottom
// edge ke paas jaata hai to editor apne aap scroll ho)
let autoScrollRAF = null;
let autoScrollContainer = null;
let autoScrollSpeed = 0;
const AUTO_SCROLL_EDGE = 40;   // px — kitna paas jaane par scroll start ho
const AUTO_SCROLL_MAX_SPEED = 10; // px per frame


// Render Code Sequence Question
function renderCodeSequenceQuestion(question) {

    const rowsContainer = document.querySelector(".code-rows");
    rowsContainer.innerHTML = "";

    // Reset drag state (naya question)
    draggingRow = null;
    draggingGhost = null;
    stopAutoScroll();

    // Original id (1-based) ke saath lines pair karo,
    // taaki shuffle hone ke baad bhi correctSequence check sahi rahe
    const linesWithId = question.lines.map((line, i) => ({
        id: i + 1,
        code: line.code,
        indent: line.indent || 0
    }));

    // Lines ko randomly shuffle karo har baar
    const shuffledLines = shuffleArray(linesWithId);

    shuffledLines.forEach(line => {

        rowsContainer.appendChild(createRowElement(line));

    });

    updateLineNumbers();

}


// Ek row (line) ka DOM element banao
function createRowElement(line) {

    const row = document.createElement("div");
    row.className = "code-row";
    row.dataset.id = line.id;

    const lineNumber = document.createElement("span");
    lineNumber.className = "line-number";

    const lineContent = document.createElement("pre");
    lineContent.className = "line-content";
    lineContent.style.paddingLeft = (line.indent * 4) + "ch";
    lineContent.textContent = line.code;

    row.appendChild(lineNumber);
    row.appendChild(lineContent);

    // Sirf line-content (code text) drag handle hai — line-number
    // par touch se scroll hoga, drag nahi
    lineContent.addEventListener("pointerdown", e => handlePointerDown(e, row));

    return row;

}


// Har row ka display line-number (1, 2, 3...) current DOM order
// ke hisaab se update karo
function updateLineNumbers() {

    document.querySelectorAll(".code-row").forEach((row, index) => {

        row.querySelector(".line-number").textContent = index + 1;

    });

}


// ---------------------------------
// Drag / Reorder Logic
// (Pointer Events — mouse aur touch dono ke liye kaam karta hai)
// ---------------------------------

function handlePointerDown(e, row) {

    e.preventDefault();

    const rect = row.getBoundingClientRect();
    pointerOffsetY = e.clientY - rect.top;

    // Ghost banao jo pointer/finger ke saath move karega
    draggingGhost = row.cloneNode(true);
    draggingGhost.className = "code-row-ghost";
    draggingGhost.style.width = rect.width + "px";
    draggingGhost.style.height = rect.height + "px";
    draggingGhost.style.left = rect.left + "px";
    draggingGhost.style.top = rect.top + "px";
    document.body.appendChild(draggingGhost);

    // Placeholder us jagah rakho jaha row thi, aur asli row ko
    // flow se hata do (sirf ghost dikhega jab tak drag chal raha hai)
    const placeholder = document.createElement("div");
    placeholder.className = "code-row-placeholder";
    placeholder.style.height = rect.height + "px";

    // Label jo batayega ki abhi kis line number par drop hoga
    const label = document.createElement("span");
    label.className = "code-row-placeholder-label";
    placeholder.appendChild(label);

    row.parentElement.insertBefore(placeholder, row);
    row.remove();

    draggingRow = row;
    draggingRow._placeholder = placeholder;

    updatePlaceholderLabel(placeholder);

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerEnd);
    document.addEventListener("pointercancel", handlePointerEnd);

}

// Placeholder ke andar "Drop → Line X" dikhao, jahan X current
// insertion position hai
function updatePlaceholderLabel(placeholder) {

    const rowsContainer = document.querySelector(".code-rows");
    const children = [...rowsContainer.children];
    const index = children.indexOf(placeholder);

    const label = placeholder.querySelector(".code-row-placeholder-label");
    if (label) label.textContent = `Drop → Line ${index + 1}`;

}

// Reorder se pehle sabhi rows ki current position capture karo (FLIP
// animation ka "First" step)
function captureRowPositions(container) {

    const positions = new Map();

    [...container.children].forEach(el => {

        positions.set(el, el.getBoundingClientRect());

    });

    return positions;

}

// Reorder ke baad rows ko unki purani position se "glide" karke
// nayi position tak animate karo (FLIP animation ka "Invert + Play" step)
function playGlideAnimation(container, previousPositions) {

    [...container.children].forEach(el => {

        const before = previousPositions.get(el);
        if (!before) return;

        const after = el.getBoundingClientRect();
        const deltaY = before.top - after.top;

        if (Math.abs(deltaY) < 1) return;

        el.style.transition = "none";
        el.style.transform = `translateY(${deltaY}px)`;

        requestAnimationFrame(() => {

            el.style.transition = "transform 180ms ease";
            el.style.transform = "";

        });

    });

}

function handlePointerMove(e) {

    if (!draggingGhost) return;

    lastPointerClientY = e.clientY;
    draggingGhost.style.top = (e.clientY - pointerOffsetY) + "px";

    updateAutoScroll(e.clientY);
    updateDropTarget(e.clientY);

}

// Placeholder ko current pointer position ke hisaab se sahi
// jagah move karo (naya insertion index alag ho tabhi)
function updateDropTarget(clientY) {

    const rowsContainer = document.querySelector(".code-rows");
    const placeholder = draggingRow._placeholder;

    const siblings = [...rowsContainer.children].filter(
        child => child !== placeholder
    );

    // Sabse pehla sibling dhundo jiske center se pointer upar hai —
    // placeholder ko uske pehle daal do
    const afterElement = siblings.find(sibling => {

        const rect = sibling.getBoundingClientRect();
        return clientY < rect.top + rect.height / 2;

    }) || null;

    // Insertion point wahi ka wahi hai to kuch mat karo
    // (isse har pixel move par reflow/animation replay nahi hota)
    const noChangeBefore = !afterElement && placeholder === rowsContainer.lastElementChild;
    const noChangeMiddle = afterElement && placeholder.nextElementSibling === afterElement;

    if (noChangeBefore || noChangeMiddle) return;

    const previousPositions = captureRowPositions(rowsContainer);

    if (afterElement) {

        rowsContainer.insertBefore(placeholder, afterElement);

    } else {

        rowsContainer.appendChild(placeholder);

    }

    updatePlaceholderLabel(placeholder);
    playGlideAnimation(rowsContainer, previousPositions);

}

// Pointer editor box ke top/bottom edge ke kitna paas hai check karo,
// aur uske hisaab se auto-scroll start/stop/speed set karo
function updateAutoScroll(clientY) {

    const rowsContainer = document.querySelector(".code-rows");
    const rect = rowsContainer.getBoundingClientRect();

    let speed = 0;

    if (clientY < rect.top + AUTO_SCROLL_EDGE) {

        // Upar ki taraf — jitna edge ke paas utni fast scroll
        const intensity = Math.min(
            (rect.top + AUTO_SCROLL_EDGE - clientY) / AUTO_SCROLL_EDGE, 1
        );
        speed = -AUTO_SCROLL_MAX_SPEED * intensity;

    } else if (clientY > rect.bottom - AUTO_SCROLL_EDGE) {

        // Neeche ki taraf
        const intensity = Math.min(
            (clientY - (rect.bottom - AUTO_SCROLL_EDGE)) / AUTO_SCROLL_EDGE, 1
        );
        speed = AUTO_SCROLL_MAX_SPEED * intensity;

    }

    autoScrollSpeed = speed;

    if (speed !== 0) {

        autoScrollContainer = rowsContainer;

        if (!autoScrollRAF) {

            autoScrollRAF = requestAnimationFrame(autoScrollStep);

        }

    } else {

        stopAutoScroll();

    }

}

// Har animation frame par container ko scroll karte raho, aur
// (pointer stationary rahe tab bhi) drop-target ko re-evaluate karo
// kyunki rows niche scroll ke saath shift ho rahi hain
function autoScrollStep() {

    if (!autoScrollContainer || autoScrollSpeed === 0) {

        autoScrollRAF = null;
        return;

    }

    autoScrollContainer.scrollTop += autoScrollSpeed;

    if (draggingRow) updateDropTarget(lastPointerClientY);

    autoScrollRAF = requestAnimationFrame(autoScrollStep);

}

function stopAutoScroll() {

    if (autoScrollRAF) cancelAnimationFrame(autoScrollRAF);

    autoScrollRAF = null;
    autoScrollContainer = null;
    autoScrollSpeed = 0;

}

function handlePointerEnd() {

    if (!draggingRow) return;

    stopAutoScroll();

    const placeholder = draggingRow._placeholder;

    placeholder.parentElement.insertBefore(draggingRow, placeholder);
    placeholder.remove();

    delete draggingRow._placeholder;

    // Drop confirm hone par ek chhota color-flash dikhao
    draggingRow.classList.add("row-dropped");
    const droppedRow = draggingRow;
    setTimeout(() => droppedRow.classList.remove("row-dropped"), 350);

    draggingRow = null;

    draggingGhost.remove();
    draggingGhost = null;

    updateLineNumbers();

    document.removeEventListener("pointermove", handlePointerMove);
    document.removeEventListener("pointerup", handlePointerEnd);
    document.removeEventListener("pointercancel", handlePointerEnd);

}


// Check Code Sequence Answer -> true/false return karta hai
function checkCodeSequenceAnswer(question) {

    const rowsContainer = document.querySelector(".code-rows");
    const currentOrder = [...rowsContainer.children].map(
        row => Number(row.dataset.id)
    );

    if (currentOrder.length !== question.correctSequence.length) {

        return false;

    }

    return currentOrder.every(
        (id, index) => id === question.correctSequence[index]
    );

}


// Apne aap ko registry me register karo
questionTypeHandlers["code-sequence"] = {
    render: renderCodeSequenceQuestion,
    check: checkCodeSequenceAnswer
};