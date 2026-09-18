import React, { useEffect, useState } from 'react';
import { User } from '../types';
import { SelectDropdown } from '../components/SelectDropdown';
import { db } from '../firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { Search, MapPin, Briefcase, Phone, Mail, MessageSquare, X, ChevronRight, School, User as UserIcon, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { StatusBadge } from '../components/StatusBadge';
import { useRegisterModal } from '../lib/nativeBack';
import { openExternalUrl, openTel, openWhatsApp, openMailto } from '../lib/openExternal';

export default function Directory() {
  const { userProfile, isAdminOrCommittee } = useAuth();
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'recent' | 'with_profession'>('all');
  
  const [selectedMember, setSelectedMember] = useState<User | null>(null);
  const [appSettings, setAppSettings] = useState<any>(null);

  useRegisterModal(!!selectedMember, () => setSelectedMember(null), 'directory-member-modal');

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const [profilesSnap, settingsSnap] = await Promise.all([
          getDocs(collection(db, 'directoryProfiles')),
          getDoc(doc(db, 'appSettings', 'main'))
        ]);
        
        if (settingsSnap.exists()) {
          setAppSettings(settingsSnap.data());
        }

        const fetchedMembers: User[] = [];
        profilesSnap.docs.forEach(doc => {
          const data = doc.data() as User;
          const st = (data.status || 'approved').toLowerCase();
          if (['approved', 'active'].includes(st)) {
            fetchedMembers.push({ ...data, uid: doc.id });
          }
        });
        // Sort client-side by full name
        fetchedMembers.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
        setMembers(fetchedMembers);
      } catch (err) {
        console.error("Error fetching members directory:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, []);

  const safeMembers = Array.isArray(members) ? members : [];
  const years = Array.from(new Set(safeMembers.map(m => m?.yearLeftSchool).filter(Boolean))).sort((a, b) => String(b).localeCompare(String(a)));
  
  const filteredMembers = safeMembers.filter(m => {
    if (!m) return false;
    const s = String(searchTerm || '').toLowerCase();
    const fullName = String(m.fullName || '').toLowerCase();
    const occupation = String(m.occupation || '').toLowerCase();
    const district = String(m.district || '').toLowerCase();
    const matchesSearch = fullName.includes(s) || occupation.includes(s) || district.includes(s);
    const matchesYear = yearFilter ? String(m.yearLeftSchool || '') === yearFilter : true;
    
    if (activeTab === 'recent') {
      const isRecent = m.yearLeftSchool && Number(m.yearLeftSchool) >= 2015;
      return matchesSearch && matchesYear && isRecent;
    }
    if (activeTab === 'with_profession') {
      return matchesSearch && matchesYear && !!m.occupation;
    }
    return matchesSearch && matchesYear;
  });

  const yearOptions = [
    { label: 'All Years', value: '' },
    ...years.map(y => ({ label: `Class of ${y}`, value: String(y) }))
  ];

  const canViewField = (member: User, field: keyof User['privacySettings']) => {
    if (userProfile?.uid === member.uid) return true;
    const setting = member.privacySettings?.[field];
    if (typeof setting === 'boolean') return setting;

    const effectiveSetting = setting || (
      (field === 'phone' || field === 'email' || field === 'whatsapp') ? 'committee_only' : 'visible_to_verified_members'
    );

    if (effectiveSetting === 'hidden') return false;
    if (effectiveSetting === 'committee_only') return !!isAdminOrCommittee;
    if (effectiveSetting === 'visible_to_verified_members') return userProfile?.status === 'approved';
    return false;
  };

  return (
    <div className="max-w-4xl mx-auto w-full pb-20 animate-in fade-in duration-300">
      
      {/* STICKY TITLE HEADER (Light Grey Highlighted) */}
      <div className="sticky top-0 z-30 bg-slate-100/95 dark:bg-slate-850/95 backdrop-blur-md px-4 sm:px-6 py-3.5 border-b border-slate-200/90 dark:border-slate-700/80 mb-5 flex items-center justify-between gap-3 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-blue-950 dark:text-blue-100">
              Alumni Directory
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Connect with verified MAMAS members & alumni
          </p>
        </div>
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-200/80 dark:bg-slate-800 px-2.5 py-1 rounded-full">
          {safeMembers.length} Members
        </div>
      </div>

      <div className="px-4 sm:px-6 space-y-4">
        {/* WHATSAPP COMMUNITY BANNER - QUIET SURFACE */}
        {appSettings?.whatsappGroupLink && (
          <div className="bg-white dark:bg-[#0c1731] rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-100 dark:border-emerald-900/40">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" stroke="none">
                  <path d="M12.031 21.031c-1.854 0-3.669-.475-5.289-1.374l-5.882 1.543 1.572-5.733a8.966 8.966 0 0 1-1.408-4.887C1.025 5.584 5.952 0 12.031 0s11.006 5.584 11.006 10.58c0 4.996-4.927 10.451-11.006 10.451zM11.97 2.09c-4.981 0-9.034 3.993-9.034 8.904 0 1.623.435 3.208 1.258 4.606l-1.077 3.931 4.025-1.055a9.01 9.01 0 0 0 4.828 1.38c4.981 0 9.034-3.993 9.034-8.904 0-4.912-4.053-8.905-9.034-8.905zm4.846 12.016c-.266-.134-1.575-.776-1.819-.865-.244-.09-.422-.134-.6.134-.178.269-.689.865-.845 1.044-.155.179-.311.202-.578.067-.266-.134-1.124-.413-2.142-1.321-.792-.705-1.326-1.575-1.482-1.844-.155-.269-.016-.414.117-.548.12-.12.266-.312.4-.469.133-.156.178-.268.266-.448.089-.179.045-.336-.022-.47-.067-.134-.6-1.444-.822-1.979-.217-.521-.437-.45-.6-.458-.155-.008-.333-.008-.511-.008-.178 0-.467.067-.711.336-.244.269-.933.913-.933 2.228s.956 2.585 1.089 2.763c.133.179 1.884 2.877 4.564 4.032.639.275 1.137.439 1.526.562.641.203 1.224.174 1.685.105.516-.076 1.575-.643 1.797-1.264.222-.622.222-1.155.155-1.264-.067-.112-.244-.179-.511-.313z" fill="currentColor"/>
                </svg>
              </div>
              <div className="min-w-0">
                <h2 className="text-xs font-semibold text-slate-900 dark:text-white truncate">Official Alumni WhatsApp Group</h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">Join fellow MAMAS alumni for community updates</p>
              </div>
            </div>
            
            <button 
              type="button"
              onClick={() => openExternalUrl(appSettings.whatsappGroupLink)}
              className="shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-1.5 px-3 rounded-xl text-xs transition-colors cursor-pointer"
            >
              Join Group
            </button>
          </div>
        )}

        {/* SEARCH & FILTER CONTROLS */}
        <div className="space-y-2.5">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search alumni by name, profession, or district..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 bg-white dark:bg-[#0c1731] border border-slate-200/80 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400 shadow-xs"
              />
            </div>
            <div className="w-full sm:w-48 shrink-0">
              <SelectDropdown
                options={yearOptions}
                value={yearFilter}
                onChange={setYearFilter}
                placeholder="All Class Years"
              />
            </div>
          </div>

          {/* Segmented Filter Bar */}
          <div className="bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl flex gap-1 border border-slate-200/80 dark:border-slate-700/60 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('all')}
              className={`flex-1 min-w-[70px] py-1.5 px-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer text-center ${
                activeTab === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All Members
            </button>
            <button
              onClick={() => setActiveTab('with_profession')}
              className={`flex-1 min-w-[100px] py-1.5 px-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer text-center ${
                activeTab === 'with_profession'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              By Profession
            </button>
            <button
              onClick={() => setActiveTab('recent')}
              className={`flex-1 min-w-[90px] py-1.5 px-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer text-center ${
                activeTab === 'recent'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Recent Classes
            </button>
          </div>
        </div>

        {/* MEMBER LIST */}
        {loading ? (
          <div className="flex justify-center py-16 bg-white dark:bg-[#0c1731] rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <div className="w-6 h-6 border-2 border-blue-200 dark:border-blue-900 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#0c1731] rounded-2xl border border-slate-200/80 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/80 overflow-hidden shadow-xs">
            {filteredMembers.length === 0 ? (
              <div className="text-center py-12 px-4 text-xs text-slate-400 dark:text-slate-500">
                No alumni members found matching your search.
              </div>
            ) : (
              filteredMembers.map(member => {
                const initials = member.fullName ? member.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : 'AM';
                return (
                  <div 
                    key={member.uid} 
                    onClick={() => setSelectedMember(member)}
                    className="p-3 sm:p-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {member.profilePictureUrl ? (
                        <img src={member.profilePictureUrl} alt={member.fullName} className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 font-semibold text-xs shrink-0">
                          {initials}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {member.fullName}
                          </h3>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                          <span>{member.yearLeftSchool ? `Class of ${member.yearLeftSchool}` : 'Alumni'}</span>
                          {member.occupation && canViewField(member, 'profession') && (
                            <>
                              <span>•</span>
                              <span className="truncate text-slate-600 dark:text-slate-400">{member.occupation}</span>
                            </>
                          )}
                          {member.district && canViewField(member, 'location') && (
                            <>
                              <span>•</span>
                              <span className="truncate">{member.district}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <StatusBadge status={member.status || 'approved'} />
                      <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Profile Detail Modal */}
      <AnimatePresence>
        {selectedMember && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs"
              onClick={() => setSelectedMember(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="relative bg-white dark:bg-[#0c1731] w-full max-w-sm rounded-2xl shadow-xl overflow-hidden border border-slate-200/80 dark:border-slate-800 z-10"
            >
              {/* Header */}
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Member Details
                </span>
                <button 
                  onClick={() => setSelectedMember(null)} 
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="p-5">
                {/* Avatar & Title */}
                <div className="flex items-center gap-3.5 mb-4">
                  {selectedMember.profilePictureUrl ? (
                    <img src={selectedMember.profilePictureUrl} alt={selectedMember.fullName} className="w-14 h-14 rounded-2xl object-cover border border-slate-200 dark:border-slate-700" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 font-semibold text-base">
                      {selectedMember.fullName ? selectedMember.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : 'AM'}
                    </div>
                  )}

                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white truncate">
                      {selectedMember.fullName}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                        {selectedMember.yearLeftSchool ? `Class of ${selectedMember.yearLeftSchool}` : 'Alumni'}
                      </span>
                      <StatusBadge status={selectedMember.status || 'approved'} />
                    </div>
                  </div>
                </div>
                
                {/* Meta Rows */}
                <div className="space-y-2 mb-5">
                  {selectedMember.occupation && canViewField(selectedMember, 'profession') && (
                    <div className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                      <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{selectedMember.occupation}</span>
                    </div>
                  )}
                  {selectedMember.district && canViewField(selectedMember, 'location') && (
                    <div className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{selectedMember.district}</span>
                    </div>
                  )}
                </div>
                
                {/* Contact actions */}
                <div>
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                    Contact Channels
                  </h4>
                  
                  {(canViewField(selectedMember, 'phone') || canViewField(selectedMember, 'email') || canViewField(selectedMember, 'whatsapp')) ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        {canViewField(selectedMember, 'phone') && selectedMember.phoneNumber && (
                          <button 
                            type="button"
                            onClick={() => openTel(selectedMember.phoneNumber!)}
                            className="flex-1 flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                          >
                            <Phone className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> 
                            <span>Call</span>
                          </button>
                        )}
                        {canViewField(selectedMember, 'whatsapp') && selectedMember.phoneNumber && (
                          <button 
                            type="button"
                            onClick={() => openWhatsApp(selectedMember.phoneNumber!)}
                            className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5" /> 
                            <span>WhatsApp</span>
                          </button>
                        )}
                      </div>
                      
                      {canViewField(selectedMember, 'email') && selectedMember.email && (
                        <button 
                          type="button"
                          onClick={() => openMailto(selectedMember.email!)}
                          className="w-full flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700/80 transition-colors cursor-pointer"
                        >
                          <Mail className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" /> 
                          <span className="truncate">{selectedMember.email}</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-center border border-slate-100 dark:border-slate-800">
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1.5">
                        <UserIcon className="w-3.5 h-3.5" /> 
                        <span>Contact details kept private by member</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
