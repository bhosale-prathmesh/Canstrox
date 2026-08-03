// =========================
// LEVEL MAP
// (app khulte hi sabse pehle yahi screen dikhti hai — Firestore
// ke "levels" collection se sabhi levels fetch karke ek zigzag
// path me "<N>" chevron-shaped nodes render karta hai.
//
// INTERACTION:
// - "current" level (jo abhi khelne ke liye unlock hai) hamesha
//   expanded rehta hai — title + Play bina hover/tap ke hi
//   dikhte hain.
// - DESKTOP (hover:hover + pointer:fine): kisi bhi unlocked node
//   par mouse le jaane se wo glide karke chaudा ho jaata hai aur
//   title + Play reveal hote hain. Zigzag row alignment
//   (flex-start/flex-end) ki wajah se node hamesha apni khaali
//   side ki taraf hi khulta hai (opposite side move). Click karne
//   se seedha level start ho jaata hai.
// - MOBILE (no hover): tap karne se node 90° rotate hota hai
//   (taaki laga ki neeche kuch khulne wala hai) aur bottom se ek
//   sheet slide-up hoti hai jisme title + Play button hota hai.
//
// Lock/Unlock progress localStorage se (UNLOCKED_LEVEL_KEY —
// script.js me bhi yahi key duplicate hai, taaki map.js
// standalone bhi kaam kare).
//
// HEARTS: sirf CURRENT (agla unlock hone wala) level hi hearts se
// bandha hota hai — hearts khatam hote hi wo bhi ek normal locked
// node ban jaata hai (disabled, click par kuch nahi hota).
// Completed/practice levels hearts se bilkul unaffected rehte hain,
// hamesha khule/khelne-layak rehte hain (script.js me unhe khelne
// se galat answer par heart nahi kategi, aur complete karne par
// ek heart wapas mil sakta hai agar full nahi hain).
// =========================

const MAP_UNLOCKED_LEVEL_KEY = "learnova_unlocked_level";

// Hearts — script.js me bhi yahi key/max duplicate hai (waisa hi
// jaisa unlocked-level ke liye pehle se ho raha hai), taaki map.js
// standalone bhi kaam kare
const MAP_HEARTS_KEY = "learnova_hearts";
const MAP_MAX_HEARTS = 3;

let mapResizeListenerAttached = false;
let activeMobileLevel = null;
let activeMobileNodeEl = null;


// Ab tak kaunsa level unlock ho chuka hai (default: 1)
function getUnlockedLevelForMap() {

    const stored = Number(localStorage.getItem(MAP_UNLOCKED_LEVEL_KEY));

    return stored && stored > 0 ? stored : 1;

}


// Abhi kitne hearts bache hain (default: full)
function getHeartsForMap() {

    const stored = localStorage.getItem(MAP_HEARTS_KEY);

    if (stored === null) return MAP_MAX_HEARTS;

    const n = Number(stored);

    return Number.isFinite(n) ? Math.max(0, Math.min(MAP_MAX_HEARTS, n)) : MAP_MAX_HEARTS;

}

// Sidebar ke stats-card wale hearts display ko sync karo
function renderMapHeartsDisplay() {

    const el = document.querySelector(".map-stat-hearts .map-stat-value");
    if (!el) return;

    const current = getHeartsForMap();
    let html = "";

    for (let i = 0; i < MAP_MAX_HEARTS; i++) {

        html += i < current ? "❤️" : "🖤";

    }

    el.textContent = html;

}


// Desktop hai (real mouse hover support) ya touch/mobile
function isDesktopHoverCapable() {

    return window.matchMedia("(hover: hover) and (pointer: fine)").matches;

}


// Firestore se sabhi levels fetch karo, levelNo ke hisaab se sorted
async function fetchLevels() {

    const snapshot = await db
        .collection("levels")
        .orderBy("levelNo")
        .get();

    return snapshot.docs.map(doc => doc.data());

}


