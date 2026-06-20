// uiFlow.js - Manages the complete UI flow from loading to gameplay

import { isWalletConnected, getUserPublicKey } from "./walletState.js";
import { createSolanaWalletButton } from "./walletConnection.js";
import { initBackgroundMusic, playBackgroundMusic, isMusicPlayingNow } from "./audioUtils.js";
import { audioContext, MUSIC_VOLUME } from "./main.js";

// UI Flow States
export const UI_STATES = {
    LOADING: 'loading',
    WALLET_CONNECT: 'wallet_connect',
    GAME_MODE_SELECT: 'game_mode_select',
    MULTIPLAYER_LOBBY: 'multiplayer_lobby',
    SINGLE_PLAYER_LOBBY: 'single_player_lobby',
    GAMEPLAY: 'gameplay'
};

let currentUIState = UI_STATES.LOADING;
let uiFlowCallbacks = {};

// DOM Elements
let uiContainer = null;
let loadingScreen = null;
let walletScreen = null;
let gameModeScreen = null;
let multiplayerLobbyScreen = null;
let singlePlayerLobbyScreen = null;

// Initialize the UI Flow
export function initUIFlow() {
    createUIContainer();
    createLoadingScreen();
    createWalletConnectScreen();
    createGameModeSelectScreen();
    createMultiplayerLobbyScreen();
    createSinglePlayerLobbyScreen();
    
    // Start with loading screen
    showState(UI_STATES.LOADING);
    
    // Auto transition from loading after a delay (or when game assets are loaded)
    setTimeout(() => {
        if (currentUIState === UI_STATES.LOADING) {
            showState(UI_STATES.WALLET_CONNECT);
        }
    }, 3000);
    
    return {
        onStateChange: (callback) => {
            uiFlowCallbacks.onStateChange = callback;
        }
    };
}

