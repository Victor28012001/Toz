// client/src/classes/AdRewardsUI.js

export default class AdRewardsUI {
    constructor(adRewards) {
        this.adRewards = adRewards;
        this.createUI();
    }
    
    createUI() {
        const panel = document.createElement('div');
        panel.id = 'ad-rewards-panel';
        panel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0,0,0,0.95);
            border: 2px solid #ffaa00;
            border-radius: 16px;
            padding: 20px;
            z-index: 105;
            display: none;
            min-width: 320px;
            max-width: 400px;
            font-family: 'Orbitron', monospace;
        `;
        
        panel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="color: #ffaa00; margin: 0;">🎁 Free Rewards</h2>
                <button id="close-ad-panel" style="
                    background: rgba(255,68,68,0.8);
                    border: none;
                    color: white;
                    width: 30px;
                    height: 30px;
                    border-radius: 50%;
                    cursor: pointer;
                ">✕</button>
            </div>
            
            <div style="margin-bottom: 20px;">
                <div class="reward-card" data-reward="tokens_small" style="
                    background: rgba(255,255,255,0.05);
                    border-radius: 8px;
                    padding: 12px;
                    margin-bottom: 10px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <div>
                        <div style="color: #ffaa00; font-weight: bold;">💰 +10 $JBKS</div>
                        <div style="font-size: 10px; color: #888;">Watch a short ad</div>
                    </div>
                    <button class="claim-ad-btn" data-reward="tokens_small" style="
                        background: linear-gradient(135deg, #ffaa00, #ff6600);
                        border: none;
                        color: #000;
                        padding: 8px 16px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-weight: bold;
                    ">Watch</button>
                </div>
                
                <div class="reward-card" data-reward="tokens_medium" style="
                    background: rgba(255,255,255,0.05);
                    border-radius: 8px;
                    padding: 12px;
                    margin-bottom: 10px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <div>
                        <div style="color: #ffaa00; font-weight: bold;">💰 +50 $JBKS</div>
                        <div style="font-size: 10px; color: #888;">Watch a short ad</div>
                    </div>
                    <button class="claim-ad-btn" data-reward="tokens_medium" style="
                        background: linear-gradient(135deg, #ffaa00, #ff6600);
                        border: none;
                        color: #000;
                        padding: 8px 16px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-weight: bold;
                    ">Watch</button>
                </div>
                
                <div class="reward-card" data-reward="grenades" style="
                    background: rgba(255,255,255,0.05);
                    border-radius: 8px;
                    padding: 12px;
                    margin-bottom: 10px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <div>
                        <div style="color: #ffaa00; font-weight: bold;">💣 +2 Grenades</div>
                        <div style="font-size: 10px; color: #888;">Watch a short ad</div>
                    </div>
                    <button class="claim-ad-btn" data-reward="grenades" style="
                        background: linear-gradient(135deg, #ffaa00, #ff6600);
                        border: none;
                        color: #000;
                        padding: 8px 16px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-weight: bold;
                    ">Watch</button>
                </div>
                
                <div class="reward-card" data-reward="health" style="
                    background: rgba(255,255,255,0.05);
                    border-radius: 8px;
                    padding: 12px;
                    margin-bottom: 10px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <div>
                        <div style="color: #ffaa00; font-weight: bold;">❤️ +50 Health</div>
                        <div style="font-size: 10px; color: #888;">Watch a short ad</div>
                    </div>
                    <button class="claim-ad-btn" data-reward="health" style="
                        background: linear-gradient(135deg, #ffaa00, #ff6600);
                        border: none;
                        color: #000;
                        padding: 8px 16px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-weight: bold;
                    ">Watch</button>
                </div>
                
                <div class="reward-card" data-reward="revive" style="
                    background: rgba(255,100,100,0.1);
                    border: 1px solid #ff4444;
                    border-radius: 8px;
                    padding: 12px;
                    margin-bottom: 10px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <div>
                        <div style="color: #ff4444; font-weight: bold;">🔄 Instant Revive</div>
                        <div style="font-size: 10px; color: #888;">Watch ad to respawn instantly</div>
                    </div>
                    <button class="claim-ad-btn" data-reward="revive" style="
                        background: linear-gradient(135deg, #ff4444, #cc0000);
                        border: none;
                        color: white;
                        padding: 8px 16px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-weight: bold;
                    ">Revive</button>
                </div>
                
                <div class="reward-card" data-reward="double_xp" style="
                    background: rgba(255,255,255,0.05);
                    border-radius: 8px;
                    padding: 12px;
                    margin-bottom: 10px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <div>
                        <div style="color: #aa44ff; font-weight: bold;">⚡ 2x XP (30 min)</div>
                        <div style="font-size: 10px; color: #888;">Watch a short ad</div>
                    </div>
                    <button class="claim-ad-btn" data-reward="double_xp" style="
                        background: linear-gradient(135deg, #aa44ff, #6600cc);
                        border: none;
                        color: white;
                        padding: 8px 16px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-weight: bold;
                    ">Watch</button>
                </div>
            </div>
            
            <div style="text-align: center; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1);">
                <div id="ad-cooldowns" style="font-size: 10px; color: #666;"></div>
            </div>
        `;
        
        document.body.appendChild(panel);
        this.bindEvents();
        this.startCooldownUpdater();
    }
    
    bindEvents() {
        document.getElementById('close-ad-panel')?.addEventListener('click', () => this.hide());
        
        document.querySelectorAll('.claim-ad-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const rewardId = btn.dataset.reward;
                await this.adRewards.claimReward(rewardId);
            });
        });
    }
    
    startCooldownUpdater() {
        setInterval(() => {
            if (!this.isVisible()) return;
            
            const cooldownDiv = document.getElementById('ad-cooldowns');
            if (cooldownDiv) {
                const rewards = ['tokens_small', 'tokens_medium', 'grenades', 'health', 'revive', 'double_xp'];
                const cooldowns = rewards.map(rewardId => {
                    const lastClaim = localStorage.getItem(`last_${rewardId}`);
                    if (lastClaim) {
                        const reward = this.adRewards.rewards[rewardId];
                        const timeSince = Date.now() - parseInt(lastClaim);
                        if (timeSince < reward.cooldown) {
                            const remaining = Math.ceil((reward.cooldown - timeSince) / 1000);
                            return `${reward.description}: ${remaining}s`;
                        }
                    }
                    return null;
                }).filter(c => c);
                
                cooldownDiv.innerHTML = cooldowns.join(' • ');
            }
        }, 1000);
    }
    
    isVisible() {
        const panel = document.getElementById('ad-rewards-panel');
        return panel && panel.style.display === 'block';
    }
    
    show() {
        const panel = document.getElementById('ad-rewards-panel');
        if (panel) panel.style.display = 'block';
    }
    
    hide() {
        const panel = document.getElementById('ad-rewards-panel');
        if (panel) panel.style.display = 'none';
    }
    
    toggle() {
        const panel = document.getElementById('ad-rewards-panel');
        if (panel) {
            if (panel.style.display === 'block') {
                this.hide();
            } else {
                this.show();
            }
        }
    }
}