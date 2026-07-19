let allFiles = [];      
let structuredPairs = []; 
let originalPairsOrder = []; 
let currentPairIndex = null;
let currentTrackInPair = null; 
let globalSpeed = 1.0;  

let savedPairs = new Set();
let hiddenPairs = new Set();
let easyPairs = new Set();
let hardPairs = new Set();

let lastDeletedPairInfo = null; 

let audioCtx = null;
let currentAudioElement = new Audio(); // Instanciar una sola vez
let currentSource = null;

const speedSlider = document.getElementById('speed-slider');
const speedDisplay = document.getElementById('speed-display');
const nowPlayingText = document.getElementById('now-playing-text');
const floatingBtn = document.getElementById('floating-play-pause');
const btnUndo = document.getElementById('btn-undo');
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const debugOutput = document.getElementById('debug-output');
const debugDeletedOutput = document.getElementById('debug-deleted-output');
const uploadStatus = document.getElementById('upload-status');
const autoplayToggle = document.getElementById('autoplay-toggle');

const groupEasyContainer = document.getElementById('group-easy-container');
const groupEasyList = document.getElementById('group-easy-list');
const groupHardContainer = document.getElementById('group-hard-container');
const groupHardList = document.getElementById('group-hard-list');
const groupPendingList = document.getElementById('group-pending-list');
const pendingTitleHeader = document.getElementById('pending-title-header');

function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    if (currentTheme === 'light') {
        document.documentElement.removeAttribute('data-theme');
        themeToggleBtn.textContent = '☀️ Modo Día';
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        themeToggleBtn.textContent = '🌙 Modo Noche';
    }
}

document.documentElement.setAttribute('data-theme', 'light');

// FUNCIÓN CLAVE: Carga automática desde la carpeta 'audio' sin JSON ni base de datos
// FUNCIÓN CLAVE: Carga automática desde la carpeta 'audio' sin JSON ni base de datos
async function loadAudioFolder() {
    uploadStatus.textContent = "Cargando..."; // Texto reducido al mínimo
    const uploadZone = document.querySelector('.upload-zone');

    try {
        const response = await fetch('datos.json');
        if (!response.ok) throw new Error("Error de archivo");
        
        const datos = await response.json();
        
        const files = datos.map(item => ({
            name: item.texto,
            url: `./audio/${item.archivo}` 
        }));

        allFiles = files;
        
        // OPTIMIZACIÓN DE ESPACIO: Ocultamos toda la caja de estado superior
        if (uploadZone) uploadZone.style.display = 'none';
        
        buildPairs();
        renderPairs();
        
        if(structuredPairs.length > 0) playPair(0, 0);

    } catch (error) {
        console.error(error);
        // Eliminamos el texto "Error: Verifica que datos.json exista."
        uploadStatus.innerHTML = "Error"; 
    }
}

// Cargar automáticamente al iniciar la página
window.addEventListener('DOMContentLoaded', () => {
    loadAudioFolder();
});

function buildPairs() {
    structuredPairs = [];
    for (let i = 0; i < allFiles.length; i += 2) {
        const track1 = allFiles[i]; 
        const track2 = allFiles[i + 1] || null; 
        
        structuredPairs.push({
            id: `par-${Math.floor(i/2) + 1}`,
            mainTitle: track1.name, 
            track1: track1,
            track2: track2
        });
    }
    originalPairsOrder = [...structuredPairs];
}