// Create main UI container
function createUIContainer() {
    uiContainer = document.createElement('div');
    uiContainer.id = 'ui-flow-container';
    uiContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 10000;
        pointer-events: none;
        font-family: 'Arial', sans-serif;
    `;
    document.body.appendChild(uiContainer);
}

// Show specific state
function showState(state) {
    currentUIState = state;
    
    // Hide all screens
    const screens = [loadingScreen, walletScreen, gameModeScreen, multiplayerLobbyScreen, singlePlayerLobbyScreen];
    screens.forEach(screen => {
        if (screen) screen.style.display = 'none';
    });
    
    // Show current screen
    switch(state) {
        case UI_STATES.LOADING:
            if (loadingScreen) loadingScreen.style.display = 'flex';
            break;
        case UI_STATES.WALLET_CONNECT:
            if (walletScreen) walletScreen.style.display = 'flex';
            break;
        case UI_STATES.GAME_MODE_SELECT:
            if (gameModeScreen) gameModeScreen.style.display = 'flex';
            break;
        case UI_STATES.MULTIPLAYER_LOBBY:
            if (multiplayerLobbyScreen) multiplayerLobbyScreen.style.display = 'flex';
            break;
        case UI_STATES.SINGLE_PLAYER_LOBBY:
            if (singlePlayerLobbyScreen) singlePlayerLobbyScreen.style.display = 'flex';
            break;
        case UI_STATES.GAMEPLAY:
            // Hide all UI screens when gameplay starts
            uiContainer.style.display = 'none';
            break;
    }
    
    if (uiFlowCallbacks.onStateChange) {
        uiFlowCallbacks.onStateChange(state);
    }
}

// Create Loading Screen
function createLoadingScreen() {
    loadingScreen = document.createElement('div');
    loadingScreen.className = 'ui-screen';
    loadingScreen.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        pointer-events: auto;
        color: white;
    `;
    
    // ASCII Art Logo
    const asciiContainer = document.createElement('pre');
    asciiContainer.style.cssText = `
        color: #00ff88;
        font-size: 12px;
        text-shadow: 0 0 10px rgba(0, 255, 136, 0.5);
        margin-bottom: 40px;
        text-align: center;
        animation: glow 2s ease-in-out infinite;
    `;
    asciiContainer.textContent = `
    ┌─────────────────────────────────────┐    
    │                                     │    
    │     ██╗   ██╗██████╗ ██████╗        │    
    │     ██║   ██║██╔══██╗██╔══██╗       │    
    │     ██║   ██║██████╔╝██████╔╝       │    
    │     ██║   ██║██╔══██╗██╔══██╗       │    
    │     ╚██████╔╝██║  ██║██████╔╝       │    
    │      ╚═════╝ ╚═╝  ╚═╝╚═════╝        │    
    │                                     │    
    │         ██████╗ ███████╗            │    
    │         ██╔══██╗██╔════╝            │    
    │         ██████╔╝█████╗              │    
    │         ██╔══██╗██╔══╝              │    
    │         ██║  ██║███████╗            │    
    │         ╚═╝  ╚═╝╚══════╝            │    
    │                                     │    
    │          [ U R B A N ]              │    
    │     [ R E Q U I S I T I O N ]       │    
    │                                     │    
    └─────────────────────────────────────┘    
    `;
    
    // Loading text with glitch effect
    const loadingText = document.createElement('div');
    loadingText.className = 'glitch';
    loadingText.setAttribute('data-glitch', 'LOADING...');
    loadingText.textContent = 'LOADING...';
    loadingText.style.cssText = `
        font-size: 24px;
        color: white;
        margin-top: 20px;
    `;
    
    // Progress bar
    const progressBar = document.createElement('div');
    progressBar.style.cssText = `
        width: 300px;
        height: 4px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 2px;
        margin-top: 30px;
        overflow: hidden;
    `;
    
    const progressFill = document.createElement('div');
    progressFill.style.cssText = `
        width: 0%;
        height: 100%;
        background: linear-gradient(90deg, #00ff88, #00ccff);
        animation: loading 3s ease-in-out forwards;
    `;
    progressBar.appendChild(progressFill);
    
    // Add keyframe animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes loading {
            0% { width: 0%; }
            100% { width: 100%; }
        }
        @keyframes glow {
            0% { text-shadow: 0 0 10px rgba(0, 255, 136, 0.5); }
            50% { text-shadow: 0 0 20px rgba(0, 255, 136, 0.8); }
            100% { text-shadow: 0 0 10px rgba(0, 255, 136, 0.5); }
        }
        .glitch {
            position: relative;
        }
        .glitch::before,
        .glitch::after {
            content: attr(data-glitch);
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
        }
        .glitch::before {
            animation: glitch-effect 3s infinite;
            color: #ff00ff;
            z-index: -1;
        }
        .glitch::after {
            animation: glitch-effect 2s infinite reverse;
            color: #00ffff;
            z-index: -2;
        }
        @keyframes glitch-effect {
            0% { transform: translate(0); }
            20% { transform: translate(-2px, 2px); }
            40% { transform: translate(-2px, -2px); }
            60% { transform: translate(2px, 2px); }
            80% { transform: translate(2px, -2px); }
            100% { transform: translate(0); }
        }
    `;
    document.head.appendChild(style);
    
    loadingScreen.appendChild(asciiContainer);
    loadingScreen.appendChild(loadingText);
    loadingScreen.appendChild(progressBar);
    uiContainer.appendChild(loadingScreen);
}

// Create Wallet Connect Screen
function createWalletConnectScreen() {
    walletScreen = document.createElement('div');
    walletScreen.className = 'ui-screen';
    walletScreen.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        display: none;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        pointer-events: auto;
        color: white;
    `;
    
    const container = document.createElement('div');
    container.style.cssText = `
        background: rgba(0, 0, 0, 0.8);
        padding: 40px;
        border-radius: 20px;
        border: 1px solid rgba(0, 255, 136, 0.3);
        text-align: center;
        max-width: 400px;
        width: 90%;
        animation: fadeIn 0.5s ease-out;
    `;
    
    const title = document.createElement('h1');
    title.textContent = 'CONNECT WALLET';
    title.style.cssText = `
        color: #00ff88;
        font-size: 32px;
        margin-bottom: 20px;
        text-shadow: 0 0 10px rgba(0, 255, 136, 0.5);
    `;
    
    const description = document.createElement('p');
    description.textContent = 'Connect your Solana wallet to continue';
    description.style.cssText = `
        color: #aaa;
        margin-bottom: 30px;
        font-size: 16px;
    `;
    
    const walletButton = document.createElement('button');
    walletButton.id = 'flow-wallet-button';
    walletButton.textContent = 'Connect Wallet';
    walletButton.style.cssText = `
        background: linear-gradient(45deg, #00ff88, #00ccff);
        color: #000;
        border: none;
        padding: 8px 20px;
        font-size: 18px;
        font-weight: bold;
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.3s;
        margin-bottom: 20px;
        position: relative;
        overflow: hidden;
    `;
    
    walletButton.addEventListener('mouseenter', () => {
        walletButton.style.transform = 'scale(1.05)';
        walletButton.style.boxShadow = '0 0 30px rgba(0, 255, 136, 0.5)';
    });
    
    walletButton.addEventListener('mouseleave', () => {
        walletButton.style.transform = 'scale(1)';
        walletButton.style.boxShadow = 'none';
    });
    
    const skipButton = document.createElement('button');
    skipButton.textContent = 'Skip (Play Off Chain)';
    skipButton.style.cssText = `
        background: transparent;
        color: #666;
        border: 1px solid #333;
        padding: 10px 20px;
        font-size: 14px;
        border-radius: 5px;
        cursor: pointer;
        transition: all 0.3s;
    `;
    
    skipButton.addEventListener('mouseenter', () => {
        skipButton.style.color = '#fff';
        skipButton.style.borderColor = '#666';
    });
    
    skipButton.addEventListener('mouseleave', () => {
        skipButton.style.color = '#666';
        skipButton.style.borderColor = '#333';
    });
    
    skipButton.addEventListener('click', () => {
        showState(UI_STATES.GAME_MODE_SELECT);
    });
    
    container.appendChild(title);
    container.appendChild(description);
    container.appendChild(walletButton);
    container.appendChild(skipButton);
    walletScreen.appendChild(container);
    uiContainer.appendChild(walletScreen);
    
    // Initialize wallet button with callback
    createSolanaWalletButton('#flow-wallet-button', (publicKey) => {
        console.log('Wallet connected in UI Flow:', publicKey);
        if (publicKey) {
            // Wallet connected successfully
            setTimeout(() => {
                showState(UI_STATES.GAME_MODE_SELECT);
            }, 1000);
        }
    });
}

