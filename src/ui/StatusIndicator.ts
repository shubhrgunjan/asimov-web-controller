import { ConnectionStatus } from '../connection/AsimovConnection';

export class StatusIndicator {
  private element: HTMLElement;
  private statusText: HTMLElement;
  private statusDot: HTMLElement;

  constructor(container: HTMLElement) {
    this.element = document.createElement('div');
    this.element.id = 'status-indicator';
    this.element.style.position = 'absolute';
    this.element.style.top = '24px';
    this.element.style.left = '24px';
    this.element.style.zIndex = '100';
    this.element.style.display = 'flex';
    this.element.style.flexDirection = 'column';
    this.element.style.gap = '4px';
    this.element.style.padding = '12px 16px';
    this.element.style.backgroundColor = 'rgba(255, 255, 255, 0.92)';
    this.element.style.backdropFilter = 'blur(10px)';
    this.element.style.border = '1px solid #e4e4e7';
    this.element.style.borderRadius = '10px';
    this.element.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.04)';
    this.element.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    this.element.style.userSelect = 'none';

    // Title: ASIMOV
    const title = document.createElement('div');
    title.textContent = 'ASIMOV';
    title.style.fontSize = '12px';
    title.style.fontWeight = '700';
    title.style.letterSpacing = '1.2px';
    title.style.color = '#18181b';
    title.style.textTransform = 'uppercase';

    // Status Row
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '8px';

    this.statusDot = document.createElement('span');
    this.statusDot.style.display = 'inline-block';
    this.statusDot.style.width = '7px';
    this.statusDot.style.height = '7px';
    this.statusDot.style.borderRadius = '50%';
    this.statusDot.style.backgroundColor = '#94a3b8';
    this.statusDot.style.transition = 'background-color 0.2s ease';

    this.statusText = document.createElement('span');
    this.statusText.textContent = 'Waiting for session';
    this.statusText.style.fontSize = '12px';
    this.statusText.style.color = '#71717a';
    this.statusText.style.fontWeight = '500';

    row.appendChild(this.statusDot);
    row.appendChild(this.statusText);

    this.element.appendChild(title);
    this.element.appendChild(row);

    // Subtle Controls Hint
    const hint = document.createElement('div');
    hint.textContent = 'WASD Move · 1/2/3 Camera · Space Stop · R Reset';
    hint.style.fontSize = '10px';
    hint.style.color = '#a1a1aa';
    hint.style.marginTop = '4px';
    hint.style.letterSpacing = '0.3px';
    this.element.appendChild(hint);

    container.appendChild(this.element);
  }

  public updateStatus(status: ConnectionStatus): void {
    switch (status) {
      case 'CONNECTED':
        this.statusDot.style.backgroundColor = '#10b981'; // subtle green
        this.statusText.textContent = 'Connected';
        this.statusText.style.color = '#18181b';
        break;
      case 'CONNECTING':
        this.statusDot.style.backgroundColor = '#f59e0b'; // amber
        this.statusText.textContent = 'Connecting...';
        this.statusText.style.color = '#71717a';
        break;
      case 'CONNECTION_LOST':
        this.statusDot.style.backgroundColor = '#ef4444'; // red
        this.statusText.textContent = 'Connection lost';
        this.statusText.style.color = '#ef4444';
        break;
      case 'WAITING_FOR_SESSION':
      default:
        this.statusDot.style.backgroundColor = '#a1a1aa'; // gray
        this.statusText.textContent = 'Waiting for session';
        this.statusText.style.color = '#71717a';
        break;
    }
  }
}
