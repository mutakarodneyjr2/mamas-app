import React from 'react';

export default function Help() {
  const faqs = [
    {
      question: "How do I make a welfare contribution?",
      answer: "Go to the Dashboard and click 'Log Contribution'. Enter the amount and the transaction reference (e.g., from Mobile Money or Bank). The Treasurer will verify it."
    },
    {
      question: "What is the minimum weekly contribution?",
      answer: "The minimum weekly contribution is UGX 5,000 for standard members, though you can contribute more to help the fund grow."
    },
    {
      question: "How do I apply for welfare support?",
      answer: "Navigate to the 'Welfare' tab and click 'Apply for Welfare'. Fill out the details, attach any required evidence (like a hospital bill or death certificate), and submit. The Welfare Committee will review your request."
    },
    {
      question: "What happens if I miss a contribution?",
      answer: "You will see a reminder on your Dashboard. If you consistently miss contributions without valid reason, your status may change to Inactive, which could affect your eligibility for welfare payouts."
    },
    {
      question: "How are school campaigns different from welfare?",
      answer: "School Campaigns are separate fundraising efforts aimed at improving our alma mater (e.g., building a library). Welfare funds are strictly for supporting association members during events like sickness, death, or weddings."
    }
  ];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="bg-mamas-card rounded-lg shadow-sm border border-slate-200 p-6">
        <h2 className="text-2xl font-bold text-mamas-text">Help & Support</h2>
        <p className="text-mamas-text-muted text-sm mt-1">Frequently asked questions and guides.</p>
      </div>

      <div className="bg-mamas-card rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="divide-y divide-gray-200">
          {faqs.map((faq, index) => (
            <div key={index} className="p-6">
              <h3 className="text-lg font-medium text-mamas-text mb-2">{faq.question}</h3>
              <p className="text-mamas-text-muted text-sm leading-relaxed">{faq.answer}</p>
            </div>
          ))}
        </div>
      </div>
      
      <div className="bg-mamas-bg rounded-lg border border-slate-200 p-6 text-center">
        <h3 className="text-sm font-medium text-mamas-text mb-1">Need more help?</h3>
        <p className="text-sm text-mamas-text-muted">Contact the association Secretary or Chairperson for specific inquiries.</p>
      </div>
    </div>
  );
}