// Create Game Mode Select Screen
function createGameModeSelectScreen() {
    gameModeScreen = document.createElement('div');
    gameModeScreen.className = 'ui-screen';
    gameModeScreen.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        display: none;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        pointer-events: auto;
        color: white;
    `;
    
    const container = document.createElement('div');
    container.style.cssText = `
        background: rgba(0, 0, 0, 0.8);
        padding: 40px;
        border-radius: 20px;
        border: 1px solid rgba(0, 255, 136, 0.3);
        text-align: center;
        max-width: 600px;
        width: 90%;
    `;
    
    const title = document.createElement('h1');
    title.textContent = 'SELECT GAME MODE';
    title.style.cssText = `
        color: #00ff88;
        font-size: 32px;
        margin-bottom: 40px;
        text-shadow: 0 0 10px rgba(0, 255, 136, 0.5);
    `;
    
    const modesContainer = document.createElement('div');
    modesContainer.style.cssText = `
        display: flex;
        gap: 20px;
        justify-content: center;
        margin-bottom: 30px;
    `;
    
    // Single Player Card
    const singlePlayerCard = createModeCard(
        '🎮 SINGLE PLAYER',
        'Experience the story alone',
        ['Campaign Mode', 'Practice & Explore', 'Learn the Mechanics']
    );
    singlePlayerCard.addEventListener('click', () => {
        showState(UI_STATES.SINGLE_PLAYER_LOBBY);
    });
    
    // Multiplayer Card
    const multiplayerCard = createModeCard(
        '👥 MULTIPLAYER',
        'Fight together or compete',
        ['Co-op Campaign', 'Team Deathmatch', 'Extraction Mode'],
        true
    );
    multiplayerCard.addEventListener('click', () => {
        if (!isWalletConnected()) {
            alert('Please connect your wallet for multiplayer features');
            showState(UI_STATES.WALLET_CONNECT);
        } else {
            showState(UI_STATES.MULTIPLAYER_LOBBY);
        }
    });
    
    modesContainer.appendChild(singlePlayerCard);
    modesContainer.appendChild(multiplayerCard);
    
    const backButton = createBackButton(() => {
        showState(UI_STATES.WALLET_CONNECT);
    });
    
    container.appendChild(title);
    container.appendChild(modesContainer);
    container.appendChild(backButton);
    gameModeScreen.appendChild(container);
    uiContainer.appendChild(gameModeScreen);
}

// Helper function to create mode cards
function createModeCard(title, isMultiplayer = false) {
    const card = document.createElement('div');
    card.style.cssText = `
        background: rgba(255, 255, 255, 0.05);
        border: 2px solid ${isMultiplayer ? '#00ff88' : '#00ccff'};
        border-radius: 15px;
        padding: 30px 20px;
        width: 250px;
        cursor: pointer;
        transition: all 0.3s;
        text-align: center;
        position: relative;
        overflow: hidden;
    `;
    
    card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-10px)';
        card.style.boxShadow = `0 20px 30px ${isMultiplayer ? 'rgba(0, 255, 136, 0.3)' : 'rgba(0, 204, 255, 0.3)'}`;
    });
    
    card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0)';
        card.style.boxShadow = 'none';
    });
    
    const badge = document.createElement('div');
    if (isMultiplayer) {
        badge.textContent = 'ONCHAIN';
        badge.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: #00ff88;
            color: #000;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
        `;
        card.appendChild(badge);
    }
    
    const titleEl = document.createElement('h2');
    titleEl.textContent = title;
    titleEl.style.cssText = `
        color: ${isMultiplayer ? '#00ff88' : '#00ccff'};
        font-size: 12px;
    `;
    card.appendChild(titleEl);
    
    return card;
}

