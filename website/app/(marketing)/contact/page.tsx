"use client";

import { useState } from "react";
import { ArrowUpRight, CheckCircle2, LifeBuoy, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function ContactPage() {
    const [formState, setFormState] = useState<"idle" | "submitting" | "success" | "error">("idle");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim() || !email.trim() || !message.trim()) {
            return;
        }

        setFormState("submitting");

        try {
            const response = await fetch("https://formspree.io/f/xpwzgvqr", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, message }),
            });

            if (response.ok) {
                setFormState("success");
                setName("");
                setEmail("");
                setMessage("");
            } else {
                setFormState("error");
            }
        } catch {
            setFormState("error");
        }
    };

    const isValid = Boolean(name.trim() && email.trim() && message.trim());

    return (
        <section className="relative overflow-hidden pb-14 pt-14 md:pb-20 md:pt-20">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.14),transparent_68%)]" />

            <div className="mx-auto max-w-6xl px-6 lg:px-12">
                <div className="mx-auto max-w-2xl text-center">
                    <p className="eyebrow text-text-soft">Support and partnerships</p>
                    <h1 className="mt-4 text-4xl font-display text-text-primary md:text-6xl">Get in Touch</h1>
                    <p className="mt-5 text-base leading-8 text-text-secondary">
                        Send product questions, billing issues, or partnership requests through the studio team.
                    </p>
                </div>

                <div className="mt-14 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
                    <div className="rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.14),transparent_42%),linear-gradient(180deg,rgba(26,29,39,0.98),rgba(15,17,23,0.98))] p-7 shadow-[0_24px_60px_rgba(28,39,122,0.18)]">
                        {formState === "success" ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
                                    <CheckCircle2 size={32} className="text-emerald-400" />
                                </div>
                                <h2 className="text-2xl font-display text-white">Message sent</h2>
                                <p className="mt-3 max-w-sm text-sm leading-7 text-text-secondary">
                                    Thanks for reaching out. The team typically responds within 24 hours.
                                </p>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    className="mt-8"
                                    onClick={() => setFormState("idle")}
                                >
                                    Send another message
                                </Button>
                            </div>
                        ) : (
                            <>
                                <div className="mb-8">
                                    <p className="text-sm uppercase tracking-[0.28em] text-white/55">Contact form</p>
                                    <h2 className="mt-3 text-2xl font-display text-white md:text-3xl">Tell us what you need.</h2>
                                    <p className="mt-3 text-sm leading-7 text-white/70">
                                        Leave the essentials and the right person will follow up with context, next steps, or access help.
                                    </p>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-5">
                                    <div className="grid gap-5 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <label htmlFor="contact-name" className="text-sm font-medium text-white/80">
                                                Name
                                            </label>
                                            <Input
                                                id="contact-name"
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                placeholder="Your name"
                                                required
                                                className="border-white/12 bg-white/5 text-white placeholder:text-white/40 focus-visible:ring-indigo-400 focus-visible:ring-offset-0"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label htmlFor="contact-email" className="text-sm font-medium text-white/80">
                                                Email
                                            </label>
                                            <Input
                                                id="contact-email"
                                                type="email"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                placeholder="you@company.com"
                                                required
                                                className="border-white/12 bg-white/5 text-white placeholder:text-white/40 focus-visible:ring-indigo-400 focus-visible:ring-offset-0"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label htmlFor="contact-message" className="text-sm font-medium text-white/80">
                                            Message
                                        </label>
                                        <Textarea
                                            id="contact-message"
                                            value={message}
                                            onChange={(e) => setMessage(e.target.value)}
                                            placeholder="Share the support issue, workflow need, or partnership idea."
                                            required
                                            className="min-h-[220px] border-white/12 bg-white/5 text-white placeholder:text-white/40 focus-visible:ring-indigo-400 focus-visible:ring-offset-0"
                                        />
                                    </div>

                                    {formState === "error" && (
                                        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
                                            Something went wrong. Please try again or email us directly.
                                        </div>
                                    )}

                                    <Button
                                        type="submit"
                                        size="lg"
                                        className="w-full sm:w-auto"
                                        disabled={!isValid || formState === "submitting"}
                                    >
                                        {formState === "submitting" ? (
                                            <>
                                                <Loader2 size={16} className="animate-spin" />
                                                Sending...
                                            </>
                                        ) : (
                                            "Send message"
                                        )}
                                    </Button>
                                </form>
                            </>
                        )}
                    </div>

                    <aside className="space-y-6">
                        <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(26,29,39,0.98),rgba(15,17,23,0.98))] p-7 shadow-[0_20px_56px_rgba(15,17,23,0.12)]">
                            <p className="text-sm uppercase tracking-[0.28em] text-white/55">Direct channels</p>
                            <h2 className="mt-3 text-2xl font-display text-white">Reach the right team fast.</h2>
                            <div className="mt-8 space-y-4">
                                <a
                                    href="mailto:support@znsnexus.com"
                                    className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition-colors hover:bg-white/[0.08]"
                                >
                                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-indigo-500/15 text-indigo-200">
                                        <Mail size={18} />
                                    </span>
                                    <span>
                                        <span className="block text-sm font-medium text-white">Support email</span>
                                        <span className="mt-1 block text-sm text-white/70">support@znsnexus.com</span>
                                    </span>
                                </a>

                                <a
                                    href="https://znsnexus.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition-colors hover:bg-white/[0.08]"
                                >
                                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-indigo-500/15 text-indigo-200">
                                        <ArrowUpRight size={18} />
                                    </span>
                                    <span>
                                        <span className="block text-sm font-medium text-white">Partnership link</span>
                                        <span className="mt-1 block text-sm text-white/70">Visit znsnexus.com</span>
                                    </span>
                                </a>
                            </div>
                        </div>

                        <div className="rounded-[26px] border border-indigo-500/20 bg-[linear-gradient(135deg,rgba(99,102,241,0.12),rgba(34,211,238,0.06))] p-6">
                            <div className="flex items-start gap-4">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-300">
                                    <LifeBuoy size={18} />
                                </span>
                                <div>
                                    <p className="text-sm font-semibold text-text-primary">Fastest route for billing questions</p>
                                    <p className="mt-2 text-sm leading-7 text-text-secondary">
                                        Include the account email and a short note on the issue so the team can respond with the right context.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>

                <div className="mt-14 h-px w-full bg-gradient-to-r from-transparent via-indigo-400/65 to-transparent" />
            </div>
        </section>
    );
}
