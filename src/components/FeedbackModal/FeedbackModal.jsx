import React, { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { submitFeedback, FEEDBACK_CATEGORIES } from '../../appwrite/database';
import { useDialog } from '../Dialog/Dialog';
import {
  X, Send, Loader2, Image, Tag, MessageSquare, FileText, Paperclip,
} from 'lucide-react';
import './FeedbackModal.css';

export default function FeedbackModal({ onClose }) {
  const { state } = useApp();
  const { toast } = useDialog();
  const fileRef = useRef(null);

  const [title,       setTitle]       = useState('');
  const [content,     setContent]     = useState('');
  const [category,    setCategory]    = useState('Bug Report');
  const [screenshot,  setScreenshot]  = useState(null);
  const [preview,     setPreview]     = useState(null);
  const [submitting,  setSubmitting]  = useState(false);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast('Screenshot must be under 5 MB.', 'error'); return; }
    setScreenshot(file);
    setPreview(URL.createObjectURL(file));
  }

  function removeScreenshot() {
    setScreenshot(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast('Please fill in title and content.', 'error'); return;
    }
    setSubmitting(true);
    try {
      await submitFeedback({
        title: title.trim(),
        content: content.trim(),
        category,
        screenshotFile: screenshot,
        userId:   state.user?.$id   || '',
        userName: state.user?.name  || '',
      });
      toast('Thanks for your feedback! 🙏', 'success', 5000);
      onClose();
    } catch (e) {
      toast('Failed to submit: ' + e.message, 'error', 6000);
    } finally { setSubmitting(false); }
  }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal feedback-modal">
        <div className="modal-header">
          <div className="feedback-modal-title">
            <MessageSquare size={16} className="feedback-icon" />
            <h3>Send Feedback</h3>
          </div>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={16} /></button>
        </div>

        <form className="feedback-form" onSubmit={handleSubmit}>
          {/* Category */}
          <div className="feedback-field">
            <label className="feedback-label"><Tag size={12} /> Category</label>
            <div className="feedback-category-row">
              {FEEDBACK_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  className={`feedback-cat-btn ${category === cat ? 'active' : ''}`}
                  onClick={() => setCategory(cat)}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="feedback-field">
            <label className="feedback-label"><FileText size={12} /> Title</label>
            <input
              className="input"
              placeholder="Short summary of your feedback…"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={255}
              required
            />
          </div>

          {/* Content */}
          <div className="feedback-field">
            <label className="feedback-label"><MessageSquare size={12} /> Description</label>
            <textarea
              className="feedback-textarea"
              placeholder="Describe your feedback, issue, or suggestion in detail…"
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={5}
              maxLength={5000}
              required
            />
            <span className="feedback-char-count">{content.length}/5000</span>
          </div>

          {/* Screenshot */}
          <div className="feedback-field">
            <label className="feedback-label"><Image size={12} /> Screenshot (optional)</label>
            {!preview ? (
              <button
                type="button"
                className="feedback-upload-btn"
                onClick={() => fileRef.current?.click()}>
                <Paperclip size={13} />
                Attach screenshot or image
              </button>
            ) : (
              <div className="feedback-preview-wrap">
                <img src={preview} alt="Screenshot preview" className="feedback-preview-img" />
                <button
                  type="button"
                  className="btn btn-icon btn-ghost btn-sm feedback-remove-img"
                  onClick={removeScreenshot}
                  title="Remove">
                  <X size={11} />
                </button>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFile}
            />
          </div>

          <div className="feedback-footer">
            <span className="feedback-user">
              Submitting as <strong>{state.user?.name || 'Anonymous'}</strong>
            </span>
            <div className="feedback-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting || !title.trim() || !content.trim()}>
                {submitting
                  ? <><Loader2 size={14} className="spin" /> Sending…</>
                  : <><Send size={14} /> Send Feedback</>}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
