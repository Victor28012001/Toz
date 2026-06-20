// export default class PlayerList {
//     constructor() {
//         this.players = [];
//     }
//     add(newPlayer) {
//         this.players.push(newPlayer);
//     }
//     find(playerId) {
//         for (const player of this.players) {
//             if (player.id === playerId) {
//                 return player;
//             }
//         }
//         return null;
//     }
//     remove(player) {
//         const arrIndex = this.players.indexOf(player);
//         if (arrIndex >= 0) {
//             this.players.splice(arrIndex, 1);
//         }
//     }
//     getAll() {
//         return this.players;
//     }
// }
// //# sourceMappingURL=PlayerList.js.map
export default class PlayerList {
    constructor() {
        this.players = [];
    }
    
    add(newPlayer) {
        // Check if player already exists
        const existing = this.find(newPlayer.id);
        if (existing) {
            console.warn(`Player ${newPlayer.name} (${newPlayer.id}) already exists, not adding again`);
            return existing; // Return the existing player
        }
        
        console.log(`Adding new player: ${newPlayer.name} (${newPlayer.id})`);
        this.players.push(newPlayer);
        return newPlayer;
    }
    
    find(playerId) {
        for (const player of this.players) {
            if (player.id === playerId) {
                return player;
            }
        }
        return null;
    }
    
    remove(player) {
        const arrIndex = this.players.indexOf(player);
        if (arrIndex >= 0) {
            console.log(`Removing player: ${player.name} (${player.id})`);
            this.players.splice(arrIndex, 1);
        }
    }
    
    getAll() {
        return this.players;
    }
}