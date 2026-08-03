// =========================
// SEQUENCE QUESTION TYPE
// (rendering + answer-check logic specific to "sequence" type questions)
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


// Render Sequence Question
// (drop slots + shuffled draggable/clickable word buttons banata hai)
function renderSequenceQuestion(question) {

    const dragZone = document.querySelector(".drag-zone");
    const dropZone = document.querySelector(".drop-zone");
    dragZone.innerHTML = "";
    dropZone.innerHTML = "";

    // Create Drop Slots
    question.options.forEach(() => {

        const slot = document.createElement("div");
        slot.className = "drop-slot";

        dropZone.appendChild(slot);

    });

    // Original id (1-based) ke saath options ko pair karo,
    // taaki shuffle hone ke baad bhi correctSequence check
    // sahi rahe (id hamesha original position ko refer karega)
    const optionsWithId = question.options.map((text, i) => ({
        text,
        id: i + 1
    }));

    // Options ko randomly shuffle karo har baar
    const shuffledOptions = shuffleArray(optionsWithId);

    // Create Buttons (shuffled order me)
    shuffledOptions.forEach(({ text, id }) => {

        const button = document.createElement("button");

        button.className = "word-btn";
        button.textContent = text;
        button.dataset.id = id;

        // Placeholder
        const placeholder = document.createElement("div");
        placeholder.className = "word-placeholder";

        dragZone.appendChild(placeholder);
        placeholder.appendChild(button);

        // Click Event
        button.addEventListener("click", () => {

            // Return to Original Position
            if (button.parentElement.classList.contains("drop-slot")) {

                placeholder.appendChild(button);
                return;

            }

            // Find Empty Slot
            const emptySlot = [...document.querySelectorAll(".drop-slot")]
                .find(slot => slot.children.length === 0);

            if (emptySlot) {

                emptySlot.appendChild(button);

            }

        });

    });

}


// Check Sequence Answer -> true/false return karta hai
// (script.js isko call karke result use karega)
function checkSequenceAnswer(question) {

    const currentSequence = [];

    document.querySelectorAll(".drop-slot").forEach(slot => {

        if (slot.firstElementChild) {

            currentSequence.push(
                Number(slot.firstElementChild.dataset.id)
            );

        }

    });

    // Not Filled Completely
    if (currentSequence.length !== question.correctSequence.length) {

        return false;

    }

    // Compare Sequence
    return currentSequence.every((value, index) => {

        return value === question.correctSequence[index];

    });

}


// Apne aap ko registry me register karo
// (questionTypeHandlers script.js me already declared/initialized hai —
// yeh file dynamically load hoti hai jab bhi "sequence" type ka
// question aaye, script.js ke loadQuestionLayout() ke through)
questionTypeHandlers.sequence = {
    render: renderSequenceQuestion,
    check: checkSequenceAnswer
};