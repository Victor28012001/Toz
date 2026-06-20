// performanceMonitor.js
export class PerformanceMonitor {
  constructor() {
    this.frameCount = 0;
    this.fps = 0;
    this.lastTime = performance.now();
    this.fpsHistory = [];
    this.maxHistoryLength = 100;
    
    // Performance metrics
    this.renderTime = 0;
    this.updateTime = 0;
    this.physicsTime = 0;
    
    // Memory usage
    this.memoryInfo = null;
    
    // GPU info
    this.gpuInfo = null;
    
    // Thresholds for warnings
    this.lowFpsThreshold = 30;
    this.veryLowFpsThreshold = 20;
    
    // UI elements
    this.statsPanel = null;
    this.isVisible = false;
    this.metricsMode = 'basic'; // 'basic', 'advanced', 'minimal'
    
    // console.log('Performance Monitor initialized');
  }

  initUI() {
    // Create stats panel
    this.statsPanel = document.createElement('div');
    this.statsPanel.id = 'performance-stats';
    this.statsPanel.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: #fff;
      font-family: monospace;
      font-size: 12px;
      padding: 10px;
      border-radius: 5px;
      border: 1px solid #333;
      z-index: 10000;
      min-width: 200px;
      backdrop-filter: blur(5px);
      display: none;
      pointer-events: none;
    `;

    // Create header with toggle button
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 5px;
      pointer-events: auto;
    `;

    const title = document.createElement('div');
    title.textContent = 'Performance Stats';
    title.style.fontWeight = 'bold';

    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = '×';
    toggleBtn.style.cssText = `
      background: none;
      border: none;
      color: white;
      cursor: pointer;
      font-size: 14px;
      padding: 2px 6px;
      border-radius: 3px;
    `;
    toggleBtn.title = 'Toggle stats panel';
    toggleBtn.addEventListener('click', () => {
      this.toggleVisibility();
    });

    header.appendChild(title);
    header.appendChild(toggleBtn);

    // Create content divs
    this.content = document.createElement('div');
    this.content.id = 'performance-content';

    this.statsPanel.appendChild(header);
    this.statsPanel.appendChild(this.content);
    document.body.appendChild(this.statsPanel);
  }

  toggleVisibility() {
    this.isVisible = !this.isVisible;
    this.statsPanel.style.display = this.isVisible ? 'block' : 'none';
    console.log("visible")
    
    if (this.isVisible) {
      this.updateUI();
    }
  }

  updateFPS(currentTime) {
    this.frameCount++;
    
    if (currentTime >= this.lastTime + 1000) {
      this.fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastTime));
      this.fpsHistory.push(this.fps);
      
      if (this.fpsHistory.length > this.maxHistoryLength) {
        this.fpsHistory.shift();
      }
      
      this.frameCount = 0;
      this.lastTime = currentTime;
      
      // Log warnings if FPS is low
      // if (this.fps < this.lowFpsThreshold) {
      //   if (this.fps < this.veryLowFpsThreshold) {
      //     console.warn(`⚠️ VERY LOW FPS: ${this.fps} - Game performance is poor`);
      //   } else {
      //     console.log(`⚠️ Low FPS: ${this.fps} - Consider reducing graphics settings`);
      //   }
      // }
      
