// ============================================================
// EditVideoModal.tsx — Updated with category + subspecialty tagging
// Adapt paths/imports to match your actual project structure
// ============================================================

"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { VIDEO_CATEGORIES, SUBSPECIALTIES, type VideoCategory, type Subspecialty } from "@/lib/constants/video-tags";

type Video = {
  id: string;
  title: string;
  vimeo_id: string;
  description: string | null;
  duration: number | null;
  status: "draft" | "published";
  members_only: boolean;
  category: VideoCategory | null;
  subspecialties: Subspecialty[];
  presenter: string | null;
  recorded_at: string | null;
};

type EditVideoModalProps = {
  video: Video | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export default function EditVideoModal({ video, open, onClose, onSaved }: EditVideoModalProps) {
  const supabase = createClient();

  const [title, setTitle] = useState("");
  const [vimeoId, setVimeoId] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState<number | "">("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [membersOnly, setMembersOnly] = useState(true);
  const [category, setCategory] = useState<VideoCategory | "">("");
  const [subspecialties, setSubspecialties] = useState<Subspecialty[]>([]);
  const [presenter, setPresenter] = useState("");
  const [recordedAt, setRecordedAt] = useState("");
  const [saving, setSaving] = useState(false);

  // Populate form when video prop changes
  useEffect(() => {
    if (video) {
      setTitle(video.title || "");
      setVimeoId(video.vimeo_id || "");
      setDescription(video.description || "");
      setDuration(video.duration ?? "");
      setStatus(video.status || "draft");
      setMembersOnly(video.members_only ?? true);
      setCategory(video.category || "");
      setSubspecialties(video.subspecialties || []);
      setPresenter(video.presenter || "");
      setRecordedAt(video.recorded_at || "");
    } else {
      // Reset for "Add new" mode
      setTitle("");
      setVimeoId("");
      setDescription("");
      setDuration("");
      setStatus("draft");
      setMembersOnly(true);
      setCategory("");
      setSubspecialties([]);
      setPresenter("");
      setRecordedAt("");
    }
  }, [video]);

  const toggleSubspecialty = (sub: Subspecialty) => {
    setSubspecialties((prev) =>
      prev.includes(sub) ? prev.filter((s) => s !== sub) : [...prev, sub]
    );
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);

    const payload = {
      title: title.trim(),
      vimeo_id: vimeoId.trim(),
      description: description.trim() || null,
      duration: duration === "" ? null : Number(duration),
      status,
      members_only: membersOnly,
      category: category || null,
      subspecialties,
      presenter: presenter.trim() || null,
      recorded_at: recordedAt || null,
    };

    let error;
    if (video?.id) {
      ({ error } = await supabase.from("videos").update(payload).eq("id", video.id));
    } else {
      ({ error } = await supabase.from("videos").insert(payload));
    }

    setSaving(false);

    if (error) {
      console.error("Save video error:", error);
      alert("Failed to save video. Check console for details.");
      return;
    }

    onSaved();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {video ? "Edit Video" : "Add Video"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              placeholder="e.g. Complete mesocolic excision"
            />
          </div>

          {/* Vimeo ID + Presenter (side by side) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vimeo ID</label>
              <input
                type="text"
                value={vimeoId}
                onChange={(e) => setVimeoId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                placeholder="e.g. 353960614"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Presenter / Speaker</label>
              <input
                type="text"
                value={presenter}
                onChange={(e) => setPresenter(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                placeholder="e.g. Mr J. Smith"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-y"
            />
          </div>

          {/* Category dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as VideoCategory)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
            >
              <option value="">Select category...</option>
              {VIDEO_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Subspecialty Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tags / Subspecialties
            </label>
            <div className="flex flex-wrap gap-2">
              {SUBSPECIALTIES.map((sub) => {
                const isSelected = subspecialties.includes(sub);
                return (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => toggleSubspecialty(sub)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 ${
                      isSelected
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                        : "bg-gray-50 text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-gray-800"
                    }`}
                  >
                    {sub}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Duration + Date Recorded + Status row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration (sec)</label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date Recorded</label>
              <input
                type="date"
                value={recordedAt}
                onChange={(e) => setRecordedAt(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "draft" | "published")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
          </div>

          {/* Members Only toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={membersOnly}
              onChange={(e) => setMembersOnly(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm font-medium text-gray-700">Members Only</span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}