export default class LeaderboardUI {
  constructor() { this.isOpen = false; this.currentSort = 'score'; this.createUI(); this.setupKeyboardShortcut(); }

  createUI() {
    this.container = document.createElement('div');
    this.container.id = 'leaderboard-modal';
    this.container.style.cssText = `position: fixed; inset: 0; z-index: 100; display: none; align-items: center; justify-content: center; background: rgba(0,0,0,0.85); font-family: 'Orbitron', monospace`;
    this.container.innerHTML = `
      <div style="background: rgba(10,15,30,0.95); border: 1px solid rgba(80,140,220,0.3); padding: 30px; min-width: 500px; max-height: 80vh; overflow-y: auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2 style="color: #ffaa00; margin: 0; font-size: 20px;">🏆 LEADERBOARD</h2>
          <button id="lb-close" style="background: none; border: 1px solid rgba(255,255,255,0.2); color: white; padding: 6px 12px; cursor: pointer; font-family: 'Orbitron', monospace;">✕ CLOSE</button>
        </div>
        <div id="lb-sort-buttons" style="display: flex; gap: 6px; margin-bottom: 15px; flex-wrap: wrap;">
          <button class="lb-sort-btn active" data-sort="score">🏅 Score</button>
          <button class="lb-sort-btn" data-sort="kills">💀 Kills</button>
          <button class="lb-sort-btn" data-sort="kd">📊 K/D</button>
          <button class="lb-sort-btn" data-sort="level">⭐ Level</button>
          <button class="lb-sort-btn" data-sort="headshots">🎯 Headshots</button>
          <button class="lb-sort-btn" data-sort="killstreak">🔥 Streak</button>
        </div>
        <div id="lb-your-stats" style="background: rgba(255,170,0,0.1); border: 1px solid rgba(255,170,0,0.3); padding: 12px; margin-bottom: 15px; color: #ffaa00; font-size: 12px;"></div>
        <div id="lb-entries" style="display: flex; flex-direction: column; gap: 4px; max-height: 400px; overflow-y: auto;"></div>
        <div id="lb-total-players" style="color: rgba(255,255,255,0.5); text-align: center; margin-top: 15px; font-size: 11px;"></div>
      </div>`;
    document.body.appendChild(this.container);
    const style = document.createElement('style');
    style.textContent = `.lb-sort-btn { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); color: rgba(255,255,255,0.7); padding: 6px 12px; cursor: pointer; font-size: 10px; font-family: 'Orbitron', monospace; transition: all 0.2s; } .lb-sort-btn:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.3); } .lb-sort-btn.active { background: rgba(255,170,0,0.2); border-color: rgba(255,170,0,0.5); color: #ffaa00; } .lb-entry { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: rgba(255,255,255,0.03); font-size: 12px; color: white; } .lb-entry-you { background: rgba(255,170,0,0.15) !important; border: 1px solid rgba(255,170,0,0.3); }`;
    document.head.appendChild(style);
    this.bindEvents();
  }

  bindEvents() {
    document.getElementById('lb-close').addEventListener('click', () => this.hide());
    document.querySelectorAll('.lb-sort-btn').forEach(btn => btn.addEventListener('click', () => {
      document.querySelectorAll('.lb-sort-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      this.currentSort = btn.dataset.sort;
      if (window.socket) window.socket.emit('requestLeaderboard', { sortBy: this.currentSort });
    }));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.isOpen) this.hide(); });
    this.container.addEventListener('click', (e) => { if (e.target === this.container) this.hide(); });
  }

  setupKeyboardShortcut() {
    document.addEventListener('keydown', (e) => { if (e.key === 'Tab' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') { e.preventDefault(); this.toggle(); } });
  }

  toggle() { this.isOpen ? this.hide() : this.show(); }
  show() { this.isOpen = true; this.container.style.display = 'flex'; if (window.socket) window.socket.emit('requestLeaderboard', { sortBy: this.currentSort }); }
  hide() { this.isOpen = false; this.container.style.display = 'none'; }

  update(data) {
    if (!this.isOpen) return;
    if (data.playerStats && data.playerRank) {
      const s = data.playerStats;
      document.getElementById('lb-your-stats').innerHTML = `
        <div style="margin-bottom: 4px;">📊 YOUR RANK: <span style="font-size: 16px; font-weight: bold;">#${data.playerRank}</span></div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px;">
          <div>💀 Kills: ${s.kills}</div><div>☠️ Deaths: ${s.deaths}</div><div>📊 K/D: ${s.kdRatio}</div>
          <div>⭐ Level: ${s.level}</div><div>🎯 HS: ${s.headshots}</div><div>🔥 Streak: ${s.highestKillstreak}</div>
        </div>`;
    }
    const entriesContainer = document.getElementById('lb-entries');
    entriesContainer.innerHTML = '';
    if (data.entries?.length > 0) {
      data.entries.forEach((entry, index) => {
        const rank = index + 1;
        const isYou = entry.playerId === window.self_player?.id;
        const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
        const div = document.createElement('div');
        div.className = `lb-entry ${isYou ? 'lb-entry-you' : ''}`;
        div.innerHTML = `
          <span style="width: 40px; text-align: center; font-weight: bold;">${rankEmoji}</span>
          <span style="flex: 1; ${isYou ? 'color: #ffaa00;' : ''}">${entry.playerName}</span>
          <span style="width: 50px; text-align: center;">💀${entry.kills}</span>
          <span style="width: 50px; text-align: center;">⭐${entry.level}</span>
          <span style="width: 60px; text-align: center;">🏅${entry.score}</span>`;
        entriesContainer.appendChild(div);
      });
    }
    document.getElementById('lb-total-players').textContent = `Total Players: ${data.totalPlayers || 0}`;
  }
}