import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { HelpArticle, SupportTicket, TicketStatus } from '../types';
import { 
  getHelpArticles, 
  getAllHelpArticlesAdmin, 
  createHelpArticle, 
  updateHelpArticle, 
  deleteHelpArticle, 
  submitSupportMessage, 
  getSupportTickets, 
  updateSupportTicket 
} from '../lib/helpService';
import { 
  Search, 
  HelpCircle, 
  MessageSquare, 
  PhoneCall, 
  Mail,
  Plus, 
  Trash2, 
  Edit3, 
  ChevronDown, 
  ChevronUp, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  BookOpen, 
  LifeBuoy, 
  ShieldAlert, 
  Clock, 
  Filter, 
  Sparkles,
  Inbox,
  Users
} from 'lucide-react';

import { ConfirmationModal } from '../components/ConfirmationModal';

export default function Help() {
  const { currentUser, userProfile } = useAuth();

  const [activeTab, setActiveTab] = useState<'faq' | 'contact' | 'admin-articles' | 'admin-tickets'>('faq');
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(true);
  
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [expandedArticleId, setExpandedArticleId] = useState<string | null>(null);

  // Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [articleToDelete, setArticleToDelete] = useState<string | null>(null);

  // Support Contacts
  const [supportPhone, setSupportPhone] = useState('+256 770 000000');
  const [supportWhatsApp, setSupportWhatsApp] = useState('+256 700 000000');
  const [supportEmail, setSupportEmail] = useState('support@mamas.org');
  const [whatsappGroupLink, setWhatsappGroupLink] = useState('');

  // Contact Support Form
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [ticketSuccess, setTicketSuccess] = useState('');
  const [ticketError, setTicketError] = useState('');

  // Admin Article Management
  const [adminArticles, setAdminArticles] = useState<HelpArticle[]>([]);
  const [editingArticle, setEditingArticle] = useState<Partial<HelpArticle> | null>(null);
  const [savingArticle, setSavingArticle] = useState(false);
  const [articleModalOpen, setArticleModalOpen] = useState(false);

  // Admin Support Tickets
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [updatingTicketId, setUpdatingTicketId] = useState<string | null>(null);

  const isAdmin = userProfile && ['super_admin', 'chairperson', 'vice_chairperson', 'secretary'].includes(userProfile.role);

  useEffect(() => {
    loadHelpData();
    fetchSupportContacts();
  }, [userProfile]);

  const fetchSupportContacts = async () => {
    try {
      const snap = await getDoc(doc(db, 'appSettings', 'main'));
      if (snap.exists()) {
        const data = snap.data();
        if (data.supportPhone) setSupportPhone(data.supportPhone);
        if (data.supportWhatsApp) setSupportWhatsApp(data.supportWhatsApp);
        if (data.supportEmail) setSupportEmail(data.supportEmail);
        if (data.whatsappGroupLink) setWhatsappGroupLink(data.whatsappGroupLink);
      }
    } catch (err) {
      console.error("Error fetching support settings:", err);
    }
  };

  const loadHelpData = async () => {
    setLoadingArticles(true);
    try {
      const pubArticles = await getHelpArticles();
      setArticles(pubArticles);
      if (pubArticles.length > 0) {
        setExpandedArticleId(pubArticles[0].id);
      }

      if (isAdmin) {
        const all = await getAllHelpArticlesAdmin();
        setAdminArticles(all);
      }
    } catch (err) {
      console.error("Error loading help articles:", err);
    } finally {
      setLoadingArticles(false);
    }
  };

  const loadTickets = async () => {
    if (!isAdmin) return;
    setLoadingTickets(true);
    try {
      const list = await getSupportTickets();
      setTickets(list);
    } catch (err) {
      console.error("Error loading tickets:", err);
    } finally {
      setLoadingTickets(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'admin-tickets') {
      loadTickets();
    } else if (activeTab === 'admin-articles') {
      loadHelpData();
    }
  }, [activeTab]);

  // Categories list
  const safeArticles = Array.isArray(articles) ? articles : [];
  const categories = ['All', ...Array.from(new Set(safeArticles.map(a => a?.category).filter(Boolean)))];

  // Filtered Articles
  const filteredArticles = safeArticles.filter(art => {
    if (!art) return false;
    const matchesCategory = selectedCategory === 'All' || art.category === selectedCategory;
    const q = String(searchQuery || '').toLowerCase();
    const title = String(art.title || '').toLowerCase();
    const content = String(art.content || '').toLowerCase();
    const category = String(art.category || '').toLowerCase();

    const matchesSearch = 
      title.includes(q) || 
      content.includes(q) ||
      category.includes(q);
    return matchesCategory && matchesSearch;
  });

  // Submit Support Ticket Handler
  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;

    setSubmittingTicket(true);
    setTicketError('');
    setTicketSuccess('');

    try {
      await submitSupportMessage({
        userId: currentUser?.uid,
        userName: userProfile?.fullName || 'Valued Member',
        userEmail: userProfile?.email || '',
        userPhone: userProfile?.phoneNumber || '',
        subject: subject.trim(),
        message: message.trim()
      });

      setTicketSuccess("Your support message has been sent to the Executive Committee. We will respond promptly.");
      setSubject('');
      setMessage('');
    } catch (err: any) {
      console.error(err);
      setTicketError("Failed to send message: " + (err.message || 'Network error'));
    } finally {
      setSubmittingTicket(false);
    }
  };

  // Save / Edit Help Article (Admin)
  const handleSaveArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingArticle?.title || !editingArticle?.content || !editingArticle?.category) return;

    setSavingArticle(true);
    try {
      if (editingArticle.id) {
        await updateHelpArticle(editingArticle.id, {
          title: editingArticle.title,
          content: editingArticle.content,
          category: editingArticle.category,
          order: editingArticle.order || 1,
          isPublished: editingArticle.isPublished ?? true
        });
      } else {
        await createHelpArticle({
          title: editingArticle.title,
          content: editingArticle.content,
          category: editingArticle.category,
          order: editingArticle.order || 1,
          isPublished: editingArticle.isPublished ?? true
        });
      }

      setArticleModalOpen(false);
      setEditingArticle(null);
      await loadHelpData();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingArticle(false);
    }
  };

  const confirmDeleteArticle = (id: string) => {
    setArticleToDelete(id);
    setDeleteModalOpen(true);
  };

  const handleDeleteArticle = async () => {
    if (!articleToDelete) return;
    try {
      await deleteHelpArticle(articleToDelete);
      await loadHelpData();
    } catch (err) {
      console.error(err);
    } finally {
      setDeleteModalOpen(false);
      setArticleToDelete(null);
    }
  };

  const handleUpdateTicketStatus = async (ticketId: string, status: TicketStatus) => {
    setUpdatingTicketId(ticketId);
    try {
      await updateSupportTicket(ticketId, status);
      await loadTickets();
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingTicketId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto w-full pb-20 font-sans animate-in fade-in duration-300">
      
      {/* STICKY TOP TITLE HEADER */}
      <div className="sticky top-0 z-30 bg-mamas-bg/95 backdrop-blur-md px-4 sm:px-6 py-3 border-b border-slate-200/60 dark:border-slate-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <LifeBuoy className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Help & Support Center
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            FAQs, knowledge base, and direct Executive Committee support
          </p>
        </div>

        {/* Quick Direct Contact Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
          {supportPhone && (
            <a
              href={`tel:${supportPhone}`}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-full font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
              title="Call Executive"
            >
              <PhoneCall className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Call</span>
            </a>
          )}
          {supportWhatsApp && (
            <a
              href={`https://wa.me/${supportWhatsApp.replace(/[^0-9]/g, '')}?text=Hello%20MAMAS%20Executive,%20I%20have%20an%20inquiry%20regarding%20Matuumu%20Alumni%20Association`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              title="WhatsApp Chat"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </a>
          )}
          {supportEmail && (
            <a
              href={`mailto:${supportEmail}?subject=MAMAS%20Executive%20Inquiry`}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-full font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
              title="Email Support"
            >
              <Mail className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Email</span>
            </a>
          )}
          {whatsappGroupLink && (
            <a
              href={whatsappGroupLink}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-full font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              title="Join Alumni Group"
            >
              <Users className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Group</span>
            </a>
          )}
        </div>
      </div>

      {/* STICKY TAB SELECTOR */}
      <div className="bg-white dark:bg-[#0c1731] px-4 sm:px-6 py-2.5 border-b border-slate-200/60 dark:border-slate-800/60 flex items-center gap-2 overflow-x-auto no-scrollbar mb-4">
        <button
          onClick={() => setActiveTab('faq')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'faq' ? 'bg-blue-600 text-white shadow-xs font-extrabold' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>FAQs & Knowledge Base</span>
        </button>

        <button
          onClick={() => setActiveTab('contact')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'contact' ? 'bg-blue-600 text-white shadow-xs font-extrabold' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          <span>Send Support Ticket</span>
        </button>

        {isAdmin && (
          <>
            <button
              onClick={() => setActiveTab('admin-articles')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'admin-articles' ? 'bg-blue-600 text-white shadow-xs font-extrabold' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Manage Articles</span>
            </button>

            <button
              onClick={() => setActiveTab('admin-tickets')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'admin-tickets' ? 'bg-blue-600 text-white shadow-xs font-extrabold' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Inbox className="w-3.5 h-3.5" />
              <span>Support Tickets ({tickets.filter(t => t.status === 'open').length})</span>
            </button>
          </>
        )}
      </div>

      {/* TAB 1: FAQ & KNOWLEDGE BASE */}
      {activeTab === 'faq' && (
        <div className="space-y-6">
          
          {/* Search & Category Filter (EDGE-TO-EDGE) */}
          <div className="bg-white dark:bg-[#0c1731] border-b border-slate-200/60 dark:border-slate-800/60 p-4 sm:p-6 space-y-4">
            <div className="relative">
              <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search articles by keywords (e.g. welfare, contributions, registration)..."
                className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Category Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-400 mr-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Category:
              </span>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Articles List */}
          {loadingArticles ? (
            <div className="p-12 text-center bg-white dark:bg-[#0c1731]">
              <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin mx-auto mb-3" />
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Loading help center articles...</p>
            </div>
          ) : filteredArticles.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-[#0c1731]">
              <HelpCircle className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">No articles matched your search</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                Try searching with different keywords or submit a direct support message to the executive team.
              </p>
              <button
                onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }}
                className="mt-4 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
              {filteredArticles.map((art) => {
                const isExpanded = expandedArticleId === art.id;
                return (
                  <div
                    key={art.id}
                    className="bg-white dark:bg-[#0c1731] transition-all duration-200"
                  >
                    <button
                      onClick={() => setExpandedArticleId(isExpanded ? null : art.id)}
                      className="w-full p-4 sm:p-5 text-left flex items-start justify-between gap-4 focus:outline-none cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl shrink-0 mt-0.5 border border-blue-100 dark:border-blue-900/60">
                          <BookOpen className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider bg-blue-50 dark:bg-blue-950/80 px-2 py-0.5 rounded-md border border-blue-200/50 dark:border-blue-900/50">
                            {art.category}
                          </span>
                          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mt-1">
                            {art.title}
                          </h3>
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-1" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400 shrink-0 mt-1" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                        <div className="prose dark:prose-invert prose-slate max-w-none text-xs sm:text-sm">
                          {art.content}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* TAB 2: CONTACT SUPPORT TICKET */}
      {activeTab === 'contact' && (
        <div className="bg-white dark:bg-[#0c1731] border-b border-slate-200/60 dark:border-slate-800/60 px-4 sm:px-6 py-6 space-y-6">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Send className="w-5 h-5 text-blue-600 dark:text-blue-400" /> Contact Executive Support
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Have a confidential inquiry, welfare suggestion, or account issue? Send a direct support ticket to the Executive Committee.
            </p>
          </div>

          {ticketSuccess && (
            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 p-4 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{ticketSuccess}</span>
            </div>
          )}

          {ticketError && (
            <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300 p-4 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>{ticketError}</span>
            </div>
          )}

          <form onSubmit={handleSubmitTicket} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Your Name</label>
                <input
                  type="text"
                  readOnly
                  value={userProfile?.fullName || 'Guest Member'}
                  className="w-full bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl px-4 py-3 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Phone Number</label>
                <input
                  type="text"
                  readOnly
                  value={userProfile?.phoneNumber || 'N/A'}
                  className="w-full bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl px-4 py-3 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Subject / Inquiry Type *</label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g., Welfare Payout Status Inquiry, Registration Correction..."
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl px-4 py-3 text-xs sm:text-sm font-medium text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Detailed Message *</label>
              <textarea
                required
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your request or issue clearly..."
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 text-xs sm:text-sm font-medium text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={submittingTicket || !subject.trim() || !message.trim()}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-6 rounded-2xl shadow-md shadow-blue-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-xs sm:text-sm cursor-pointer"
            >
              {submittingTicket ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Submitting Ticket...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" /> Send Support Ticket
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: ADMIN ARTICLES MANAGEMENT */}
      {activeTab === 'admin-articles' && isAdmin && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-white dark:bg-[#0c1731] border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Help Center Article Management</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Create, edit, reorder, or publish articles for the member help center.</p>
            </div>
            <button
              onClick={() => {
                setEditingArticle({ title: '', content: '', category: 'General', order: adminArticles.length + 1, isPublished: true });
                setArticleModalOpen(true);
              }}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2.5 rounded-2xl text-xs flex items-center gap-1.5 shadow-md shadow-blue-500/25 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add Article
            </button>
          </div>

          <div className="bg-white dark:bg-[#0c1731] border border-slate-200/80 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xs">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {adminArticles.map((art) => (
                <div key={art.id} className="p-4 sm:p-5 flex items-start justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md">
                        Order #{art.order}
                      </span>
                      <span className="text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md">
                        {art.category}
                      </span>
                      {!art.isPublished && (
                        <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-400 px-2 py-0.5 rounded-md">
                          Draft (Unpublished)
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">{art.title}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">{art.content}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        setEditingArticle(art);
                        setArticleModalOpen(true);
                      }}
                      className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-xl transition-colors cursor-pointer"
                      title="Edit"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => confirmDeleteArticle(art.id)}
                      className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-colors cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={deleteModalOpen}
        title="Delete Help Article"
        message="Are you sure you want to delete this help article? This action cannot be undone."
        confirmText="Delete"
        onConfirm={handleDeleteArticle}
        onCancel={() => setDeleteModalOpen(false)}
        isDanger={true}
      />

      {/* TAB 4: ADMIN SUPPORT TICKETS */}
      {activeTab === 'admin-tickets' && isAdmin && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#0c1731] border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs flex items-center justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Submitted Member Support Tickets</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Review and manage member support inquiries.</p>
            </div>
            <button
              onClick={loadTickets}
              disabled={loadingTickets}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-bold transition-colors cursor-pointer"
            >
              Refresh
            </button>
          </div>

          {loadingTickets ? (
            <div className="p-12 text-center bg-white dark:bg-[#0c1731] rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-500 dark:text-slate-400">Loading support tickets...</p>
            </div>
          ) : tickets.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-[#0c1731] rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <Inbox className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-600 dark:text-slate-400">No support tickets found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tickets.map((t) => (
                <div key={t.id} className="bg-white dark:bg-[#0c1731] border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                          t.status === 'open' ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400' :
                          t.status === 'in_progress' ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-400' :
                          'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400'
                        }`}>
                          {t.status.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-slate-400">
                          {new Date(t.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <h3 className="font-extrabold text-slate-900 dark:text-white text-base mt-1">{t.subject}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                        Submitted by: {t.userName} • {t.userPhone || 'No Phone'} {t.userEmail ? `• ${t.userEmail}` : ''}
                      </p>
                    </div>

                    {/* Status Update Buttons */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {['open', 'in_progress', 'resolved', 'closed'].map((st) => (
                        <button
                          key={st}
                          disabled={updatingTicketId === t.id}
                          onClick={() => handleUpdateTicketStatus(t.id, st as TicketStatus)}
                          className={`px-2.5 py-1 rounded-xl text-[10px] font-bold capitalize transition-colors cursor-pointer ${
                            t.status === st ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {st.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                    {t.message}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ADMIN ARTICLE CREATE / EDIT MODAL */}
      {articleModalOpen && editingArticle && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0c1731] border border-slate-200/80 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {editingArticle.id ? 'Edit Help Article' : 'Create Help Article'}
            </h3>

            <form onSubmit={handleSaveArticle} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={editingArticle.title || ''}
                  onChange={(e) => setEditingArticle({ ...editingArticle, title: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Category *</label>
                  <input
                    type="text"
                    required
                    value={editingArticle.category || ''}
                    onChange={(e) => setEditingArticle({ ...editingArticle, category: e.target.value })}
                    placeholder="e.g., Welfare Assistance"
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Display Order</label>
                  <input
                    type="number"
                    value={editingArticle.order || 1}
                    onChange={(e) => setEditingArticle({ ...editingArticle, order: parseInt(e.target.value) || 1 })}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Content / Answer *</label>
                <textarea
                  required
                  rows={5}
                  value={editingArticle.content || ''}
                  onChange={(e) => setEditingArticle({ ...editingArticle, content: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 text-xs sm:text-sm font-medium text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isPublished"
                  checked={editingArticle.isPublished ?? true}
                  onChange={(e) => setEditingArticle({ ...editingArticle, isPublished: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded cursor-pointer"
                />
                <label htmlFor="isPublished" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                  Publish immediately to Help Center
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => { setArticleModalOpen(false); setEditingArticle(null); }}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingArticle}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-2xl shadow-md shadow-blue-500/25 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {savingArticle ? 'Saving...' : 'Save Article'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
