// public/js/classes/VoiceChat.js
export default class VoiceChat {
    constructor(socket, localPlayer) {
        this.socket = socket;
        this.localPlayer = localPlayer;
        this.peers = new Map();
        this.localStream = null;
        this.isEnabled = false;
        this.isMuted = false;
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.remoteAudioElements = new Map();
        this.userSpeakingStates = new Map();
        this.pendingCalls = new Set(); // Track pending calls to avoid duplicates
        this.connectionAttempts = new Map(); // Track connection attempts
        
        // Use global SimplePeer from the script tag
        this.SimplePeer = window.SimplePeer;
        
        if (!this.SimplePeer) {
            console.error('SimplePeer not loaded! Make sure the script is included.');
            return;
        }
        
        this.peerConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' }
            ],
            iceTransportPolicy: 'all'
        };
        
        this.init();
    }
    
    init() {
        this.setupSocketListeners();
        this.setupUI();
    }
    
    setupSocketListeners() {
        this.socket.on('voice-users-list', (data) => {
            console.log('Existing voice users:', data.users);
            if (this.isEnabled) {
                data.users.forEach(user => {
                    if (user.playerId !== this.localPlayer.id && !this.peers.has(user.playerId)) {
                        // Add a small delay to avoid race conditions
                        setTimeout(() => {
                            this.initiateCall(user.playerId);
                        }, 500);
                    }
                });
            }
        });
        
        this.socket.on('voice-user-connected', (data) => {
            console.log('New voice user connected:', data.userId);
            if (data.userId !== this.localPlayer.id && this.isEnabled && !this.peers.has(data.userId)) {
                // Add delay to ensure both sides are ready
                setTimeout(() => {
                    this.initiateCall(data.userId);
                }, 500);
            }
        });
        
        this.socket.on('voice-user-disconnected', (data) => {
            console.log('Voice user disconnected:', data.userId);
            this.disconnectFromUser(data.userId);
        });
        
        this.socket.on('voice-signal', (data) => {
            if (data.from !== this.localPlayer.id) {
                this.handleSignal(data.from, data.signal);
            }
        });
        
        this.socket.on('voice-speaking', (data) => {
            this.updateSpeakingIndicator(data.userId, data.isSpeaking);
        });
    }
    
    setupUI() {
        this.voiceToggle = document.getElementById('voice-toggle');
        this.micLevel = document.querySelector('.mic-level');
        this.voiceUsersList = document.querySelector('.voice-users-list');
        
        if (this.voiceToggle) {
            this.voiceToggle.addEventListener('click', () => this.toggleVoiceChat());
        }
    }
    
    async toggleVoiceChat() {
        if (!this.isEnabled) {
            await this.enableVoiceChat();
        } else {
            this.disableVoiceChat();
        }
    }
    
    async enableVoiceChat() {
        try {
            console.log('Requesting microphone access...');
            
            this.localStream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 44100,
                    channelCount: 1
                } 
            });
            
            console.log('Microphone access granted');
            
            // Set up audio context for level detection
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.microphone = this.audioContext.createMediaStreamSource(this.localStream);
            this.microphone.connect(this.analyser);
            this.analyser.fftSize = 256;
            
            // Start monitoring audio levels
            this.startAudioLevelMonitoring();
            
            this.isEnabled = true;
            this.voiceToggle.textContent = '🔴';
            this.voiceToggle.classList.remove('disabled');
            this.voiceToggle.classList.add('enabled');
            
            // Notify other players
            this.socket.emit('voice-ready', { userId: this.localPlayer.id });
            
            // Wait a bit for server to process, then connect to existing players
            setTimeout(() => {
                this.connectToAllPlayers();
            }, 1000);
            
            console.log('Voice chat enabled successfully');
            this.showNotification('Voice chat enabled!', '#00ff00');
            
        } catch (error) {
            console.error('Failed to get microphone access:', error);
            this.showNotification('Could not access microphone. Please check permissions.', '#ff0000');
        }
    }
    
    disableVoiceChat() {
        // Close all peer connections
        this.peers.forEach((peer, userId) => {
            try {
                peer.destroy();
            } catch(e) {}
        });
        this.peers.clear();
        this.pendingCalls.clear();
        this.connectionAttempts.clear();
        
        // Stop local stream
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        
        // Close audio context
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        // Clean up remote audio elements
        this.remoteAudioElements.forEach((audio) => {
            if (audio) {
                audio.pause();
                audio.srcObject = null;
            }
        });
        this.remoteAudioElements.clear();
        
        this.isEnabled = false;
        this.voiceToggle.textContent = '🎤';
        this.voiceToggle.classList.remove('enabled');
        this.voiceToggle.classList.add('disabled');
        
        // Clear UI
        if (this.voiceUsersList) {
            this.voiceUsersList.innerHTML = '';
        }
        
        console.log('Voice chat disabled');
        this.showNotification('Voice chat disabled', '#ffaa00');
    }
    
    connectToAllPlayers() {
        const allPlayers = window.players?.getAll() || [];
        const otherPlayers = allPlayers.filter(p => p.id !== this.localPlayer.id);
        
        console.log(`Connecting to ${otherPlayers.length} other players`);
        
        otherPlayers.forEach(player => {
            if (!this.peers.has(player.id) && !this.pendingCalls.has(player.id)) {
                this.initiateCall(player.id);
            }
        });
    }
    
    initiateCall(userId) {
        // Prevent duplicate calls
        if (this.peers.has(userId) || this.pendingCalls.has(userId)) {
            console.log(`Already connecting to ${userId}, skipping`);
            return;
        }
        
        if (!this.isEnabled) {
            console.log('Voice chat not enabled, skipping call');
            return;
        }
        
        console.log('Initiating call with:', userId);
        this.pendingCalls.add(userId);
        
        try {
            const peer = new this.SimplePeer({
                initiator: true,
                trickle: true, // Enable trickle ICE for better connection
                stream: this.localStream,
                config: this.peerConfig
            });
            
            this.setupPeerEvents(peer, userId);
            this.peers.set(userId, peer);
            this.addUserToUI(userId, 'connecting');
            
            // Set timeout for connection attempt
            const timeout = setTimeout(() => {
                if (this.peers.has(userId) && !this.peers.get(userId).connected) {
                    console.log(`Connection timeout for ${userId}`);
                    this.disconnectFromUser(userId);
                }
            }, 10000);
            
            this.connectionAttempts.set(userId, timeout);
            
        } catch (error) {
            console.error('Error creating peer:', error);
            this.pendingCalls.delete(userId);
        }
    }
    
    handleSignal(userId, signal) {
        // Skip if already disconnected or destroyed
        if (!this.peers.has(userId)) {
            // Create receiver peer if it doesn't exist
            try {
                console.log('Creating receiver peer for:', userId);
                const peer = new this.SimplePeer({
                    initiator: false,
                    trickle: true,
                    stream: this.localStream,
                    config: this.peerConfig
                });
                
                this.setupPeerEvents(peer, userId);
                this.peers.set(userId, peer);
                this.addUserToUI(userId, 'connecting');
            } catch (error) {
                console.error('Error creating receiver peer:', error);
                return;
            }
        }
        
        const peer = this.peers.get(userId);
        if (peer && !peer.destroyed) {
            try {
                peer.signal(signal);
            } catch (error) {
                console.error('Error signaling peer:', error);
            }
        }
    }
    
    setupPeerEvents(peer, userId) {
        peer.on('signal', (signal) => {
            this.socket.emit('voice-signal', {
                to: userId,
                from: this.localPlayer.id,
                signal: signal
            });
        });
        
        peer.on('stream', (remoteStream) => {
            console.log('✅ Received stream from:', userId);
            this.playRemoteAudio(remoteStream, userId);
            this.updateUserStatus(userId, 'connected');
            
            // Clear pending call and timeout
            this.pendingCalls.delete(userId);
            if (this.connectionAttempts.has(userId)) {
                clearTimeout(this.connectionAttempts.get(userId));
                this.connectionAttempts.delete(userId);
            }
        });
        
        peer.on('error', (err) => {
            console.error('Peer error for user', userId, ':', err);
            this.updateUserStatus(userId, 'disconnected');
            
            // Clean up failed connection
            setTimeout(() => {
                if (this.peers.has(userId) && !this.peers.get(userId).connected) {
                    this.disconnectFromUser(userId);
                }
            }, 2000);
        });
        
        peer.on('close', () => {
            console.log('Peer disconnected:', userId);
            this.removeUserFromUI(userId);
            this.pendingCalls.delete(userId);
            if (this.connectionAttempts.has(userId)) {
                clearTimeout(this.connectionAttempts.get(userId));
                this.connectionAttempts.delete(userId);
            }
        });
        
        peer.on('connect', () => {
            console.log('✅ Peer connected to:', userId);
            this.updateUserStatus(userId, 'connected');
            this.pendingCalls.delete(userId);
        });
    }
    
    playRemoteAudio(stream, userId) {
        const audio = new Audio();
        audio.srcObject = stream;
        audio.autoplay = true;
        audio.volume = 0.8; // Set a comfortable volume
        
        // Mute audio element if it's our own stream (for echo prevention)
        if (stream.id === this.localStream?.id) {
            audio.muted = true;
        }
        
        if (this.remoteAudioElements.has(userId)) {
            const oldAudio = this.remoteAudioElements.get(userId);
            oldAudio.pause();
            oldAudio.srcObject = null;
        }
        this.remoteAudioElements.set(userId, audio);
        
        this.detectRemoteSpeaking(stream, userId);
    }
    
    detectRemoteSpeaking(stream, userId) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        source.connect(analyser);
        analyser.fftSize = 256;
        
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        const checkSpeaking = () => {
            if (!this.peers.has(userId) || this.peers.get(userId)?.destroyed) {
                if (audioContext.state !== 'closed') {
                    audioContext.close();
                }
                return;
            }
            
            analyser.getByteFrequencyData(dataArray);
            let average = 0;
            for (let i = 0; i < dataArray.length; i++) {
                average += dataArray[i];
            }
            average /= dataArray.length;
            
            const isSpeaking = average > 20;
            
            if (isSpeaking !== this.userSpeakingStates.get(userId)) {
                this.userSpeakingStates.set(userId, isSpeaking);
                this.updateSpeakingIndicator(userId, isSpeaking);
            }
            
            requestAnimationFrame(checkSpeaking);
        };
        
        checkSpeaking();
    }
    
    startAudioLevelMonitoring() {
        if (!this.analyser) return;
        
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        
        const updateLevel = () => {
            if (!this.isEnabled || !this.analyser) return;
            
            this.analyser.getByteFrequencyData(dataArray);
            let average = 0;
            for (let i = 0; i < dataArray.length; i++) {
                average += dataArray[i];
            }
            average /= dataArray.length;
            
            const level = Math.min(100, (average / 128) * 100);
            if (this.micLevel) {
                this.micLevel.style.width = level + '%';
            }
            
            const isSpeaking = average > 20;
            if (isSpeaking !== this.wasSpeaking) {
                this.wasSpeaking = isSpeaking;
                this.socket.emit('voice-speaking', {
                    userId: this.localPlayer.id,
                    isSpeaking: isSpeaking
                });
            }
            
            requestAnimationFrame(updateLevel);
        };
        
        updateLevel();
    }
    
    addUserToUI(userId, status) {
        if (!this.voiceUsersList) return;
        
        const player = window.players?.find(userId);
        const playerName = player ? player.name : 'Unknown Player';
        
        if (document.getElementById(`voice-user-${userId}`)) return;
        
        const userElement = document.createElement('div');
        userElement.className = 'voice-user';
        userElement.id = `voice-user-${userId}`;
        userElement.innerHTML = `
            <div class="status ${status}"></div>
            <span>${this.escapeHtml(playerName)}</span>
        `;
        
        this.voiceUsersList.appendChild(userElement);
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    updateUserStatus(userId, status) {
        const userElement = document.getElementById(`voice-user-${userId}`);
        if (userElement) {
            const statusDot = userElement.querySelector('.status');
            if (statusDot) {
                statusDot.className = `status ${status}`;
            }
        }
    }
    
    updateSpeakingIndicator(userId, isSpeaking) {
        const userElement = document.getElementById(`voice-user-${userId}`);
        if (userElement) {
            if (isSpeaking) {
                userElement.classList.add('speaking');
            } else {
                userElement.classList.remove('speaking');
            }
        }
    }
    
    removeUserFromUI(userId) {
        const userElement = document.getElementById(`voice-user-${userId}`);
        if (userElement) {
            userElement.remove();
        }
    }
    
    disconnectFromUser(userId) {
        const peer = this.peers.get(userId);
        if (peer) {
            try {
                peer.destroy();
            } catch(e) {}
            this.peers.delete(userId);
        }
        
        this.pendingCalls.delete(userId);
        if (this.connectionAttempts.has(userId)) {
            clearTimeout(this.connectionAttempts.get(userId));
            this.connectionAttempts.delete(userId);
        }
        
        if (this.remoteAudioElements?.has(userId)) {
            const audio = this.remoteAudioElements.get(userId);
            audio.pause();
            audio.srcObject = null;
            this.remoteAudioElements.delete(userId);
        }
        
        this.userSpeakingStates.delete(userId);
        this.removeUserFromUI(userId);
    }
    
    showNotification(message, color) {
        console.log(`[Voice Chat] ${message}`);
        
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            background: ${color};
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 10001;
            font-family: Arial;
            font-size: 14px;
            animation: fadeOut 3s forwards;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
    
    cleanup() {
        this.disableVoiceChat();
        this.peers.clear();
        this.pendingCalls.clear();
        this.connectionAttempts.clear();
        this.remoteAudioElements.clear();
        this.userSpeakingStates.clear();
    }
}