function renderPairs() {
    groupEasyList.innerHTML = '';
    groupHardList.innerHTML = '';
    groupPendingList.innerHTML = '';

    let hasEasy = false;
    let hasHard = false;
    let hasPending = false;
    
    structuredPairs.forEach((pair, index) => {
        const isSaved = savedPairs.has(pair.id);
        const isHidden = hiddenPairs.has(pair.id);
        const isEasy = easyPairs.has(pair.id);
        const isHard = hardPairs.has(pair.id);

        const block = document.createElement('div');
        let blockClass = 'pair-block';
        if (isSaved) blockClass += ' saved';
        if (isHidden) blockClass += ' hidden-pair';
        if (isEasy) blockClass += ' is-easy';
        if (isHard) blockClass += ' is-hard';

        block.className = blockClass;
        block.id = `block-${index}`;

        block.addEventListener('click', (e) => {
            if (e.target.closest('.btn-save-single') || 
                e.target.closest('.btn-hide-left') || 
                e.target.closest('.btn-easy-left') || 
                e.target.closest('.btn-hard-right') || 
                e.target.closest('.btn-inline-play') ||
                e.target.closest('.pair-nav-right')) return;
            playPair(index, 0); 
        });

        block.innerHTML = `
            <button class="btn-easy-left ${isEasy ? 'active' : ''}" title="Marcar como Fácil (Easy)" onclick="toggleEasy('${pair.id}', ${index}, event)">EASY</button>
            <button class="btn-hide-left" title="Ocultar y descartar par" onclick="hidePair('${pair.id}', ${index})">✕</button>
            <div class="pair-content-wrapper">
                <div class="pair-header">
                    <span class="pair-main-title">${pair.mainTitle}</span>
                    <button class="btn btn-save-single ${isSaved ? 'active' : ''}" 
                            onclick="toggleSavePair('${pair.id}', ${index})">
                        ${isSaved ? '✓ Guardado' : 'Guardar'}
                    </button>
                </div>
                <div class="pair-tracks">
                    <div class="track-cell" id="t-${index}-1" style="${!pair.track2 ? 'color:#444;' : ''}">
                        <span class="track-name-text">② ${pair.track2 ? pair.track2.name : '[Vacío]'}</span>
                        ${pair.track2 ? `<button class="btn-inline-play" onclick="playPair(${index}, 1)">▶ Escuchar</button>` : ''}
                    </div>
                </div>
            </div>
            <button class="btn-hard-right ${isHard ? 'active' : ''}" title="Marcar como Difícil (Hard)" onclick="toggleHard('${pair.id}', ${index}, event)">HARD</button>
            <div class="pair-nav-right">
                <button class="btn-nav-step" title="Audio anterior (Atrás)" onclick="navPrev(${index})">⏮</button>
                <button class="btn-nav-step" title="Siguiente audio (Adelante)" onclick="navNext(${index})">⏭</button>
            </div>
        `;

        if (isEasy) {
            groupEasyList.appendChild(block);
            hasEasy = true;
        } else if (isHard) {
            groupHardList.appendChild(block);
            hasHard = true;
        } else {
            groupPendingList.appendChild(block);
            hasPending = true;
        }
    });

    groupEasyContainer.style.display = hasEasy ? 'flex' : 'none';
    groupHardContainer.style.display = hasHard ? 'flex' : 'none';
    pendingTitleHeader.style.display = (hasEasy || hasHard) && hasPending ? 'block' : 'none';

    if (currentPairIndex !== null) {
        updateUIFocus();
    }
}

function forceNextPair() {
    if (currentPairIndex === null) return;
    let nextIndex = currentPairIndex + 1;
    while (nextIndex < structuredPairs.length && hiddenPairs.has(structuredPairs[nextIndex].id)) {
        nextIndex++;
    }
    playPair(nextIndex, 0);
}

function toggleEasy(pairId, index, event) {
    event.stopPropagation();
    const isCurrentlyPlaying = (currentPairIndex === index);
    if (isCurrentlyPlaying) {
        forceNextPair();
    }
    if (easyPairs.has(pairId)) {
        easyPairs.delete(pairId);
    } else {
        easyPairs.add(pairId);
        hardPairs.delete(pairId);
    }
    renderPairs();
}

function toggleHard(pairId, index, event) {
    event.stopPropagation();
    const isCurrentlyPlaying = (currentPairIndex === index);
    if (isCurrentlyPlaying) {
        forceNextPair();
    }
    if (hardPairs.has(pairId)) {
        hardPairs.delete(pairId);
    } else {
        hardPairs.add(pairId);
        easyPairs.delete(pairId);
    }
    renderPairs();
}

function shuffleList() {
    if (structuredPairs.length === 0) return;
    let easyList = structuredPairs.filter(p => easyPairs.has(p.id));
    let hardList = structuredPairs.filter(p => hardPairs.has(p.id));
    let pendingList = structuredPairs.filter(p => !easyPairs.has(p.id) && !hardPairs.has(p.id));

    const shuffle = (array) => {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    };

    shuffle(easyList);
    shuffle(hardList);
    shuffle(pendingList);

    // Guardamos el ID real de la pista actual antes de mezclar
    let activePairId = null;
    if (currentPairIndex !== null && structuredPairs[currentPairIndex]) {
        activePairId = structuredPairs[currentPairIndex].id;
    }

    // Mezclamos la lista (como ya lo tienes)
    structuredPairs = [...easyList, ...hardList, ...pendingList];

    // Buscamos dónde quedó esa pista en el nuevo orden
    if (activePairId !== null) {
        currentPairIndex = structuredPairs.findIndex(p => p.id === activePairId);
    }
    renderPairs();
}

