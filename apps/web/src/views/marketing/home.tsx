import { useRef } from "react";
import { Link } from "@tanstack/react-router";
import { motion, useScroll, useTransform, useInView } from "framer-motion";
import type { Variants } from "framer-motion";
import { ArrowRight, Code2, ListTodo, Search } from "lucide-react";

// --- Components ---

function HeroSection() {
    // Staggered text animation
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            translateY: 0,
            transition: {
                staggerChildren: 0.15,
                delayChildren: 0.2,
            },
        },
    };

    const itemVariants: Variants = {
        hidden: { opacity: 0, y: 50 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } },
    };

    return (
        <section className="relative flex min-h-screen w-full items-center overflow-hidden border-b border-border bg-page">
            {/* Background Image */}
            <img
                src="https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1920&q=80&auto=format&fit=crop"
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full object-cover opacity-75"
            />

            {/* Primary dark overlay – left-to-right fade so text stays readable */}
            <div className="absolute inset-0 bg-page/95" />
            {/* Bottom fade */}
            <div className="absolute inset-0 bg-page via-transparent to-transparent" />

            {/* Static Film Grain Overlay – pure SVG, no external image */}
            <svg
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-10 h-full w-full"
                style={{ opacity: 0.05 }}
                xmlns="http://www.w3.org/2000/svg"
            >
                <defs>
                    <filter id="grain" x="0%" y="0%" width="100%" height="100%">
                        <feTurbulence
                            type="fractalNoise"
                            baseFrequency="0.99"
                            numOctaves="4"
                            seed="2"
                            stitchTiles="stitch"
                            result="noise"
                        />
                        <feColorMatrix type="saturate" values="0" in="noise" result="greyNoise" />
                        <feBlend in="SourceGraphic" in2="greyNoise" mode="overlay" />
                    </filter>
                </defs>
                <rect width="100%" height="100%" filter="url(#grain)" />
            </svg>

            {/* Content */}
            <motion.div
                className="relative z-20 flex w-full max-w-7xl flex-col items-start px-8 py-32 md:px-16"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                <motion.p
                    variants={itemVariants}
                    className="mb-5 text-xs font-bold text-accent"
                >
                    Editorial Workspace System
                </motion.p>

                <h1 className="flex max-w-3xl flex-wrap justify-start font-display text-4xl font-bold leading-[0.92] tracking-tighter text-text md:text-5xl lg:text-[5.25rem]">
                    {"Give the work a calmer place to live.".split(" ").map((word, i) => (
                        <motion.span
                            key={i}
                            variants={itemVariants}
                            className="mr-[0.22em] inline-block"
                        >
                            {word}
                        </motion.span>
                    ))}
                </h1>

                <motion.p
                    variants={itemVariants}
                    className="mt-6 max-w-lg text-base text-text-muted leading-relaxed"
                >
                    Start privately, keep the system readable, and add shared continuity only when it improves the workflow.
                </motion.p>

                <motion.div variants={itemVariants} className="mt-8 flex flex-col items-start gap-3 sm:flex-row">
                    <Link
                        to="/workspaces"
                        className="button-primary group h-11 px-6"
                    >
                        Open Studio
                        <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                    </Link>
                    <Link
                        to="/gallery"
                        className="button-secondary h-11 px-6"
                    >
                        Browse Library
                    </Link>
                </motion.div>
            </motion.div>
        </section>
    );
}

