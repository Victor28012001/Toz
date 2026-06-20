export default class MessageList {
    constructor() {
        this.messages = [];
    }
    add(message) {
        this.messages.push(message);
    }
    getAll() {
        return this.messages;
    }
}