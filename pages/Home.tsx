
import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { FutsalVenue, UserRole } from '../types';
import { useAuth } from '../App';
import heroImg from '../uploads/venues/soccer-ball-goal-sunlight-118635243.jpeg';

interface HomeProps {
  onBook: (venueId: string) => void;
}

const Home: React.FC<HomeProps> = ({ onBook }) => {
  const { user } = useAuth();
  const [venues, setVenues] = useState<FutsalVenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLocation, setFilterLocation] = useState('All Districts');

  useEffect(() => {
    loadVenues();
  }, []);

 const loadVenues = async () => {
  setLoading(true);
  try {
    
    // Add cache busting parameter
    const timestamp = new Date().getTime();
    const data = await api.getVenues();
    
    
    // Filter out any venues that might have been cached but don't exist
    const validVenues = data.filter(venue => {
      // You can add additional validation here if needed
      return venue.name && venue.name.trim() !== '';
    });
    
    setVenues(validVenues);
    
    // Clear any old cached data
    localStorage.removeItem('kickoff_venues');
    
  } catch (error) {
    console.error('Error loading venues:', error);
    // If error, clear cache and set empty array
    localStorage.removeItem('kickoff_venues');
    setVenues([]);
  } finally {
    setLoading(false);
  }
};
  // In Home.tsx, add this useEffect to refresh when venues might have changed
useEffect(() => {
  const refreshVenues = async () => {
    const freshVenues = await api.getVenues();
    setVenues(freshVenues);
  };
  
  // You could trigger this from an event or periodically
  refreshVenues();
}, []); // Or add dependencies as needed

  // Extract unique districts from venues for the dropdown
  // Assuming location format: "District Name, City" or "District Name, Lat/Lng"
  const uniqueDistricts = useMemo(() => {
    const districts = venues.map(v => {
      // Get the first part before comma (district name)
      const districtPart = v.location.split(',')[0].trim();
      return districtPart;
    });
    return ['All Districts', ...new Set(districts)].sort();
  }, [venues]);

  // Filter logic - filter by district
  const filteredVenues = useMemo(() => {
    return venues.filter(venue => {
      // Get district from venue location
      const venueDistrict = venue.location.split(',')[0].trim();
      
      const matchesLocation = filterLocation === 'All Districts' || 
                             venueDistrict.toLowerCase() === filterLocation.toLowerCase();
      const matchesSearch = venue.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            venue.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesLocation && matchesSearch;
    });
  }, [venues, searchQuery, filterLocation]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Hero Section */}
      <section className="mb-12 relative overflow-hidden rounded-3xl bg-slate-900 text-white p-8 md:p-16">
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-4xl md:text-6xl font-extrabold mb-6 leading-tight">
            Find Your <span className="text-green-400">Perfect Pitch</span> In Seconds
          </h1>
          <p className="text-lg text-slate-300 mb-8">
            Book top-rated futsal grounds instantly. Seamless scheduling, transparent pricing, and professional arenas at your fingertips.
          </p>
          <div className="flex flex-wrap gap-4">
            <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20">
              <span className="block text-2xl font-bold">{venues.length}+</span>
              <span className="text-sm text-slate-400">Arenas</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20">
              <span className="block text-2xl font-bold">8</span>
              <span className="text-sm text-slate-400">Daily Slots</span>
            </div>
          </div>
        </div>
        <div className="absolute right-0 top-0 w-1/2 h-full opacity-20 md:opacity-50 pointer-events-none">
          <img
            src={heroImg}
            className="object-cover w-full h-full sepia hue-rotate-[120deg] saturate-200"
            alt="Hero Background"
          />
        </div>
      </section>

      {/* Filter Controls */}
      <div className="mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-800 w-full md:w-auto">Available Grounds</h2>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative flex-grow">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input 
              type="text" 
              placeholder="Search by name..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 w-full rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-green-500 outline-none"
            />
          </div>

          <div className="relative min-w-[160px]">
             <select 
              value={filterLocation}
              onChange={(e) => setFilterLocation(e.target.value)}
              className="pl-4 pr-10 py-2 w-full rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-green-500 outline-none appearance-none bg-white cursor-pointer"
            >
              {uniqueDistricts.map(district => (
                <option key={district} value={district}>{district}</option>
              ))}
            </select>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1,2,3].map(n => (
            <div key={n} className="animate-pulse bg-white rounded-2xl h-96"></div>
          ))}
        </div>
      ) : filteredVenues.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 border-dashed">
          <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-slate-800">No grounds found</h3>
          <p className="text-slate-500">Try adjusting your filters or search terms.</p>
          <button 
            onClick={() => {setSearchQuery(''); setFilterLocation('All Locations');}}
            className="mt-4 text-green-600 font-semibold hover:underline"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredVenues.map(venue => (
            <div key={venue.id} className="bg-white rounded-2xl overflow-hidden border border-slate-200 hover:shadow-xl transition-all group">
              <div className="h-48 relative overflow-hidden">
                <img
                  src={(/central futsal|arean central|arena central/i).test(venue.name) ? heroImg : venue.images[0]}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  alt={venue.name}
                />
                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-sm font-bold text-slate-900">
                  ₨{venue.pricePerHour}/hr
                </div>
              </div>
              <div className="p-6">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-xl font-bold text-slate-800">{venue.name}</h3>
                  <div className="flex items-center text-yellow-500 font-bold text-sm">
                    ★ {venue.rating}
                  </div>
                </div>
                <p className="text-slate-500 text-sm mb-4 flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {venue.location}
                </p>
                <div className="flex flex-wrap gap-2 mb-6">
                  {venue.amenities.map(item => (
                    <span key={item} className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-md">
                      {item}
                    </span>
                  ))}
                </div>
                <button 
                  onClick={() => onBook(venue.id)}
                  className={`w-full py-3 font-bold rounded-xl transition-colors ${
                    user && user.role !== UserRole.USER 
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                    : 'bg-slate-900 text-white hover:bg-green-600'
                  }`}
                >
                  {user?.role === UserRole.OWNER || user?.role === UserRole.ADMIN ? 'View Only' : 'Book Field'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Home;
