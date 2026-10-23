import { describe, expect, it } from 'vitest';

/**
 * WCAG 2.2 contrast checks for text drawn over gradients, which automated
 * scanners report as "incomplete". Each pair uses the gradient stop that sits
 * behind the text (the worst case where several stops do). Keep in sync with
 * the cited CSS rules.
 */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const NORMAL = 4.5;
const LARGE = 3;

// [label, foreground, background behind the text, required ratio, CSS source]
const PAIRS: [string, string, string, number, string][] = [
  ['active title text', '#ffffff', '#0055e7', NORMAL, 'window.css .xp-window__titlebar (45–70% band)'],
  ['active title text (lower band)', '#ffffff', '#0066fe', NORMAL, 'window.css .xp-window__titlebar (90% stop)'],
  ['inactive title text', '#10307e', '#8aa5e6', NORMAL, 'tokens.css --c-title-text-inactive on inactive bar darkest stop'],
  ['inactive title text (light stop)', '#10307e', '#a6c0f3', NORMAL, 'inactive bar lightest stop'],
  ['taskbar button text', '#ffffff', '#2b67dc', NORMAL, 'shell.css .xp-task main band'],
  ['taskbar button text (hover)', '#ffffff', '#2d6be2', NORMAL, 'shell.css .xp-task:hover main band'],
  ['taskbar button text (pressed)', '#ffffff', '#1d50b3', NORMAL, 'shell.css .xp-task.is-active'],
  ['clock text', '#ffffff', '#0b72c8', NORMAL, 'shell.css .xp-tray main band'],
  ['start label (large bold 19px)', '#ffffff', '#36a236', LARGE, 'shell.css .xp-start upper text band'],
  ['start menu user name', '#ffffff', '#1b6cd3', NORMAL, 'shell.css .start-menu__header'],
  ['start menu footer text', '#ffffff', '#2f6dcb', NORMAL, 'shell.css .start-menu__footer'],
  ['start menu places text', '#0a246a', '#d3e5fa', NORMAL, 'shell.css .start-menu__right'],
  ['start menu subtitle', '#666666', '#ffffff', NORMAL, 'shell.css .start-item__sub'],
  ['menu highlight', '#ffffff', '#316ac5', NORMAL, 'menu.css .xp-menu__item.is-active'],
  ['task pane link', '#215dc6', '#d6dff7', NORMAL, 'tokens.css --c-link on .task-group__body'],
  ['task pane link (hover)', '#0b3a9c', '#d6dff7', NORMAL, 'tokens.css --c-link-hover'],
  ['task group title', '#215dc6', '#ffffff', NORMAL, 'explorer.css .task-group__header (left, where text sits)'],
  ['task group title (hover)', '#0b3a9c', '#ffffff', NORMAL, 'explorer.css .task-group__header button:hover'],
  ['special task group title', '#ffffff', '#0c4ad3', NORMAL, 'explorer.css .task-group--special header'],
  ['muted item metadata', '#6d6d6d', '#ffffff', NORMAL, 'explorer.css .item__meta'],
  ['help search label', '#ffffff', '#3a6fd0', NORMAL, 'apps.css .help__search (top stop)'],
  ['help brand subtitle', '#d6e2f8', '#1e5bc6', NORMAL, 'apps.css .help__brand small'],
  ['welcome heading (large 24px)', '#ffffff', '#5a7edc', LARGE, 'shell.css .welcome__middle'],
  ['welcome user name (large 24px)', '#ffffff', '#5a7edc', LARGE, 'shell.css .welcome__user'],
  ['turn-off button labels', '#ffffff', '#4466c8', NORMAL, 'dialogs.css .session-dialog__body (lighter stop)'],
  ['stand-by hint', '#8a8a8a', '#000000', NORMAL, 'shell.css .standby__hint'],
  ['calculator operator keys', '#d00000', '#ecebe6', NORMAL, 'apps.css .calc__key--op on key face'],
  ['calculator digit keys', '#0000e0', '#ecebe6', NORMAL, 'apps.css .calc__key--digit'],
  ['tree dimmed (read-only) folders', '#6d6a5e', '#ffffff', NORMAL, 'explorer.css .xp-tree__row.is-dim'],
];

describe('text contrast over gradients (WCAG 1.4.3)', () => {
  it.each(PAIRS)('%s', (_label, fg, bg, required) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(required);
  });
});
