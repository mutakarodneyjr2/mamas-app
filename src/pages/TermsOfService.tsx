import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '../components/Logo';

export default function TermsOfService() {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-12">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center justify-between p-4">
          <button 
            onClick={() => navigate(-1)} 
            className="flex items-center text-slate-500 hover:text-mamas-primary transition-colors text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back
          </button>
          <Link to="/" className="flex items-center">
            <Logo dark />
          </Link>
        </div>
      </header>
      
      <main className="max-w-3xl mx-auto px-5 md:px-10 py-10 bg-white shadow-sm border border-slate-100 rounded-3xl mt-8">
        <div className="mb-10 text-center border-b border-slate-100 pb-8">
          <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-mamas-primary mb-3">Terms of Service</h1>
          <p className="text-slate-400 text-sm font-medium">Last Updated: July 2026</p>
        </div>
        
        <div className="space-y-8 text-slate-600 leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-3">1. Introduction and Acceptance</h2>
            <p>Welcome to the Matuumu Alumni Mutual Aid Association (MAMAS). By accessing or using our application, you agree to comply with and be bound by these Terms of Service. If you do not agree with any part of these terms, you may not use our services.</p>
          </section>


          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-3">2. Description of MAMAS</h2>
            <p>MAMAS is a mutual aid platform designed to support Matuumu Alumni through financial contributions, welfare support, and school support campaigns. It serves as a central hub for managing memberships, logging contributions, and organizing community welfare.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-3">3. Membership and Contributions</h2>
            <p>Membership requires registration and approval by the administrative committee. All financial contributions made to the General Welfare Pool or specific campaigns are voluntary and non-refundable. Your contribution goes directly to the designated cause or general mutual aid funds.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-3">4. Welfare Support Rules</h2>
            <p>Welfare requests are subject to approval by the association's committee based on predefined categories and available funds. Submitting a request does not guarantee disbursement. The committee's decisions are final.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-3">5. School Support Campaigns</h2>
            <p>Members can contribute to active School Support Campaigns. If a campaign reaches its goal and closes, or is cancelled, any excess or remaining funds may be transferred to the General Welfare Pool at the discretion of the administrators.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-3">6. User Responsibilities</h2>
            <p>Users must provide accurate information during registration and keep their profiles updated. You are responsible for maintaining the confidentiality of your account credentials (e.g., OTPs) and for all activities that occur under your account.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-3">7. Limitation of Liability</h2>
            <p>MAMAS and its administrative committee shall not be held liable for any direct, indirect, incidental, or consequential damages resulting from the use or inability to use the platform, including any issues related to third-party payment providers like Mobile Money services.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-3">8. Governing Law</h2>
            <p>These Terms of Service are governed by and construed in accordance with the laws of the Republic of Uganda. Any disputes arising from these terms will be subject to the exclusive jurisdiction of the courts of Uganda.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-3">9. Contact Information</h2>
            <p>For any questions regarding these Terms of Service, please contact the MAMAS administrative committee through the official association channels or the support section within the app.</p>
          </section>
        </div>
      </main>
    </div>
  );
}