// Create Multiplayer Lobby Screen
function createMultiplayerLobbyScreen() {
    multiplayerLobbyScreen = document.createElement('div');
    multiplayerLobbyScreen.className = 'ui-screen';
    multiplayerLobbyScreen.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        display: none;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        pointer-events: auto;
        color: white;
    `;
    
    const container = document.createElement('div');
    container.style.cssText = `
        background: rgba(0, 0, 0, 0.9);
        padding: 40px;
        border-radius: 20px;
        border: 1px solid #00ff88;
        width: 90%;
        max-width: 800px;
    `;
    
    const header = document.createElement('div');
    header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 30px;
    `;
    
    const title = document.createElement('h1');
    title.textContent = 'MULTIPLAYER LOBBY';
    title.style.cssText = `
        color: #00ff88;
        font-size: 28px;
    `;
    
    const playerInfo = document.createElement('div');
    playerInfo.style.cssText = `
        color: #aaa;
        font-size: 14px;
    `;
    playerInfo.innerHTML = `Wallet: <span style="color:#00ff88">${getUserPublicKey() ? getUserPublicKey().slice(0, 8) + '...' : 'Not Connected'}</span>`;
    
    header.appendChild(title);
    header.appendChild(playerInfo);
    
    // Create/Join tabs
    const tabsContainer = document.createElement('div');
    tabsContainer.style.cssText = `
        display: flex;
        gap: 10px;
        margin-bottom: 30px;
        border-bottom: 1px solid #333;
        padding-bottom: 10px;
    `;
    
    const createTab = createTabButton('CREATE SESSION', true);
    const joinTab = createTabButton('JOIN SESSION', false);
    
    tabsContainer.appendChild(createTab);
    tabsContainer.appendChild(joinTab);
    
    // Create Session Panel
    const createPanel = document.createElement('div');
    createPanel.id = 'create-panel';
    createPanel.style.display = 'block';
    
    const sessionName = createInput('Session Name', 'Enter session name...');
    const maxPlayers = createSelect('Max Players', ['2', '4', '6', '8']);
    const gameMode = createSelect('Game Mode', ['Co-op Campaign', 'Team Deathmatch', 'Extraction Mode']);
    
    const createBtn = createActionButton('CREATE SESSION', '#00ff88', () => {
        // Get values from inputs
        const name = sessionName.querySelector('input').value || 'Co-op Session';
        const max = parseInt(maxPlayers.querySelector('select').value) || 4;
        const mode = gameMode.querySelector('select').value || 'Co-op Campaign';
        
        // Create session ID from name
        const sessionId = name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
        
        // Update URL and start game
        const url = new URL(window.location);
        url.searchParams.set('session', sessionId);
        window.history.replaceState({}, '', url);
        
        startGameWithMode('multiplayer', 'NORMAL', {
            sessionName: name,
            maxPlayers: max,
            gameMode: mode,
            sessionId: sessionId,
            isHost: true
        });
    });
    
    createPanel.appendChild(sessionName);
    createPanel.appendChild(maxPlayers);
    createPanel.appendChild(gameMode);
    createPanel.appendChild(createBtn);
    
    // Join Session Panel
    const joinPanel = document.createElement('div');
    joinPanel.id = 'join-panel';
    joinPanel.style.display = 'none';
    
    // Session list container
    const sessionList = document.createElement('div');
    sessionList.id = 'session-list';
    sessionList.style.cssText = `
        background: rgba(255, 255, 255, 0.05);
        border-radius: 10px;
        padding: 20px;
        margin-bottom: 20px;
        max-height: 300px;
        overflow-y: auto;
    `;
    
    // Add loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.id = 'session-loading';
    loadingIndicator.style.cssText = `
        text-align: center;
        padding: 20px;
        color: #00ff88;
    `;
    loadingIndicator.textContent = 'Loading sessions...';
    sessionList.appendChild(loadingIndicator);
    
    // Refresh button
    const refreshBtn = createActionButton('REFRESH SESSIONS', '#00ccff', () => {
        fetchSessions(sessionList);
    });
    
    joinPanel.appendChild(sessionList);
    joinPanel.appendChild(refreshBtn);
    
    // Tab switching logic
    createTab.addEventListener('click', () => {
        createTab.classList.add('active');
        joinTab.classList.remove('active');
        createPanel.style.display = 'block';
        joinPanel.style.display = 'none';
    });
    
    joinTab.addEventListener('click', () => {
        joinTab.classList.add('active');
        createTab.classList.remove('active');
        createPanel.style.display = 'none';
        joinPanel.style.display = 'block';
        
        // Fetch sessions when switching to join tab
        fetchSessions(sessionList);
    });
    
    const backButton = createBackButton(() => {
        showState(UI_STATES.GAME_MODE_SELECT);
    });
    
    container.appendChild(header);
    container.appendChild(tabsContainer);
    container.appendChild(createPanel);
    container.appendChild(joinPanel);
    container.appendChild(backButton);
    multiplayerLobbyScreen.appendChild(container);
    uiContainer.appendChild(multiplayerLobbyScreen);
}

