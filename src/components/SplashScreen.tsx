import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

interface SplashScreenProps {
    onComplete: () => void;
}

const PARTICLES = Array.from({ length: 12 });

export function SplashScreen({ onComplete }: SplashScreenProps) {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setVisible(false);
        }, 2200);
        return () => clearTimeout(timer);
    }, []);

    return (
        <AnimatePresence onExitComplete={onComplete}>
            {visible && (
                <motion.div
                    className="splash-screen"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35, ease: 'easeInOut' }}
                >
                    <div className="splash-screen__scanline" />

                    <div className="splash-screen__particles">
                        {PARTICLES.map((_, i) => (
                            <div key={i} className="splash-screen__particle" />
                        ))}
                    </div>

                    <div className="splash-screen__content">
                        <motion.div
                            className="splash-screen__x"
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        >
                            X
                        </motion.div>

                        <motion.div
                            className="splash-screen__title"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.35, ease: 'easeOut' }}
                        >
                            العميل X
                        </motion.div>

                        <motion.div
                            className="splash-screen__subtitle"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.5, delay: 0.65 }}
                        >
                            ALAMEL-X
                        </motion.div>
                    </div>

                    <motion.div
                        className="splash-screen__progress-wrap"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3, delay: 0.4 }}
                    >
                        <div className="splash-screen__progress-track">
                            <div className="splash-screen__progress-fill" />
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