function SectionCapture() {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-20%" });

    return (
        <section ref={ref} className="border-b border-border">
            <div className="mx-auto grid max-w-7xl grid-cols-1 lg:grid-cols-2">
                {/* Left side: Sticky text */}
                <div className="border-b border-border lg:border-b-0 lg:border-r border-border p-12 md:p-20 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:justify-center">
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={isInView ? { opacity: 1, y: 0 } : {}}
                        transition={{ duration: 0.6 }}
                        className="mb-4 text-xs font-bold text-text-soft"
                    >
                        01. Capture
                    </motion.p>
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        animate={isInView ? { opacity: 1, y: 0 } : {}}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="font-display text-4xl font-bold tracking-tight text-text md:text-5xl lg:text-6xl"
                    >
                        Bring raw source material into a working draft surface.
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={isInView ? { opacity: 1, y: 0 } : {}}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="mt-6 text-lg text-text-muted"
                    >
                        Paste internal notes, roadmaps, onboarding guides, or process documentation and turn them into a structure that remains readable after the first session.
                    </motion.p>
                </div>

                {/* Right side: Scrolling UI Mockup */}
                <div className="flex items-center justify-center p-8 py-24 md:p-20 bg-page min-h-screen">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={isInView ? { opacity: 1, scale: 1 } : {}}
                        transition={{ duration: 0.8, delay: 0.3 }}
                        className="w-full max-w-md border border-border bg-black/40 rounded-lg shadow-2xl overflow-hidden"
                    >
                        <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3">
                            <div className="flex gap-2">
                                <span className="h-3 w-3 rounded-full bg-surface-muted" />
                                <span className="h-3 w-3 rounded-full bg-surface-muted" />
                                <span className="h-3 w-3 rounded-full bg-surface-muted" />
                            </div>
                            <span className="text-xs font-mono text-text-soft">draft_notes.md</span>
                        </div>
                        <div className="p-6 font-mono text-sm leading-relaxed text-text-muted">
                            <span className="text-accent"># Team Operating Notes</span>
                            <br /><br />
                            <span className="text-text-soft">{"// Week 1"}</span><br />
                            <span className="text-text-muted">- Setup, access, workspace conventions</span><br />
                            <span className="text-text-muted">- Initial system tour</span><br />
                            <br />
                            <span className="text-text-soft">{"// Week 2"}</span><br />
                            <span className="text-text-muted">- Ownership patterns</span><br />
                            <span className="text-text-muted">- Review rhythms and handoff rules</span><br />
                            <br />
                            <div className="mt-8 flex gap-3 opacity-80">
                                <span className="h-2 w-full rounded-sm bg-surface-muted" />
                                <span className="h-2 w-3/4 rounded-sm bg-surface-muted" />
                            </div>
                        </div>
                        <div className="border-t border-border bg-page p-4 flex justify-end">
                            <button className="flex items-center gap-2 rounded-full bg-text px-4 py-2 text-xs font-medium text-page hover:bg-[#e6e6e6] transition-colors">
                                <Code2 size={14} /> Generate Structure
                            </button>
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}

function SectionNavigate() {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-20%" });

    return (
        <section ref={ref} className="border-b border-border bg-page">
            <div className="mx-auto grid max-w-7xl grid-cols-1 lg:grid-cols-2">
                {/* Left side: Sticky text */}
                <div className="border-b border-border lg:border-b-0 lg:border-r border-border p-12 md:p-20 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:justify-center">
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={isInView ? { opacity: 1, y: 0 } : {}}
                        transition={{ duration: 0.6 }}
                        className="mb-4 text-xs font-bold text-text-soft"
                    >
                        02. Navigate
                    </motion.p>
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        animate={isInView ? { opacity: 1, y: 0 } : {}}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="font-display text-4xl font-bold tracking-tight text-text md:text-5xl lg:text-6xl"
                    >
                        Keep the library legible as the volume of work grows.
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={isInView ? { opacity: 1, y: 0 } : {}}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="mt-6 text-lg text-text-muted"
                    >
                        Recency, completion, and next actions stay visible in one quiet list so people can resume work immediately instead of re-learning the interface.
                    </motion.p>
                </div>

                {/* Right side: Scrolling UI Mockup */}
                <div className="flex items-center justify-center p-8 py-24 md:p-20 min-h-screen">
                    <motion.div
                        initial={{ opacity: 0, x: 50 }}
                        animate={isInView ? { opacity: 1, x: 0 } : {}}
                        transition={{ duration: 0.8, delay: 0.3 }}
                        className="w-full max-w-md flex flex-col gap-4"
                    >
                        {/* Mock List Items */}
                        {[
                            { title: "React Architecture Patterns", progress: 100, active: false },
                            { title: "Team Onboarding Guide", progress: 65, active: true },
                            { title: "Q3 Design System Sync", progress: 12, active: false },
                        ].map((item, i) => (
                            <div key={i} className={`border border-border rounded-lg p-5 flex flex-col transition-all duration-300 ${item.active ? 'bg-surface-muted' : 'bg-black/40 opacity-70'}`}>
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h4 className="font-medium text-text">{item.title}</h4>
                                        <p className="text-xs text-text-soft mt-1">Updated 2 days ago</p>
                                    </div>
                                    <span className="text-xs font-mono text-text-muted">{item.progress}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-surface rounded-full overflow-hidden border border-border">
                                    <div
                                        className={`h-full rounded-full transition-all duration-1000 ${item.progress === 100 ? 'bg-raised' : 'bg-accent'}`}
                                        style={{ width: `${item.progress}%` }}
                                    />
                                </div>
                                {item.active && (
                                    <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-xs text-accent font-medium">
                                            <ListTodo size={14} /> Resume Module 3
                                        </div>
                                        <ArrowRight size={14} className="text-text-soft" />
                                    </div>
                                )}
                            </div>
                        ))}
                    </motion.div>
                </div>
            </div>
        </section>
    );
}

export default function MarketingPage() {
    return (
        <div className="min-h-screen bg-page text-text selection:bg-accent/30">
            <HeroSection />
            <SectionCapture />
            <SectionNavigate />

            <section className="border-t border-border bg-page py-32 text-center">
                <div className="mx-auto max-w-3xl px-6">
                    <p className="mb-4 text-xs font-bold text-accent">
                        Begin with material, not UI
                    </p>
                    <h2 className="font-display text-4xl font-bold leading-tight tracking-tighter text-text md:text-6xl">
                        Ready to structure your work?
                    </h2>
                    <div className="mt-10 flex justify-center">
                        <Link
                            to="/create"
                            className="group flex h-14 items-center justify-center gap-2 rounded-full bg-text px-10 text-sm font-medium text-page transition-all hover:bg-[#e6e6e6]"
                        >
                            Start the Studio
                            <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
}