async function fetchSessions(sessionListElement) {
    try {
        // Clear and show loading
        sessionListElement.innerHTML = '<div style="text-align: center; padding: 20px; color: #00ff88;">Loading sessions...</div>';
        
        // Try to connect to your server
        const serverUrl = 'http://localhost:3001'; // Update this to your server URL
        const response = await fetch(`${serverUrl}/api/sessions`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            mode: 'cors'
        });
        
        if (!response.ok) {
            throw new Error(`Server responded with ${response.status}`);
        }
        
        const sessions = await response.json();
        
        // Clear loading
        sessionListElement.innerHTML = '';
        
        if (sessions.length === 0) {
            // Show empty state
            const emptyState = document.createElement('div');
            emptyState.style.cssText = `
                text-align: center;
                padding: 40px 20px;
                color: #666;
            `;
            emptyState.innerHTML = `
                <p style="font-size: 18px; margin-bottom: 10px;">No active sessions</p>
                <p style="font-size: 14px;">Create a new session to start playing</p>
            `;
            sessionListElement.appendChild(emptyState);
            return;
        }
        
        // Display real sessions
        sessions.forEach(session => {
            const sessionItem = createSessionItem({
                name: session.id,
                players: session.playerCount,
                max: 4, // You might want to store max players in session data
                mode: session.state === 'active' ? 'In Progress' : 'Waiting'
            });
            
            sessionItem.addEventListener('click', () => {
                // Join this session
                startGameWithMode('multiplayer', 'NORMAL', {
                    sessionId: session.id,
                    isHost: false,
                    sessionName: session.id,
                    maxPlayers: 4,
                    gameMode: 'Co-op Campaign'
                });
            });
            
            sessionListElement.appendChild(sessionItem);
        });
        
    } catch (error) {
        console.error('Failed to fetch sessions:', error);
        
        // Show error state
        sessionListElement.innerHTML = `
            <div style="text-align: center; padding: 40px 20px;">
                <p style="color: #ff4444; font-size: 18px; margin-bottom: 10px;">Failed to load sessions</p>
                <p style="color: #666; font-size: 14px; margin-bottom: 20px;">${error.message}</p>
                <button onclick="window.location.reload()" style="
                    background: #00ff88;
                    color: #000;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    cursor: pointer;
                ">Retry</button>
            </div>
        `;
    }
}

