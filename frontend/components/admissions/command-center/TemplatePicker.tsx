"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, CheckCircle2 } from "lucide-react";
import type { ApiInquiry } from "@/types/admissions";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (template: string) => void;
  inquiry: ApiInquiry | null;
}

type TemplateGroup = {
  category: string;
  templates: { label: string; body: (inq: ApiInquiry) => string }[];
};

const TEMPLATE_GROUPS: TemplateGroup[] = [
  {
    category: "Welcome",
    templates: [
      {
        label: "Warm Welcome",
        body: (inq) => {
          const first = inq.full_name.split(" ")[0] || "there";
          const grade = inq.class_name_resolved ? `Grade ${inq.class_name_resolved}` : "your chosen grade";
          return `Hello ${first}! 👋\n\nThank you for your interest in admission for ${grade}.\n\nWe'd love to show you around our campus. Would you be available for a visit this week?\n\nPlease reply with a convenient time!\n\nWarm regards,\nAdmissions Team`;
        },
      },
    ],
  },
  {
    category: "Follow-up",
    templates: [
      {
        label: "Gentle Reminder",
        body: (inq) => {
          const first = inq.full_name.split(" ")[0] || "there";
          const grade = inq.class_name_resolved ? `Grade ${inq.class_name_resolved}` : "the grade";
          return `Hi ${first}! 😊\n\nJust following up on your admission inquiry for ${grade}.\n\nWe still have seats available for the upcoming academic year — but they're filling up fast!\n\n🗓️ Book your campus visit today. Reply with a convenient time.\n\nBest wishes,\nAdmissions Team`;
        },
      },
      {
        label: "Second Follow-up",
        body: (inq) => {
          const first = inq.full_name.split(" ")[0] || "there";
          return `Hi ${first},\n\nHope you're doing well! We wanted to follow up once more about your child's admission.\n\nWe'd love to answer any questions you might have about our programs, fees, or facilities.\n\nFeel free to call us anytime — we're here to help! 📞\n\nAdmissions Team`;
        },
      },
    ],
  },
  {
    category: "Visit",
    templates: [
      {
        label: "Visit Invitation",
        body: (inq) => {
          const first = inq.full_name.split(" ")[0] || "there";
          return `Dear ${first},\n\n🏫 We'd like to invite you for a personal campus tour!\n\nDuring the visit you'll get to:\n✅ Meet our faculty\n✅ See our facilities & classrooms\n✅ Speak with the Admissions Head\n\nPlease reply with your preferred date and we'll arrange everything.\n\nAdmissions Team`;
        },
      },
      {
        label: "Visit Confirmation",
        body: (inq) => {
          const first = inq.full_name.split(" ")[0] || "there";
          return `Dear ${first},\n\n✅ Your campus visit is confirmed!\n\nPlease arrive 10 minutes early and ask for the Admissions Desk.\n\nLooking forward to meeting you!\n\nAdmissions Team`;
        },
      },
    ],
  },
  {
    category: "Offer",
    templates: [
      {
        label: "Seat Offer",
        body: (inq) => {
          const first = inq.full_name.split(" ")[0] || "there";
          const grade = inq.class_name_resolved ? `Grade ${inq.class_name_resolved}` : "your chosen grade";
          return `Dear ${first},\n\n🎉 We are pleased to offer your child a seat in ${grade}!\n\nPlease visit us at your earliest convenience to complete the enrollment formalities.\n\nAdmissions Team`;
        },
      },
      {
        label: "Seat Urgency",
        body: (inq) => {
          const first = inq.full_name.split(" ")[0] || "there";
          return `Hi ${first}! ⚠️\n\nWe have very limited seats remaining for the upcoming academic year.\n\nPlease confirm your interest soon to avoid missing out!\n\nAdmissions Team`;
        },
      },
    ],
  },
  {
    category: "Waitlist",
    templates: [
      {
        label: "Waitlist Notification",
        body: (inq) => {
          const first = inq.full_name.split(" ")[0] || "there";
          return `Dear ${first},\n\nThank you for your interest. Your child has been added to our waitlist.\n\nWe will contact you as soon as a seat becomes available.\n\nAdmissions Team`;
        },
      },
    ],
  },
  {
    category: "Rejection",
    templates: [
      {
        label: "Polite Decline",
        body: (inq) => {
          const first = inq.full_name.split(" ")[0] || "there";
          return `Dear ${first},\n\nThank you for considering our school for your child's education.\n\nUnfortunately, we are unable to offer admission at this time due to limited availability.\n\nWe wish your family the very best.\n\nAdmissions Team`;
        },
      },
    ],
  },
];

export function TemplatePicker({ isOpen, onClose, onSelect, inquiry }: Props) {
  const [activeCategory, setActiveCategory] = useState<string>(TEMPLATE_GROUPS[0].category);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const activeGroup = TEMPLATE_GROUPS.find((g) => g.category === activeCategory);
  const previewBody =
    selectedTemplate && inquiry
      ? selectedTemplate
      : inquiry && activeGroup?.templates[0]
      ? activeGroup.templates[0].body(inquiry)
      : "";

  const handleCopy = async () => {
    if (!previewBody) return;
    try {
      await navigator.clipboard.writeText(previewBody);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">Message Templates</h3>
              <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500">
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Category sidebar */}
              <div className="w-36 border-r border-gray-100 flex flex-col py-2 flex-shrink-0">
                {TEMPLATE_GROUPS.map((g) => (
                  <button
                    key={g.category}
                    onClick={() => { setActiveCategory(g.category); setSelectedTemplate(null); }}
                    className={`text-left px-4 py-2.5 text-sm font-medium transition-colors ${
                      activeCategory === g.category
                        ? "bg-indigo-50 text-indigo-700 border-r-2 border-indigo-600"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {g.category}
                  </button>
                ))}
              </div>

              {/* Templates + preview */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{activeCategory} Templates</p>
                {activeGroup?.templates.map((t) => {
                  const body = inquiry ? t.body(inquiry) : "";
                  const isActive = selectedTemplate === body;
                  return (
                    <button
                      key={t.label}
                      onClick={() => setSelectedTemplate(body)}
                      className={`w-full text-left p-3 rounded-xl border text-sm transition-all ${
                        isActive
                          ? "border-indigo-500 bg-indigo-50"
                          : "border-gray-200 bg-gray-50 hover:border-indigo-300"
                      }`}
                    >
                      <span className={`font-semibold block mb-1 ${isActive ? "text-indigo-700" : "text-gray-800"}`}>
                        {t.label}
                      </span>
                      <span className="text-gray-500 text-xs line-clamp-2">{body.slice(0, 100)}…</span>
                    </button>
                  );
                })}

                {/* Preview */}
                {previewBody && (
                  <div className="mt-3 p-3 bg-green-50 border border-green-100 rounded-xl">
                    <p className="text-xs font-semibold text-green-800 mb-1.5">Preview:</p>
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{previewBody}</pre>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center gap-3 px-5 py-4 border-t border-gray-100">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 border border-gray-200 text-gray-700 rounded-lg px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
              >
                {copied ? <CheckCircle2 size={14} className="text-green-500" /> : <Copy size={14} />}
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                onClick={() => { if (previewBody) { onSelect(previewBody); onClose(); } }}
                disabled={!previewBody}
                className="ml-auto bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                Use Template →
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
