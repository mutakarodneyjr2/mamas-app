import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '../components/Logo';

export default function PrivacyPolicy() {
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
          <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-mamas-primary mb-3">Privacy Policy</h1>
          <p className="text-slate-400 text-sm font-medium">Last Updated: July 2026</p>
        </div>
        
        <div className="space-y-8 text-slate-600 leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-3">1. Information We Collect</h2>
            <p>To provide you with the services of the Matuumu Alumni Mutual Aid Association (MAMAS), we collect the following personal data:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Full name, phone number, and email address</li>
              <li>Profile pictures and other self-provided directory information</li>
              <li>Contribution history, financial logs, and welfare application details</li>
              <li>Usage data within the application</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-3">2. How We Use Your Data</h2>
            <p>Your data is used to:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Verify your identity and membership status</li>
              <li>Process contributions, payments, and welfare requests</li>
              <li>Maintain the alumni directory (visibility can be managed in your profile settings)</li>
              <li>Communicate important updates regarding the association</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-3">3. How We Protect Your Data</h2>
            <p>We implement appropriate technical and organizational security measures to protect your personal information against unauthorized access, loss, or alteration. All data is stored securely using Google Firebase infrastructure with restricted access rules.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-3">4. Data Sharing</h2>
            <p>We do not sell, rent, or trade your personal data. We may share information only in the following circumstances:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>With payment processors (e.g., Mobile Money providers) strictly for executing transactions</li>
              <li>With authorized committee members to review welfare applications and verify contributions</li>
              <li>When required by law or legal processes in the Republic of Uganda</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-3">5. Mobile Money Payment Data</h2>
            <p>When you make a payment via Mobile Money, we only collect the phone number provided for the transaction and the transaction reference to verify payments. We do not store PINs or full banking credentials on our servers.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-3">6. Your Rights</h2>
            <p>You have the right to access, correct, or request deletion of your personal data. You can manage your privacy preferences (such as hiding your phone number or email from the directory) directly in your Profile settings. To request account deletion, please contact the administrative committee.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-3">7. Contact for Privacy Questions</h2>
            <p>If you have any questions or concerns about this Privacy Policy or how your data is handled, please contact the MAMAS administrative committee.</p>
          </section>
        </div>
      </main>
    </div>
  );
}
