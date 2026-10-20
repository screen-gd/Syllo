"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const STEPS = [
    { text: "Reading your content...", icon: "\u{1F4D6}" },
    { text: "Identifying sections and topics...", icon: "\u{1F50D}" },
    { text: "Detecting videos and resources...", icon: "\u{1F3A5}" },
    { text: "Building your workspace...", icon: "\u{1F3D7}\u{FE0F}" },
    { text: "Applying the finishing touches...", icon: "\u2728" },
];

export default function LoadingExperience() {
    const [activeStep, setActiveStep] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveStep((previous) => (previous < STEPS.length - 1 ? previous + 1 : previous));
        }, 2400);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian">
            <motion.div
                className="absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.25 }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                style={{
                    background: "radial-gradient(circle at 50% 40%, rgba(99,102,241,0.2) 0%, transparent 60%)",
                }}
            />

            <div className="relative z-10 mx-auto max-w-md px-6 text-center">
                <motion.div
                    className="glass mb-8 inline-block rounded-2xl p-5"
                    initial={{ scale: 0.7, opacity: 0, y: 12 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 240, damping: 20 }}
                >
                    <motion.span
                        className="text-5xl"
                        animate={{ y: [0, -5, 0] }}
                        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    >
                        {"\u{1F5FA}\u{FE0F}"}
                    </motion.span>
                </motion.div>

                <motion.h2
                    className="mb-2 font-display text-2xl font-bold text-text-primary"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.12, duration: 0.45, ease: "easeOut" }}
                >
                    Generating Your Workspace
                </motion.h2>

                <motion.p
                    className="mb-10 text-sm text-text-secondary"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.45, ease: "easeOut" }}
                >
                    The AI is analyzing your content and building something great...
                </motion.p>

                <div className="space-y-3 text-left">
                    {STEPS.map((step, index) => {
                        const isComplete = index < activeStep;
                        const isActive = index === activeStep;

                        return (
                            <motion.div
                                key={step.text}
                                initial={{ opacity: 0, x: -16 }}
                                animate={{ opacity: isActive || isComplete ? 1 : 0.24, x: 0 }}
                                transition={{ delay: 0.15 + index * 0.08, duration: 0.4, ease: "easeOut" }}
                                className={`flex items-center gap-3 rounded-lg p-3 transition-colors duration-300 ${
                                    isActive ? "glass border-glow" : ""
                                }`}
                            >
                                <motion.span
                                    className="shrink-0 text-lg"
                                    animate={isActive ? { y: [0, -2, 0] } : { y: 0 }}
                                    transition={isActive ? { duration: 2.2, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
                                >
                                    {step.icon}
                                </motion.span>

                                <span className={`text-sm ${isActive ? "font-medium text-text-primary" : "text-text-secondary"}`}>
                                    {step.text}
                                </span>

                                <div className="ml-auto flex h-4 w-4 items-center justify-center">
                                    <AnimatePresence initial={false} mode="wait">
                                        {isComplete ? (
                                            <motion.span
                                                key="complete"
                                                className="text-[12px] text-success"
                                                initial={{ opacity: 0, scale: 0.4 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.7 }}
                                                transition={{ type: "spring", stiffness: 320, damping: 18 }}
                                            >
                                                {"\u2713"}
                                            </motion.span>
                                        ) : isActive ? (
                                            <motion.div
                                                key="active"
                                                className="h-4 w-4 rounded-full border-2 border-indigo-accent border-t-transparent"
                                                initial={{ opacity: 0, scale: 0.85 }}
                                                animate={{ opacity: 1, scale: 1, rotate: 360 }}
                                                exit={{ opacity: 0, scale: 0.85 }}
                                                transition={{
                                                    opacity: { duration: 0.2 },
                                                    scale: { type: "spring", stiffness: 260, damping: 18 },
                                                    rotate: { duration: 1, repeat: Infinity, ease: "linear" },
                                                }}
                                            />
                                        ) : (
                                            <motion.span
                                                key="pending"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 0 }}
                                                exit={{ opacity: 0 }}
                                            />
                                        )}
                                    </AnimatePresence>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
