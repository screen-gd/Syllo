import { useEffect, useRef, type ReactNode } from "react";
import { motion } from "motion/react";
import { springs } from "./motion";

/**
 * Fades a page in with a 4px rise when the route changes. The first page renders as the server sent it, with no
 * entrance, so nothing is hidden before hydration. Under reduced motion only the fade remains (MotionConfig in
 * Providers drops the rise).
 */
export default function PageTransition({
    routeKey,
    children,
}: {
    routeKey: string;
    children: ReactNode;
}) {
    const mounted = useRef(false);
    useEffect(() => {
        mounted.current = true;
    }, []);
    return (
        <motion.div
            key={routeKey}
            initial={mounted.current ? { opacity: 0, y: 4 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={springs.page}
        >
            {children}
        </motion.div>
    );
}
