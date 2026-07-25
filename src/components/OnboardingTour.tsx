import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { User } from '../types';
import { Sparkles, CreditCard, HeartHandshake, FileText, UserCheck, Check, ArrowRight, ArrowLeft, X } from 'lucide-react';

interface OnboardingTourProps {
  userProfile: User;
  onComplete: () => void;
}

export function OnboardingTour({ userProfile, onComplete }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const steps = [
    {
      title: "Welcome to MAMAS! 🎉",
      subtitle: "Your secure alumni community hub",
      description: "Welcome, " + userProfile.fullName + "! MAMAS connects you with fellow alumni, tracks your welfare fund contributions, manages support requests, and keeps you updated with community notices.",
      icon: Sparkles,
      color: "bg-teal-500",
      lightColor: "bg-teal-50 text-teal-700 border-teal-200"
    },
    {
      title: "How to Make Contributions 💳",
      subtitle: "Support Welfare & Campaigns",
      description: "Navigate to 'Contribute' from the menu to record payments toward the monthly Welfare Fund or special school development campaigns. Enter your Mobile Money reference code and amount for instant verification by treasurers.",
      icon: CreditCard,
      color: "bg-indigo-500",
      lightColor: "bg-indigo-50 text-indigo-700 border-indigo-200"
    },
    {
      title: "Applying for Welfare Support 🤝",
      subtitle: "Transparent member assistance",
      description: "In times of need (medical, bereavement, or education support), go to the Welfare section to submit a support request. Executive members review and vote securely with full audit transparency.",
      icon: HeartHandshake,
      color: "bg-rose-500",
      lightColor: "bg-rose-50 text-rose-700 border-rose-200"
    },
    {
      title: "Viewing Your Statement 📊",
      subtitle: "Complete financial history",
      description: "Check your personal financial statement anytime to view all verified contributions, total welfare amounts paid, campaign support history, and download PDF or CSV records.",
      icon: FileText,
      color: "bg-amber-500",
      lightColor: "bg-amber-50 text-amber-700 border-amber-200"
    },
    {
      title: "Profile & Privacy Settings ⚙️",
      subtitle: "Control your information",
      description: "Visit your Profile to update your phone number, occupation, district, and choose whether fellow members can view your contact details in the directory.",
      icon: UserCheck,
      color: "bg-emerald-500",
      lightColor: "bg-emerald-50 text-emerald-700 border-emerald-200"
    }
  ];

  const handleFinish = async () => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', userProfile.uid), {
        hasCompletedOnboarding: true,
        updatedAt: Date.now()
      });
      onComplete();
    } catch (err) {
      console.error("Error saving onboarding status:", err);
      onComplete();
    } finally {
      setLoading(false);
    }
  };

  const step = steps[currentStep];
  const IconComponent = step.icon;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-mamas-card w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header / Progress bar */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Step {currentStep + 1} of {steps.length}
            </span>
          </div>
          <button
            onClick={handleFinish}
            disabled={loading}
            className="text-xs font-bold text-slate-400 hover:text-slate-700 transition-colors flex items-center gap-1 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm"
          >
            Skip Tour <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-md ${step.color}`}>
              <IconComponent className="w-7 h-7" />
            </div>
            <div>
              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border mb-1 ${step.lightColor}`}>
                {step.subtitle}
              </span>
              <h3 className="text-xl font-display font-bold text-mamas-text">{step.title}</h3>
            </div>
          </div>

          <p className="text-sm text-slate-600 leading-relaxed bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
            {step.description}
          </p>

          {/* Dots Indicator */}
          <div className="flex items-center justify-center gap-2 pt-2">
            {steps.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStep(idx)}
                className={`h-2 rounded-full transition-all ${
                  idx === currentStep ? 'w-8 bg-mamas-primary' : 'w-2 bg-slate-200 hover:bg-slate-300'
                }`}
                aria-label={`Go to step ${idx + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
            disabled={currentStep === 0 || loading}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              currentStep === 0 ? 'opacity-0 pointer-events-none' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 shadow-sm'
            }`}
          >
            <ArrowLeft className="w-4 h-4" /> Previous
          </button>

          {currentStep < steps.length - 1 ? (
            <button
              onClick={() => setCurrentStep(prev => Math.min(steps.length - 1, prev + 1))}
              disabled={loading}
              className="flex items-center gap-1.5 bg-mamas-primary hover:bg-mamas-primary-hover text-white px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md"
            >
              Next <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={loading}
              className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md"
            >
              <Check className="w-4 h-4" /> {loading ? 'Saving...' : 'Get Started'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
