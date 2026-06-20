// client/src/classes/AdRewards.js

export default class AdRewards {
    constructor(socket, adManager) {
        this.socket = socket;
        this.adManager = adManager;
        this.rewards = {
            revive: {
                type: 'revive',
                description: 'Instant revive on the spot',
                cooldown: 120000, // 2 minutes
                maxPerDay: 3
            },
            tokens_small: {
                type: 'tokens',
                amount: 10,
                description: '+10 $JBKS',
                cooldown: 30000, // 30 seconds
                maxPerDay: 20
            },
            tokens_medium: {
                type: 'tokens',
                amount: 50,
                description: '+50 $JBKS',
                cooldown: 120000, // 2 minutes
                maxPerDay: 5
            },
            grenades: {
                type: 'grenades',
                amount: 2,
                description: '+2 Grenades',
                cooldown: 60000, // 1 minute
                maxPerDay: 10
            },
            health: {
                type: 'health',
                amount: 50,
                description: '+50 HP',
                cooldown: 60000,
                maxPerDay: 8
            },
            double_xp: {
                type: 'boost',
                duration: 1800, // 30 minutes
                multiplier: 2,
                description: '2x XP for 30 minutes',
                cooldown: 300000, // 5 minutes
                maxPerDay: 3
            }
        };
        
        this.loadDailyStats();
    }
    
    loadDailyStats() {
        const today = new Date().toDateString();
        this.dailyClaims = JSON.parse(localStorage.getItem('adRewardClaims') || '{}');
        if (this.dailyClaims.date !== today) {
            this.dailyClaims = { date: today };
            Object.keys(this.rewards).forEach(key => {
                this.dailyClaims[key] = 0;
            });
        }
    }
    
    saveDailyStats() {
        localStorage.setItem('adRewardClaims', JSON.stringify(this.dailyClaims));
    }
    
    canClaimReward(rewardId) {
        const reward = this.rewards[rewardId];
        if (!reward) return false;
        
        const todayCount = this.dailyClaims[rewardId] || 0;
        if (todayCount >= reward.maxPerDay) {
            this.showNotification(`Daily limit reached for ${reward.description}`, '#ffaa00');
            return false;
        }
        
        const lastClaim = localStorage.getItem(`last_${rewardId}`);
        if (lastClaim && Date.now() - parseInt(lastClaim) < reward.cooldown) {
            const remaining = Math.ceil((reward.cooldown - (Date.now() - parseInt(lastClaim))) / 1000);
            this.showNotification(`Available in ${remaining} seconds`, '#ffaa00');
            return false;
        }
        
        return true;
    }
    
    async claimReward(rewardId) {
        if (!this.canClaimReward(rewardId)) return false;
        
        const reward = this.rewards[rewardId];
        
        const success = await this.adManager.showRewardedVideo(
            (rewardData) => this.grantReward(rewardId, reward),
            (completed) => {
                if (completed) {
                    this.recordClaim(rewardId);
                }
            }
        );
        
        return success;
    }
    
    grantReward(rewardId, reward) {
        switch(reward.type) {
            case 'revive':
                this.revivePlayer();
                break;
            case 'tokens':
                this.addTokens(reward.amount);
                break;
            case 'grenades':
                this.addGrenades(reward.amount);
                break;
            case 'health':
                this.restoreHealth(reward.amount);
                break;
            case 'boost':
                this.activateBoost(reward.multiplier, reward.duration);
                break;
        }
        
        this.showNotification(`+ ${reward.description}`, '#00ff00');
    }
    
    recordClaim(rewardId) {
        this.dailyClaims[rewardId] = (this.dailyClaims[rewardId] || 0) + 1;
        localStorage.setItem(`last_${rewardId}`, Date.now().toString());
        this.saveDailyStats();
    }
    
    showNotification(message, color) {
        if (window.feedbackSystem) {
            window.feedbackSystem.showNotification(message, color);
        }
    }
    
    addTokens(amount) {
        // if (window.solanaService && window.solanaService.isConnected) {
        //     this.socket.emit('addTokens', { amount });
        // }
    }
    
    addGrenades(amount) {
        if (window.self_player) {
            window.self_player.addGrenade(amount);
            if (window.modernHUD) {
                window.modernHUD.updateGrenadeCount(window.self_player.grenadeCount, window.self_player.maxGrenades);
            }
        }
    }
    
    restoreHealth(amount) {
        if (window.self_player && !window.self_player.isDead) {
            window.self_player.heal(amount);
            window.self_player.updateHealthUI();
        }
    }
    
    revivePlayer() {
        if (window.self_player && window.self_player.isDead) {
            // Trigger respawn immediately
            if (window.requestRespawn) {
                window.requestRespawn();
            }
        }
    }
    
    activateBoost(multiplier, duration) {
        localStorage.setItem('xpBoost', JSON.stringify({
            active: true,
            multiplier: multiplier,
            expiresAt: Date.now() + (duration * 1000)
        }));
    }
}