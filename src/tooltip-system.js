/**
 * Custom Tooltip System
 * Supports 3 types of tooltips: default, info, warning
 * Trigger types: hover (default), click
 * 
 * Usage:
 * <span data-tooltip="Your tooltip text" data-tooltip-type="default" data-tooltip-trigger="hover">Hover me</span>
 * <span data-tooltip="Info tooltip" data-tooltip-type="info" data-tooltip-trigger="click">Click me</span>
 * <span data-tooltip="Warning message" data-tooltip-type="warning">Warning</span>
 */

class TooltipSystem {
  constructor() {
    this.tooltips = new Map();
    this.activeTooltip = null;
    this.init();
  }

  init() {
    // Setup immediately or wait for DOM
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }

    // Close tooltip on click outside
    document.addEventListener('click', (e) => {
      // Don't close if clicking on a tooltip element itself or the trigger
      if (e.target.closest('[data-tooltip]') || e.target.closest('.tooltip')) {
        return;
      }
      if (this.activeTooltip) {
        this.hide();
      }
    }, true); // Use capture phase to catch clicks early

    // Close tooltip on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.activeTooltip) {
        this.hide();
      }
    });
  }

  setup() {
    const elements = document.querySelectorAll('[data-tooltip]');
    elements.forEach((el) => {
      this.attachTooltip(el);
    });
  }

  attachTooltip(element) {
    const text = element.getAttribute('data-tooltip');
    const type = element.getAttribute('data-tooltip-type') || 'default';
    const trigger = element.getAttribute('data-tooltip-trigger') || 'hover';

    if (!text) return;

    // Store tooltip data
    this.tooltips.set(element, { text, type, trigger });

    if (trigger === 'hover') {
      element.addEventListener('mouseenter', () => this.show(element));
      element.addEventListener('mouseleave', () => this.hide());
    } else if (trigger === 'click') {
      element.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (this.activeTooltip === element) {
          this.hide();
        } else {
          this.show(element);
        }
        return false;
      });
    }
  }

  show(element) {
    // Hide previous tooltip
    if (this.activeTooltip && this.activeTooltip !== element) {
      this.hide();
    }

    this.activeTooltip = element;
    const data = this.tooltips.get(element);
    if (!data) return;

    // Create or reuse tooltip element
    let tooltip = element.nextElementSibling;
    if (!tooltip || !tooltip.classList.contains('tooltip')) {
      tooltip = document.createElement('div');
      tooltip.className = `tooltip tooltip-${data.type}`;
      element.insertAdjacentElement('afterend', tooltip);
    }

    tooltip.textContent = data.text;
    tooltip.classList.add('tooltip-visible');

    // Position tooltip
    this.positionTooltip(tooltip, element);
  }

  hide() {
    if (!this.activeTooltip) return;

    const tooltip = this.activeTooltip.nextElementSibling;
    if (tooltip && tooltip.classList.contains('tooltip')) {
      tooltip.classList.remove('tooltip-visible');
    }

    this.activeTooltip = null;
  }

  positionTooltip(tooltip, element) {
    // Use requestAnimationFrame to ensure the tooltip is rendered before positioning
    requestAnimationFrame(() => {
      const rect = element.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      
      // Default: position above the element
      let top = rect.top - tooltipRect.height - 10;
      let left = rect.left + (rect.width - tooltipRect.width) / 2;

      // Check if tooltip goes off-screen top
      if (top < 10) {
        // Position below instead
        top = rect.bottom + 10;
      }

      // Check if tooltip goes off-screen left
      if (left < 10) {
        left = 10;
      }

      // Check if tooltip goes off-screen right
      const maxRight = window.innerWidth - 10;
      if (left + tooltipRect.width > maxRight) {
        left = maxRight - tooltipRect.width;
      }

      tooltip.style.position = 'fixed';
      tooltip.style.top = top + 'px';
      tooltip.style.left = left + 'px';
      tooltip.style.zIndex = '9999';
    });
  }

  // Public method to add tooltips dynamically
  static add(element, text, type = 'default', trigger = 'hover') {
    if (!element) return;
    element.setAttribute('data-tooltip', text);
    element.setAttribute('data-tooltip-type', type);
    element.setAttribute('data-tooltip-trigger', trigger);
    
    if (window.tooltipSystem) {
      window.tooltipSystem.attachTooltip(element);
    }
  }

  // Public method to remove tooltips
  static remove(element) {
    if (!element) return;
    element.removeAttribute('data-tooltip');
    element.removeAttribute('data-tooltip-type');
    element.removeAttribute('data-tooltip-trigger');
    
    if (window.tooltipSystem) {
      window.tooltipSystem.tooltips.delete(element);
    }
  }
}

// Initialize the tooltip system globally
window.tooltipSystem = new TooltipSystem();
