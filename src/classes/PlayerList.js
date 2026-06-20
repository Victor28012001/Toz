export default class PlayerList {
  constructor() {
    this.players = [];
    this._map = new Map(); // O(1) lookup
  }

  add(newPlayer) {
    if (this._map.has(newPlayer.id)) {
      console.warn(`Player ${newPlayer.name} already exists`);
      return this._map.get(newPlayer.id);
    }
    this.players.push(newPlayer);
    this._map.set(newPlayer.id, newPlayer);
    return newPlayer;
  }

  find(playerId) {
    return this._map.get(playerId) ?? null;
  }

  remove(player) {
    const idx = this.players.indexOf(player);
    if (idx >= 0) {
      this.players.splice(idx, 1);
      this._map.delete(player.id);
    }
  }

  getAll() {
    return this.players;
  }
}