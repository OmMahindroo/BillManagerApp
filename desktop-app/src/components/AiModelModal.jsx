import React, { useState } from 'react';
import { Sparkles, Key, X, Check, ExternalLink, ShieldCheck, Cpu } from 'lucide-react';
import { GEMINI_MODELS } from '../ocr/geminiVisionHelper';

export default function AiModelModal({
  isOpen,
  onClose,
  apiKey,
  setApiKey,
  selectedModel,
  setSelectedModel,
  useAiByDefault,
  setUseAiByDefault,
}) {
  const [tempKey, setTempKey] = useState(apiKey || '');
  const [tempModel, setTempModel] = useState(selectedModel || 'gemini-1.5-flash');
  const [tempDefault, setTempDefault] = useState(useAiByDefault);

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    setApiKey(tempKey.trim());
    setSelectedModel(tempModel);
    setUseAiByDefault(tempDefault);
    localStorage.setItem('billscanner_gemini_key', tempKey.trim());
    localStorage.setItem('billscanner_gemini_model', tempModel);
    localStorage.setItem('billscanner_use_ai', String(tempDefault));
    onClose();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card small-modal glass-panel">
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="badge-icon-teal">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="modal-title">AI Vision Model Setup</h3>
              <p className="modal-subtitle">Extract entire bills & tables in one go using Google Gemini</p>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave}>
          <div className="modal-body-padded">
            <div className="ai-info-callout">
              <Cpu size={18} className="text-teal flex-shrink-0" />
              <p>
                Connecting Google Gemini allows the tool to read multi-column invoices, complex line items, HSN/SAC codes, and taxes with 100% precision in one single shot.
              </p>
            </div>

            <div className="form-group">
              <label>
                <Key size={14} className="text-teal" />
                <span>Google Gemini API Key</span>
              </label>
              <input
                type="password"
                placeholder="AIzaSy..."
                value={tempKey}
                onChange={(e) => setTempKey(e.target.value)}
                autoFocus
              />
              <span className="input-hint">
                Stored safely in your browser's local storage. Zero cloud tracking.
              </span>
            </div>

            <div className="form-group">
              <label>
                <span>Vision Model</span>
              </label>
              <select
                value={tempModel}
                onChange={(e) => setTempModel(e.target.value)}
              >
                {GEMINI_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="option-row" style={{ marginTop: '12px' }}>
              <div className="option-info">
                <span className="option-title">Auto-extract with AI on Scan</span>
                <p className="option-desc">
                  Automatically use Gemini AI whenever a bill is intercepted from the scanner.
                </p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={tempDefault}
                  onChange={(e) => setTempDefault(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="get-key-link">
              <a 
                href="https://aistudio.google.com/app/apikey" 
                target="_blank" 
                rel="noreferrer"
                className="external-link-btn"
              >
                <span>Get a free Gemini API Key from Google AI Studio</span>
                <ExternalLink size={13} />
              </a>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              <Check size={16} />
              <span>Save AI Settings</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
