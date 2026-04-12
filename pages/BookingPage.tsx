
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { FutsalVenue, Booking, TIME_SLOTS, UserRole } from '../types';
import { useAuth } from '../App';

interface BookingPageProps {
  venueId: string;
  onBack: () => void;
}

const BookingPage: React.FC<BookingPageProps> = ({ venueId, onBack }) => {
  const { user } = useAuth();
  const [venue, setVenue] = useState<FutsalVenue | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [existingBookings, setExistingBookings] = useState<Booking[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [bookingInProgress, setBookingInProgress] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [activeImg, setActiveImg] = useState(0);

  useEffect(() => {
    api.getVenueById(venueId).then(setVenue);
    fetchBookings();
  }, [venueId, selectedDate]);

  const fetchBookings = () => {
    api.getVenueBookings(venueId, selectedDate).then(setExistingBookings);
  };

  const handleBooking = async () => {
    if (!user || selectedSlot === null) return;
    
    if (user.role !== UserRole.USER) {
      alert("Only players can book fields. You are logged in with management privileges.");
      return;
    }

    setBookingInProgress(true);
    await api.createBooking({
      venueId,
      userId: user.id,
      date: selectedDate,
      slotIndex: selectedSlot
    });
    setBookingInProgress(false);
    setShowSuccess(true);
    fetchBookings();
    setSelectedSlot(null);
  };

  if (!venue) return <div className="p-8 text-center">Loading venue details...</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <button onClick={onBack} className="mb-6 flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
        Back to Listings
      </button>

      <div className="bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-sm flex flex-col md:flex-row mb-8">
        <div className="md:w-1/2 relative group">
          <img src={venue.images[activeImg]} className="w-full h-80 object-cover" alt={venue.name} />
          {venue.images.length > 1 && (
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
              {venue.images.map((_, i) => (
                <button 
                  key={i} 
                  onClick={() => setActiveImg(i)}
                  className={`w-2 h-2 rounded-full transition-all ${activeImg === i ? 'bg-white w-4' : 'bg-white/40'}`}
                />
              ))}
            </div>
          )}
        </div>
        <div className="p-8 md:w-1/2 flex flex-col justify-center">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">{venue.name}</h2>
          <p className="text-slate-500 text-sm mb-4">{venue.description}</p>
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-bold">
              ₨{venue.pricePerHour} / hour
            </div>
            <div className="text-slate-400 text-xs">8 slots daily from 4 PM</div>
          </div>
          <div className="mt-6 flex gap-2">
            {venue.amenities.map(a => (
              <span key={a} className="text-[10px] bg-slate-50 text-slate-500 px-2 py-1 rounded border border-slate-100">
                {a}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="text-xl font-bold text-slate-800">Choose Your Slot</h3>
          <input 
            type="date" 
            value={selectedDate}
            min={new Date().toISOString().split('T')[0]}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {TIME_SLOTS.map((slot, index) => {
            const isBooked = existingBookings.some(b => b.slotIndex === index && b.status !== 'CANCELLED');
            const isSelected = selectedSlot === index;

            return (
              <button
                key={index}
                disabled={isBooked}
                onClick={() => setSelectedSlot(index)}
                className={`p-4 rounded-2xl border transition-all text-center flex flex-col items-center justify-center gap-1
                  ${isBooked 
                    ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed opacity-60' 
                    : isSelected 
                      ? 'bg-green-600 border-green-600 text-white shadow-lg shadow-green-200' 
                      : 'bg-white border-slate-200 text-slate-700 hover:border-green-500 hover:bg-green-50'
                  }`}
              >
                <span className="text-xs opacity-70">Slot {index + 1}</span>
                <span className="font-bold">{slot}</span>
                <span className="text-[10px] uppercase tracking-wider font-bold">
                  {isBooked ? 'Booked' : 'Available'}
                </span>
              </button>
            );
          })}
        </div>

        {selectedSlot !== null && !showSuccess && (
          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between animate-in fade-in slide-in-from-bottom-2">
            <div>
              <p className="text-sm text-slate-500">Booking Summary</p>
              <p className="font-bold text-slate-800">
                {selectedDate} | {TIME_SLOTS[selectedSlot]}
              </p>
            </div>
            {user?.role === UserRole.USER ? (
              <button 
                onClick={handleBooking}
                disabled={bookingInProgress}
                className="px-8 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-lg shadow-green-100 disabled:opacity-50"
              >
                {bookingInProgress ? 'Booking...' : 'Confirm Now'}
              </button>
            ) : (
              <div className="text-red-500 font-semibold text-sm">
                Only players can book fields.
              </div>
            )}
          </div>
        )}

        {showSuccess && (
          <div className="p-8 bg-green-50 border border-green-100 rounded-2xl text-center space-y-4">
            <div className="w-16 h-16 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-2 text-2xl">✓</div>
            <h3 className="text-2xl font-bold text-green-900">Booking Confirmed!</h3>
            <p className="text-green-700">See you at {venue.name} on {selectedDate} at {TIME_SLOTS[selectedSlot || 0]}</p>
            <button 
              onClick={() => setShowSuccess(false)}
              className="px-6 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700"
            >
              Book Another
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingPage;