function resetStraight() {
    if (originalPairsOrder.length === 0) return;
    let activePairId = null;
    if (currentPairIndex !== null && structuredPairs[currentPairIndex]) {
        activePairId = structuredPairs[currentPairIndex].id;
    }
    structuredPairs = [...originalPairsOrder];
    if (activePairId !== null) {
        currentPairIndex = structuredPairs.findIndex(p => p.id === activePairId);
    }
    renderPairs();
}

function playPair(index, trackNumber) {
    while (index < structuredPairs.length && index >= 0 && hiddenPairs.has(structuredPairs[index].id)) {
        index++;
        trackNumber = 0;
    }

    if (index >= structuredPairs.length || index < 0) {
        currentPairIndex = null;
        currentTrackInPair = null;
        nowPlayingText.textContent = "Fin de la lista";
        floatingBtn.style.display = "none";
        clearVisuals();
        stopCurrentAudio();
        return;
    }

    currentPairIndex = index;
    currentTrackInPair = trackNumber;
    
    const pair = structuredPairs[index];
    const trackData = trackNumber === 0 ? pair.track1 : pair.track2;
    
    if (!trackData) {
        if (autoplayToggle.checked) {
            goToNext();
        } else {
            updatePlayPauseUI(false);
        }
        return;
    }

    // Usamos la URL directa en lugar de crear Object URLs
    playAudioStream(trackData.url, trackData.name);
}

function stopCurrentAudio() {
    if (currentAudioElement && !currentAudioElement.paused) {
        currentAudioElement.pause();
        currentAudioElement.onended = null;
    }
}

function playAudioStream(url, fileName) {
    const ctx = getAudioContext();
    stopCurrentAudio(); // Pausa la pista anterior

    // Solo creamos el nodo de conexión si no existe aún
    if (!currentSource) {
        currentSource = ctx.createMediaElementSource(currentAudioElement);
        currentSource.connect(ctx.destination);
    }

    currentAudioElement.src = url;
    currentAudioElement.playbackRate = globalSpeed;
    currentAudioElement.preservesPitch = true; 
    currentAudioElement.mozPreservesPitch = true;
    currentAudioElement.webkitPreservesPitch = true;

    currentAudioElement.onended = function() {
        if (autoplayToggle.checked) {
            goToNext();
        } else {
            updatePlayPauseUI(false);
        }
    };

    currentAudioElement.play().catch(err => console.log("Interacción requerida:", err));
    
    updatePlayPauseUI(true);
    nowPlayingText.textContent = fileName;
    updateUIFocus();
}

function goToNext() {
    if (currentPairIndex === null) return;
    if (currentTrackInPair === 0) {
        const pair = structuredPairs[currentPairIndex];
        if (pair.track2) {
            playPair(currentPairIndex, 1);
        } else {
            playPair(currentPairIndex + 1, 0);
        }
    } else {
        playPair(currentPairIndex + 1, 0);
    }
}

function goToPrev() {
    if (currentPairIndex === null) return;
    if (currentTrackInPair === 1) {
        playPair(currentPairIndex, 0);
    } else {
        let targetIndex = currentPairIndex - 1;
        while (targetIndex >= 0 && hiddenPairs.has(structuredPairs[targetIndex].id)) {
            targetIndex--;
        }
        if (targetIndex >= 0) {
            const prevPair = structuredPairs[targetIndex];
            if (prevPair.track2) {
                playPair(targetIndex, 1);
            } else {
                playPair(targetIndex, 0);
            }
        }
    }
}

function navNext(index) {
    if (currentPairIndex !== index) {
        playPair(index, 0);
    } else {
        goToNext();
    }
}

function navPrev(index) {
    if (currentPairIndex !== index) {
        playPair(index, 0);
    } else {
        goToPrev();
    }
}

function togglePlayPause() {
    if (!currentAudioElement) return;
    if (!currentAudioElement.paused) {
        currentAudioElement.pause();
        updatePlayPauseUI(false);
    } else {
        getAudioContext();
        currentAudioElement.play();
        updatePlayPauseUI(true);
    }
}

function updatePlayPauseUI(playing) {
    if (currentPairIndex === null) {
        floatingBtn.style.display = "none";
        return;
    }
    floatingBtn.style.display = "flex";
    floatingBtn.textContent = playing ? "II" : "▶";
}

