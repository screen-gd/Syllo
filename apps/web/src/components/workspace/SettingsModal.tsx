"use client";

import { useState } from "react";
import { Badge } from "@/components/glaze/ui/badge";
import { Button } from "@/components/glaze/ui/button";
import {
    Dialog,
    DialogBody,
    DialogClose,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/glaze/ui/dialog";
import { Field, FieldLabel } from "@/components/glaze/ui/field";
import { Input } from "@/components/glaze/ui/input";
import { Switch } from "@/components/glaze/ui/switch";
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
    const [logoUrl, setLogoUrl] = useState(roadmap.branding?.logoUrl || "");

    const handleSave = () => {
        onUpdateBranding({
            customTitle: titleOverride,
            hideWatermark,
            accentColor: roadmap.branding?.accentColor,
            logoUrl
        });
        onClose();
    };

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Workspace settings</DialogTitle>
                </DialogHeader>
                <DialogBody>
                    <div className="flex flex-col gap-4">
                        <Field>
                            <FieldLabel>Custom workspace title</FieldLabel>
                            <Input
                                value={titleOverride}
                                onValueChange={setTitleOverride}
                                placeholder={roadmap.title}
                            />
                            <p className="type-caption text-text-2">
                                Overrides the title shown in the sidebar and
                                header.
                            </p>
                        </Field>

                        <Field>
                            <FieldLabel>Workspace logo URL</FieldLabel>
                            <Input
                                type="url"
                                value={logoUrl}
                                onValueChange={setLogoUrl}
                                placeholder="https://example.com/logo.png"
                            />
                            <p className="type-caption text-text-2">
                                Accepts any valid image URL. File upload coming
                                in v2.
                            </p>
                        </Field>

                        <div className="flex items-start justify-between gap-4 border-t border-line-faint pt-4">
                            <div>
                                <p className="type-body-sm text-text-1">
                                    Hide &quot;Powered by ZNS Nexus&quot;
                                    watermark{" "}
                                    <Badge>Pro feature</Badge>
                                </p>
                                <p className="mt-1 type-caption text-text-2">
                                    Removes our branding from embedded
                                    workspaces and shared read-only links.
                                </p>
                            </div>
                            <Switch
                                aria-label="Hide watermark"
                                checked={hideWatermark}
                                onCheckedChange={setHideWatermark}
                            />
                        </div>
                    </div>
                </DialogBody>
                <DialogFooter>
                    <DialogClose>Cancel</DialogClose>
                    <Button onClick={handleSave}>Save settings</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