      // Update UI if visible
      if (this.isVisible) {
        this.updateUI();
      }
    }
  }

  updateUI() {
    if (!this.content || !this.isVisible) return;

    const avgFps = this.getAverageFPS();
    const minFps = this.getMinFPS();
    const maxFps = this.getMaxFPS();
    
    let contentHTML = `
      <div style="margin-bottom: 5px;">
        <div style="color: ${this.getFPSColor(this.fps)}; font-weight: bold;">
          FPS: ${this.fps} (Avg: ${avgFps})
        </div>
        <div style="font-size: 10px; color: #aaa;">
          Min: ${minFps} | Max: ${maxFps}
        </div>
      </div>
    `;

    if (this.metricsMode === 'advanced') {
      contentHTML += `
        <div style="border-top: 1px solid #333; padding-top: 5px; margin-top: 5px;">
          <div>Render: ${this.renderTime.toFixed(2)}ms</div>
          <div>Update: ${this.updateTime.toFixed(2)}ms</div>
          <div>Physics: ${this.physicsTime.toFixed(2)}ms</div>
        </div>
      `;
    }

    if (this.memoryInfo) {
      const usedMB = Math.round(this.memoryInfo.usedJSHeapSize / 1048576);
      const totalMB = Math.round(this.memoryInfo.totalJSHeapSize / 1048576);
      const memoryPercent = Math.round((usedMB / totalMB) * 100);
      
      contentHTML += `
        <div style="border-top: 1px solid #333; padding-top: 5px; margin-top: 5px;">
          <div>Memory: ${usedMB}MB / ${totalMB}MB (${memoryPercent}%)</div>
          <div style="background: #333; height: 4px; border-radius: 2px; margin-top: 2px;">
            <div style="background: ${this.getMemoryColor(memoryPercent)}; height: 100%; width: ${memoryPercent}%; border-radius: 2px;"></div>
          </div>
        </div>
      `;
    }

    // Add GPU info if available
    if (this.gpuInfo) {
      contentHTML += `
        <div style="border-top: 1px solid #333; padding-top: 5px; margin-top: 5px;">
          <div>Renderer: ${this.gpuInfo.renderer || 'Unknown'}</div>
          <div>Vendor: ${this.gpuInfo.vendor || 'Unknown'}</div>
        </div>
      `;
    }

    // Add performance tips
    if (this.fps < this.lowFpsThreshold) {
      contentHTML += `
        <div style="border-top: 1px solid #ff9900; padding-top: 5px; margin-top: 5px; color: #ff9900; font-size: 10px;">
          ⚠️ Performance Tips:
          <ul style="margin: 3px 0 0 10px; padding-left: 5px;">
            <li>Reduce graphics settings</li>
            <li>Close background apps</li>
            <li>Update GPU drivers</li>
          </ul>
        </div>
      `;
    }

    this.content.innerHTML = contentHTML;
  }

  getFPSColor(fps) {
    if (fps >= 60) return '#0f0';
    if (fps >= 45) return '#ff0';
    if (fps >= 30) return '#f80';
    return '#f00';
  }

  getMemoryColor(percent) {
    if (percent < 70) return '#0f0';
    if (percent < 85) return '#ff0';
    return '#f00';
  }

  getAverageFPS() {
    if (this.fpsHistory.length === 0) return 0;
    const sum = this.fpsHistory.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.fpsHistory.length);
  }

  getMinFPS() {
    return this.fpsHistory.length > 0 ? Math.min(...this.fpsHistory) : 0;
  }

  getMaxFPS() {
    return this.fpsHistory.length > 0 ? Math.max(...this.fpsHistory) : 0;
  }

  measureTime(func, metricName) {
    const start = performance.now();
    const result = func();
    const end = performance.now();
    const duration = end - start;
    
    // Update the appropriate metric
    switch (metricName) {
      case 'render':
        this.renderTime = duration;
        break;
      case 'update':
        this.updateTime = duration;
        break;
      case 'physics':
        this.physicsTime = duration;
        break;
    }
    
    return result;
  }

  updateMemoryInfo() {
    if (performance.memory) {
      this.memoryInfo = performance.memory;
    }
  }

  updateGPUInfo(renderer) {
    this.gpuInfo = {
      renderer: renderer.info.renderer,
      vendor: renderer.info.vendor,
      maxTextures: renderer.capabilities.maxTextures,
      maxTextureSize: renderer.capabilities.maxTextureSize
    };
  }

  collectMetrics(renderer) {
    this.updateGPUInfo(renderer);
    this.updateMemoryInfo();
  }

  setMetricsMode(mode) {
    this.metricsMode = mode;
    if (this.isVisible) {
      this.updateUI();
    }
  }

  dispose() {
    if (this.statsPanel && this.statsPanel.parentNode) {
      this.statsPanel.parentNode.removeChild(this.statsPanel);
    }
  }
}

// Convenience function to create a simple FPS counter
export function createSimpleFPSCounter() {
  const fpsCounter = document.createElement('div');
  fpsCounter.id = 'simple-fps-counter';
  fpsCounter.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    color: white;
    font-family: monospace;
    font-size: 14px;
    background: rgba(0, 0, 0, 0.5);
    padding: 5px 10px;
    border-radius: 3px;
    z-index: 9999;
    pointer-events: none;
  `;
  
  let frameCount = 0;
  let lastTime = performance.now();
  let fps = 0;
  
  function update() {
    frameCount++;
    const currentTime = performance.now();
    
    if (currentTime >= lastTime + 1000) {
      fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
      frameCount = 0;
      lastTime = currentTime;
      
      // Update display
      fpsCounter.textContent = `FPS: ${fps}`;
      fpsCounter.style.color = fps >= 60 ? '#0f0' : fps >= 30 ? '#ff0' : '#f00';
      
      // Log if FPS drops below 30
      if (fps < 30) {
        console.log(`Low FPS detected: ${fps}`);
      }
    }
    
    requestAnimationFrame(update);
  }
  
  document.body.appendChild(fpsCounter);
  update();
  
  return fpsCounter;
}