// Poora Map Render Karo
async function renderMap() {

    const pathContainer = document.querySelector(".map-path");
    const svg = document.querySelector(".map-lines");

    if (!pathContainer) return;

    pathContainer.innerHTML = `
        <div class="map-status map-loading">
            <div class="map-loader"><span></span><span></span><span></span></div>
            <p>Levels load ho rahe hain...</p>
        </div>
    `;
    if (svg) svg.innerHTML = "";

    closeMobileSheet();

    let levels;

    try {

        levels = await fetchLevels();

    } catch (error) {

        console.error(error);
        pathContainer.innerHTML = `
            <div class="map-status error">
                <span class="map-status-icon">⚠</span>
                <p>Levels load nahi ho paaye. Console check karo.</p>
            </div>
        `;
        return;

    }

    if (!levels.length) {

        pathContainer.innerHTML = `
            <div class="map-status">
                <p>Abhi koi level nahi mila — pehle temp.html se questions upload karo.</p>
            </div>
        `;
        return;

    }

    pathContainer.innerHTML = "";

    renderMapHeartsDisplay();

    const unlockedLevel = getUnlockedLevelForMap();

    levels.forEach((level, index) => {

        pathContainer.appendChild(
            createLevelNode(level, index, unlockedLevel)
        );

    });

    // Nodes DOM me render hone ke baad hi unki actual position
    // pata chalti hai. Entrance animation (staggered slide-in) ke
    // poore duration tak lines ko HAR FRAME redraw karte raho —
    // warna nodes to move karte rehte hain lekin lines ek purani
    // (galat) position par frozen reh jaati, aur bracket-corners
    // se disconnect dikhta
    const entranceDuration = (levels.length - 1) * 70 + 650;
    animateLines(entranceDuration);

    if (!mapResizeListenerAttached) {

        window.addEventListener("resize", () => drawMapLines());
        mapResizeListenerAttached = true;

    }

}


// Ek level ka node (row + chevron button) banao
function createLevelNode(level, index, unlockedLevel) {

    const isNextLevel = level.levelNo === unlockedLevel;
    const isCompleted = level.levelNo < unlockedLevel;
    const isBeyondUnlocked = level.levelNo > unlockedLevel;

    // Hearts ka feature SIRF current (agla unlock hone wala) level
    // par lagta hai — hearts khatam hote hi ye bhi ek normal locked
    // node ki tarah ban jaata hai (disabled, click par kuch nahi
    // hota). Completed/practice levels hearts se bilkul unaffected
    // rehte hain — wo hamesha khule (khelne layak) rehte hain.
    //
    // LEVEL 1 EXCEPTION: level 1 kabhi bhi heart-lock nahi hota,
    // chahe hearts 0 hi kyun na hon — kyunki abhi tak koi bhi
    // completed/practice level hi nahi hai jisse heart wapas kamaya
    // ja sake, isliye lock hone par poora game hamesha ke liye
    // atak jaata (script.js me bhi level 1 isi wajah se hearts ke
    // consequence — heart loss/game-over — se azaad rakha gaya hai)
    const isHeartLocked = isNextLevel && level.levelNo !== 1 && getHeartsForMap() <= 0;
    const isLocked = isBeyondUnlocked || isHeartLocked;

    // "current" class (glow effect) sirf tabhi lagao jab level
    // waqai khelne layak ho — hearts khatam hone par ye visually
    // bhi ek plain locked node jaisa hi dikhna chahiye
    const isCurrent = isNextLevel && !isHeartLocked;

    const row = document.createElement("div");
    row.className = "map-node-row " + (index % 2 === 0 ? "align-left" : "align-right");
    // Har node thodi der ruk ke, ek ke baad ek reveal ho (staggered)
    row.style.animationDelay = (index * 70) + "ms";

    const node = document.createElement("button");
    node.className = "map-node";
    node.dataset.level = level.levelNo;

    if (isLocked) node.classList.add("locked");
    if (isCurrent) node.classList.add("current");
    if (isCompleted) node.classList.add("completed");

    node.disabled = isLocked;

    // Asli "<" aur ">" bracket characters — inhi ke corners se
    // connecting lines judti hain (drawMapLines me), node ke
    // overall center se nahi
    const leftBracket = document.createElement("span");
    leftBracket.className = "node-bracket node-bracket-left";
    leftBracket.textContent = "<";

    const rightBracket = document.createElement("span");
    rightBracket.className = "node-bracket node-bracket-right";
    rightBracket.textContent = ">";

    // Andar ka content ek "node-inner" span me hai taaki mobile
    // rotate hone par ise counter-rotate karke upright rakh sakein
    const inner = document.createElement("span");
    inner.className = "node-inner";

    const number = document.createElement("span");
    number.className = "node-number";
    number.textContent = isLocked ? "🔒" : level.levelNo;

    const title = document.createElement("span");
    title.className = "node-title";
    title.textContent = level.title || `Level ${level.levelNo}`;

    const play = document.createElement("span");
    play.className = "node-play";

    play.textContent = isCompleted ? "Practice" : "Play";

    inner.appendChild(number);
    inner.appendChild(title);
    inner.appendChild(play);

    node.appendChild(leftBracket);
    node.appendChild(inner);
    node.appendChild(rightBracket);

    if (!isLocked) {

        node.addEventListener("click", () => handleNodeClick(level, node));

        // Har unlocked node (current bhi) ke hover ke dauran
        // chain-lines ko bhi glide karte rehne do
        node.addEventListener("mouseenter", () => animateLines(420));
        node.addEventListener("mouseleave", () => animateLines(420));

    }

    row.appendChild(node);

    return row;

}


