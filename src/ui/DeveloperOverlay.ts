export interface DebugInfo {
  connectionStatus: string;
  sessionId: string;
  transport: string;
  latencyMs: number;
  renderFps: number;
  stateRateHz: number;
  commandRateHz: number;
  robotMode: string;
  recoveryState: string;
  position: [number, number, number];
  orientation: [number, number, number, number];
  activeCamera: string;
}

export class DeveloperOverlay {
  private element: HTMLElement;
  private isVisible: boolean = false;
  private contentElem: HTMLElement;

  constructor(container: HTMLElement) {
    this.element = document.createElement('div');
    this.element.id = 'developer-overlay';
    this.element.style.position = 'absolute';
    this.element.style.top = '24px';
    this.element.style.right = '24px';
    this.element.style.zIndex = '200';
    this.element.style.width = '300px';
    this.element.style.padding = '14px 16px';
    this.element.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
    this.element.style.backdropFilter = 'blur(12px)';
    this.element.style.border = '1px solid #e4e4e7';
    this.element.style.borderRadius = '10px';
    this.element.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.06)';
    this.element.style.fontFamily = 'SFMono-Regular, Menlo, Monaco, Consolas, monospace';
    this.element.style.fontSize = '11px';
    this.element.style.color = '#3f3f46';
    this.element.style.display = 'none';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = '10px';
    header.style.paddingBottom = '6px';
    header.style.borderBottom = '1px solid #f4f4f5';

    const title = document.createElement('span');
    title.textContent = 'DEV TELEMETRY [F1]';
    title.style.fontWeight = '700';
    title.style.color = '#18181b';
    title.style.fontSize = '11px';

    const closeBtn = document.createElement('span');
    closeBtn.textContent = '✕';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.color = '#a1a1aa';
    closeBtn.onclick = () => this.hide();

    header.appendChild(title);
    header.appendChild(closeBtn);
    this.element.appendChild(header);

    this.contentElem = document.createElement('div');
    this.contentElem.style.display = 'flex';
    this.contentElem.style.flexDirection = 'column';
    this.contentElem.style.gap = '5px';
    this.element.appendChild(this.contentElem);

    container.appendChild(this.element);
  }

  public toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  public show(): void {
    this.isVisible = true;
    this.element.style.display = 'block';
  }

  public hide(): void {
    this.isVisible = false;
    this.element.style.display = 'none';
  }

  public update(info: DebugInfo): void {
    if (!this.isVisible) return;

    const posStr = `[${info.position[0].toFixed(2)}, ${info.position[1].toFixed(2)}, ${info.position[2].toFixed(2)}]`;
    const quatStr = `[${info.orientation[0].toFixed(2)}, ${info.orientation[1].toFixed(2)}, ${info.orientation[2].toFixed(2)}, ${info.orientation[3].toFixed(2)}]`;

    this.contentElem.innerHTML = `
      <div style="display:flex; justify-content:space-between;"><span style="color:#71717a">Connection:</span><span style="font-weight:600; color:#18181b">${info.connectionStatus}</span></div>
      <div style="display:flex; justify-content:space-between;"><span style="color:#71717a">Session:</span><span style="color:#18181b">${info.sessionId}</span></div>
      <div style="display:flex; justify-content:space-between;"><span style="color:#71717a">Transport:</span><span style="color:#18181b">${info.transport}</span></div>
      <div style="display:flex; justify-content:space-between;"><span style="color:#71717a">Latency:</span><span style="color:#18181b">${info.latencyMs.toFixed(1)} ms</span></div>
      <div style="display:flex; justify-content:space-between;"><span style="color:#71717a">Render FPS:</span><span style="font-weight:600; color:#2563eb">${info.renderFps.toFixed(0)}</span></div>
      <div style="display:flex; justify-content:space-between;"><span style="color:#71717a">State Rate:</span><span style="color:#18181b">${info.stateRateHz} Hz</span></div>
      <div style="display:flex; justify-content:space-between;"><span style="color:#71717a">Command Rate:</span><span style="color:#18181b">${info.commandRateHz} Hz</span></div>
      <div style="display:flex; justify-content:space-between;"><span style="color:#71717a">Robot Mode:</span><span style="color:#18181b">${info.robotMode}</span></div>
      <div style="display:flex; justify-content:space-between;"><span style="color:#71717a">Camera View:</span><span style="color:#18181b">${info.activeCamera}</span></div>
      <div style="display:flex; justify-content:space-between;"><span style="color:#71717a">Position:</span><span style="font-size:10px; color:#18181b">${posStr}</span></div>
      <div style="display:flex; justify-content:space-between;"><span style="color:#71717a">Orientation:</span><span style="font-size:10px; color:#18181b">${quatStr}</span></div>
    `;
  }
}
