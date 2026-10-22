"use client";

import { useState } from "react";
import { X, Image as ImageIcon, Paintbrush, Lock } from "lucide-react";
import type { Roadmap } from "@/types";

interface SettingsModalProps {
    roadmap: Roadmap;
    isOpen: boolean;
    onClose: () => void;
    onUpdateBranding: (branding: Roadmap["branding"]) => void;
}

export default function SettingsModal({ roadmap, isOpen, onClose, onUpdateBranding }: SettingsModalProps) {
    const [titleOverride, setTitleOverride] = useState(roadmap.branding?.customTitle || "");
    const [hideWatermark, setHideWatermark] = useState(roadmap.branding?.hideWatermark || false);
    const [accentColor, setAccentColor] = useState(roadmap.branding?.accentColor || "#4cb3f0");
    const [logoUrl, setLogoUrl] = useState(roadmap.branding?.logoUrl || "");

    if (!isOpen) return null;

    const handleSave = () => {
        onUpdateBranding({
            customTitle: titleOverride,
            hideWatermark,
            accentColor,
            logoUrl
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 transition-opacity" onClick={onClose} />
            
            <div className="relative bg-surface-muted border border-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
                    <h2 className="font-display text-xl text-text">Workspace Settings</h2>
                    <button onClick={onClose} className="p-2 hover:bg-surface rounded-lg transition-colors text-text-muted hover:text-text">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-8">
                    {/* Branding Section */}
                    <div>
                        <h3 className="font-display text-xs text-accent mb-6 flex items-center gap-2">
                            <Paintbrush size={14} /> White-Label Branding
                        </h3>
                        
                        <div className="space-y-5">
                            <div>
                                <label className="block text-sm text-text-muted mb-2">Custom Workspace Title</label>
                                <input 
                                    type="text" 
                                    value={titleOverride}
                                    onChange={(e) => setTitleOverride(e.target.value)}
                                    placeholder={roadmap.title}
                                    className="w-full bg-surface border border-border rounded-lg px-4 py-2 text-sm text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2"
                                />
                                <p className="text-sm text-text-muted mt-1">Overrides the title shown in the sidebar and header.</p>
                            </div>

                            <div>
                                <label className="block text-sm text-text-muted mb-2">Workspace Logo URL</label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <ImageIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                                        <input 
                                            type="url" 
                                            value={logoUrl}
                                            onChange={(e) => setLogoUrl(e.target.value)}
                                            placeholder="https://example.com/logo.png"
                                            className="w-full bg-surface border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2"
                                        />
                                    </div>
                                </div>
                                <p className="text-sm text-text-muted mt-1">Accepts any valid image URL. File upload coming in v2.</p>
                            </div>

                            <div>
                                <label className="block text-sm text-text-muted mb-2">Brand Accent Color</label>
                                <div className="flex items-center gap-3">
                                    <input 
                                        type="color" 
                                        value={accentColor}
                                        onChange={(e) => setAccentColor(e.target.value)}
                                        className="w-10 h-10 rounded cursor-pointer border-0 bg-transparent p-0"
                                    />
                                    <span className="text-sm font-mono text-text-muted">{accentColor}</span>
                                </div>
                                <p className="text-sm text-text-muted mt-1">Replaces the workspace accent color.</p>
                            </div>

                            <div className="pt-2 border-t border-border">
                                <label className="flex items-start gap-3 cursor-pointer group">
                                    <div className="relative flex items-center justify-center mt-0.5">
                                        <input 
                                            type="checkbox" 
                                            checked={hideWatermark}
                                            onChange={(e) => setHideWatermark(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <div className={`w-5 h-5 rounded border ${hideWatermark ? 'bg-accent border-accent' : 'border-border-strong group-hover:border-text-soft'} flex items-center justify-center transition-colors`}>
                                            {hideWatermark && <X size={12} className="text-text" />}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-text font-medium flex items-center gap-2">
                                            Hide &quot;Powered by ZNS Nexus&quot; Watermark
                                            <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-warning/10 text-warning border border-warning/20 flex items-center gap-1">
                                                <Lock size={8} /> Pro Feature
                                            </span>
                                        </div>
                                        <p className="text-sm text-text-muted mt-1 leading-relaxed">
                                            Removes our branding from embedded workspaces and shared read-only links.
                                        </p>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-border flex justify-end gap-3 shrink-0 bg-surface/50">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-sm text-text-muted hover:text-text hover:bg-surface transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave}
                        className="px-6 py-2 bg-text hover:bg-[#e6e6e6] text-page rounded-full text-sm font-medium transition-colors"
                    >
                        Save Settings
                    </button>
                </div>
            </div>
        </div>
    );
}