// Create Single Player Lobby Screen
function createSinglePlayerLobbyScreen() {
    singlePlayerLobbyScreen = document.createElement('div');
    singlePlayerLobbyScreen.className = 'ui-screen';
    singlePlayerLobbyScreen.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        display: none;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        pointer-events: auto;
        color: white;
    `;
    
    const container = document.createElement('div');
    container.style.cssText = `
        background: rgba(0, 0, 0, 0.9);
        padding: 40px;
        border-radius: 20px;
        border: 1px solid #00ccff;
        width: 90%;
        max-width: 600px;
    `;
    
    const title = document.createElement('h1');
    title.textContent = 'SINGLE PLAYER';
    title.style.cssText = `
        color: #00ccff;
        font-size: 32px;
        margin-bottom: 30px;
        text-align: center;
    `;
    
    // Difficulty selection
    const difficultyLabel = document.createElement('div');
    difficultyLabel.textContent = 'Select Difficulty:';
    difficultyLabel.style.cssText = `
        color: #aaa;
        margin-bottom: 10px;
    `;
    
    const difficultyContainer = document.createElement('div');
    difficultyContainer.style.cssText = `
        display: flex;
        gap: 10px;
        margin-bottom: 30px;
        flex-wrap: wrap;
    `;
    
    const difficulties = [
        { name: 'EASY', color: '#00ff88' },
        { name: 'NORMAL', color: '#ffaa00' },
        { name: 'HARD', color: '#ff4444' },
        { name: 'NIGHTMARE', color: '#aa00ff' }
    ];
    
    difficulties.forEach(diff => {
        const btn = document.createElement('button');
        btn.textContent = diff.name;
        btn.style.cssText = `
            background: transparent;
            border: 2px solid ${diff.color};
            color: ${diff.color};
            padding: 10px 20px;
            font-size: 16px;
            font-weight: bold;
            border-radius: 5px;
            cursor: pointer;
            transition: all 0.3s;
            flex: 1;
            min-width: 120px;
        `;
        
        btn.addEventListener('mouseenter', () => {
            btn.style.background = diff.color;
            btn.style.color = '#000';
        });
        
        btn.addEventListener('mouseleave', () => {
            btn.style.background = 'transparent';
            btn.style.color = diff.color;
        });
        
        btn.addEventListener('click', () => {
            // Set difficulty and start
            startGameWithMode('single', diff.name);
        });
        
        difficultyContainer.appendChild(btn);
    });
    
    // Game options
    const optionsLabel = document.createElement('div');
    optionsLabel.textContent = 'Game Options:';
    optionsLabel.style.cssText = `
        color: #aaa;
        margin-bottom: 10px;
        margin-top: 20px;
    `;
    
    const optionsContainer = document.createElement('div');
    optionsContainer.style.cssText = `
        margin-bottom: 30px;
    `;
    
    const checkboxes = [
        { label: 'Tutorial Mode', checked: true },
        { label: 'Infinite Ammo', checked: false },
        { label: 'Enemy Markers', checked: false },
        { label: 'Night Cycle', checked: true }
    ];
    
    checkboxes.forEach(option => {
        const checkboxContainer = document.createElement('div');
        checkboxContainer.style.cssText = `
            margin-bottom: 10px;
            display: flex;
            align-items: center;
        `;
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = option.checked;
        checkbox.style.cssText = `
            width: 18px;
            height: 18px;
            margin-right: 10px;
            cursor: pointer;
        `;
        
        const label = document.createElement('label');
        label.textContent = option.label;
        label.style.cssText = `
            color: #fff;
            cursor: pointer;
        `;
        
        checkboxContainer.appendChild(checkbox);
        checkboxContainer.appendChild(label);
        optionsContainer.appendChild(checkboxContainer);
    });
    
    const startBtn = createActionButton('START GAME', '#00ff88', () => {
        startGameWithMode('single', 'NORMAL');
    });
    
    const backButton = createBackButton(() => {
        showState(UI_STATES.GAME_MODE_SELECT);
    });
    
    container.appendChild(title);
    container.appendChild(difficultyLabel);
    container.appendChild(difficultyContainer);
    container.appendChild(optionsLabel);
    container.appendChild(optionsContainer);
    container.appendChild(startBtn);
    container.appendChild(backButton);
    singlePlayerLobbyScreen.appendChild(container);
    uiContainer.appendChild(singlePlayerLobbyScreen);
}

// Helper Functions for UI Elements
function createTabButton(text, isActive) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `
        background: ${isActive ? '#00ff88' : 'transparent'};
        color: ${isActive ? '#000' : '#fff'};
        border: 2px solid #00ff88;
        padding: 10px 30px;
        font-size: 16px;
        font-weight: bold;
        border-radius: 5px;
        cursor: pointer;
        transition: all 0.3s;
    `;
    
    if (isActive) btn.classList.add('active');
    
    return btn;
}

function createInput(label, placeholder) {
    const container = document.createElement('div');
    container.style.marginBottom = '20px';
    
    const labelEl = document.createElement('label');
    labelEl.textContent = label;
    labelEl.style.cssText = `
        display: block;
        color: #aaa;
        margin-bottom: 5px;
        font-size: 14px;
    `;
    
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = placeholder;
    input.style.cssText = `
        width: 100%;
        padding: 10px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid #333;
        color: #fff;
        border-radius: 5px;
        font-size: 14px;
    `;
    
    container.appendChild(labelEl);
    container.appendChild(input);
    return container;
}

function createSelect(label, options) {
    const container = document.createElement('div');
    container.style.marginBottom = '20px';
    
    const labelEl = document.createElement('label');
    labelEl.textContent = label;
    labelEl.style.cssText = `
        display: block;
        color: #aaa;
        margin-bottom: 5px;
        font-size: 14px;
    `;
    
    const select = document.createElement('select');
    select.style.cssText = `
        width: 100%;
        padding: 10px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid #333;
        color: #fff;
        border-radius: 5px;
        font-size: 14px;
    `;
    
    options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = opt;
        select.appendChild(option);
    });
    
    container.appendChild(labelEl);
    container.appendChild(select);
    return container;
}

function createActionButton(text, color, onClick) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `
        width: 100%;
        background: ${color};
        color: #000;
        border: none;
        padding: 15px;
        font-size: 18px;
        font-weight: bold;
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.3s;
        margin-top: 20px;
    `;
    
    btn.addEventListener('mouseenter', () => {
        btn.style.transform = 'scale(1.02)';
        btn.style.boxShadow = `0 0 30px ${color}`;
    });
    
    btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'scale(1)';
        btn.style.boxShadow = 'none';
    });
    
    btn.addEventListener('click', onClick);
    return btn;
}

function createBackButton(onClick) {
    const btn = document.createElement('button');
    btn.textContent = '← BACK';
    btn.style.cssText = `
        background: transparent;
        color: #666;
        border: 1px solid #333;
        padding: 10px;
        font-size: 14px;
        border-radius: 5px;
        cursor: pointer;
        transition: all 0.3s;
        margin-top: 20px;
    `;
    
    btn.addEventListener('mouseenter', () => {
        btn.style.color = '#fff';
        btn.style.borderColor = '#666';
    });
    
    btn.addEventListener('mouseleave', () => {
        btn.style.color = '#666';
        btn.style.borderColor = '#333';
    });
    
    btn.addEventListener('click', onClick);
    return btn;
}

function createSessionItem(session) {
    const item = document.createElement('div');
    item.style.cssText = `
        background: rgba(255, 255, 255, 0.02);
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 10px;
        cursor: pointer;
        transition: all 0.3s;
        border: 1px solid transparent;
    `;
    
    item.addEventListener('mouseenter', () => {
        item.style.background = 'rgba(255, 255, 255, 0.05)';
        item.style.borderColor = '#00ff88';
    });
    
    item.addEventListener('mouseleave', () => {
        item.style.background = 'rgba(255, 255, 255, 0.02)';
        item.style.borderColor = 'transparent';
    });
    
    item.innerHTML = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
            <span style="color: #00ff88; font-weight: bold;">${session.name}</span>
            <span style="color: #aaa;">${session.players}/${session.max} players</span>
        </div>
        <div style="display: flex; gap: 10px;">
            <span style="color: #666; font-size: 12px;">Mode: ${session.mode}</span>
        </div>
    `;
    
    return item;
}

