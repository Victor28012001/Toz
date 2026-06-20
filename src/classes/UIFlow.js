// Updated classes/UIFlow.js with loadout integration
export default class UIFlow {
  constructor(onStart) {
    this.onStart = onStart;
    this.selectedMap = null;
    this.selectedMapKey = null;
    this.playerName = "";
    this.selectedWeapons = [];
    this.availableWeapons = [];
    this._inject();
  }

  _inject() {
    // Inject fonts + global styles
    if (!document.getElementById("uiflow-style")) {
      const style = document.createElement("style");
      style.id = "uiflow-style";
      style.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&display=swap');

        #uiflow-root * { box-sizing: border-box; }

        #uiflow-root {
          position: fixed; inset: 0; z-index: 100;
          background: #050810;
          font-family: 'Share Tech Mono', monospace;
          color: #c8d8f0;
          overflow: hidden;
        }

        /* scanline overlay */
        #uiflow-root::before {
          content: '';
          position: fixed; inset: 0; z-index: 1;
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0,0,0,0.08) 2px,
            rgba(0,0,0,0.08) 4px
          );
          pointer-events: none;
        }
#uiflow-root .grid-overlay {
  position: fixed;
  inset: 0;
  background-image: 
    linear-gradient(rgba(80,160,255,0.1) 1px, transparent 1px),
    linear-gradient(90deg, rgba(80,160,255,0.1) 1px, transparent 1px);
  background-size: 50px 50px;
  pointer-events: none;
  z-index: 1;
  opacity: 0.1;
  animation: gridShift 20s linear infinite;
}

/* Scanline Overlay with movement */
#uiflow-root .scanline-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px);
  z-index: 2;
  opacity: 0.2;
  animation: scanlineMove 8s linear infinite;
}

