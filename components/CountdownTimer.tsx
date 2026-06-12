'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image'; // Re-added Image import

interface CountdownTimerProps {
  targetDate: string; // ISO string for the target date in GMT (e.g., '2026-06-15T00:00:00Z')
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({ targetDate: targetDateString }) => {
  const targetDate = new Date(targetDateString); // Parse the target date

  const calculateTimeLeft = () => {
    const now = new Date();
    // Calculate difference in milliseconds
    const difference = targetDate.getTime() - now.getTime();

    let timeLeft = {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    };

    if (difference > 0) {
      timeLeft = {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      };
    }

    return timeLeft;
  };

  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 }); // Hydration fix: initial state is zeros
  const [isMounted, setIsMounted] = useState(false); // Hydration fix: track if component is mounted
  const [isSalesStarted, setIsSalesStarted] = useState(false);

  useEffect(() => {
    setIsMounted(true); // Hydration fix: set mounted true on client
    // Initial check in case the component mounts after the target date
    if (targetDate.getTime() <= new Date().getTime()) {
      setIsSalesStarted(true);
      return; // Exit early if sales have already started
    }

    setTimeLeft(calculateTimeLeft()); // Hydration fix: calculate time only on client mount

    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft();
      if (newTimeLeft.days <= 0 && newTimeLeft.hours <= 0 && newTimeLeft.minutes <= 0 && newTimeLeft.seconds <= 0) {
        setIsSalesStarted(true);
        clearInterval(timer);
      }
      setTimeLeft(newTimeLeft);
    }, 1000);

    return () => clearInterval(timer); // Cleanup on unmount
  }, [targetDateString]); // Dependency array to re-run effect if targetDateString changes

  if (!isMounted || isSalesStarted) { // Hydration fix: only render on client after mounted, or if sales started
    return null;
  }

  // Format the date for display, explicitly showing GMT
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
    timeZone: 'GMT',
  };
  const formattedDate = targetDate.toLocaleString('en-US', options);

  return (
    <div className="fixed inset-0 bg-background flex flex-col justify-center items-center z-[9999] p-6 text-center overflow-y-auto">
      <div className="max-w-4xl w-full py-12 flex flex-col items-center space-y-12 animate-in fade-in zoom-in duration-1000 ease-out">
        {/* Brand Identity */}
        <div className="flex flex-col items-center space-y-4">
          <div className="relative w-32 h-32 md:w-44 md:h-44 transition-transform hover:scale-105 duration-500">
            <Image
              src="/aura-luxe-logo.png"
              alt="AuraLuxe Logo"
              fill
              sizes="(max-width: 768px) 128px, 176px" // Fixed Image warning
              className="object-contain"
              priority
            />
          </div>
          <h1 className="text-sm md:text-base font-bold tracking-[0.4em] text-foreground uppercase opacity-60">
            AuraLuxe Hair
          </h1>
        </div>

        {/* Announcement */}
        <div className="space-y-4">
          <h2 className="text-5xl md:text-8xl font-black text-primary tracking-tighter italic">
            COMING SOON
          </h2>
          <div className="h-1.5 w-24 bg-primary mx-auto rounded-full" />
          <p className="text-muted-foreground text-lg md:text-2xl font-medium tracking-tight max-w-lg mx-auto leading-relaxed">
            Our luxury collection launch is just around the corner. Get ready to transform your look.
          </p>
        </div>

        {/* Timer Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 w-full max-w-3xl">
          {[
            { label: 'Days', value: timeLeft.days },
            { label: 'Hours', value: timeLeft.hours },
            { label: 'Minutes', value: timeLeft.minutes },
            { label: 'Seconds', value: timeLeft.seconds },
          ].map((item) => (
            <div key={item.label} className="group relative">
               <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-accent/20 rounded-3xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
               <div className="relative bg-card border border-border/50 rounded-2xl md:rounded-3xl p-6 md:p-10 shadow-2xl flex flex-col items-center justify-center">
                  <span className="text-4xl md:text-7xl font-black text-foreground tabular-nums tracking-tighter">
                    {item.value.toString().padStart(2, '0')}
                  </span>
                  <span className="text-[10px] md:text-xs uppercase font-extrabold tracking-[0.2em] text-primary mt-2">
                    {item.label}
                  </span>
               </div>
            </div>
          ))}
        </div>

        {/* Official Start Time */}
        <div className="pt-12 space-y-6"> {/* Increased space-y for more separation */}
          <span className="px-5 py-2 rounded-full border border-primary/20 text-[10px] md:text-xs font-bold uppercase tracking-[0.25em] text-primary bg-primary/5">
            Official Launch
          </span>
          <p className="text-lg md:text-2xl font-bold text-foreground/80 tracking-tight">
            {formattedDate}
          </p>
        </div>
      </div>
    </div>
  );
};

export default CountdownTimer;