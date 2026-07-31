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
  Inbox
} from 'lucide-react';

export default function Help() {
  const { currentUser, userProfile } = useAuth();

  const [activeTab, setActiveTab] = useState<'faq' | 'contact' | 'admin-articles' | 'admin-tickets'>('faq');
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(true);
  
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [expandedArticleId, setExpandedArticleId] = useState<string | null>(null);

  // Support Contacts
  const [supportPhone, setSupportPhone] = useState('+256 770 000000');
  const [supportWhatsApp, setSupportWhatsApp] = useState('+256 700 000000');
  const [supportEmail, setSupportEmail] = useState('support@mamas.org');

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

  const handleDeleteArticle = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this help article?")) return;
    try {
      await deleteHelpArticle(id);
      await loadHelpData();
    } catch (err) {
      console.error(err);
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
    <div className="space-y-6 max-w-5xl mx-auto pb-12 font-sans">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-mamas-primary via-mamas-primary/95 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-mamas-accent opacity-10 rounded-full blur-2xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold text-mamas-accent border border-white/10 mb-3">
              <LifeBuoy className="w-3.5 h-3.5" /> Matuumu S.S. Alumni Help Desk
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight">
              How can we help you today?
            </h1>
            <p className="text-slate-300 text-sm mt-1 max-w-xl leading-relaxed">
              Find answers to common questions about welfare assistance, weekly contributions, school campaigns, or send a direct message to the Executive Committee.
            </p>
          </div>

          {/* Quick Direct Contacts */}
          <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto shrink-0">
            {supportPhone && (
              <a
                href={`tel:${supportPhone}`}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xs transition-all shadow-md hover:shadow-emerald-900/30"
              >
                <PhoneCall className="w-4 h-4" />
                <span>Call Executive</span>
              </a>
            )}
            {supportWhatsApp && (
              <a
                href={`https://wa.me/${supportWhatsApp.replace(/[^0-9]/g, '')}?text=Hello%20MAMAS%20Executive,%20I%20have%20an%20inquiry%20regarding%20Matuumu%20Alumni%20Association`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-bold text-xs transition-all shadow-md hover:shadow-teal-900/30"
              >
                <MessageSquare className="w-4 h-4" />
                <span>WhatsApp Chat</span>
              </a>
            )}
            {supportEmail && (
              <a
                href={`mailto:${supportEmail}?subject=MAMAS%20Executive%20Inquiry`}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs transition-all shadow-md hover:shadow-blue-900/30"
              >
                <Mail className="w-4 h-4" />
                <span>Email Support</span>
              </a>
            )}
          </div>
        </div>

        {/* Tab Selector */}
        <div className="mt-8 flex flex-wrap gap-2 pt-4 border-t border-white/10">
          <button
            onClick={() => setActiveTab('faq')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'faq' ? 'bg-mamas-accent text-mamas-primary shadow-md' : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
          >
            <BookOpen className="w-4 h-4" /> FAQs & Knowledge Base
          </button>

          <button
            onClick={() => setActiveTab('contact')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'contact' ? 'bg-mamas-accent text-mamas-primary shadow-md' : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
          >
            <Send className="w-4 h-4" /> Contact Support Ticket
          </button>

          {isAdmin && (
            <>
              <button
                onClick={() => setActiveTab('admin-articles')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'admin-articles' ? 'bg-amber-400 text-slate-900 shadow-md' : 'bg-white/10 hover:bg-white/20 text-amber-200'
                }`}
              >
                <Edit3 className="w-4 h-4" /> Manage Articles
              </button>

              <button
                onClick={() => setActiveTab('admin-tickets')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'admin-tickets' ? 'bg-indigo-400 text-slate-900 shadow-md' : 'bg-white/10 hover:bg-white/20 text-indigo-200'
                }`}
              >
                <Inbox className="w-4 h-4" /> Support Tickets ({tickets.filter(t => t.status === 'open').length})
              </button>
            </>
          )}
        </div>
      </div>

      {/* TAB 1: FAQ & KNOWLEDGE BASE */}
      {activeTab === 'faq' && (
        <div className="space-y-6">
          
          {/* Search & Category Filter */}
          <div className="bg-mamas-card border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-sm space-y-4">
            <div className="relative">
              <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search articles by keywords (e.g. welfare, contributions, registration)..."
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-mamas-text focus:bg-white focus:ring-2 focus:ring-mamas-accent outline-none transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-bold bg-slate-200 px-2 py-0.5 rounded-full"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Category Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-400 mr-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Category:
              </span>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                    selectedCategory === cat
                      ? 'bg-mamas-primary text-white shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Articles List */}
          {loadingArticles ? (
            <div className="p-12 text-center bg-mamas-card rounded-3xl border border-slate-200 shadow-sm">
              <Loader2 className="w-8 h-8 text-mamas-accent animate-spin mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-500">Loading help center articles...</p>
            </div>
          ) : filteredArticles.length === 0 ? (
            <div className="p-12 text-center bg-mamas-card rounded-3xl border border-slate-200 shadow-sm">
              <HelpCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-mamas-text">No articles matched your search</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Try searching with different keywords or submit a direct support message to the executive team.
              </p>
              <button
                onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }}
                className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredArticles.map((art) => {
                const isExpanded = expandedArticleId === art.id;
                return (
                  <div
                    key={art.id}
                    className={`bg-mamas-card border rounded-2xl overflow-hidden transition-all duration-200 ${
                      isExpanded ? 'border-mamas-accent shadow-md ring-1 ring-mamas-accent/30' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <button
                      onClick={() => setExpandedArticleId(isExpanded ? null : art.id)}
                      className="w-full p-4 sm:p-5 text-left flex items-start justify-between gap-4 focus:outline-none"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-slate-100 text-mamas-primary rounded-xl shrink-0 mt-0.5">
                          <BookOpen className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-mamas-accent uppercase tracking-wider bg-mamas-accent/10 px-2 py-0.5 rounded-md">
                            {art.category}
                          </span>
                          <h3 className="text-sm sm:text-base font-bold text-mamas-text mt-1">
                            {art.title}
                          </h3>
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-mamas-accent shrink-0 mt-1" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400 shrink-0 mt-1" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="px-5 pb-5 pt-1 text-sm text-slate-600 leading-relaxed border-t border-slate-100 bg-slate-50/50">
                        <div className="prose prose-slate max-w-none text-xs sm:text-sm">
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
        <div className="bg-mamas-card border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm max-w-3xl mx-auto space-y-6">
          <div>
            <h2 className="text-xl font-bold text-mamas-text flex items-center gap-2">
              <Send className="w-5 h-5 text-mamas-accent" /> Contact Executive Support
            </h2>
            <p className="text-xs text-mamas-text-muted mt-1">
              Have a confidential inquiry, welfare suggestion, or account issue? Send a direct support ticket to the Executive Committee.
            </p>
          </div>

          {ticketSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl text-xs sm:text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{ticketSuccess}</span>
            </div>
          )}

          {ticketError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl text-xs sm:text-sm font-medium flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{ticketError}</span>
            </div>
          )}

          <form onSubmit={handleSubmitTicket} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Your Name</label>
                <input
                  type="text"
                  readOnly
                  value={userProfile?.fullName || 'Guest Member'}
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-700 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Phone Number</label>
                <input
                  type="text"
                  readOnly
                  value={userProfile?.phoneNumber || 'N/A'}
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-700 cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Subject / Inquiry Type *</label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g., Welfare Payout Status Inquiry, Registration Correction..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-mamas-accent outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Detailed Message *</label>
              <textarea
                required
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your request or issue clearly..."
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-mamas-accent outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={submittingTicket || !subject.trim() || !message.trim()}
              className="w-full bg-mamas-primary hover:bg-mamas-primary-hover text-white font-bold py-3.5 px-6 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
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
          <div className="flex items-center justify-between bg-mamas-card border border-slate-200 rounded-3xl p-6 shadow-sm">
            <div>
              <h2 className="text-xl font-bold text-mamas-text">Help Center Article Management</h2>
              <p className="text-xs text-mamas-text-muted mt-1">Create, edit, reorder, or publish articles for the member help center.</p>
            </div>
            <button
              onClick={() => {
                setEditingArticle({ title: '', content: '', category: 'General', order: adminArticles.length + 1, isPublished: true });
                setArticleModalOpen(true);
              }}
              className="bg-mamas-primary hover:bg-mamas-primary-hover text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Article
            </button>
          </div>

          <div className="bg-mamas-card border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="divide-y divide-slate-100">
              {adminArticles.map((art) => (
                <div key={art.id} className="p-4 sm:p-5 flex items-start justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                        Order #{art.order}
                      </span>
                      <span className="text-[10px] font-bold bg-mamas-accent/15 text-mamas-primary px-2 py-0.5 rounded-md">
                        {art.category}
                      </span>
                      {!art.isPublished && (
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md">
                          Draft (Unpublished)
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-mamas-text text-sm">{art.title}</h3>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-1">{art.content}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        setEditingArticle(art);
                        setArticleModalOpen(true);
                      }}
                      className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                      title="Edit"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteArticle(art.id)}
                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
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

      {/* TAB 4: ADMIN SUPPORT TICKETS */}
      {activeTab === 'admin-tickets' && isAdmin && (
        <div className="space-y-6">
          <div className="bg-mamas-card border border-slate-200 rounded-3xl p-6 shadow-sm flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-mamas-text">Submitted Member Support Tickets</h2>
              <p className="text-xs text-mamas-text-muted mt-1">Review and manage member support inquiries.</p>
            </div>
            <button
              onClick={loadTickets}
              disabled={loadingTickets}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
            >
              Refresh
            </button>
          </div>

          {loadingTickets ? (
            <div className="p-12 text-center bg-mamas-card rounded-3xl border border-slate-200 shadow-sm">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-500">Loading support tickets...</p>
            </div>
          ) : tickets.length === 0 ? (
            <div className="p-12 text-center bg-mamas-card rounded-3xl border border-slate-200 shadow-sm">
              <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-600">No support tickets found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tickets.map((t) => (
                <div key={t.id} className="bg-mamas-card border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                          t.status === 'open' ? 'bg-amber-100 text-amber-800' :
                          t.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                          'bg-emerald-100 text-emerald-800'
                        }`}>
                          {t.status.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-slate-400">
                          {new Date(t.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <h3 className="font-bold text-mamas-text text-base mt-1">{t.subject}</h3>
                      <p className="text-xs text-slate-500 font-semibold mt-0.5">
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
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold capitalize transition-colors ${
                            t.status === st ? 'bg-mamas-primary text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                          }`}
                        >
                          {st.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl text-xs text-slate-700 leading-relaxed font-medium">
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-mamas-card border border-slate-200 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-mamas-text">
              {editingArticle.id ? 'Edit Help Article' : 'Create Help Article'}
            </h3>

            <form onSubmit={handleSaveArticle} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={editingArticle.title || ''}
                  onChange={(e) => setEditingArticle({ ...editingArticle, title: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-mamas-accent outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Category *</label>
                  <input
                    type="text"
                    required
                    value={editingArticle.category || ''}
                    onChange={(e) => setEditingArticle({ ...editingArticle, category: e.target.value })}
                    placeholder="e.g., Welfare Assistance"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-mamas-accent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Display Order</label>
                  <input
                    type="number"
                    value={editingArticle.order || 1}
                    onChange={(e) => setEditingArticle({ ...editingArticle, order: parseInt(e.target.value) || 1 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-mamas-accent outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Content / Answer *</label>
                <textarea
                  required
                  rows={5}
                  value={editingArticle.content || ''}
                  onChange={(e) => setEditingArticle({ ...editingArticle, content: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-mamas-accent outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isPublished"
                  checked={editingArticle.isPublished ?? true}
                  onChange={(e) => setEditingArticle({ ...editingArticle, isPublished: e.target.checked })}
                  className="w-4 h-4 text-mamas-primary border-slate-300 rounded"
                />
                <label htmlFor="isPublished" className="text-xs font-bold text-slate-700">
                  Publish immediately to Help Center
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setArticleModalOpen(false); setEditingArticle(null); }}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingArticle}
                  className="px-5 py-2 bg-mamas-primary hover:bg-mamas-primary-hover text-white font-bold text-xs rounded-xl shadow-md transition-colors disabled:opacity-50"
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
