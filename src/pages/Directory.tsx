import React, { useEffect, useState } from 'react';
import { User } from '../types';

export default function Directory() {
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const response = await fetch('/api/directory');
        if (!response.ok) throw new Error("Failed to fetch directory data");
        const fetchedMembers = await response.json();
        // Sort client-side by full name
        fetchedMembers.sort((a: User, b: User) => a.fullName.localeCompare(b.fullName));
        setMembers(fetchedMembers);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchMembers();
  }, []);

  const years = Array.from(new Set(members.map(m => m.yearLeftSchool))).sort((a, b) => String(b).localeCompare(String(a)));
  const districts = Array.from(new Set(members.map(m => m.district))).sort();

  const filteredMembers = members.filter(m => {
    const matchesSearch = m.fullName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesYear = yearFilter ? m.yearLeftSchool === yearFilter : true;
    const matchesDistrict = districtFilter ? m.district === districtFilter : true;
    return matchesSearch && matchesYear && matchesDistrict;
  });

  return (
    <div className="space-y-6">
      <div className="bg-mamas-card rounded-lg shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-mamas-text">Alumni Directory</h2>
          <p className="text-mamas-text-muted text-sm mt-1">Connect with fellow MAMAS members.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row w-full md:w-auto gap-3">
          <input
            type="text"
            placeholder="Search by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-48 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-mamas-primary focus:border-mamas-primary sm:text-sm"
          />
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="w-full sm:w-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-mamas-primary focus:border-mamas-primary sm:text-sm"
          >
            <option value="">All Years</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select
            value={districtFilter}
            onChange={(e) => setDistrictFilter(e.target.value)}
            className="w-full sm:w-36 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-mamas-primary focus:border-mamas-primary sm:text-sm"
          >
            <option value="">All Districts</option>
            {districts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-mamas-text-muted">Loading directory...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMembers.length === 0 ? (
            <div className="col-span-full text-center py-12 text-mamas-text-muted bg-mamas-card rounded-lg border border-slate-200">
              No members found matching your filters.
            </div>
          ) : (
            filteredMembers.map(member => (
              <div key={member.uid} className="bg-mamas-card rounded-lg shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                <div className="p-6 flex-1">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="h-16 w-16 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                      {member.profilePictureUrl ? (
                        <img src={member.profilePictureUrl} alt={member.fullName} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-xl font-bold text-mamas-text-muted">
                          {member.fullName.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-mamas-text">{member.fullName}</h3>
                      <p className="text-sm text-mamas-text-muted">Class of {member.yearLeftSchool}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm text-mamas-text-muted">
                    <p><span className="font-medium text-mamas-text">District:</span> {member.district}</p>
                    <p><span className="font-medium text-mamas-text">Occupation:</span> {member.occupation}</p>
                    <p><span className="font-medium text-mamas-text">Residence:</span> {member.placeOfResidence}</p>
                  </div>
                </div>
                
                <div className="bg-mamas-bg px-6 py-4 border-t border-slate-200 text-sm">
                  {member.privacySettings?.showPhone || member.privacySettings?.showEmail ? (
                    <div className="space-y-1">
                      {member.privacySettings?.showPhone && (
                        <p className="flex items-center gap-2 text-gray-700">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                          <a href={`tel:${member.phoneNumber}`} className="hover:text-mamas-text">{member.phoneNumber}</a>
                        </p>
                      )}
                      {member.privacySettings?.showEmail && member.email && (
                        <p className="flex items-center gap-2 text-gray-700">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                          <a href={`mailto:${member.email}`} className="hover:text-mamas-text">{member.email}</a>
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-mamas-text-muted italic">Contact details are private.</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
