import React, { useEffect, useState } from 'react';
import { User } from '../types';
import { SelectDropdown } from '../components/SelectDropdown';
import { db } from '../firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { Search, MapPin, Briefcase, Phone, Mail, MessageSquare, X, ChevronRight, School, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';

export default function Directory() {
  const { userProfile, isAdminOrCommittee } = useAuth();
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  
  const [selectedMember, setSelectedMember] = useState<User | null>(null);
  const [appSettings, setAppSettings] = useState<any>(null);

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
    const matchesSearch = fullName.includes(s);
    const matchesYear = yearFilter ? String(m.yearLeftSchool || '') === yearFilter : true;
    return matchesSearch && matchesYear;
  });

  const yearOptions = [
    { label: 'All Years', value: '' },
    ...years.map(y => ({ label: String(y), value: String(y) }))
  ];

  const canViewField = (member: User, field: keyof User['privacySettings']) => {
    // If it's the current user, they can always view their own fields
    if (userProfile?.uid === member.uid) return true;
    
    const setting = member.privacySettings?.[field];
    
    // Legacy support for boolean settings
    if (typeof setting === 'boolean') {
      return setting;
    }

    // Default privacy if undefined is 'visible_to_verified_members' for most fields except contact info
    const effectiveSetting = setting || (
      (field === 'phone' || field === 'email' || field === 'whatsapp') ? 'committee_only' : 'visible_to_verified_members'
    );

    if (effectiveSetting === 'hidden') return false;
    if (effectiveSetting === 'committee_only') return !!isAdminOrCommittee;
    if (effectiveSetting === 'visible_to_verified_members') return userProfile?.status === 'approved';
    
    return false;
  };

  return (
    <div className="space-y-6 pb-28 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">Alumni Directory</h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">Connect with verified MAMAS members</p>
        </div>
      </div>

      {/* WHATSAPP COMMUNITY BANNER */}
      {appSettings?.whatsappGroupLink && (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl p-4 shadow-sm border border-emerald-100 dark:border-emerald-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-emerald-500/20">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" stroke="none"><path d="M12.031 21.031c-1.854 0-3.669-.475-5.289-1.374l-5.882 1.543 1.572-5.733a8.966 8.966 0 0 1-1.408-4.887C1.025 5.584 5.952 0 12.031 0s11.006 5.584 11.006 10.58c0 4.996-4.927 10.451-11.006 10.451zM11.97 2.09c-4.981 0-9.034 3.993-9.034 8.904 0 1.623.435 3.208 1.258 4.606l-1.077 3.931 4.025-1.055a9.01 9.01 0 0 0 4.828 1.38c4.981 0 9.034-3.993 9.034-8.904 0-4.912-4.053-8.905-9.034-8.905zm4.846 12.016c-.266-.134-1.575-.776-1.819-.865-.244-.09-.422-.134-.6.134-.178.269-.689.865-.845 1.044-.155.179-.311.202-.578.067-.266-.134-1.124-.413-2.142-1.321-.792-.705-1.326-1.575-1.482-1.844-.155-.269-.016-.414.117-.548.12-.12.266-.312.4-.469.133-.156.178-.268.266-.448.089-.179.045-.336-.022-.47-.067-.134-.6-1.444-.822-1.979-.217-.521-.437-.45-.6-.458-.155-.008-.333-.008-.511-.008-.178 0-.467.067-.711.336-.244.269-.933.913-.933 2.228s.956 2.585 1.089 2.763c.133.179 1.884 2.877 4.564 4.032.639.275 1.137.439 1.526.562.641.203 1.224.174 1.685.105.516-.076 1.575-.643 1.797-1.264.222-.622.222-1.155.155-1.264-.067-.112-.244-.179-.511-.313z" fill="currentColor"/></svg>
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900 dark:text-emerald-50 tracking-tight">Alumni WhatsApp Group</h2>
              <p className="text-xs text-slate-500 dark:text-emerald-200/70 mt-0.5 truncate">Join the official MAMAS community</p>
            </div>
          </div>
          
          <div className="shrink-0">
            <a 
              href={appSettings.whatsappGroupLink}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 px-4 rounded-xl text-xs shadow-sm shadow-emerald-500/20 active:scale-95 transition-all text-center"
            >
              Join Group
            </a>
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-white dark:bg-[#0c1731] rounded-3xl p-4 shadow-xs border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
          />
        </div>
        <div className="w-full sm:w-44 shrink-0">
          <SelectDropdown
            options={yearOptions}
            value={yearFilter}
            onChange={setYearFilter}
            placeholder="All Years"
          />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-3 border-blue-200 dark:border-blue-900 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filteredMembers.length === 0 ? (
            <div className="col-span-full text-center py-12 text-slate-400 dark:text-slate-500 bg-white dark:bg-[#0c1731] rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              No members found matching your search.
            </div>
          ) : (
            filteredMembers.map(member => {
              const initials = member.fullName ? member.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : 'AM';
              return (
                <div 
                  key={member.uid} 
                  onClick={() => setSelectedMember(member)}
                  className="bg-white dark:bg-[#0c1731] rounded-3xl p-4 shadow-xs border border-slate-200/80 dark:border-slate-800 hover:border-blue-500/50 dark:hover:border-blue-500/50 flex items-center gap-4 cursor-pointer hover:shadow-md transition-all active:scale-[0.98]"
                >
                  {member.profilePictureUrl ? (
                    <img src={member.profilePictureUrl} alt={member.fullName} className="w-12 h-12 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900 flex items-center justify-center text-blue-700 dark:text-blue-300 font-extrabold text-sm shrink-0">
                      {initials}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">{member.fullName}</h3>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5 mt-1">
                      <School className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" /> 
                      {member.yearLeftSchool ? `Class of ${member.yearLeftSchool}` : 'Alumni'}
                      {member.district && canViewField(member, 'location') && <span className="opacity-50 mx-0.5">•</span>}
                      {member.district && canViewField(member, 'location') && <span className="truncate">{member.district}</span>}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Profile Modal */}
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
              className="relative bg-white dark:bg-[#0c1731] w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border border-slate-200/80 dark:border-slate-800"
            >
              {/* Cover / Header */}
              <div className="h-28 bg-gradient-to-r from-[#07132c] via-[#0f2756] to-[#1e3a8a] relative">
                <button onClick={() => setSelectedMember(null)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/30 text-white flex items-center justify-center hover:bg-black/50 transition-colors z-10 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="px-6 pb-6 relative">
                {/* Avatar */}
                <div className="-mt-14 mb-3 flex justify-center relative z-10">
                  {selectedMember.profilePictureUrl ? (
                    <img src={selectedMember.profilePictureUrl} alt={selectedMember.fullName} className="w-28 h-28 rounded-2xl object-cover border-4 border-white dark:border-[#0c1731] bg-white dark:bg-[#0c1731] shadow-md" />
                  ) : (
                    <div className="w-28 h-28 rounded-2xl border-4 border-white dark:border-[#0c1731] bg-blue-50 dark:bg-blue-950/80 flex items-center justify-center text-blue-700 dark:text-blue-300 font-extrabold text-3xl shadow-md border-blue-200 dark:border-blue-900">
                      {selectedMember.fullName ? selectedMember.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : 'AM'}
                    </div>
                  )}
                </div>
                
                <div className="text-center mb-6">
                  <h3 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">{selectedMember.fullName}</h3>
                  <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-1 uppercase tracking-wider">Class of {selectedMember.yearLeftSchool || 'Unknown'}</p>
                </div>
                
                <div className="space-y-2 mb-6">
                  {selectedMember.district && canViewField(selectedMember, 'location') && (
                    <div className="flex items-center gap-3 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <MapPin className="w-4 h-4 text-blue-500 dark:text-blue-400 shrink-0" />
                      <span className="truncate">{selectedMember.district}</span>
                    </div>
                  )}
                  {selectedMember.occupation && canViewField(selectedMember, 'profession') && (
                    <div className="flex items-center gap-3 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <Briefcase className="w-4 h-4 text-blue-500 dark:text-blue-400 shrink-0" />
                      <span className="truncate">{selectedMember.occupation}</span>
                    </div>
                  )}
                </div>
                
                {/* Contact actions */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3 px-1">Contact Details</h4>
                  
                  {(canViewField(selectedMember, 'phone') || canViewField(selectedMember, 'email') || canViewField(selectedMember, 'whatsapp')) ? (
                    <div className="flex flex-col gap-2.5">
                      <div className="flex gap-2.5">
                        {canViewField(selectedMember, 'phone') && selectedMember.phoneNumber && (
                          <a href={`tel:${selectedMember.phoneNumber}`} className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white py-3 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]">
                            <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Call
                          </a>
                        )}
                        {canViewField(selectedMember, 'whatsapp') && selectedMember.phoneNumber && (
                          <a href={`https://wa.me/${selectedMember.phoneNumber.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-2xl text-sm font-bold shadow-xs transition-all active:scale-[0.98]">
                            <MessageSquare className="w-4 h-4" /> WhatsApp
                          </a>
                        )}
                      </div>
                      
                      {canViewField(selectedMember, 'email') && selectedMember.email && (
                         <a href={`mailto:${selectedMember.email}`} className="w-full flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 py-3 rounded-2xl text-sm font-bold transition-all border border-slate-200 dark:border-slate-700/80 active:scale-[0.98]">
                           <Mail className="w-4 h-4 text-blue-500 dark:text-blue-400" /> {selectedMember.email}
                         </a>
                      )}
                    </div>
                  ) : (
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl text-center border border-slate-100 dark:border-slate-800">
                      <p className="text-xs font-bold text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1.5 uppercase tracking-wide">
                        <UserIcon className="w-3.5 h-3.5" /> Contact details kept private
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
