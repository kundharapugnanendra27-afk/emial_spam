import React from 'react';
import { Palette, RotateCcw, X } from 'lucide-react';
import { DEFAULT_THEME, THEME_PRESETS, ThemeSettings } from '../theme';

interface ThemeEditorModalProps {
  open: boolean;
  theme: ThemeSettings;
  onChange: (next: ThemeSettings) => void;
  onClose: () => void;
}

export const ThemeEditorModal: React.FC<ThemeEditorModalProps> = ({
  open,
  theme,
  onChange,
  onClose,
}) => {
  if (!open) return null;

  const presetCards: {
    id: keyof typeof THEME_PRESETS;
    name: string;
    description: string;
  }[] = [
    {
      id: 'warm_beige',
      name: 'Warm Beige',
      description: 'Soft sand backdrop with ivory cards and warm brown accents',
    },
    {
      id: 'soft_cream',
      name: 'Soft Cream',
      description: 'Lighter cream paper canvas with clean blue controls',
    },
    {
      id: 'classic_slate',
      name: 'Classic Light',
      description: 'Neutral cool gray workspace with crisp white surfaces',
    },
  ];

  const updateCustomField = (field: keyof ThemeSettings, value: string) => {
    onChange({
      ...theme,
      presetId: 'custom',
      [field]: value,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35"
      role="dialog"
      aria-modal="true"
      aria-labelledby="theme-editor-title"
    >
      <div className="w-full max-w-md pl-surface border pl-border rounded-lg shadow-lg overflow-hidden">
        <div className="px-5 py-4 border-b pl-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 pl-accent-text shrink-0" aria-hidden="true" />
            <h2 id="theme-editor-title" className="text-sm font-semibold pl-text">
              Customize Theme
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close theme editor"
            className="p-1 rounded pl-muted hover:pl-text cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Preset Picker */}
          <div>
            <div className="text-xs font-medium pl-text mb-2">Choose a Theme Style</div>
            <div className="space-y-2">
              {presetCards.map((p) => {
                const preset = THEME_PRESETS[p.id];
                const active = theme.presetId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onChange(preset)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-md border transition-colors flex items-center justify-between gap-3 cursor-pointer ${
                      active
                        ? 'pl-subtle border-current pl-text'
                        : 'pl-surface pl-border hover:pl-subtle'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-semibold pl-text">{p.name}</div>
                      <div className="text-[11px] pl-muted mt-0.5">{p.description}</div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0" aria-hidden="true">
                      <span
                        className="w-4 h-4 rounded border border-black/15"
                        style={{ backgroundColor: preset.canvasBg }}
                      />
                      <span
                        className="w-4 h-4 rounded border border-black/15"
                        style={{ backgroundColor: preset.surfaceBg }}
                      />
                      <span
                        className="w-4 h-4 rounded border border-black/15"
                        style={{ backgroundColor: preset.accentColor }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Color Fine-Tuning */}
          <div className="pt-4 border-t pl-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium pl-text">Fine-Tune Colors</span>
              <button
                type="button"
                onClick={() => onChange(DEFAULT_THEME)}
                className="inline-flex items-center gap-1 text-xs pl-muted hover:pl-text cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" aria-hidden="true" />
                <span>Reset to Warm Beige</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <label className="flex items-center justify-between gap-2 px-3 py-2 border pl-border rounded-md pl-surface cursor-pointer">
                <span className="pl-text">Page Background</span>
                <input
                  type="color"
                  aria-label="Page Background Color"
                  value={theme.canvasBg}
                  onChange={(e) => updateCustomField('canvasBg', e.target.value)}
                  className="w-6 h-6 rounded border-0 bg-transparent cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between gap-2 px-3 py-2 border pl-border rounded-md pl-surface cursor-pointer">
                <span className="pl-text">Card Surface</span>
                <input
                  type="color"
                  aria-label="Card Surface Color"
                  value={theme.surfaceBg}
                  onChange={(e) => updateCustomField('surfaceBg', e.target.value)}
                  className="w-6 h-6 rounded border-0 bg-transparent cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between gap-2 px-3 py-2 border pl-border rounded-md pl-surface cursor-pointer">
                <span className="pl-text">Borders</span>
                <input
                  type="color"
                  aria-label="Border Color"
                  value={theme.borderColor}
                  onChange={(e) => updateCustomField('borderColor', e.target.value)}
                  className="w-6 h-6 rounded border-0 bg-transparent cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between gap-2 px-3 py-2 border pl-border rounded-md pl-surface cursor-pointer">
                <span className="pl-text">Accent Button</span>
                <input
                  type="color"
                  aria-label="Accent Button Color"
                  value={theme.accentColor}
                  onChange={(e) => updateCustomField('accentColor', e.target.value)}
                  className="w-6 h-6 rounded border-0 bg-transparent cursor-pointer"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t pl-border pl-subtle flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium rounded-md pl-accent-bg cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