/* Noise Grain with flicker */
#uiflow-root .noise-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
  background-size: 200px 200px;
  z-index: 2;
  opacity: 0.3;
  animation: noiseFlicker 3s ease-in-out infinite;
}

        /* noise grain */
        #uiflow-root::after {
          content: '';
          position: fixed; inset: 0; z-index: 2;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
          pointer-events: none;
          opacity: 0.4;
        }

        .uif-screen {
          position: absolute; inset: 0;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          z-index: 10;
          padding: 20px;
          overflow-y: scroll;
        }

        /* LOGO */
        .uif-logo {
          font-family: 'Orbitron', monospace;
          font-size: clamp(22px, 4vw, 48px);
          font-weight: 900;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #fff;
          text-shadow: 0 0 30px rgba(80,160,255,0.6), 0 0 60px rgba(80,160,255,0.2);
          margin-bottom: 4px;
          animation: logoFlicker 8s ease-in-out infinite;
        }
        .uif-sub {
          font-size: 11px;
          letter-spacing: 0.5em;
          color: #4a7ab0;
          text-transform: uppercase;
          margin-bottom: 48px;
        }
        @keyframes logoFlicker {
          0%,94%,96%,100% { opacity:1; }
          95% { opacity:0.6; }
        }

        @keyframes gridShift {
            0% {
              background-position: 0px 0px;
            }
            100% {
              background-position: 50px 50px;
            }
          }

          @keyframes scanlineMove {
            0% {
              transform: translateY(0);
            }
            100% {
              transform: translateY(4px);
            }
          }

          @keyframes noiseFlicker {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 0.5; }
          }

        @keyframes uif-fadeInUp {
          from { opacity: 0; transform: translateY(30px) rotateX(-15deg); }
          to { opacity: 1; transform: translateY(0) rotateX(0); }
        }

        @keyframes uif-fadeOutDown {
          from { opacity: 1; transform: translateY(0) rotateX(0); }
          to { opacity: 0; transform: translateY(-30px) rotateX(15deg); }
        }

        @keyframes uif-scaleIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }

        @keyframes uif-slideInLeft {
          from { opacity: 0; transform: translateX(-30px); }
          to { opacity: 1; transform: translateX(0); }
        }

        @keyframes uif-shimmerMove {
          0% { left: -200%; }
          100% { left: 200%; }
        }

        @keyframes uif-borderPulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }

        @keyframes uif-gentlePulse {
          0% { box-shadow: 0 0 0px rgba(64,192,255,0.2);}
          50% { box-shadow: 0 0 16px rgba(64,192,255,0.4);}
          100% { box-shadow: 0 0 0px rgba(64,192,255,0.2);}
        }

        /* PANEL */
        .uif-panel {
          background: rgba(8,15,30,0.92);
          border: 2px solid rgba(80,160,255,0.28);
          padding: 36px 40px;
          width: 100%;
          max-width: 480px;
          position: relative;
          backdrop-filter: blur(2px);
          clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px));
          animation: uif-fadeInUp 0.5s cubic-bezier(0.2, 0.9, 0.4, 1.1) forwards;
          animation-delay: 0.3s;
          opacity: 0;
        }
        .uif-panel::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, #40a0ff, transparent);
          animation: uif-borderPulse 3s infinite;
        }

        .uif-label {
          font-size: 10px;
          letter-spacing: 0.3em;
          color: #4a7ab0;
          text-transform: uppercase;
          margin-bottom: 8px;
          display: block;
        }

        .uif-input {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(80,140,220,0.3);
          border-radius: 1px;
          padding: 12px 16px;
          font-family: 'Orbitron', monospace;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 0.1em;
          color: #e8f0ff;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          margin-bottom: 28px;
          clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px));
        }
        .uif-input:focus {
          border-color: rgba(80,160,255,0.7);
          box-shadow: 0 0 20px rgba(80,160,255,0.12);
        }
        .uif-input::placeholder { color: rgba(100,140,200,0.4); }

        /* MAP CARDS */
        .uif-maps {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          width: 100%;
          max-width: 680px;
          margin-bottom: 32px;
        }
        .uif-map-card {
          background: rgba(8,15,30,0.9);
          border: 1px solid rgba(80,140,220,0.25);
          padding: 24px 20px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.2, 0.9, 0.4, 1.1);
          clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px));
          animation: uif-slideInLeft 0.5s cubic-bezier(0.2, 0.9, 0.4, 1.1) forwards;
          position: relative;
          overflow: hidden;
          user-select: none;
        }
        .uif-map-card::after {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 80%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(80,160,255,0.12), transparent);
          transform: skewX(-15deg);
          transition: left 0.6s;
          pointer-events: none;
        }
        .uif-map-card:hover { border-color: rgba(80,160,255,0.45); transform: translateY(-2px); }
        .uif-map-card:hover::after { left: 150%; }
        .uif-map-card.selected {
          border-color: #40c0ff;
          box-shadow: 0 0 18px rgba(64,192,255,0.3);
          animation: uif-gentlePulse 2s infinite;
        }
        .uif-map-card.selected::after { opacity:1; }

        .uif-map-icon {
          font-size: 32px; margin-bottom: 12px; display:none;
        }
        .uif-map-name {
          font-family: 'Orbitron', monospace;
          font-size: 11px; font-weight:700;
          letter-spacing: 0.15em;
          color: #e0eaff;
          text-transform: uppercase;
          margin-bottom: 6px;
        }
        .uif-map-desc {
          font-size: 10px;
          color: #4a6a9a;
          letter-spacing: 0.05em;
          line-height: 1.5;
        }
        .uif-map-badge {
          position: absolute; top: 12px; right: 12px;
          font-size: 8px; letter-spacing:0.2em;
          padding: 3px 8px;
          border-radius: 1px;
          text-transform: uppercase;
        }
        .uif-map-badge.jetpack {
          background: rgba(0,200,120,0.12);
          border: 1px solid rgba(0,200,120,0.4);
          color: #00c878;
        }
        .uif-map-badge.tactical {
          background: rgba(255,160,40,0.1);
          border: 1px solid rgba(255,160,40,0.35);
          color: #ffa028;
        }

        /* SELECTED TICK */
        .uif-map-card.selected .uif-map-name::before {
          content:'▶ '; color: rgba(80,200,255,0.8);
        }

        /* BUTTONS */
        .uif-btn {
          width: 100%;
          padding: 14px 24px;
          font-family: 'Orbitron', monospace;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.25em;
          text-transform: uppercase;
          border: 1px solid rgba(80,160,255,0.5);
          background: rgba(30,70,140,0.25);
          color: #b8dcff;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.2, 0.9, 0.4, 1.1);
          clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px));
          position: relative;
          overflow: hidden;
          margin-top: 4px;
        }
        .uif-btn::before {
          content:'';
          position:absolute; top:0; left:-150%; width:100%; height:100%;
          background: linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent);
          transition: left 0.6s;
          transform: skewX(-20deg);
        }
        .uif-btn:hover::before { left:150%; }
        .uif-btn:hover {
          border-color: rgba(80,200,255,0.8);
          background: rgba(40,90,180,0.35);
          color: #e0f0ff;
          box-shadow: 0 0 20px rgba(0,160,255,0.4);
          transform: translateY(-2px);
        }
        .uif-btn:active { transform: scale(0.95); }
        .uif-btn:disabled {
          opacity: 0.35; cursor: not-allowed; transform: none;
        }
        .uif-btn.primary {
          background: rgba(40,100,200,0.4);
          border-color: rgba(80,180,255,0.7);
          color: #e8f4ff;
        }
        .uif-btn.primary:hover {
          background: rgba(50,120,230,0.55);
          box-shadow: 0 0 30px rgba(80,160,255,0.25);
        }

        /* STEP INDICATOR */
        .uif-steps {
          display: flex; align-items: center; gap: 8px;
          margin-bottom: 36px;
        }
        .uif-step {
          width: 24px; height: 2px;
          background: rgba(80,140,220,0.2);
          transition: background 0.3s;
        }
        .uif-step.active { background: rgba(80,180,255,0.8); }
        .uif-step.done { background: rgba(0,200,120,0.6); }

        /* ERROR */
        .uif-error {
          font-size: 10px; letter-spacing:0.15em;
          color: #ff6060;
          margin-top: 10px;
          min-height: 14px;
          text-align:center;
        }

        /* DIVIDER */
        .uif-divider {
          display: flex; align-items: center; gap:12px;
          margin: 20px 0;
          color: rgba(80,120,180,0.5);
          font-size: 9px; letter-spacing:0.3em;
        }
        .uif-divider::before,.uif-divider::after {
          content:''; flex:1;
          height:1px; background:rgba(80,120,180,0.2);
        }

        /* fade transitions */
        .uif-screen { opacity:0; pointer-events:none; transition: opacity 0.4s ease; }
        .uif-screen.visible { opacity:1; pointer-events:all; animation: uif-fadeInUp 0.5s cubic-bezier(0.2, 0.9, 0.4, 1.1) forwards; }

        /* corner decorations */
        .uif-corner {
          position:fixed; width:40px; height:40px;
          border-color: rgba(80,140,220,0.25);
          border-style: solid;
          z-index:10;
        }
        .uif-corner.tl { top:16px; left:16px; border-width:1px 0 0 1px; }
        .uif-corner.tr { top:16px; right:16px; border-width:1px 1px 0 0; }
        .uif-corner.bl { bottom:16px; left:16px; border-width:0 0 1px 1px; }
        .uif-corner.br { bottom:16px; right:16px; border-width:0 1px 1px 0; }

        /* status bar */
        .uif-statusbar {
          position:fixed; bottom:0; left:0; right:0;
          height:28px; z-index:15;
          background: rgba(4,10,20,0.95);
          border-top:1px solid rgba(80,120,180,0.15);
          display:flex; align-items:center;
          padding:0 20px; gap:24px;
          font-size:9px; letter-spacing:0.2em;
          color: rgba(80,120,180,0.5);
        }
        .uif-statusbar span.live { color:rgba(0,200,120,0.7); }
        .uif-statusbar span.live::before {
          content:'●'; margin-right:5px;
          animation: blink 1.2s step-end infinite;
        }
        @keyframes blink { 50%{opacity:0;} }

        /* LOADOUT GRID STYLES */
        .uif-loadout-scroll {
          width: 100%;
          max-width: 800px;
          max-height: 50vh;
          overflow-y: auto;
          margin-bottom: 24px;
          padding: 4px;
        }
        
        .uif-loadout-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 12px;
          padding: 4px;
        }
        
        .uif-weapon-card {
          background: rgba(8,15,30,0.9);
          border: 1px solid rgba(80,140,220,0.18);
          padding: 16px 12px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.2, 0.9, 0.4, 1.1);
          clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px));
          animation: uif-scaleIn 0.3s cubic-bezier(0.2, 0.9, 0.4, 1.1) forwards;
          position: relative;
          overflow: hidden;
          user-select: none;
          text-align: center;
        }
        
        .uif-weapon-card:hover {
          border-color: #40c0ff;
          box-shadow: 0 0 18px rgba(64,192,255,0.3);
          animation: uif-gentlePulse 2s infinite;
        }
        
        .uif-weapon-card.selected {
          border-color: rgba(80,200,255,0.8);
          background: rgba(20,40,80,0.6);
          box-shadow: 0 0 20px rgba(80,160,255,0.2);
        }
        
        .uif-weapon-card.selected::after {
          content: '✓';
          position: absolute;
          top: 8px;
          right: 8px;
          color: #00c878;
          font-size: 14px;
          font-weight: bold;
        }
        
        .uif-weapon-icon {
          width: 80px;
          height: 60px;
          margin: 0 auto 10px;
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
          border-radius: 2px;
        }
        
        .uif-weapon-name {
          font-family: 'Orbitron', monospace;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.1em;
          color: #e0eaff;
          margin-bottom: 8px;
        }
        
        .uif-weapon-stats {
          display: flex;
          justify-content: center;
          gap: 12px;
          font-size: 9px;
          color: #4a6a9a;
        }
        
        .uif-loadout-selection {
          text-align: center;
          margin-bottom: 16px;
          font-size: 11px;
          letter-spacing: 0.15em;
          color: #4a7ab0;
        }
        
        .uif-loadout-selection span {
          color: #ffaa44;
          font-weight: bold;
        }

        #uif-conf-map{
          font-size:13px;
          color:#6090c0;
          line-height:1.7
        }

        #uif-conf-map > span{
            font-family: Orbitron, monospace;
            font-size: 15px;
            color: #a0d0ff;
            font-weight: 700;
        }

        #uif-conf-name{
          font-family: Orbitron, monospace;
          font-size: 18px;
          font-weight: 700;
          color: #e8f0ff;
          letter-spacing: 0.12em;
        }

        .weapon-list {
          font-family: 'Orbitron', monospace;
          font-size: 12px;
          color: #a0d0ff;
          font-weight: 700;
          
          /* Desktop Layout: Stack vertically */
          display: flex;
          flex-direction: column;
          gap: 4px; 
        }

        /* Map Preview Panel for desktop */
        .uif-map-preview-panel {
            display: none;
            margin-left: 30px;
            width: 280px;
            flex-shrink: 0;
        }

        .uif-map-preview-image {
            width: 100%;
            height: 160px;
            border-radius: 4px;
            overflow: hidden;
            border: 1px solid rgba(80,140,220,0.3);
            background: rgba(0,0,0,0.5);
        }

        .uif-map-preview-image img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .uif-map-preview-desc {
            margin-top: 12px;
            padding: 12px;
            background: rgba(8,15,30,0.8);
            border: 1px solid rgba(80,140,220,0.2);
            border-radius: 4px;
        }

        .uif-map-preview-name {
            font-family: 'Orbitron', monospace;
            font-size: 14px;
            font-weight: 700;
            color: #e0eaff;
            margin-bottom: 8px;
        }

        .uif-map-preview-stats {
            display: flex;
            gap: 16px;
            margin-top: 8px;
            font-size: 11px;
            color: #ffaa44;
        }

        .map-loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.95);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(8px);
    font-family: 'Orbitron', monospace;
    transition: opacity 0.5s ease;
}

