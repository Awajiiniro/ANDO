import { useEffect } from 'react';
import { motion } from 'framer-motion';

export default function Splash({ onComplete }) {
  useEffect(() => {
    console.log('Splash mounted, starting timer');
    const timer = setTimeout(() => {
      console.log('Splash timeout reached, calling onComplete');
      onComplete();
    }, 2500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-b from-white to-slate-50 dark:from-slate-950 dark:to-slate-900">
      <motion.div
        className="relative"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        {/* Gradient glow background */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full blur-3xl opacity-40"
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.4, 0.6, 0.4],
          }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
          }}
          style={{ width: '300px', height: '300px', margin: 'auto' }}
        />

        {/* Logo */}
        <motion.div
          className="relative w-24 h-24 flex items-center justify-center"
          animate={{
            y: [0, -5, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
          }}
        >
          <img
            src="/ando-logo.jpeg"
            alt="ANDO"
            className="w-full h-full rounded-full object-cover shadow-2xl"
          />
        </motion.div>
      </motion.div>

      {/* Fade out animation */}
      <motion.div
        className="absolute inset-0 bg-white dark:bg-slate-950"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0 }}
        exit={{ opacity: 1 }}
        transition={{ delay: 2, duration: 0.5 }}
      />
    </div>
  );
}
