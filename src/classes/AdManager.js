// client/src/classes/AdManager.js

import { Capacitor } from '@capacitor/core';
import { AdMob } from '@capacitor-community/admob';

class AdManager {
    constructor() {
        this.isInitialized = false;
        this.isMobile = Capacitor.isNativePlatform();
        this.isElectron = navigator.userAgent.indexOf('Electron') !== -1;
        this.isWeb = !this.isMobile && !this.isElectron;
        
        // Test Ad IDs (replace with your production IDs)
        this.adIds = {
            interstitial: 'ca-app-pub-3940256099942544/1033173712', // Test ID
            rewarded: 'ca-app-pub-3940256099942544/5224354917',     // Test ID
            banner: 'ca-app-pub-3940256099942544/6300978111'        // Test ID
        };
        
        // Ad limits to prevent abuse
        this.adLimits = {
            interstitial: { lastShown: 0, cooldown: 120000, dailyLimit: 10 },
            rewarded: { lastShown: 0, cooldown: 30000, dailyLimit: 20 }
        };
        
        this.loadDailyCounts();
    }
    
    loadDailyCounts() {
        const today = new Date().toDateString();
        this.dailyCounts = JSON.parse(localStorage.getItem('adDailyCounts') || '{}');
        if (this.dailyCounts.date !== today) {
            this.dailyCounts = {
                date: today,
                interstitial: 0,
                rewarded: 0
            };
        }
    }
    
    saveDailyCounts() {
        localStorage.setItem('adDailyCounts', JSON.stringify(this.dailyCounts));
    }
    
    canShowAd(type) {
        const limits = this.adLimits[type];
        const dailyCount = this.dailyCounts[type];
        
        if (dailyCount >= limits.dailyLimit) {
            console.log(`Daily limit reached for ${type} ads`);
            return false;
        }
        
        const timeSinceLast = Date.now() - limits.lastShown;
        if (timeSinceLast < limits.cooldown) {
            console.log(`Cooldown active for ${type} ads`);
            return false;
        }
        
        return true;
    }
    
    recordAdShown(type) {
        this.adLimits[type].lastShown = Date.now();
        this.dailyCounts[type]++;
        this.saveDailyCounts();
    }
    
    async initialize() {
        if (!this.isMobile) {
            console.log('Desktop/Web mode - using simulated ads');
            this.isInitialized = true;
            return;
        }
        
        try {
            await AdMob.initialize({
                requestTrackingAuthorization: true,
                initializeForTesting: true // Set to false for production
            });
            this.isInitialized = true;
            console.log('✅ AdMob initialized');
        } catch (error) {
            console.error('Failed to initialize AdMob:', error);
        }
    }
    
    // Show interstitial ad (full screen)
    async showInterstitial(onComplete = null) {
        if (!this.canShowAd('interstitial')) {
            if (onComplete) onComplete(false);
            return false;
        }
        
        if (this.isMobile && this.isInitialized) {
            try {
                await AdMob.prepareInterstitial({
                    adId: this.adIds.interstitial,
                    isTesting: true
                });
                
                await AdMob.showInterstitial();
                
                AdMob.addListener('onInterstitialClose', () => {
                    this.recordAdShown('interstitial');
                    if (onComplete) onComplete(true);
                });
                
                return true;
            } catch (error) {
                console.error('Failed to show interstitial:', error);
                if (onComplete) onComplete(false);
                return false;
            }
        } else {
            // Desktop/Web fallback
            return await this.showDesktopAd('interstitial', onComplete);
        }
    }
    
    // Show rewarded video ad
    async showRewardedVideo(onRewarded, onComplete = null) {
        if (!this.canShowAd('rewarded')) {
            if (onComplete) onComplete(false);
            return false;
        }
        
        if (this.isMobile && this.isInitialized) {
            try {
                await AdMob.prepareRewardVideoAd({
                    adId: this.adIds.rewarded,
                    isTesting: true
                });
                
                await AdMob.showRewardVideoAd();
                
                AdMob.addListener('onRewarded', (reward) => {
                    this.recordAdShown('rewarded');
                    if (onRewarded) onRewarded(reward);
                });
                
                AdMob.addListener('onRewardedVideoAdClosed', () => {
                    if (onComplete) onComplete(true);
                });
                
                return true;
            } catch (error) {
                console.error('Failed to show rewarded video:', error);
                if (onComplete) onComplete(false);
                return false;
            }
        } else {
            // Desktop/Web fallback
            return await this.showDesktopAd('rewarded', (success) => {
                if (success && onRewarded) onRewarded({ amount: 1, type: 'reward' });
                if (onComplete) onComplete(success);
            });
        }
    }
    
    // Desktop/Web simulated ad
    async showDesktopAd(type, onComplete) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.95);
                z-index: 1040;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: 'Orbitron', monospace;
            `;
            
            const isRewarded = type === 'rewarded';
            const title = isRewarded ? 'Watch Ad for Reward!' : 'Advertisement';
            const waitTime = isRewarded ? 30 : 5;
            
            modal.innerHTML = `
                <div style="background: linear-gradient(135deg, #1a1a2e, #16213e);
                            border: 2px solid #ffaa00;
                            border-radius: 16px;
                            padding: 40px;
                            text-align: center;
                            max-width: 400px;">
                    <div style="font-size: 48px; margin-bottom: 20px;">${isRewarded ? '🎁' : '📺'}</div>
                    <h2 style="color: #ffaa00;">${title}</h2>
                    <p style="color: #fff; margin: 20px 0;">${isRewarded ? 'Get your reward after watching!' : 'Support the game by watching this ad'}</p>
                    <div style="font-size: 48px; font-weight: bold; color: #ffaa00; margin: 20px;" id="ad-timer">${waitTime}</div>
                    <button id="skip-ad-btn" style="
                        background: #444;
                        border: none;
                        color: #fff;
                        padding: 10px 20px;
                        border-radius: 8px;
                        cursor: pointer;
                        font-family: 'Orbitron', monospace;
                        opacity: 0.5;
                        pointer-events: none;
                    ">Skip Ad</button>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            let timeLeft = waitTime;
            const timerEl = modal.querySelector('#ad-timer');
            const skipBtn = modal.querySelector('#skip-ad-btn');
            
            const interval = setInterval(() => {
                timeLeft--;
                if (timerEl) timerEl.textContent = timeLeft;
                
                if (timeLeft <= 0) {
                    clearInterval(interval);
                    skipBtn.style.opacity = '1';
                    skipBtn.style.pointerEvents = 'auto';
                    skipBtn.style.background = '#ffaa00';
                    skipBtn.style.color = '#000';
                    skipBtn.textContent = 'Continue';
                }
            }, 1000);
            
            skipBtn.addEventListener('click', () => {
                modal.remove();
                this.recordAdShown(type);
                if (onComplete) onComplete(true);
                resolve(true);
            });
        });
    }
    
    // Show banner ad
    async showBanner(position = 'bottom') {
        if (!this.isMobile || !this.isInitialized) return;
        
        try {
            await AdMob.showBanner({
                adId: this.adIds.banner,
                adSize: 'BANNER',
                position: position === 'top' ? 0 : 2,
                margin: 0,
                isTesting: true
            });
        } catch (error) {
            console.error('Failed to show banner:', error);
        }
    }
    
    async hideBanner() {
        if (!this.isMobile || !this.isInitialized) return;
        
        try {
            await AdMob.hideBanner();
        } catch (error) {
            console.error('Failed to hide banner:', error);
        }
    }
}

export default AdManager;