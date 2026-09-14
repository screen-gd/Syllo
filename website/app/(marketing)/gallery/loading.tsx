"use client";

import { motion } from "framer-motion";

export default function GalleryLoading() {
    const skeletonCards = Array.from({ length: 6 }, (_, index) => index);

    return (
        <div className="min-h-screen bg-obsidian pt-28">
            <div className="mx-auto max-w-7xl px-6 pb-24 lg:px-10">
                <div className="border-b border-white/8 pb-6">
                    <motion.div
                        className="h-5 w-20 rounded-full bg-white/[0.05]"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                    />
                    <motion.div
                        className="mt-5 h-11 max-w-md rounded-full bg-white/[0.06]"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, ease: "easeOut", delay: 0.06 }}
                    />
                    <motion.div
                        className="mt-4 h-4 max-w-xl rounded-full bg-white/[0.04]"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, ease: "easeOut", delay: 0.12 }}
                    />
                </div>

                <motion.div
                    className="mt-8 h-16 rounded-[24px] border border-white/8 bg-white/[0.03]"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut", delay: 0.18 }}
                />

                <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {skeletonCards.map((index) => (
                        <motion.div
                            key={index}
                            className="rounded-[28px] border border-white/8 bg-white/[0.03] p-6"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.42, ease: "easeOut", delay: 0.15 + index * 0.06 }}
                        >
                            <div className="h-44 rounded-[20px] bg-white/[0.05]" />
                            <div className="mt-5 h-4 w-20 rounded-full bg-white/[0.05]" />
                            <div className="mt-4 h-7 w-3/4 rounded-full bg-white/[0.06]" />
                            <div className="mt-3 h-4 w-full rounded-full bg-white/[0.04]" />
                            <div className="mt-2 h-4 w-5/6 rounded-full bg-white/[0.04]" />
                            <div className="mt-6 flex gap-3">
                                <div className="h-9 w-28 rounded-full bg-white/[0.05]" />
                                <div className="h-9 w-24 rounded-full bg-white/[0.04]" />
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
}
