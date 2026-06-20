// client/src/classes/NotificationPopup.js

export default class NotificationPopup {
    constructor() {
        this.container = null;
        this.queue = [];
        this.isShowing = false;
        this.createContainer();
    }

    createContainer() {
        if (document.getElementById('notification-container')) return;
        
        this.container = document.createElement('div');
        this.container.id = 'notification-container';
        this.container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 103;
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: none;
        `;
        document.body.appendChild(this.container);
    }

    show(message, type = 'success', duration = 3000) {
        const notification = document.createElement('div');
        
        // Set colors based on type
        let colors = {
            success: { bg: 'rgba(0, 200, 0, 0.95)', border: '#00ff00', icon: '✅' },
            error: { bg: 'rgba(200, 0, 0, 0.95)', border: '#ff0000', icon: '❌' },
            warning: { bg: 'rgba(200, 100, 0, 0.95)', border: '#ffaa00', icon: '⚠️' },
            info: { bg: 'rgba(0, 100, 200, 0.95)', border: '#00aaff', icon: 'ℹ️' }
        };
        
        const color = colors[type] || colors.success;
        
        notification.style.cssText = `
            background: ${color.bg};
            border-left: 4px solid ${color.border};
            border-radius: 8px;
            padding: 12px 20px;
            min-width: 250px;
            max-width: 350px;
            font-family: 'Orbitron', monospace;
            font-size: 12px;
            color: white;
            backdrop-filter: blur(8px);
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            animation: slideInRight 0.3s ease-out;
            pointer-events: auto;
            display: flex;
            align-items: center;
            gap: 12px;
        `;
        
        notification.innerHTML = `
            <span style="font-size: 18px;">${color.icon}</span>
            <span style="flex: 1;">${message}</span>
            <button class="notification-close" style="
                background: none;
                border: none;
                color: rgba(255,255,255,0.6);
                cursor: pointer;
                font-size: 14px;
                padding: 0;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
            ">✕</button>
        `;
        
        // Add close button functionality
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            this.removeNotification(notification);
        });
        
        this.container.appendChild(notification);
        
        // Auto remove after duration
        setTimeout(() => {
            this.removeNotification(notification);
        }, duration);
        
        return notification;
    }
    
    removeNotification(notification) {
        if (notification && notification.parentNode) {
            notification.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }
    }
    
    success(message, duration = 3000) {
        return this.show(message, 'success', duration);
    }
    
    error(message, duration = 4000) {
        return this.show(message, 'error', duration);
    }
    
    warning(message, duration = 3000) {
        return this.show(message, 'warning', duration);
    }
    
    info(message, duration = 3000) {
        return this.show(message, 'info', duration);
    }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            opacity: 0;
            transform: translateX(100px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    
    @keyframes slideOutRight {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(100px);
        }
    }
`;
document.head.appendChild(style);