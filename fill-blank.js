// =========================
// FILL-BLANK (CLOZE) QUESTION TYPE
// (multi-line passage jisme "%%" jaha bhi milta hai wahi ek blank
// ban jaata hai, aur "\n" jaha bhi milta hai wahi se UI nayi line
// par chala jaata hai — dono signs text ke ANDAR kahin bhi ho
// sakte hain, sirf line ke end me hi nahi. Options pool se click
// karke sahi blank fill karna hota hai. Blank khaali hote waqt
// sirf ek underline jaisa dikhta hai, poora box nahi — fill hone
// ke baad normal .word-btn block ban jaata hai)
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


// Render Fill-Blank Question
function renderFillBlankQuestion(question) {

    const linesContainer = document.querySelector(".cloze-lines");
    const pool = document.querySelector(".drag-zone");

    linesContainer.innerHTML = "";
    pool.innerHTML = "";

    // Pehli line row banao
    let currentLine = createClozeLine();
    linesContainer.appendChild(currentLine);

    // Har "lines" entry ke text ko token-by-token scan karo.
    // "%%" jaha bhi mile -> ek blank banao (chahe text ke beech me ho).
    // "\n" jaha bhi mile -> us jagah se nayi line row shuru karo.
    question.lines.forEach(rawLine => {

        const tokens = rawLine.split(/(%%|\n)/);

        tokens.forEach(token => {

            if (token === "") return;

            if (token === "\n") {

                currentLine = createClozeLine();
                linesContainer.appendChild(currentLine);
                return;

            }

            if (token === "%%") {

                const blank = document.createElement("span");
                blank.className = "blank-slot";

                currentLine.appendChild(blank);
                return;

            }

            // Plain text token
            const textSpan = document.createElement("span");
            textSpan.className = "cloze-text-segment";
            textSpan.textContent = token;

            currentLine.appendChild(textSpan);

        });

    });

    // Original id (1-based) ke saath options ko pair karo,
    // taaki shuffle hone ke baad bhi correctSequence check sahi rahe
    const optionsWithId = question.options.map((text, i) => ({
        text,
        id: i + 1
    }));

    // Options ko randomly shuffle karo har baar
    const shuffledOptions = shuffleArray(optionsWithId);

    // Options Pool banao (click-to-fill)
    shuffledOptions.forEach(({ text, id }) => {

        const button = document.createElement("button");

        button.className = "word-btn";
        button.textContent = text;
        button.dataset.id = id;

        // Placeholder — button ki original jagah, jaha wo wapas aa sake
        const placeholder = document.createElement("div");
        placeholder.className = "word-placeholder";

        pool.appendChild(placeholder);
        placeholder.appendChild(button);

        // Click Event
        button.addEventListener("click", () => {

            // Already kisi blank me hai -> wapas pool me bhej do
            if (button.parentElement.classList.contains("blank-slot")) {

                placeholder.appendChild(button);
                return;

            }

            // Sabse pehla khaali blank dhundo
            const emptyBlank = [...document.querySelectorAll(".blank-slot")]
                .find(slot => slot.children.length === 0);

            if (!emptyBlank) return;

            fillBlankWithScroll(emptyBlank, button);

        });

    });

}


// Ek nayi cloze-line row banao
function createClozeLine() {

    const line = document.createElement("div");
    line.className = "cloze-line";

    return line;

}


// Check karo ki diya gaya blank abhi apne scrollable container
// (.cloze-lines) ke visible area ke andar hai ya nahi
function isBlankVisible(blank, container) {

    const blankRect = blank.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    return (
        blankRect.top >= containerRect.top &&
        blankRect.bottom <= containerRect.bottom
    );

}


// Blank agar abhi visible nahi hai to pehle uske paas auto-scroll
// karo (halka highlight ke saath), phir hi button ko usme daalo.
// Agar already visible hai to turant fill kar do.
function fillBlankWithScroll(blank, button) {

    const container = document.querySelector(".cloze-lines");

    if (isBlankVisible(blank, container)) {

        blank.appendChild(button);
        return;

    }

    blank.classList.add("scroll-highlight");

    blank.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });

    setTimeout(() => {

        blank.classList.remove("scroll-highlight");
        blank.appendChild(button);

    }, 350);

}


// Check Fill-Blank Answer -> true/false return karta hai
function checkFillBlankAnswer(question) {

    const currentSequence = [];

    document.querySelectorAll(".blank-slot").forEach(slot => {

        if (slot.firstElementChild) {

            currentSequence.push(
                Number(slot.firstElementChild.dataset.id)
            );

        } else {

            currentSequence.push(null);

        }

    });

    // Koi blank khaali hai ya length match nahi karti
    if (currentSequence.length !== question.correctSequence.length) {

        return false;

    }

    if (currentSequence.includes(null)) {

        return false;

    }

    // Compare Sequence
    return currentSequence.every((id, index) => {

        return id === question.correctSequence[index];

    });

}


// Apne aap ko registry me register karo
questionTypeHandlers["fill-blank"] = {
    render: renderFillBlankQuestion,
    check: checkFillBlankAnswer
};