.map-loading-container {
    text-align: center;
    max-width: 500px;
    width: 90%;
    padding: 40px;
    background: rgba(8,15,30,0.95);
    border: 2px solid rgba(80,160,255,0.4);
    clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px));
    position: relative;
}

.map-loading-container::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, #40a0ff, transparent);
    animation: uif-borderPulse 2s infinite;
}

.loading-map-name {
    font-size: 18px;
    font-weight: bold;
    letter-spacing: 0.2em;
    color: #40c0ff;
    margin-bottom: 10px;
    text-transform: uppercase;
}

.loading-subtitle {
    font-size: 11px;
    letter-spacing: 0.3em;
    color: #4a7ab0;
    margin-bottom: 30px;
}

.loading-progress-bar {
    width: 100%;
    height: 4px;
    background: rgba(80,140,220,0.2);
    border-radius: 2px;
    overflow: hidden;
    margin: 20px 0;
}

.loading-progress-fill {
    width: 0%;
    height: 100%;
    background: linear-gradient(90deg, #40a0ff, #80d0ff);
    transition: width 0.3s ease;
    box-shadow: 0 0 10px rgba(64,160,255,0.5);
}

.loading-percent {
    font-size: 24px;
    font-weight: bold;
    color: #80d0ff;
    margin: 10px 0;
    font-family: 'Orbitron', monospace;
}

.loading-status {
    font-size: 11px;
    color: #4a7ab0;
    letter-spacing: 0.15em;
    margin-top: 10px;
}

.loading-steps {
    display: flex;
    justify-content: center;
    gap: 15px;
    margin: 20px 0;
}

.loading-step {
    font-size: 10px;
    color: rgba(80,140,220,0.3);
    letter-spacing: 0.1em;
    position: relative;
    padding-left: 15px;
}

.loading-step::before {
    content: '○';
    position: absolute;
    left: 0;
    color: rgba(80,140,220,0.3);
}

.loading-step.complete {
    color: #40c0ff;
}

.loading-step.complete::before {
    content: '●';
    color: #40c0ff;
}

.loading-step.active {
    color: #ffaa44;
}

.loading-step.active::before {
    content: '◉';
    color: #ffaa44;
    animation: pulse 1s infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}

        @media (min-width: 951px) {
            .uif-maps-wrapper {
                display: flex;
                align-items: flex-start;
                gap: 20px;
                width: 100%;
                max-width: 980px;
            }
            
            .uif-map-preview-panel {
                display: block;
            }
        }

        @media screen and (max-width: 950px) {
          .uif-sub, .uif-steps {
            margin-bottom: 23px;
          }
            .uif-maps-wrapper{
              display: flex;
              }
          .uif-maps {
              display: flex;
              flex-direction: column;
              gap: 14px;
              width: 100%;
              max-width: 680px;
              margin-bottom: 20px;
          }
          .uif-map-card {
              display: flex !important;
        flex-direction: row !important;
        align-items: center !important;
        gap: 15px !important;
        padding: 12px !important;
        width: 100% !important;
        height: auto !important;
        min-height: 60px;
          }
          .uif-map-badge {
              top: 8px;
              right: 8px;
              font-size: 7px;
              letter-spacing: 0.1em;
          }
          .uif-map-icon {
              display: none;
              width: 100vw;
              padding: 0 12px;
          }
          
          /* Map Preview Image */
          .uif-map-preview {
              width: 80px !important;
              height: 60px !important;
              border-radius: 4px !important;
              overflow: hidden !important;
              flex-shrink: 0 !important;
              border: 1px solid rgba(80,140,220,0.3) !important;
              display: none;
          }
          
          .uif-map-preview img {
              width: 100% !important;
              height: 100% !important;
              object-fit: cover !important;
          }
          
          .uif-map-info {
              flex: 1 !important;
              text-align: left !important;
          }

          .uif-map-name {
              font-size: 11px !important;
              font-weight: 700;
              letter-spacing: 0.1em;
              margin-bottom: 4px !important;
          }

          .uif-map-desc {
              display: block !important;
              font-size: 9px !important;
              color: #4a6a9a;
              letter-spacing: 0.05em;
              margin-bottom: 6px !important;
              line-height: 1.3 !important;
          }
          
          .uif-map-stats {
              display: flex !important;
              gap: 12px !important;
              font-size: 8px !important;
              color: #ffaa44 !important;
          }
          
          .uif-map-stats span {
              display: flex !important;
              align-items: center !important;
              gap: 4px !important;
          }

          .uif-loadout-grid {
              grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
              gap: 10px;
              width: 80%;
          }

          .uif-weapon-card {
              border-radius: 0px;
              padding: 10px 6px;
          }

          .uif-btn {
              font-size: 6px;
              margin-top: -4px;
          }

          #uif-conf-name{
              font-size: 8px;
          }

          .uif-divider {
              margin: 0 0;
          }

          #uif-conf-map{
            font-size: 10px;
          }

          #uif-conf-map > span{
              font-size: 10px;
          }

          .weapon-list {
            flex-direction: row; 
            flex-wrap: wrap;
            gap: 12px;
            font-size: 10px;
          }

          .uif-panel {
              padding: 26px 40px;
          }

          #weapons{
            margin-bottom: 13px;
          }
          
          /* Map Preview Panel for mobile */
          .uif-map-preview-panel {
              display: block !important;
              max-width: 680px;
          }
          
          .uif-map-preview-image {
              width: 100%;
              height: 180px;
              border-radius: 4px;
              overflow: hidden;
              border: 1px solid rgba(80,140,220,0.3);
              background: rgba(0,0,0,0.5);
          }
          
          .uif-map-preview-image img {
              width: 100%;
              height: 100%;
              object-fit: cover;
          }
          
          .uif-map-preview-desc {
              margin-top: 0px;
              padding: 12px;
              background: rgba(8,15,30,0.8);
              border: 1px solid rgba(80,140,220,0.2);
              border-radius: 4px;
          }
          
          .uif-map-preview-name {
              font-family: 'Orbitron', monospace;
              font-size: 14px;
              font-weight: 700;
              color: #e0eaff;
              margin-bottom: 8px;
          }
          
          .uif-map-preview-stats {
              display: flex;
              gap: 16px;
              margin-top: 8px;
              font-size: 11px;
              color: #ffaa44;
          }
        }
      `;
      document.head.appendChild(style);
    }

    // Root
    const root = document.createElement("div");
    root.id = "uiflow-root";
    root.innerHTML = `
  
  <!-- Static corner borders -->
  <div class="corner corner-tl"></div>
  <div class="corner corner-tr"></div>
  <div class="corner corner-bl"></div>
  <div class="corner corner-br"></div>
  
  <!-- Animated corner gradients (like React motion) -->
  <div class="corner-animated tl"><div class="corner-gradient"></div></div>
  <div class="corner-animated tr"><div class="corner-gradient"></div></div>
  <div class="corner-animated bl"><div class="corner-gradient"></div></div>
  <div class="corner-animated br"><div class="corner-gradient"></div></div>

      <div class="grid-overlay"></div>
      <div class="scanline-overlay"></div>
      <div class="noise-overlay"></div>

      <!-- STEP 1: Name -->
      <div class="uif-screen" id="uif-s1">
        <div class="uif-logo">TOZ</div>
        <div class="uif-sub">Combat Protocol v2.4</div>
        <div class="uif-steps">
          <div class="uif-step active" id="uif-dot1"></div>
          <div class="uif-step" id="uif-dot2"></div>
          <div class="uif-step" id="uif-dot3"></div>
          <div class="uif-step" id="uif-dot4"></div>
        </div>
        <div class="uif-panel" style="max-width:380px">
          <label class="uif-label">Operator Callsign</label>
          <input class="uif-input" id="uif-name" type="text" placeholder="GHOST_01" maxlength="20" autocomplete="off" spellcheck="false">
          <button class="uif-btn primary" id="uif-name-ok">CONFIRM IDENTITY →</button>
          <div class="uif-error" id="uif-name-err"></div>
        </div>
      </div>

      <!-- STEP 2: Map -->
      <div class="uif-screen" id="uif-s2">
        <div class="uif-logo" style="font-size:clamp(16px,2.5vw,32px)">SELECT DEPLOYMENT ZONE</div>
        <div class="uif-sub" style="margin-bottom:28px">Choose your battleground</div>
        <div class="uif-steps">
          <div class="uif-step done" id="uif-dot1b"></div>
          <div class="uif-step active" id="uif-dot2b"></div>
          <div class="uif-step" id="uif-dot3b"></div>
          <div class="uif-step" id="uif-dot4b"></div>
        </div>
        <div class="uif-maps-wrapper">
          <div class="uif-maps" id="uif-map-grid"></div>
          <div class="uif-map-preview-panel" id="uif-map-preview">
            <div class="uif-map-preview-image">
              <img id="uif-preview-img" src="/assets/ui/maps/map1.png" alt="Map preview">
            </div>
            <div class="uif-map-preview-desc">
              <div class="uif-map-preview-name" id="uif-preview-name">Shooting Range</div>
              <div class="uif-map-preview-stats" id="uif-preview-stats">
                <span>👥 0/10 players</span>
                <span>🎯 Active</span>
              </div>
            </div>
          </div>
        </div>
        <div style="display:flex;gap:12px;width:100%;max-width:680px">
          <button class="uif-btn" id="uif-map-back" style="max-width:140px">← BACK</button>
          <button class="uif-btn primary" id="uif-map-ok" disabled>SELECT LOADOUT →</button>
        </div>
        <div class="uif-error" id="uif-map-err"></div>
      </div>

      <!-- STEP 3: Loadout Selection -->
      <div class="uif-screen" id="uif-s3">
        <div class="uif-logo" style="font-size:clamp(14px,2vw,24px)">SELECT YOUR ARSENAL</div>
        <div class="uif-sub" style="margin-bottom:20px">Choose 4 weapons</div>
        <div class="uif-steps">
          <div class="uif-step done" id="uif-dot1c"></div>
          <div class="uif-step done" id="uif-dot2c"></div>
          <div class="uif-step active" id="uif-dot3c"></div>
          <div class="uif-step" id="uif-dot4c"></div>
        </div>
        <div class="uif-loadout-selection" id="uif-loadout-counter">
          Selected: <span>0</span> / 4
        </div>
        <div class="uif-loadout-scroll">
          <div class="uif-loadout-grid" id="uif-weapon-grid"></div>
        </div>
        <div style="display:flex;gap:12px;width:100%;max-width:680px">
          <button class="uif-btn" id="uif-loadout-back" style="max-width:140px">← BACK</button>
          <button class="uif-btn primary" id="uif-loadout-ok" disabled>CONFIRM LOADOUT →</button>
        </div>
        <div class="uif-error" id="uif-loadout-err"></div>
      </div>

      <!-- STEP 4: Ready -->
      <div class="uif-screen" id="uif-s4">
        <div class="uif-logo" style="font-size:clamp(16px,2.5vw,28px)">MISSION BRIEFING</div>
        <div class="uif-sub">Confirm deployment</div>
        <div class="uif-steps">
          <div class="uif-step done"></div>
          <div class="uif-step done"></div>
          <div class="uif-step done"></div>
          <div class="uif-step active"></div>
        </div>
        <div class="uif-panel" style="max-width:480px">
          <div>
            <div class="uif-label">Operator</div>
            <div id="uif-conf-name"></div>
          </div>
          <div class="uif-divider">ZONE</div>
          <div>
            <div id="uif-conf-map"></div>
          </div>
          <div class="uif-divider">LOADOUT</div>
          <div id="weapons">
            <div id="uif-conf-loadout" style="font-size:11px;color:#6090c0;line-height:1.7"></div>
          </div>
          <button class="uif-btn primary" id="uif-launch" style="padding:16px">⬛ ENTER WARZONE</button>
          <button class="uif-btn" id="uif-ready-back" style="margin-top:10px;background:transparent;border-color:rgba(80,120,180,0.25);color:rgba(80,120,180,0.6)">← CHANGE LOADOUT</button>
        </div>
      </div>

      <div class="uif-statusbar">
        <span class="live">SERVER ONLINE</span>
        <span id="uif-sb-map">NO ZONE SELECTED</span>
        <span id="uif-sb-name">UNNAMED</span>
        <span id="uif-sb-loadout">NO LOADOUT</span>
      </div>
    `;
    document.body.appendChild(root);
    this._root = root;
    this._initWeapons();
    this._bindEvents();
    this._showScreen("uif-s1");

    // Focus name input
    setTimeout(() => document.getElementById("uif-name")?.focus(), 100);
  }

  _updateBackground(step) {
    const root = document.getElementById("uiflow-root");
    const backgrounds = {
      1: "url('/assets/ui/bgs/bg1.jpg')",
      2: "url('/assets/ui/bgs/bg2.jpg')",
      3: "url('/assets/ui/bgs/bg3.jpg')",
      4: "url('/assets/ui/bgs/bg4.png')",
    };
    root.style.background = `linear-gradient(rgba(5,8,16,0.9), rgba(5,8,16,0.95)), ${backgrounds[step]}`;
    root.style.backgroundSize = "cover";
    root.style.backgroundPosition = "center";
  }

  _initWeapons() {
    // Get weapon configs from global
    const WEAPON_CONFIGS = window.WEAPON_CONFIGS || {};

    this.availableWeapons = Object.entries(WEAPON_CONFIGS).map(
      ([key, config]) => ({
        key: key,
        name: config.name,
        damage: config.damage,
        maxAmmo: config.maxAmmo,
        fireRate: config.fireRate,
        config: config,
      }),
    );
  }

  _showScreen(id) {
  const currentScreen = this._root.querySelector(".uif-screen.visible");
  const newScreen = document.getElementById(id);
  
  const gridOverlay = this._root.querySelector(".grid-overlay");
  const scanlineOverlay = this._root.querySelector(".scanline-overlay");
  const noiseOverlay = this._root.querySelector(".noise-overlay");

  if (currentScreen === newScreen) return;

  // Speed up animations during transition (like screen glitch)
  if (gridOverlay) {
    gridOverlay.style.animationDuration = "2s";
    scanlineOverlay.style.animationDuration = "1s";
    noiseOverlay.style.animationDuration = "0.5s";
  }

  // Animate out current screen
  if (currentScreen) {
    currentScreen.style.animation =
      "uif-fadeOutDown 0.4s cubic-bezier(0.2, 0.9, 0.4, 1.1) forwards";
    setTimeout(() => {
      currentScreen.classList.remove("visible");
      currentScreen.style.animation = "";
    }, 400);
  }

  // Animate in new screen
  setTimeout(() => {
    this._root
      .querySelectorAll(".uif-screen")
      .forEach((s) => s.classList.remove("visible"));
    
    if (newScreen) {
      newScreen.classList.add("visible");
      newScreen.style.animation =
        "uif-fadeInUp 0.6s ease-in forwards";

      // Reset animations back to normal speed after transition
      setTimeout(() => {
        if (gridOverlay) {
          gridOverlay.style.animationDuration = "0.8s";
          scanlineOverlay.style.animationDuration = "0.8s";
          noiseOverlay.style.animationDuration = "0.8s";
        }
      }, 600);

      // Update background based on step
      let step = 1;
      if (id === "uif-s1") step = 1;
      else if (id === "uif-s2") step = 2;
      else if (id === "uif-s3") step = 3;
      else if (id === "uif-s4") step = 4;
      this._updateBackground(step);
    }
  }, 600);
}

  _buildMapGrid() {
    const grid = document.getElementById("uif-map-grid");
    if (!grid) return;
    grid.innerHTML = "";

    const maps = [
      {
        key: "shooting_range",
        icon: "🎯",
        name: "Shooting Range",
        desc: "Desert training ground. Rooms & tactical combat. Standard loadout.",
        badge: "TACTICAL",
        badgeClass: "tactical",
        previewImage: "/assets/ui/maps/map1.png",
        maxPlayers: 100,
        active: true,
      },
      {
        key: "greeble_map",
        icon: "🏛️",
        name: "Ancient Ruins",
        desc: "High-altitude deathmatch. Jetpack equipped. No respawn rooms.",
        badge: "JETPACK",
        badgeClass: "jetpack",
        previewImage: "/assets/ui/maps/map2.png",
        maxPlayers: 100,
        active: true,
      },
      {
        key: "lowpoly_environment",
        icon: "🌳",
        name: "Low Poly Environment",
        desc: "Fantasy world with windmills & bridges. Exploration focused. Standard loadout.",
        badge: "EXPLORE",
        badgeClass: "tactical",
        previewImage: "/assets/ui/maps/map3.png",
        maxPlayers: 100,
        active: true,
      },
    ];

    // Store current player counts (can be updated from server)
    this.mapPlayerCounts = {
      shooting_range: 0,
      greeble_map: 0,
      lowpoly_environment: 0,
    };

    maps.forEach((m, idx) => {
      const card = document.createElement("div");
      card.className = "uif-map-card";
      card.dataset.key = m.key;

      // For mobile: show preview image inside card
      const isMobile = window.innerWidth <= 950;

      if (isMobile) {
        card.innerHTML = `
          <div class="uif-map-preview">
            <img src="${m.previewImage}" alt="${m.name}">
          </div>
          <div class="uif-map-info">
            <div class="uif-map-name">${m.name}</div>
            <div class="uif-map-desc">${m.desc}</div>
            <div class="uif-map-stats">
              <span>👥 <span class="player-count-${m.key}">0</span>/${m.maxPlayers}</span>
              <span>🏷️ ${m.badge}</span>
            </div>
          </div>
          <span class="uif-map-badge ${m.badgeClass}">${m.badge}</span>
        `;
      } else {
        card.innerHTML = `
          <span class="uif-map-badge ${m.badgeClass}">${m.badge}</span>
          <span class="uif-map-icon">${m.icon}</span>
          <div class="uif-map-name">${m.name}</div>
          <div class="uif-map-desc">${m.desc.replace(/\n/g, "<br>")}</div>
          <div class="uif-map-stats">
            <span>👥 <span class="player-count-${m.key}">0</span>/${
          m.maxPlayers
        }</span>
          </div>
        `;
      }
      card.style.animationDelay = `${0.1 + idx * 0.08}s`;

      card.addEventListener("click", () => {
        this._playSelectSound();
        grid
          .querySelectorAll(".uif-map-card")
          .forEach((c) => c.classList.remove("selected"));
        card.classList.add("selected");
        this.selectedMapKey = m.key;
        document.getElementById("uif-map-ok").disabled = false;
        document.getElementById("uif-map-err").textContent = "";
        document.getElementById("uif-sb-map").textContent =
          m.name.toUpperCase();

        // Update preview panel
        this._updateMapPreview(m);
      });
      grid.appendChild(card);
    });

    // Initialize preview with first map
    if (maps.length > 0) {
      this._updateMapPreview(maps[0]);
    }

    // Request player counts from server
    this._requestPlayerCounts();
  }

  _updateMapPreview(map) {
    const previewImg = document.getElementById("uif-preview-img");
    const previewName = document.getElementById("uif-preview-name");
    const previewStats = document.getElementById("uif-preview-stats");

    if (previewImg) {
      previewImg.src = map.previewImage;
      previewImg.alt = map.name;
    }
    if (previewName) {
      previewName.textContent = map.name;
    }
    if (previewStats) {
      const currentCount = this.mapPlayerCounts?.[map.key] || 0;
      previewStats.innerHTML = `
        <span>👥 ${currentCount}/${map.maxPlayers} players</span>
        <span>🎯 ${map.active ? "Active" : "Coming Soon"}</span>
        <span>🏷️ ${map.badge}</span>
      `;
    }
  }

  _requestPlayerCounts() {
    // Listen for player count updates from server
    if (window.socket) {
      window.socket.emit("requestMapPlayerCounts");

      window.socket.on("mapPlayerCounts", (counts) => {
        this.mapPlayerCounts = counts;

        // Update all map cards
        Object.keys(counts).forEach((mapKey) => {
          const countElements = document.querySelectorAll(
            `.player-count-${mapKey}`,
          );
          countElements.forEach((el) => {
            el.textContent = counts[mapKey];
          });
        });

        // Update preview if a map is selected
        if (this.selectedMapKey) {
          const selectedMap = this._getMapByKey(this.selectedMapKey);
          if (selectedMap) {
            this._updateMapPreview(selectedMap);
          }
        }
      });
    }
  }

  _getMapByKey(key) {
    const maps = {
      shooting_range: {
        key: "shooting_range",
        name: "Shooting Range",
        previewImage: "/assets/ui/maps/map1.png",
        maxPlayers: 10,
        active: true,
        badge: "TACTICAL",
      },
      greeble_map: {
        key: "greeble_map",
        name: "Ancient Ruins",
        previewImage: "/assets/ui/maps/map2.png",
        maxPlayers: 10,
        active: true,
        badge: "JETPACK",
      },
      lowpoly_environment: {
        key: "lowpoly_environment",
        name: "Low Poly Environment",
        previewImage: "/assets/ui/maps/map3.png",
        maxPlayers: 10,
        active: true,
        badge: "EXPLORE",
      },
    };
    return maps[key];
  }

  _buildWeaponGrid() {
    const grid = document.getElementById("uif-weapon-grid");
    if (!grid) return;
    grid.innerHTML = "";

    this.availableWeapons.forEach((weapon, idx) => {
      const card = document.createElement("div");
      card.className = "uif-weapon-card";
      card.dataset.weapon = weapon.key;

      card.innerHTML = `
      <div class="uif-weapon-icon" style="background-image: url(/assets/ui/weapons/${weapon.key}.jpg)"></div>
      <div class="uif-weapon-name">${weapon.name}</div>
      <div class="uif-weapon-stats">
        <span>💥 ${weapon.damage}</span>
        <span>🔫 ${weapon.maxAmmo}</span>
        <span>⚡ ${weapon.fireRate}s</span>
      </div>
    `;
      card.style.animationDelay = `${0.05 * idx}s`;

      // Check if already selected
      if (this.selectedWeapons.find((w) => w.key === weapon.key)) {
        card.classList.add("selected");
      }

      card.addEventListener("click", () => {
        this._playSelectSound(); // Use select sound for weapon selection
        this._toggleWeapon(weapon, card);
      });
      grid.appendChild(card);
    });

    this._updateLoadoutCounter();
  }

  _toggleWeapon(weapon, card) {
    const index = this.selectedWeapons.findIndex((w) => w.key === weapon.key);

    if (index === -1) {
      // Adding weapon
      if (this.selectedWeapons.length >= 4) {
        const err = document.getElementById("uif-loadout-err");
        if (err) {
          err.textContent = "MAXIMUM 4 WEAPONS ALLOWED";
          setTimeout(() => {
            err.textContent = "";
          }, 2000);
        }
        return;
      }
      this.selectedWeapons.push(weapon);
      card.classList.add("selected");
    } else {
      // Removing weapon
      this.selectedWeapons.splice(index, 1);
      card.classList.remove("selected");
    }

    this._updateLoadoutCounter();
    this._updateLoadoutButton();
    this._updateStatusBar();
  }

  _updateLoadoutCounter() {
    const counter = document.getElementById("uif-loadout-counter");
    if (counter) {
      const span = counter.querySelector("span");
      if (span) {
        span.textContent = this.selectedWeapons.length;
        if (this.selectedWeapons.length === 4) {
          span.style.color = "#00c878";
        } else if (this.selectedWeapons.length > 0) {
          span.style.color = "#ffaa44";
        } else {
          span.style.color = "#4a6a9a";
        }
      }
    }
  }

  _updateLoadoutButton() {
    const btn = document.getElementById("uif-loadout-ok");
    if (btn) {
      btn.disabled = this.selectedWeapons.length !== 4;
      if (this.selectedWeapons.length === 4) {
        btn.textContent = "CONFIRM LOADOUT →";
      } else {
        btn.textContent = `SELECT ${
          4 - this.selectedWeapons.length
        } MORE WEAPON(S)`;
      }
    }
  }

  _updateStatusBar() {
    const sb = document.getElementById("uif-sb-loadout");
    if (sb) {
      if (this.selectedWeapons.length === 0) {
        sb.textContent = "NO LOADOUT";
        sb.style.color = "rgba(80,120,180,0.5)";
      } else if (this.selectedWeapons.length === 4) {
        sb.textContent = "LOADOUT READY";
        sb.style.color = "rgba(0,200,120,0.7)";
      } else {
        sb.textContent = `${this.selectedWeapons.length}/4 WEAPONS`;
        sb.style.color = "rgba(255,160,40,0.7)";
      }
    }
  }

  _bindEvents() {
    // Helper to add button sound to buttons
    const addButtonSound = (buttonId) => {
      const btn = document.getElementById(buttonId);
      if (btn) {
        btn.addEventListener("click", (e) => {
          this._playButtonSound();
        });
      }
    };

    // Add sounds to all buttons
    const allButtons = [
      "uif-name-ok",
      "uif-map-ok",
      "uif-map-back",
      "uif-loadout-ok",
      "uif-loadout-back",
      "uif-launch",
      "uif-ready-back",
    ];

    allButtons.forEach(addButtonSound);

    // Step 1 → 2 (existing event with sound already added via above)
    document
      .getElementById("uif-name-ok")
      .addEventListener("click", () => this._confirmName());
    document.getElementById("uif-name").addEventListener("keydown", (e) => {
      if (e.key === "Enter") this._confirmName();
    });

    // Step 2 → 3
    this._buildMapGrid();
    document.getElementById("uif-map-ok").addEventListener("click", () => {
      if (!this.selectedMapKey) {
        document.getElementById("uif-map-err").textContent =
          "SELECT A ZONE FIRST";
        return;
      }
      this._showLoadoutScreen();
    });
    document
      .getElementById("uif-map-back")
      .addEventListener("click", () => this._showScreen("uif-s1"));

    // Step 3 → 4
    document.getElementById("uif-loadout-ok").addEventListener("click", () => {
      if (this.selectedWeapons.length !== 4) {
        document.getElementById("uif-loadout-err").textContent =
          "SELECT EXACTLY 4 WEAPONS";
        return;
      }
      this._showConfirm();
    });
    document
      .getElementById("uif-loadout-back")
      .addEventListener("click", () => this._showScreen("uif-s2"));

    // Step 4 → launch
    document
      .getElementById("uif-launch")
      .addEventListener("click", () => this._launch());
    document
      .getElementById("uif-ready-back")
      .addEventListener("click", () => this._showScreen("uif-s3"));
  }

  _confirmName() {
    const val = document.getElementById("uif-name").value.trim();
    if (!val || val.length < 2) {
      document.getElementById("uif-name-err").textContent =
        "CALLSIGN MUST BE AT LEAST 2 CHARACTERS";
      return;
    }
    this.playerName = val;
    document.getElementById("uif-sb-name").textContent = val.toUpperCase();
    this._showScreen("uif-s2");
  }

  _showLoadoutScreen() {
    this._buildWeaponGrid();
    this._updateLoadoutButton();
    this._updateStatusBar();
    this._showScreen("uif-s3");
  }

  _showConfirm() {
    const MAP_META = {
      shooting_range: {
        name: "Shooting Range",
        desc: "Desert TDM · Room system active · Standard jump · 10 players max",
      },
      greeble_map: {
        name: "Ancient Ruins",
        desc: "Aerial deathmatch · Jetpack enabled · No room rewards · 10 players max",
      },
      lowpoly_environment: {
        name: "Low Poly Environment",
        desc: "Fantasy exploration · Windmills & bridges · Standard movement · 10 players max",
      },
    };
    const meta = MAP_META[this.selectedMapKey];

    document.getElementById("uif-conf-name").textContent =
      this.playerName.toUpperCase();
    document.getElementById(
      "uif-conf-map",
    ).innerHTML = `<span>${meta.name}</span><br>${meta.desc}`;

    // Show loadout summary
    const loadoutDiv = document.getElementById("uif-conf-loadout");
    if (loadoutDiv) {
      if (this.selectedWeapons.length === 4) {
        // Wrap each individual weapon name in a span
        const weaponList = this.selectedWeapons
          .map((w) => `<span>${w.name}</span>`)
          .join("");

        // Add the "weapon-list" class to control the layout via CSS
        loadoutDiv.innerHTML = `<span class="weapon-list">${weaponList}</span>`;
      } else {
        loadoutDiv.innerHTML = `<span style="color:#ff6060; font-family:Orbitron,monospace; font-size:12px; font-weight:700;">Loadout incomplete!</span>`;
      }
    }

    this._showScreen("uif-s4");
  }

  _launch() {
    // Set pending loadout weapons globally
    window.pendingLoadoutWeapons = this.selectedWeapons.map((w) => w.config);

    // Pass everything to caller
    this._root.style.transition = "opacity 0.5s";
    this._root.style.opacity = "0";
    setTimeout(() => {
      this._root.remove();
    }, 500);

    this.onStart({
      name: this.playerName,
      mapKey: this.selectedMapKey,
      loadout: this.selectedWeapons.map((w) => w.config),
    });
  }

  _playClickSound() {
    if (window.uiSoundManager) {
      window.uiSoundManager.playClick();
    }
  }

  _playButtonSound() {
    if (window.uiSoundManager) {
      window.uiSoundManager.playButtonClick();
    }
  }

  _playSelectSound() {
    if (window.uiSoundManager) {
      window.uiSoundManager.playSelectClick();
    }
  }

  destroy() {
    const root = document.getElementById("uiflow-root");
    if (root) root.remove();
  }
}