// Function to start the game
// function startGameWithMode(mode, difficulty = 'NORMAL') {
//     // Hide all UI
//     uiContainer.style.display = 'none';
    
//     // Initialize game music
//     initBackgroundMusic(MUSIC_VOLUME, audioContext).then(() => {
//         if (!isMusicPlayingNow()) {
//             playBackgroundMusic(audioContext);
//         }
//     });
    
//     // Hide any existing UI screens
//     const menuPanel = document.getElementById('menuPanel');
//     const loader = document.getElementById('loader');
//     if (menuPanel) menuPanel.style.display = 'none';
//     if (loader) loader.style.display = 'none';
    
//     // Dispatch event for game to start
//     window.dispatchEvent(new CustomEvent('game-start', {
//         detail: { mode, difficulty }
//     }));
    
//     console.log(`Starting game in ${mode} mode with ${difficulty} difficulty`);
// }

function startGameWithMode(mode, difficulty = 'NORMAL', customOptions = {}) {
    // Hide all UI
    uiContainer.style.display = 'none';
    
    // Initialize game music
    initBackgroundMusic(MUSIC_VOLUME, audioContext).then(() => {
        if (!isMusicPlayingNow()) {
            playBackgroundMusic(audioContext);
        }
    });
    
    // Hide any existing UI screens
    const menuPanel = document.getElementById('menuPanel');
    const loader = document.getElementById('loader');
    if (menuPanel) menuPanel.style.display = 'none';
    if (loader) loader.style.display = 'none';
    
    // Collect additional data based on mode
    let gameStartData = {
        mode,
        difficulty,
        options: {},
        sessionId: null,
        maxPlayers: 4,
        isHost: false,
        ...customOptions // Merge custom options
    };
    
    if (mode === 'multiplayer' && !customOptions.sessionId) {
        // Only create new session if not joining existing one
        const sessionNameInput = document.querySelector('#create-panel input');
        const maxPlayersSelect = document.querySelector('#create-panel select');
        const gameModeSelect = document.querySelectorAll('#create-panel select')[1];
        
        const sessionName = sessionNameInput?.value || 'Co-op Session';
        const maxPlayers = maxPlayersSelect?.value || 4;
        const gameMode = gameModeSelect?.value || 'Co-op Campaign';
        
        const sessionId = sessionName.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
        
        gameStartData = {
            ...gameStartData,
            sessionName,
            maxPlayers: parseInt(maxPlayers),
            gameMode,
            sessionId,
            isHost: true
        };
        
        // Update URL with session ID for sharing
        const url = new URL(window.location);
        url.searchParams.set('session', sessionId);
        window.history.replaceState({}, '', url);
    } else if (mode === 'single') {
        // Single player - check URL for session parameter (for joining)
        const urlParams = new URLSearchParams(window.location.search);
        const sessionParam = urlParams.get('session');
        if (sessionParam) {
            // User is trying to join a session via URL
            gameStartData = {
                ...gameStartData,
                mode: 'multiplayer',
                sessionId: sessionParam,
                isHost: false
            };
        }
    }
    
    // Store for game to access
    window.gameStartData = gameStartData;
    
    // Dispatch event for game to start
    window.dispatchEvent(new CustomEvent('game-start', {
        detail: gameStartData
    }));
    
    console.log(`Starting game in ${mode} mode with ${difficulty} difficulty`, gameStartData);
}

// Export function to get current state
export function getCurrentUIState() {
    return currentUIState;
}

// Export function to manually transition states
export function transitionToState(state) {
    if (Object.values(UI_STATES).includes(state)) {
        showState(state);
    }
}