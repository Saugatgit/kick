
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { User, FutsalVenue, UserRole } from '../types';

const AdminDashboard: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [venues, setVenues] = useState<FutsalVenue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [u, v] = await Promise.all([api.getAllUsers(), api.getVenues()]);
    setUsers(u);
    setVenues(v);
    setLoading(false);
  };

  const handleDeleteUser = async (userToDelete: User) => {
  if (userToDelete.role === UserRole.ADMIN) {
    alert("Security restriction: Admin accounts cannot be deleted.");
    return;
  }

  const message = userToDelete.role === UserRole.OWNER
    ? `Are you sure you want to delete OWNER "${userToDelete.name}"?\n\nThis will permanently delete:\n✅ User account: ${userToDelete.email}\n✅ ALL their venues\n✅ ALL bookings for their venues\n\nThis action cannot be undone!`
    : `Are you sure you want to delete USER "${userToDelete.name}"?`;

  if (window.confirm(message)) {
    
    const success = await api.deleteUser(userToDelete.id);
    
    if (success) {
      alert(`✅ User "${userToDelete.name}" deleted successfully${
        userToDelete.role === UserRole.OWNER ? ' along with all their venues and bookings' : ''
      }!`);
      
      // Refresh the data
      loadData();
      
      // Clear venue cache globally
      localStorage.removeItem('kickoff_venues');
      localStorage.removeItem('cached_venues');
      
      // Trigger app-wide refresh if available
      if (props.onRefresh) {
        props.onRefresh();
      }
    } else {
      alert('❌ Failed to delete user. Please try again.');
    }
  }
};

  const renderAvatar = (u: User) => {
    if (!u.avatar || u.avatar.length < 5) {
      return (
        <div className="w-8 h-8 rounded-full border border-slate-100 bg-slate-50 flex items-center justify-center text-sm">
          {u.avatar || '😊'}
        </div>
      );
    }
    return <img src={u.avatar} className="w-8 h-8 rounded-full object-cover" alt="" />;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-12">
        <h1 className="text-3xl font-bold text-slate-800">System Administration</h1>
        <p className="text-slate-500">Monitor all activities across the platform</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-bold text-slate-800 text-lg">User Management</h3>
              <span className="bg-slate-200 px-3 py-1 rounded-full text-xs font-bold text-slate-600">
                {users.length} Total Users
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-slate-400 text-xs font-bold uppercase tracking-widest border-b border-slate-50">
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 flex items-center gap-3">
                        {renderAvatar(u)}
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{u.name}</p>
                          <p className="text-xs text-slate-400">{u.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold tracking-tight uppercase ${
                          u.role === UserRole.ADMIN ? 'bg-purple-100 text-purple-700' :
                          u.role === UserRole.OWNER ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-semibold text-green-500">Active</td>
                      <td className="px-6 py-4">
                        {u.role !== UserRole.ADMIN ? (
                          <button 
                            onClick={() => handleDeleteUser(u)}
                            className="text-red-400 hover:text-red-600 transition-colors"
                            title="Delete User"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          </button>
                        ) : (
                          <span className="text-slate-300 cursor-not-allowed" title="Admin accounts cannot be deleted">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                            </svg>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-xl shadow-slate-200">
            <h3 className="text-xl font-bold mb-6">Platform Pulse</h3>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-400">Venue Utilization</span>
                  <span>78%</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full">
                  <div className="w-[78%] h-full bg-green-500 rounded-full"></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-400">Monthly Target</span>
                  <span>$12,400 / $15k</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full">
                  <div className="w-[82%] h-full bg-blue-500 rounded-full"></div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-200">
            <h3 className="font-bold text-slate-800 mb-4">Pending Approvals</h3>
            <div className="space-y-4">
              <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="font-bold text-orange-800 text-sm">SkyHigh Sports</p>
                  <p className="text-xs text-orange-600">New Venue Request</p>
                </div>
                <button className="text-xs bg-orange-600 text-white px-3 py-1 rounded-full font-bold">Review</button>
              </div>
              <p className="text-xs text-slate-400 text-center">No other pending items</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