speedSlider.addEventListener('input', (e) => {
    globalSpeed = parseFloat(e.target.value);
    speedDisplay.textContent = `${globalSpeed.toFixed(2)}x`;
    if (currentAudioElement) {
        currentAudioElement.playbackRate = globalSpeed;
    }
});

function updateUIFocus() {
    clearVisuals();
    const activeBlock = document.getElementById(`block-${currentPairIndex}`);
    if (activeBlock) {
        activeBlock.classList.add('playing');
        activeBlock.scrollIntoView({ behavior: 'auto', block: 'center' });
        
        const rect = activeBlock.offsetTop;
        const blockHeight = activeBlock.offsetHeight;
        floatingBtn.style.top = `${rect + (blockHeight / 2) - 27}px`;
        floatingBtn.style.display = "flex";
    }
    
    if (currentTrackInPair === 1) {
        const activeCell = document.getElementById(`t-${currentPairIndex}-1`);
        if (activeCell) activeCell.classList.add('active-track');
    }
}

function clearVisuals() {
    document.querySelectorAll('.pair-block').forEach(b => b.classList.remove('playing'));
    document.querySelectorAll('.track-cell').forEach(c => c.classList.remove('active-track'));
}

function toggleSavePair(pairId, index) {
    if (savedPairs.has(pairId)) {
        savedPairs.delete(pairId);
    } else {
        savedPairs.add(pairId);
        if(hiddenPairs.has(pairId)) {
            hiddenPairs.delete(pairId);
            const block = document.getElementById(`block-${index}`);
            if (block) block.classList.remove('hidden-pair');
        }
    }

    const block = document.getElementById(`block-${index}`);
    if (block) {
        const btn = block.querySelector('.btn-save-single');
        if (savedPairs.has(pairId)) {
            block.classList.add('saved');
            btn.classList.add('active');
            btn.textContent = '✓ Guardado';
        } else {
            block.classList.remove('saved');
            btn.classList.remove('active');
            btn.textContent = 'Guardar';
        }
    }
    updateAllDebugTexts();
}

function hidePair(pairId, index) {
    hiddenPairs.add(pairId);
    lastDeletedPairInfo = { id: pairId, index: index };
    btnUndo.classList.add('active');
    
    if(savedPairs.has(pairId)) {
        savedPairs.delete(pairId);
        const block = document.getElementById(`block-${index}`);
        if (block) {
            block.classList.remove('saved');
            const btn = block.querySelector('.btn-save-single');
            btn.classList.remove('active');
            btn.textContent = 'Guardar';
        }
    }

    const block = document.getElementById(`block-${index}`);
    if (block) block.classList.add('hidden-pair');
    updateAllDebugTexts();

    if (currentPairIndex === index) {
        if (autoplayToggle.checked) {
            goToNext();
        } else {
            updatePlayPauseUI(false);
        }
    }
}

function triggerUndo() {
    if (!lastDeletedPairInfo) return;
    const { id, index } = lastDeletedPairInfo;
    hiddenPairs.delete(id);
    
    const block = document.getElementById(`block-${index}`);
    if (block) {
        block.classList.remove('hidden-pair');
    }
    
    updateAllDebugTexts();
    btnUndo.classList.remove('active');
    lastDeletedPairInfo = null;

    if (currentPairIndex === index) {
        updateUIFocus();
    }
}

function updateAllDebugTexts() {
    let savedText = "";
    let deletedText = "";
    
    structuredPairs.forEach(pair => {
        if (savedPairs.has(pair.id)) {
            savedText += `${pair.track1.name}\n`;
            if (pair.track2) savedText += `${pair.track2.name}\n`;
            savedText += `---------------------------\n`;
        }
        if (hiddenPairs.has(pair.id)) {
            deletedText += `${pair.track1.name}\n`;
            if (pair.track2) deletedText += `${pair.track2.name}\n`;
            deletedText += `---------------------------\n`;
        }
    });

    debugOutput.value = savedText;
    debugDeletedOutput.value = deletedText;
}

async function copyList(elementId) {
    const textarea = document.getElementById(elementId);
    if (!textarea.value.trim()) return;
    
    try {
        await navigator.clipboard.writeText(textarea.value);
        // Opcional: Podrías cambiar el texto del botón temporalmente para dar feedback visual
        console.log("Copiado al portapapeles");
    } catch (err) {
        console.error("Error al copiar: ", err);
    }
}
