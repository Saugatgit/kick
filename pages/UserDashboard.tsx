import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Booking, FutsalVenue, TIME_SLOTS } from '../types';
import { useAuth } from '../App';

interface UserDashboardProps {
  onBook: () => void;
}

const UserDashboard: React.FC<UserDashboardProps> = ({ onBook }) => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<(Booking & { venue?: FutsalVenue })[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<Booking & { venue?: FutsalVenue } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const userBookings = await api.getUserBookings(user.id);
      
      // Filter out only CANCELLED bookings, keep PENDING and CONFIRMED
      const activeBookings = userBookings
        .filter(b => b.status !== 'CANCELLED')
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setBookings(activeBookings);
    } catch (error) {
      console.error('Error loading user dashboard data:', error);
      alert('Failed to load your bookings. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!window.confirm("Are you sure you want to cancel this booking?")) return;
    
    try {
      const success = await api.cancelBooking(id);
      if (success) {
        alert('Booking cancelled successfully!');
        loadData(); // Refresh the bookings list
      } else {
        alert('Failed to cancel booking. Please try again.');
      }
    } catch (error) {
      console.error('Error cancelling booking:', error);
      alert('An error occurred. Please try again.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Welcome, {user?.name}</h1>
          <p className="text-slate-500">Manage your bookings and upcoming matches</p>
        </div>
        <button 
          onClick={onBook}
          className="px-6 py-3 bg-green-600 text-white font-bold rounded-xl shadow-lg shadow-green-100 hover:bg-green-700 transition-all"
        >
          Book New Match
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <h2 className="text-xl font-bold text-slate-800 mb-4">My Active Bookings</h2>
          
          {loading ? (
            <div className="space-y-4">
              {[1,2,3].map(n => <div key={n} className="h-24 bg-white animate-pulse rounded-2xl"></div>)}
            </div>
          ) : bookings.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-3xl border border-slate-200">
              <p className="text-slate-400 mb-4 text-lg">No active bookings found.</p>
              <button onClick={onBook} className="text-green-600 font-bold hover:underline">
                Start Playing Today
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {bookings.map(booking => (
                <div key={booking.id} className="bg-white p-6 rounded-2xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedBooking(booking)}>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden">
                      <img src={booking.venue?.images?.[0]} className="w-full h-full object-cover" alt={booking.venue?.name} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-lg">{booking.venue?.name}</h4>
                      <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                        <span>{booking.date}</span>
                        <span>•</span>
                        <span>{TIME_SLOTS[booking.slotIndex]}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      booking.status === 'CONFIRMED' 
                        ? 'bg-green-100 text-green-700' 
                        : booking.status === 'CANCELLED'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {booking.status}
                    </span>
                    <button
                      onClick={(event) => { event.stopPropagation(); setSelectedBooking(booking); }}
                      className="text-blue-500 text-sm font-semibold hover:bg-blue-50 px-3 py-1 rounded-lg transition-colors"
                    >
                      View Details
                    </button>
                    {booking.status === 'CONFIRMED' && (
                      <button 
                        onClick={(event) => { event.stopPropagation(); handleCancel(booking.id); }}
                        className="text-red-500 text-sm font-semibold hover:bg-red-50 px-3 py-1 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedBooking && (
            <div className="mt-8" onClick={() => setSelectedBooking(null)}>
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-800">Booking Details</h3>
                    <p className="text-slate-500">Click outside or close to continue browsing bookings.</p>
                  </div>
                  <button onClick={() => setSelectedBooking(null)} className="text-red-500 hover:text-red-700 font-semibold">Close</button>
                </div>

<div className="mt-4 space-y-4">
                <div className="flex justify-between">
                  <span className="text-slate-500">Status:</span>
                  <span className={`font-bold ${selectedBooking.status === 'CONFIRMED' ? 'text-green-600' : 'text-red-600'}`}>
                    {selectedBooking.status}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-slate-500">Date:</span>
                  <span className="font-semibold">{selectedBooking.date}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-slate-500">Time Slot:</span>
                  <span className="font-semibold">{TIME_SLOTS[selectedBooking.slotIndex]}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-slate-500">Slot Number:</span>
                  <span className="font-semibold">Slot {selectedBooking.slotIndex + 1}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-slate-500">Total:</span>
                  <span className="font-semibold">₨{selectedBooking.totalAmount?.toFixed(2) ?? '0.00'}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-slate-500">Offline Block:</span>
                  <span className="font-semibold">{selectedBooking.isOfflineBlock ? 'Yes' : 'No'}</span>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-sm text-slate-500">Booking ID: {selectedBooking.id}</p>
                </div>

              </div>
            </div>
          )}

        </div>

        <div>
          <h2 className="text-xl font-bold text-slate-800 mb-4">Account Stats</h2>
          <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Active Bookings</span>
              <span className="font-bold text-slate-800">
                {bookings.filter(b => b.status === 'CONFIRMED').length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Pending Approval</span>
              <span className="font-bold text-yellow-600">
                {bookings.filter(b => b.status === 'PENDING').length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Total Bookings</span>
              <span className="font-bold text-green-600">{bookings.length}</span>
            </div>
            <div className="pt-4 border-t border-slate-100">
              <p className="text-sm text-slate-500 mb-2">Need help?</p>
              <button 
                onClick={() => window.location.href = 'mailto:support@kickoff.com'}
                className="text-sm text-green-600 font-semibold hover:underline"
              >
                Contact Support
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;