import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { FutsalVenue, Booking, TIME_SLOTS } from '../types';
import { useAuth } from '../App';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import L from 'leaflet';

// Toast Notification Component
const ToastNotification: React.FC<{ message: string; type: 'success' | 'error'; onClose: () => void }> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    
    return () => clearTimeout(timer);
  }, [onClose]);
  
  return (
    <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-xl shadow-xl border ${
      type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
    }`}>
      <div className="flex items-center gap-3">
        <span className={`text-xl ${type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
          {type === 'success' ? '✓' : '✕'}
        </span>
        <span className="font-semibold">{message}</span>
        <button onClick={onClose} className="ml-4 text-slate-500 hover:text-slate-700">
          ✕
        </button>
      </div>
    </div>
  );
};

const OwnerDashboard: React.FC = () => {
  const { user } = useAuth();
  const [venues, setVenues] = useState<FutsalVenue[]>([]);
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Notification State
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBookingDetailsOpen, setIsBookingDetailsOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [newVenue, setNewVenue] = useState({
    name: '',
    district: '',
    locationName: '',
    location: '', // Will be auto-formatted as "District, LocationName"
    pricePerHour: 20,
    imageUrl1: '',
    imageUrl2: '',
    description: '',
    amenities: 'Parking, Shower, WiFi'
  });

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Management State
  const [selectedVenue, setSelectedVenue] = useState<FutsalVenue | null>(null);
  const [managementDate, setManagementDate] = useState(new Date().toISOString().split('T')[0]);
  const [venueBookings, setVenueBookings] = useState<Booking[]>([]);
  const [cancelledBookings, setCancelledBookings] = useState<Booking[]>([]);
  const [pendingBookings, setPendingBookings] = useState<Booking[]>([]);
  const [togglingSlot, setTogglingSlot] = useState<number | null>(null);
  const [cancellingBooking, setCancellingBooking] = useState<string | null>(null);
  const [uncancellingBooking, setUncancellingBooking] = useState<string | null>(null);
  const [approvingBooking, setApprovingBooking] = useState<string | null>(null);
  const [rejectingBooking, setRejectingBooking] = useState<string | null>(null);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  useEffect(() => {
    if (selectedVenue) fetchVenueBookings();
  }, [selectedVenue, managementDate]);

  // Init map when modal opens
  useEffect(() => {
    if (!isAddModalOpen && mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
      markerRef.current = null;
    }
  }, [isAddModalOpen]);

  const loadData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      
      // 1. Get owner's venues
      const ownerVenues = await api.getOwnerVenues(user.id);
      setVenues(ownerVenues);
      
      // 2. Get ALL bookings for owner's venues
      const ownerBookings = await api.getOwnerBookings(user.id);
      
      // Separate confirmed and cancelled bookings
      const activeBookings = ownerBookings.filter(b => b.status === 'CONFIRMED');
      const cancelled = ownerBookings.filter(b => b.status === 'CANCELLED');
      
      
      setAllBookings(activeBookings);
      setCancelledBookings(cancelled);
      
      // 3. Auto-select first venue if none selected
      if (ownerVenues.length > 0 && !selectedVenue) {
        setSelectedVenue(ownerVenues[0]);
      }
      
    } catch (error) {
      console.error('Error loading owner dashboard data:', error);
      showNotification('Failed to load dashboard data. Please refresh.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchVenueBookings = async () => {
    if (!selectedVenue) return;
    
    try {
      const allBookings = await api.getVenueBookings(selectedVenue.id, managementDate);
      
      // Separate bookings by status
      const confirmedBookings = allBookings.filter(b => b.status === 'CONFIRMED');
      const cancelled = allBookings.filter(b => b.status === 'CANCELLED');
      const pending = allBookings.filter(b => b.status === 'PENDING');
      
      setVenueBookings(confirmedBookings);
      setPendingBookings(pending);
      setCancelledBookings(prev => {
        // Merge new cancelled bookings with existing ones, avoiding duplicates
        const merged = [...prev];
        cancelled.forEach(newCancelled => {
          if (!merged.some(b => b.id === newCancelled.id)) {
            merged.push(newCancelled);
          }
        });
        return merged;
      });
    } catch (error) {
      console.error('Error fetching venue bookings:', error);
      setVenueBookings([]);
      setPendingBookings([]);
    }
  };

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
  };

  // Handle booking cancellation by owner
  const handleCancelBooking = async (bookingId: string) => {
    if (!selectedVenue) return;
    
    setCancellingBooking(bookingId);
    try {
      const success = await api.cancelBooking(bookingId);
      
      if (success) {
        showNotification('Booking cancelled successfully!', 'success');
        // Refresh data
        await fetchVenueBookings();
        await loadData();
      } else {
        showNotification('Failed to cancel booking. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Error cancelling booking:', error);
      showNotification('An error occurred while cancelling the booking.', 'error');
    } finally {
      setCancellingBooking(null);
      setIsBookingDetailsOpen(false);
      setSelectedBooking(null);
    }
  };

  // Handle booking uncancellation (restore booking)
  const handleUncancelBooking = async (bookingId: string) => {
  if (!selectedVenue) return;
  
  setUncancellingBooking(bookingId);
  try {
    // First, check if the slot is available
    const cancelledBooking = cancelledBookings.find(b => b.id === bookingId);
    if (!cancelledBooking) {
      showNotification('Booking not found', 'error');
      return;
    }
    
    // Check if slot is now available
    const slotAlreadyBooked = venueBookings.some(b => 
      b.slotIndex === cancelledBooking.slotIndex && 
      b.date === cancelledBooking.date
    );
    
    if (slotAlreadyBooked) {
      showNotification('Cannot restore: This slot is now booked by another user', 'error');
      return;
    }
    
    // Use the uncancel function
    const success = await api.uncancelBooking(bookingId);
    
    if (success) {
      showNotification('Booking restored successfully!', 'success');
      // Refresh data
      await fetchVenueBookings();
      await loadData();
    } else {
      showNotification('Failed to restore booking. Please try again.', 'error');
    }
  } catch (error) {
    console.error('Error uncancelling booking:', error);
    showNotification('An error occurred while restoring the booking.', 'error');
  } finally {
    setUncancellingBooking(null);
  }
};

// Handle booking approval
const handleApproveBooking = async (bookingId: string) => {
  setApprovingBooking(bookingId);
  try {
    const success = await api.approveBooking(bookingId);
    
    if (success) {
      showNotification('Booking approved successfully!', 'success');
      // Refresh data
      await fetchVenueBookings();
      await loadData();
    } else {
      showNotification('Failed to approve booking. Please try again.', 'error');
    }
  } catch (error) {
    console.error('Error approving booking:', error);
    showNotification('An error occurred while approving the booking.', 'error');
  } finally {
    setApprovingBooking(null);
  }
};

// Handle booking rejection
const handleRejectBooking = async (bookingId: string) => {
  if (!window.confirm('Are you sure you want to reject this booking request?')) return;

  setRejectingBooking(bookingId);
  try {
    const success = await api.rejectBooking(bookingId);
    
    if (success) {
      showNotification('Booking rejected successfully!', 'success');
      // Refresh data
      await fetchVenueBookings();
      await loadData();
    } else {
      showNotification('Failed to reject booking. Please try again.', 'error');
    }
  } catch (error) {
    console.error('Error rejecting booking:', error);
    showNotification('An error occurred while rejecting the booking.', 'error');
  } finally {
    setRejectingBooking(null);
  }
};

// View booking details
const viewBookingDetails = (booking: Booking) => {
  setSelectedBooking(booking);
  setIsBookingDetailsOpen(true);
};

  // Helper function to get booking info for a specific slot
const getSlotBookingInfo = (index: number) => {
  // Check confirmed bookings first
  const confirmedBooking = venueBookings.find(b => b.slotIndex === index);
  if (confirmedBooking) {
    const isOffline = (confirmedBooking as any).isOfflineBlock === true;
    return {
      booking: confirmedBooking,
      isOffline,
      isUserBooking: confirmedBooking && !isOffline,
      status: 'confirmed'
    };
  }

  // Check pending bookings
  const pendingBooking = pendingBookings.find(b => b.slotIndex === index);
  if (pendingBooking) {
    return {
      booking: pendingBooking,
      isOffline: false,
      isUserBooking: true,
      status: 'pending'
    };
  }

  return null;
};

  const handleToggleSlot = async (index: number) => {
  if (!selectedVenue || !user) return;
  setTogglingSlot(index);
  try {
    
    // Find the booking for this slot
    const existingBooking = venueBookings.find(b => b.slotIndex === index);
    
    // Check if it's an offline block
    const isOfflineBlock = (existingBooking as any)?.isOfflineBlock === true;
    
    if (existingBooking && !isOfflineBlock) {
      // It's a real user booking - cannot block
      showNotification('Cannot block a slot that is booked by a user', 'error');
      return;
    }
    
    if (existingBooking && isOfflineBlock) {
      // Remove the offline booking (unblock)
      await api.cancelBooking(existingBooking.id);
      showNotification('Slot unblocked successfully!', 'success');
    } else {
      // Create offline booking to block slot
      await api.toggleOfflineBooking(selectedVenue.id, managementDate, index, user.id);
      showNotification('Slot blocked successfully!', 'success');
    }
    
    // Refresh data
    await fetchVenueBookings();
    await loadData();
  } catch (error) {
    console.error('Error toggling slot:', error);
    showNotification('Failed to update slot. Please try again.', 'error');
  } finally {
    setTogglingSlot(null);
  }
};


  const handleCreateVenue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!newVenue.imageUrl1 || !newVenue.imageUrl2) {
      showNotification("At least 2 photos are compulsory.", 'error');
      return;
    }

    try {
      await api.createVenue({
        ownerId: user.id,
        name: newVenue.name,
        location: newVenue.location,
        pricePerHour: Number(newVenue.pricePerHour),
        images: [newVenue.imageUrl1, newVenue.imageUrl2],
        description: newVenue.description,
        rating: 5.0,
        amenities: newVenue.amenities.split(',').map(s => s.trim()).filter(s => s !== '')
      });

      setIsAddModalOpen(false);
      setNewVenue({
        name: '',
        district: '',
        locationName: '',
        location: '',
        pricePerHour: 20,
        imageUrl1: '',
        imageUrl2: '',
        description: '',
        amenities: 'Parking, Shower, WiFi'
      });
      showNotification('Venue created successfully!', 'success');
      loadData();
    } catch (error) {
      console.error('Error creating venue:', error);
      showNotification('Failed to create venue. Please try again.', 'error');
    }
  };

  // Update chart data to only count CONFIRMED bookings
  // If a specific venue is selected, show its bookings; otherwise show all for the management date
  const bookingsForChart = selectedVenue 
    ? venueBookings.filter(b => b.status === 'CONFIRMED') 
    : allBookings.filter(b => b.status === 'CONFIRMED' && b.date === managementDate);
  
  const chartData = TIME_SLOTS.map((slot, index) => ({
    name: slot.split(' ')[0],
    count: bookingsForChart.filter(b => b.slotIndex === index).length
  }));

  // Get today's active bookings for the selected venue
  // Note: venueBookings is already filtered by managementDate in fetchVenueBookings()
  const todayActiveBookings = venueBookings;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Notification Toast */}
      {notification && (
        <ToastNotification 
          message={notification.message} 
          type={notification.type} 
          onClose={() => setNotification(null)} 
        />
      )}

      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Owner Dashboard</h1>
          <p className="text-slate-500">Analytics and management for your facilities</p>
        </div>
        <button onClick={() => setIsAddModalOpen(true)} className="px-6 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-green-600 shadow-lg transition-colors">
          + Register New Venue
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-sm font-bold uppercase tracking-widest text-[10px]">Active Venues</p>
          <p className="text-3xl font-bold text-slate-800">{venues.length}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-sm font-bold uppercase tracking-widest text-[10px]">Active Bookings</p>
          <p className="text-3xl font-bold text-slate-800">
            {allBookings.length}
          </p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-sm font-bold uppercase tracking-widest text-[10px]">Revenue (EST)</p>
          <p className="text-3xl font-bold text-green-600">
            ${allBookings.length * 25}
          </p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-sm font-bold uppercase tracking-widest text-[10px]">Cancelled</p>
          <p className="text-3xl font-bold text-red-600">
            {cancelledBookings.length}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        <div className="bg-white p-8 rounded-3xl border border-slate-200">
          <h3 className="text-xl font-bold text-slate-800 mb-6">Booking Density (By Hour)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none'}} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.count > 0 ? '#16a34a' : '#f1f5f9'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-200">
          <h3 className="text-xl font-bold text-slate-800 mb-6">Your Venues</h3>
          <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(n => (
                  <div key={n} className="h-16 bg-slate-100 animate-pulse rounded-2xl"></div>
                ))}
              </div>
            ) : venues.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <p>No venues registered yet.</p>
                <button 
                  onClick={() => setIsAddModalOpen(true)}
                  className="text-green-600 font-semibold mt-2 hover:underline"
                >
                  Create your first venue
                </button>
              </div>
            ) : (
              venues.map(venue => (
                <div key={venue.id} className="flex items-center justify-between p-4 border border-slate-100 rounded-2xl hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <img src={venue.images[0]} className="w-12 h-12 rounded-lg object-cover" alt={venue.name} />
                    <div>
                      <p className="font-bold text-slate-800">{venue.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{venue.location}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedVenue(venue)}
                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${
                      selectedVenue?.id === venue.id 
                        ? 'bg-green-600 text-white' 
                        : 'text-green-600 hover:bg-green-50'
                    }`}
                  >
                    Manage
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {selectedVenue && (
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl animate-in fade-in slide-in-from-bottom-4">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-bold text-slate-800">
              Manage Availability: {selectedVenue.name}
            </h2>
            <div className="flex items-center gap-4">
              <input 
                type="date"
                value={managementDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setManagementDate(e.target.value)}
                className="px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500"
              />
              <button 
                onClick={() => setSelectedVenue(null)} 
                className="text-slate-400 hover:text-slate-600 transition-colors"
                title="Close"
              >
                ✕
              </button>
            </div>
          </div>
          
          {/* Today's Active Bookings */}
          <div className="mb-8">
            <h3 className="text-lg font-bold text-slate-700 mb-4">Today's Active Bookings ({managementDate})</h3>
            {todayActiveBookings.length === 0 ? (
              <p className="text-slate-500 text-sm">No active bookings for today.</p>
            ) : (
              <div className="space-y-3">
                {todayActiveBookings.map(booking => {
                  // Get user info from booking
                  const userName = typeof booking.userId === 'object' && (booking.userId as any).name 
                    ? (booking.userId as any).name 
                    : 'User';
                  const userEmail = typeof booking.userId === 'object' && (booking.userId as any).email 
                    ? (booking.userId as any).email 
                    : 'N/A';
                  
                  return (
                    <div key={booking.id} className="flex items-center justify-between p-4 bg-green-50 border border-green-100 rounded-xl hover:bg-green-100 transition-colors cursor-pointer" onClick={() => viewBookingDetails(booking)}>
                      <div className="flex items-center gap-4">
                        <div className="bg-green-100 text-green-700 px-3 py-2 rounded-lg">
                          <span className="font-bold text-lg">{TIME_SLOTS[booking.slotIndex]?.split(' ')[0]}</span>
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">Slot {booking.slotIndex + 1}: {TIME_SLOTS[booking.slotIndex]}</p>
                          <p className="text-sm text-slate-600">Booked by: {userName}</p>
                          <p className="text-xs text-slate-500">{userEmail}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            viewBookingDetails(booking);
                          }}
                          className="px-4 py-2 bg-blue-100 text-blue-700 font-semibold rounded-lg hover:bg-blue-200 transition-colors"
                        >
                          View Details
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelBooking(booking.id);
                          }}
                          disabled={cancellingBooking === booking.id}
                          className="px-4 py-2 bg-red-100 text-red-700 font-semibold rounded-lg hover:bg-red-200 disabled:opacity-50 transition-colors"
                        >
                          {cancellingBooking === booking.id ? 'Cancelling...' : 'Cancel'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* Pending Bookings Approval Section */}
          <div className="mb-8">
            <h3 className="text-lg font-bold text-slate-700 mb-4">Pending Booking Requests</h3>
            {pendingBookings.length === 0 ? (
              <p className="text-slate-500 text-sm">No pending booking requests.</p>
            ) : (
              <div className="space-y-3">
                {pendingBookings.map(booking => {
                  // Get user info from booking
                  const userName = typeof booking.userId === 'object' && (booking.userId as any).name 
                    ? (booking.userId as any).name 
                    : 'User';
                  const userEmail = typeof booking.userId === 'object' && (booking.userId as any).email 
                    ? (booking.userId as any).email 
                    : 'N/A';
                  
                  return (
                    <div key={booking.id} className="flex items-center justify-between p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                      <div className="flex items-center gap-4">
                        <div className="bg-yellow-100 text-yellow-700 px-3 py-2 rounded-lg">
                          <span className="font-bold text-lg">{TIME_SLOTS[booking.slotIndex]?.split(' ')[0]}</span>
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">Slot {booking.slotIndex + 1}: {TIME_SLOTS[booking.slotIndex]}</p>
                          <p className="text-sm text-slate-600">Requested by: {userName}</p>
                          <p className="text-xs text-slate-500">{userEmail}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => viewBookingDetails(booking)}
                          className="px-4 py-2 bg-blue-100 text-blue-700 font-semibold rounded-lg hover:bg-blue-200 transition-colors"
                        >
                          View Details
                        </button>
                        <button 
                          onClick={() => handleApproveBooking(booking.id)}
                          disabled={approvingBooking === booking.id}
                          className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                          {approvingBooking === booking.id ? 'Approving...' : 'Approve'}
                        </button>
                        <button 
                          onClick={() => handleRejectBooking(booking.id)}
                          disabled={rejectingBooking === booking.id}
                          className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                        >
                          {rejectingBooking === booking.id ? 'Rejecting...' : 'Reject'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* Slot Grid */}
          <h3 className="text-lg font-bold text-slate-700 mb-4">Slot Management</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {TIME_SLOTS.map((slot, index) => {
              const slotInfo = getSlotBookingInfo(index);
              const booking = slotInfo?.booking;
              const isOffline = slotInfo?.isOffline;
              const isUserBooking = slotInfo?.isUserBooking;
              const bookingStatus = slotInfo?.status;
              
              // Check if this slot has a cancelled booking
              const isCancelled = cancelledBookings.some(
                b => b.venueId === selectedVenue.id && 
                     b.slotIndex === index && 
                     b.date === managementDate
              );
              
              // Get user name for bookings
              let userName = 'User';
              if (isUserBooking && booking) {
                if (typeof booking.userId === 'object' && (booking.userId as any).name) {
                  userName = (booking.userId as any).name;
                } else if ((booking as any).userName) {
                  userName = (booking as any).userName;
                }
              }
              
              return (
                <div key={index} className={`p-4 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all ${
                  booking && bookingStatus === 'confirmed' ? 'bg-slate-50 border-slate-200' : 
                  booking && bookingStatus === 'pending' ? 'bg-yellow-50 border-yellow-200' :
                  isCancelled ? 'bg-red-50 border-red-100' : 
                  'bg-white border-slate-100 hover:border-green-300'
                }`}>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                    Slot {index + 1}
                  </span>
                  <span className="font-bold text-slate-800 text-sm">{slot}</span>
                  
                  {/* Show booking info */}
                  {isUserBooking && bookingStatus === 'confirmed' && (
                    <div className="text-xs text-center mt-1">
                      <div className="font-semibold text-green-600">Booked</div>
                      <div className="text-slate-500 text-[10px] truncate max-w-full">
                        {userName}
                      </div>
                    </div>
                  )}

                  {isUserBooking && bookingStatus === 'pending' && (
                    <div className="text-xs text-center mt-1">
                      <div className="font-semibold text-yellow-600">Pending</div>
                      <div className="text-slate-500 text-[10px] truncate max-w-full">
                        {userName}
                      </div>
                    </div>
                  )}
                  
                  {isOffline && (
                    <div className="text-xs text-orange-600 font-semibold">
                      Blocked
                    </div>
                  )}
                  
                  {isCancelled && (
                    <div className="text-xs text-red-600 font-semibold">
                      Cancelled
                    </div>
                  )}
                  
                  <div className="flex gap-2 w-full">
  {isUserBooking && booking && (
    <button 
      onClick={(e) => {
        e.stopPropagation();
        viewBookingDetails(booking);
      }}
      className="flex-1 py-2 text-[10px] font-bold uppercase rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200"
    >
      View
    </button>
  )}
  <button 
    disabled={togglingSlot === index || (isUserBooking && !isOffline)}
    onClick={() => handleToggleSlot(index)}
    className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-lg transition-all ${
      isOffline 
        ? 'bg-orange-100 text-orange-600 hover:bg-orange-200 hover:text-orange-700' 
        : isUserBooking
          ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
          : isCancelled
            ? 'bg-red-200 text-red-500 cursor-not-allowed'
            : 'bg-slate-900 text-white hover:bg-green-600'
    }`}
  >
    {togglingSlot === index ? '...' : 
     isOffline ? 'Unblock' : 
     isUserBooking ? 'Booked' : 
     isCancelled ? 'Cancelled' : 'Block Slot'}
  </button>
</div>
                </div>
              );
            })}
          </div>
          
          {/* Cancelled Bookings Section */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <h3 className="text-lg font-bold text-slate-700 mb-4">Recent Cancellations</h3>
            <div className="space-y-2">
              {cancelledBookings
                .filter(b => b.venueId === selectedVenue.id)
                .slice(0, 5) // Show only 5 most recent
                .map(cancelled => {
                  // Get user info
                  const userName = typeof cancelled.userId === 'object' && (cancelled.userId as any).name 
                    ? (cancelled.userId as any).name 
                    : 'User';
                  const userEmail = typeof cancelled.userId === 'object' && (cancelled.userId as any).email 
                    ? (cancelled.userId as any).email 
                    : 'N/A';
                  
                  return (
                    <div key={cancelled.id} className="p-3 bg-red-50 border border-red-100 rounded-lg flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium text-red-800">Cancelled Booking</p>
                        <p className="text-xs text-red-600">
                          {cancelled.date} | Slot {cancelled.slotIndex + 1} ({TIME_SLOTS[cancelled.slotIndex]})
                        </p>
                        <p className="text-xs text-red-500 mt-1">User: {userName} ({userEmail})</p>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full font-bold">
                          CANCELLED
                        </span>
                        <button 
                          onClick={() => handleUncancelBooking(cancelled.id)}
                          disabled={uncancellingBooking === cancelled.id}
                          className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-lg hover:bg-green-200 disabled:opacity-50"
                        >
                          {uncancellingBooking === cancelled.id ? '...' : 'Restore'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              
              {cancelledBookings.filter(b => b.venueId === selectedVenue.id).length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">No cancelled bookings</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Booking Details Modal */}
      {isBookingDetailsOpen && selectedBooking && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsBookingDetailsOpen(false)}></div>
          <div className="bg-white w-full max-w-md rounded-3xl p-8 relative z-10 shadow-2xl">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">Booking Details</h2>
            
            <div className="space-y-4 mb-8">
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
              
              {/* User Info (if available) */}
              {typeof selectedBooking.userId === 'object' && (
                <>
                  <div className="pt-4 border-t border-slate-200">
                    <h3 className="font-bold text-slate-700 mb-2">User Information</h3>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Name:</span>
                      <span className="font-semibold">{(selectedBooking.userId as any).name || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Email:</span>
                      <span className="font-semibold">{(selectedBooking.userId as any).email || 'N/A'}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
            
            <div className="flex gap-4">
              <button 
                onClick={() => setIsBookingDetailsOpen(false)}
                className="flex-1 py-3 font-bold text-slate-500 hover:bg-slate-100 rounded-2xl transition-colors"
              >
                Close
              </button>
              
              {selectedBooking.status === 'CONFIRMED' && (
                <button 
                  onClick={() => handleCancelBooking(selectedBooking.id)}
                  disabled={cancellingBooking === selectedBooking.id}
                  className="flex-1 py-3 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {cancellingBooking === selectedBooking.id ? 'Cancelling...' : 'Cancel Booking'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {isAddModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)}></div>
          <div className="bg-white w-full max-w-2xl rounded-3xl p-8 relative z-10 shadow-2xl overflow-y-auto max-h-[90vh]">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">Register New Ground</h2>
            <form onSubmit={handleCreateVenue} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <input type="text" required value={newVenue.name} onChange={e => setNewVenue({...newVenue, name: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500 outline-none" placeholder="Venue Name" />
                <input type="number" required value={newVenue.pricePerHour} onChange={e => setNewVenue({...newVenue, pricePerHour: Number(e.target.value)})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500 outline-none" placeholder="Price / Hr (₨)" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">District Name</label>
                  <input 
                    type="text" 
                    required 
                    value={newVenue.district} 
                    onChange={e => {
                      const district = e.target.value;
                      setNewVenue(prev => ({
                        ...prev,
                        district,
                        location: district && prev.locationName ? `${district}, ${prev.locationName}` : ''
                      }));
                    }}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500 outline-none" 
                    placeholder="e.g. Kathmandu" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Location / Address</label>
                  <input 
                    type="text" 
                    required 
                    value={newVenue.locationName} 
                    onChange={e => {
                      const locationName = e.target.value;
                      setNewVenue(prev => ({
                        ...prev,
                        locationName,
                        location: prev.district && locationName ? `${prev.district}, ${locationName}` : ''
                      }));
                    }}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500 outline-none" 
                    placeholder="e.g. Thamel" 
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input type="text" required value={newVenue.imageUrl1} onChange={e => setNewVenue({...newVenue, imageUrl1: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500 outline-none" placeholder="Photo 1 URL" />
                <input type="text" required value={newVenue.imageUrl2} onChange={e => setNewVenue({...newVenue, imageUrl2: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500 outline-none" placeholder="Photo 2 URL" />
              </div>
              <textarea required value={newVenue.description} onChange={e => setNewVenue({...newVenue, description: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500 outline-none h-24 resize-none" placeholder="Venue Description"></textarea>
              <div className="flex gap-4">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 py-4 font-bold text-slate-500 hover:bg-slate-100 rounded-2xl transition-colors">Cancel</button>
                <button type="submit" className="flex-[2] py-4 bg-green-600 text-white font-bold rounded-2xl hover:bg-green-700 transition-colors">Confirm Venue</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerDashboard;