import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { Trophy, Award, Medal, Users, ChevronRight, School, MapPin, Briefcase, Phone, Mail, MessageSquare, X, User as UserIcon } from 'lucide-react';
import { User } from '../types';
import { formatUGX } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';

export default function TopContributors() {
  const { userProfile, isAdminOrCommittee } = useAuth();
  const [contributors, setContributors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<User | null>(null);

  useEffect(() => {
    async function fetchTopContributors() {
      try {
        const [usersSnap, profilesSnap] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'directoryProfiles'))
        ]);

        const profileMap = new Map<string, any>();
        profilesSnap.docs.forEach(d => {
          profileMap.set(d.id, d.data());
        });

        const list = usersSnap.docs
          .map(doc => {
            const data = doc.data();
            const prof = profileMap.get(doc.id) || {};
            return {
              uid: doc.id,
              ...data,
              ...prof, // Merge safe profile fields
              totalContributed: Number(data.totalContributed) || 0,
              fullName: data.fullName || prof.fullName || 'Alumni Member',
              yearLeftSchool: data.yearLeftSchool || prof.yearLeftSchool,
              district: data.district || prof.district,
              occupation: data.occupation || prof.occupation,
              profilePictureUrl: data.profilePictureUrl || prof.profilePictureUrl,
              status: data.status || prof.status || 'approved',
              privacySettings: data.privacySettings || prof.privacySettings || {}
            };
          })
          .filter(u => ['approved', 'active'].includes((u.status || '').toLowerCase()) && (u.totalContributed > 0))
          .sort((a, b) => b.totalContributed - a.totalContributed);

        setContributors(list);
      } catch (err) {
        console.error("Error fetching top contributors:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchTopContributors();
  }, []);

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
    <div className="max-w-3xl mx-auto w-full pb-20 animate-in fade-in duration-300">
      
      {/* STICKY PAGE TITLE HEADER */}
      <div className="sticky top-16 z-30 bg-mamas-bg/95 backdrop-blur-md py-4 mb-4 border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Top Contributors</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Recognizing alumni dedicated to our collective solidarity and growth</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-3 border-blue-200 dark:border-blue-900 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
      ) : contributors.length === 0 ? (
        <div className="py-12 text-center text-slate-400">
          <Trophy className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" strokeWidth={1.5} />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No Contribution Records Yet</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">When members pay dues or back campaigns, the verified leaderboard will appear here.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
          {contributors.map((member, index) => {
            const rank = index + 1;
            const rankLabel = rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : `${rank}th`;
            const initials = member.fullName ? member.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : 'AM';

            const badgeBg = rank === 1 
              ? 'bg-amber-500 text-slate-950 border-amber-400' 
              : rank === 2 
              ? 'bg-slate-300 dark:bg-slate-700 text-slate-900 dark:text-white border-slate-400' 
              : rank === 3 
              ? 'bg-amber-700 text-white border-amber-600' 
              : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';

            return (
              <div
                key={member.uid}
                onClick={() => setSelectedMember(member)}
                className="bg-white dark:bg-[#0c1731] py-3.5 px-2 sm:px-4 transition-all cursor-pointer flex items-center justify-between gap-3 sm:gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/40"
              >
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  {/* Rank Badge */}
                  <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center font-extrabold text-xs sm:text-sm border shadow-xs shrink-0 ${badgeBg}`}>
                    {rankLabel}
                  </div>

                  {/* Avatar */}
                  {member.profilePictureUrl ? (
                    <img
                      src={member.profilePictureUrl}
                      alt={member.fullName}
                      className="w-11 h-11 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-extrabold text-sm flex items-center justify-center border border-blue-200 dark:border-blue-800 shrink-0">
                      {initials}
                    </div>
                  )}

                  {/* Member Info */}
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base truncate">
                      {member.fullName}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                      <span className="flex items-center gap-1 font-medium">
                        <School className="w-3.5 h-3.5 text-blue-500" />
                        Class of {member.yearLeftSchool || '—'}
                      </span>
                      {member.district && canViewField(member, 'location') && (
                        <>
                          <span className="opacity-40">•</span>
                          <span className="truncate">{member.district}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Amount / Action */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <span className="block font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                      {formatUGX(member.totalContributed)}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500">
                      Total Contributed
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 hidden sm:block" />
                </div>
              </div>
            );
          })}
        </div>
      )}

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
                  <div className="mt-2 inline-block px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-extrabold">
                    Verified Contributions: {formatUGX(selectedMember.totalContributed || 0)}
                  </div>
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