// Node click hone par decide karo: DESKTOP par (jahan hover se
// pehle hi preview mil chuka hota hai) seedha level start karo.
// MOBILE par current aur completed dono levels ke liye bottom-sheet
// popup hi dikhao (koi bypass nahi) — locked wale ab bhi click nahi
// karne dete (upar hi handler attach nahi hota unlocked par).
function handleNodeClick(level, nodeEl) {

    // Hearts khatam hone par current level node ab khud hi
    // "locked" (disabled) ho chuka hota hai, isliye us par click
    // listener attach hi nahi hota — ye function sirf tab call
    // hota hai jab level waqai khelne layak ho (current level with
    // hearts, ya koi bhi completed/practice level, jinhe hearts se
    // koi farak nahi padta)
    if (isDesktopHoverCapable()) {

        triggerLaunchFlash(() => {

            if (window.startLevel) window.startLevel(level.levelNo);

        });
        return;

    }

    // Mobile: toggle — dobara usi node par tap karne se sheet band ho
    if (activeMobileLevel === level.levelNo) {

        closeMobileSheet();

    } else {

        openMobileSheet(level, nodeEl);

    }

}


// =========================
// MOBILE BOTTOM SHEET
// (ek hi sheet DOM me banti hai, dynamically — reuse hoti hai
// har level ke liye)
// =========================

function ensureMobileSheet() {

    if (document.querySelector(".map-sheet-overlay")) return;

    const overlay = document.createElement("div");
    overlay.className = "map-sheet-overlay";

    const sheet = document.createElement("div");
    sheet.className = "map-sheet";

    const handle = document.createElement("div");
    handle.className = "map-sheet-handle";

    const title = document.createElement("div");
    title.className = "map-sheet-title";

    const playBtn = document.createElement("button");
    playBtn.className = "map-sheet-play";
    playBtn.textContent = "Play";

    sheet.appendChild(handle);
    sheet.appendChild(title);
    sheet.appendChild(playBtn);
    overlay.appendChild(sheet);
    document.body.appendChild(overlay);

    // Overlay ke khaali (backdrop) area par tap -> sheet band ho
    overlay.addEventListener("click", event => {

        if (event.target === overlay) closeMobileSheet();

    });

    playBtn.addEventListener("click", () => {

        const levelToStart = activeMobileLevel;
        closeMobileSheet();

        if (levelToStart != null && window.startLevel) {

            triggerLaunchFlash(() => window.startLevel(levelToStart));

        }

    });

}

function openMobileSheet(level, nodeEl) {

    ensureMobileSheet();

    // Agar koi aur node already open tha, usse pehle band karo
    if (activeMobileNodeEl && activeMobileNodeEl !== nodeEl) {

        activeMobileNodeEl.classList.remove("mobile-open");

    }

    activeMobileLevel = level.levelNo;
    activeMobileNodeEl = nodeEl;

    const titleEl = document.querySelector(".map-sheet-title");
    const playBtn = document.querySelector(".map-sheet-play");
    const isCompleted = nodeEl.classList.contains("completed");

    titleEl.textContent = level.title || `Level ${level.levelNo}`;
    playBtn.textContent = isCompleted ? "Practice" : "Play";

    nodeEl.classList.add("mobile-open");

    document.querySelector(".map-sheet-overlay").classList.add("show");

    // Node rotate hone (mobile-open) ke transition ke poore
    // duration tak lines ko redraw karte raho, warna bracket
    // rotate hoke move ho jaata hai lekin line purani jagah
    // frozen reh jaati hai
    animateLines(320);

}

function closeMobileSheet() {

    const overlay = document.querySelector(".map-sheet-overlay");
    if (overlay) overlay.classList.remove("show");

    if (activeMobileNodeEl) activeMobileNodeEl.classList.remove("mobile-open");

    activeMobileLevel = null;
    activeMobileNodeEl = null;

    // Yahan bhi — rotate-back transition ke dauran lines ko
    // sync me redraw karte raho
    animateLines(320);

}


// =========================
// CONNECTING LINES
// =========================

// Har consecutive level-node ke beech ek connecting line kheencho
// (locked wale aage se dashed/grey, unlocked wale solid/colorful)
function drawMapLines() {

    const svg = document.querySelector(".map-lines");
    const scrollEl = document.querySelector(".map-scroll");
    const nodes = [...document.querySelectorAll(".map-node")];

    if (!svg || !scrollEl || nodes.length < 2) return;

    svg.innerHTML = "";

    const totalHeight = scrollEl.scrollHeight;
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", totalHeight);
    svg.style.height = totalHeight + "px";

    const scrollRect = scrollEl.getBoundingClientRect();

    for (let i = 0; i < nodes.length - 1; i++) {

        const nodeA = nodes[i];
        const nodeB = nodes[i + 1];

        // Node ke center se NAHI — "<"/">" bracket ke corner
        // (jo bhi bracket doosre node ki taraf "face" karta hai)
        // se connection banao
        const aCenterX = nodeA.getBoundingClientRect().left
            + nodeA.getBoundingClientRect().width / 2;
        const bCenterX = nodeB.getBoundingClientRect().left
            + nodeB.getBoundingClientRect().width / 2;

        const aIsRight = bCenterX >= aCenterX;
        const aBracket = aIsRight
            ? nodeA.querySelector(".node-bracket-right")
            : nodeA.querySelector(".node-bracket-left");

        const bIsLeft = aCenterX <= bCenterX;
        const bBracket = bIsLeft
            ? nodeB.querySelector(".node-bracket-left")
            : nodeB.querySelector(".node-bracket-right");

        // ">" ka pointy tip uske RIGHT edge par hai, "<" ka tip
        // uske LEFT edge par — isliye bracket ke CENTER ki jagah
        // uske sahi outer edge se anchor lo, warna line tip se
        // "aage nikal" jaati hai
        const a = aBracket.getBoundingClientRect();
        const b = bBracket.getBoundingClientRect();

        const x1 = (aIsRight ? a.right : a.left) - scrollRect.left + scrollEl.scrollLeft;
        const y1 = a.top + a.height / 2 - scrollRect.top + scrollEl.scrollTop;
        const x2 = (bIsLeft ? b.left : b.right) - scrollRect.left + scrollEl.scrollLeft;
        const y2 = b.top + b.height / 2 - scrollRect.top + scrollEl.scrollTop;

        const isNextLocked = nodes[i + 1].classList.contains("locked");

        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", x1);
        line.setAttribute("y1", y1);
        line.setAttribute("x2", x2);
        line.setAttribute("y2", y2);
        line.setAttribute("stroke", isNextLocked ? "#2A3550" : "#7C5CFF");
        line.setAttribute("stroke-width", "3");
        line.setAttribute("stroke-linecap", "round");

        if (isNextLocked) line.setAttribute("stroke-dasharray", "8,8");

        svg.appendChild(line);

    }

}


// Node expand/collapse hone (hover glide) ke dauran, poori
// transition duration ke liye har frame par lines ko redraw karo —
// taaki connecting line bhi node ke saath smoothly glide kare
function animateLines(durationMs) {

    const start = performance.now();

    function step(now) {

        drawMapLines();

        if (now - start < durationMs) {

            requestAnimationFrame(step);

        }

    }

    requestAnimationFrame(step);

}


// =========================
// LAUNCH FLASH
// (level start hone se pehle ek quick "warp" flash — index.html
// me ek fixed .map-launch-flash overlay div hai, map.css uski
// animation define karti hai. Flash ke bilkul peak point par hi
// view switch karte hain, taaki transition smooth cut jaisa lage)
// =========================
function triggerLaunchFlash(onDone) {

    const flash = document.querySelector(".map-launch-flash");

    if (!flash) {

        onDone();
        return;

    }

    flash.classList.add("flash");

    setTimeout(() => {

        onDone();
        flash.classList.remove("flash");

    }, 260);

}


// Baaki files (config.js, script.js) is file se pehle load hote
// hain (index.html me order dekho), isliye "db" aur
// "window.startLevel" is point tak available hote hain
window.renderMap = renderMap;

document.addEventListener("DOMContentLoaded", renderMap);