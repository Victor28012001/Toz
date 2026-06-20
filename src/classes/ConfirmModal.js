// client/src/classes/ConfirmModal.js

export default class ConfirmModal {
    constructor() {
        this.modal = null;
        this.resolve = null;
        this.createModal();
    }

    createModal() {
        if (document.getElementById('confirm-modal')) return;
        
        this.modal = document.createElement('div');
        this.modal.id = 'confirm-modal';
        this.modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(4px);
            z-index: 104;
            display: none;
            align-items: center;
            justify-content: center;
            font-family: 'Orbitron', monospace;
        `;
        
        this.modal.innerHTML = `
            <div style="
                background: rgba(20, 20, 40, 0.98);
                border: 1px solid rgba(255, 170, 0, 0.3);
                border-radius: 12px;
                padding: 30px;
                max-width: 400px;
                width: 90%;
                text-align: center;
                animation: fadeIn 0.2s ease-out;
            ">
                <div id="confirm-icon" style="font-size: 48px; margin-bottom: 15px;">🛒</div>
                <h3 id="confirm-title" style="color: #ffaa00; margin-bottom: 15px;">Confirm Purchase</h3>
                <p id="confirm-message" style="color: #fff; margin-bottom: 20px; line-height: 1.5;"></p>
                <div style="display: flex; gap: 15px; justify-content: center;">
                    <button id="confirm-yes" style="
                        background: linear-gradient(135deg, #00cc44, #009933);
                        border: none;
                        color: white;
                        padding: 10px 25px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-family: 'Orbitron', monospace;
                        font-weight: bold;
                        transition: transform 0.2s;
                    ">✓ Yes</button>
                    <button id="confirm-no" style="
                        background: rgba(100, 100, 100, 0.3);
                        border: 1px solid rgba(255,255,255,0.2);
                        color: white;
                        padding: 10px 25px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-family: 'Orbitron', monospace;
                        transition: transform 0.2s;
                    ">✗ No</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.modal);
        
        // Add event listeners
        document.getElementById('confirm-yes').addEventListener('click', () => {
            if (this.resolve) this.resolve(true);
            this.hide();
        });
        
        document.getElementById('confirm-no').addEventListener('click', () => {
            if (this.resolve) this.resolve(false);
            this.hide();
        });
        
        // Close on outside click
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                if (this.resolve) this.resolve(false);
                this.hide();
            }
        });
    }
    
    show(options) {
        this.createModal();
        
        const icon = document.getElementById('confirm-icon');
        const title = document.getElementById('confirm-title');
        const message = document.getElementById('confirm-message');
        
        if (icon) icon.textContent = options.icon || '🛒';
        if (title) title.textContent = options.title || 'Confirm Purchase';
        if (message) message.textContent = options.message || 'Are you sure?';
        
        this.modal.style.display = 'flex';
        
        return new Promise((resolve) => {
            this.resolve = resolve;
        });
    }
    
    hide() {
        if (this.modal) {
            this.modal.style.display = 'none';
        }
    }
}

// Add fadeIn animation if not exists
if (!document.querySelector('#confirm-animation-style')) {
    const animStyle = document.createElement('style');
    animStyle.id = 'confirm-animation-style';
    animStyle.textContent = `
        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: scale(0.95);
            }
            to {
                opacity: 1;
                transform: scale(1);
            }
        }
    `;
    document.head.appendChild(animStyle);
}