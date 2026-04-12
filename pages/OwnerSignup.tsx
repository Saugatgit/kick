import React, { useState, useRef, useEffect } from 'react';
import { api } from '../services/api';
import L from 'leaflet';

interface OwnerSignupProps {
  onComplete: (ownerData: any, venueData: any) => Promise<boolean>;
  onBack: () => void;
}

const COMMON_AMENITIES = [
  'Synthetic Turf', 'Night Lights', 'Parking', 'Showers', 'Changing Rooms', 
  'Water Station', 'First Aid', 'Cafe/Snack Bar', 'Locker Room', 'Pro Goals'
];

const OwnerSignup: React.FC<OwnerSignupProps> = ({ onComplete, onBack }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form State
  const [ownerInfo, setOwnerInfo] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    avatar: '' 
  });
  const [venueInfo, setVenueInfo] = useState({
    name: '',
    district: '',  // NEW: District name
    locationName: '', // NEW: Location/Address name
    location: '',  // This will be formatted as "District, Location"
    pricePerHour: 25,
    description: '',
    images: ['', ''], // For preview URLs (base64)
    amenities: [] as string[]
  });

  // Store actual File objects
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (step === 2 && mapContainerRef.current && !mapRef.current) {
      // Initialize Leaflet map
      const map = L.map(mapContainerRef.current).setView([27.7172, 85.3240], 13);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);

      mapRef.current = map;

      map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        setMarker(lat, lng);
        setVenueInfo(prev => ({ ...prev, location: `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}` }));
      });
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [step]);

  const setMarker = (lat: number, lng: number) => {
    if (!mapRef.current) return;
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      markerRef.current = L.marker([lat, lng]).addTo(mapRef.current);
    }
    mapRef.current.flyTo([lat, lng], 16);
  };

  const detectLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setMarker(latitude, longitude);
        setVenueInfo(prev => ({ ...prev, location: `Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}` }));
      },
      () => alert("Unable to retrieve your location.")
    );
  };

  const searchWithAI = async () => {
    if (!venueInfo.location || venueInfo.location.length < 3) return;
    setSearchingLocation(true);
    
    let coords: any = undefined;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej));
      coords = pos.coords;
    } catch (e) {}

    const result = await api.searchLocation(venueInfo.location, coords);
    if (result) {
      setVenueInfo(prev => ({ ...prev, location: result.address }));
    }
    setSearchingLocation(false);
  };

  // Handle owner avatar upload
  const handleOwnerAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check file size (5MB max for avatar)
    if (file.size > 5 * 1024 * 1024) {
      alert('Avatar file size should be less than 5MB');
      return;
    }
    
    // Check file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('Only image files (JPG, PNG, GIF, WebP) are allowed');
      return;
    }
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setOwnerInfo({...ownerInfo, avatar: reader.result as string});
    };
    reader.readAsDataURL(file);
  };

  // Handle venue photo upload
  const handleVenuePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size should be less than 10MB');
      return;
    }
    
    // Check file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('Only image files (JPG, PNG, GIF, WebP) are allowed');
      return;
    }
    
    // Create preview URL
    const reader = new FileReader();
    reader.onloadend = () => {
      const newImages = [...venueInfo.images];
      newImages[index] = reader.result as string;
      setVenueInfo({ ...venueInfo, images: newImages });
      
      // Store the actual file
      const newFiles = [...uploadedFiles];
      newFiles[index] = file;
      setUploadedFiles(newFiles);
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = (index: number) => {
    const newImages = [...venueInfo.images];
    newImages[index] = '';
    setVenueInfo({ ...venueInfo, images: newImages });
    
    const newFiles = [...uploadedFiles];
    newFiles.splice(index, 1);
    setUploadedFiles(newFiles);
  };

  const toggleAmenity = (amenity: string) => {
    setVenueInfo(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity]
    }));
  };

  const handleNext = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setStep(prev => prev + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if at least 2 photos are uploaded
    if (uploadedFiles.length < 2) {
      setError('At least 2 photos are strictly compulsory for your venue listing.');
      return;
    }
    
    setLoading(true);
    setUploading(true);
    
    try {
      // Create FormData for file upload
      const formData = new FormData();
      
      // Add owner data
      formData.append('ownerName', ownerInfo.name);
      formData.append('ownerEmail', ownerInfo.email);
      formData.append('ownerPassword', ownerInfo.password);
      
      // Add venue data
      formData.append('venueName', venueInfo.name);
      formData.append('venueLocation', venueInfo.location);
      formData.append('venuePrice', venueInfo.pricePerHour.toString());
      formData.append('venueDescription', venueInfo.description);
      formData.append('venueAmenities', venueInfo.amenities.join(','));
      
      // Add venue photos
      uploadedFiles.forEach((file, index) => {
        if (file) {
          formData.append('venuePhotos', file);
        }
      });
      
      
      // Upload to backend
      const response = await fetch('/api/auth/onboard-owner-with-photos', {
        method: 'POST',
        body: formData,
        // Note: Don't set Content-Type header for FormData
      });
      
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Registration failed');
      }
      
      const data = await response.json();
      
      // Call the original onComplete with the new data
      const success = await onComplete(
        { 
          name: ownerInfo.name, 
          email: ownerInfo.email, 
          password: ownerInfo.password,
          avatar: ownerInfo.avatar || '🏢'
        },
        { 
          name: venueInfo.name,
          location: venueInfo.location,
          pricePerHour: venueInfo.pricePerHour,
          images: data.venue.images, // Use the server-generated URLs
          description: venueInfo.description,
          amenities: venueInfo.amenities
        }
      );
      
      if (!success) {
        setError('Registration failed. Please try again.');
        setLoading(false);
        setUploading(false);
        setStep(1);
      }
      
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.message || 'An error occurred during registration');
      setLoading(false);
      setUploading(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-between mb-10 max-w-xs mx-auto">
      {[1, 2, 3].map((s) => (
        <React.Fragment key={s}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all shadow-sm ${
            step === s ? 'bg-green-600 text-white scale-110 shadow-green-200' : 
            step > s ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-500'
          }`}>
            {step > s ? '✓' : s}
          </div>
          {s < 3 && <div className={`h-1 flex-grow mx-2 rounded-full ${step > s ? 'bg-slate-800' : 'bg-slate-200'}`} />}
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <div className="min-h-[90vh] bg-slate-50 flex items-center justify-center p-4 py-12">
      <div className="max-w-4xl w-full bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden flex flex-col md:flex-row">
        
        <div className="md:w-72 bg-slate-900 text-white p-8 flex flex-col justify-between border-r border-slate-800">
          <div>
            <div className="w-12 h-12 bg-green-600 rounded-2xl flex items-center justify-center mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-3 tracking-tight">Business Partner</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Launch your futsal arena on KickOff and start accepting bookings today.
            </p>
          </div>
          
          <div className="space-y-4">
             <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mb-1">Support</p>
                <p className="text-sm">24/7 Dedicated help for owners.</p>
             </div>
             <button onClick={onBack} className="text-slate-400 hover:text-white text-sm font-semibold flex items-center gap-2 transition-colors">
               ← Cancel Registration
             </button>
          </div>
        </div>

        <div className="flex-1 p-8 md:p-12 overflow-y-auto max-h-[90vh]">
          {renderStepIndicator()}

          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <h3 className="text-2xl font-bold text-slate-800 mb-2">Step 1: Owner Profile</h3>
              <p className="text-slate-500 text-sm mb-8">Personal details for account management.</p>
              
              <div className="space-y-6">
                <div className="flex flex-col items-center mb-4">
                  <div 
                    onClick={() => avatarInputRef.current?.click()}
                    className="w-24 h-24 rounded-[2rem] border-2 border-dashed border-slate-200 flex items-center justify-center cursor-pointer hover:border-green-500 transition-all overflow-hidden bg-slate-50 relative group"
                  >
                    {ownerInfo.avatar ? (
                      <img src={ownerInfo.avatar} className="w-full h-full object-cover" alt="Profile" />
                    ) : (
                      <span className="text-4xl">🏢</span>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px] font-bold uppercase">Upload</div>
                  </div>
                  <input 
                    type="file" 
                    ref={avatarInputRef} 
                    onChange={handleOwnerAvatarUpload} // FIXED LINE
                    className="hidden" 
                    accept="image/*" 
                  />
                  <p className="text-xs text-slate-400 mt-3 font-semibold uppercase tracking-widest">Business Owner Photo</p>
                </div>

                <div className="grid gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Full Legal Name</label>
                    <input 
                      type="text" 
                      required 
                      value={ownerInfo.name} 
                      onChange={e => setOwnerInfo({...ownerInfo, name: e.target.value})} 
                      className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500 outline-none" 
                      placeholder="Michael Jordan"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Business Email</label>
                    <input 
                      type="email" 
                      required 
                      value={ownerInfo.email} 
                      onChange={e => setOwnerInfo({...ownerInfo, email: e.target.value})} 
                      className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500 outline-none" 
                      placeholder="manager@arena.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Account Password</label>
                    <input 
                      type="password" 
                      required 
                      value={ownerInfo.password} 
                      onChange={e => setOwnerInfo({...ownerInfo, password: e.target.value})} 
                      className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500 outline-none" 
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <button 
                  disabled={!ownerInfo.name || !ownerInfo.email || !ownerInfo.password}
                  onClick={handleNext} 
                  className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 disabled:opacity-50 transition-all shadow-lg active:scale-[0.98]"
                >
                  Continue to Venue Details
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <h3 className="text-2xl font-bold text-slate-800 mb-2">Step 2: Venue Basics</h3>
              <p className="text-slate-500 text-sm mb-6">Tell us where your futsal is located.</p>

              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Futsal Name</label>
                    <input 
                      type="text" 
                      required 
                      value={venueInfo.name} 
                      onChange={e => setVenueInfo({...venueInfo, name: e.target.value})} 
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500 outline-none" 
                      placeholder="e.g. Strike Arena"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Price Per Hour (₨)</label>
                    <input 
                      type="number" 
                      required 
                      value={venueInfo.pricePerHour} 
                      onChange={e => setVenueInfo({...venueInfo, pricePerHour: Number(e.target.value)})} 
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">District Name</label>
                    <input 
                      type="text" 
                      required 
                      value={venueInfo.district} 
                      onChange={e => {
                        const district = e.target.value;
                        setVenueInfo({
                          ...venueInfo, 
                          district,
                          location: district && venueInfo.locationName ? `${district}, ${venueInfo.locationName}` : ''
                        });
                      }} 
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500 outline-none" 
                      placeholder="e.g. Kathmandu"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Location / Address</label>
                    <input 
                      type="text" 
                      required 
                      value={venueInfo.locationName} 
                      onChange={e => {
                        const locationName = e.target.value;
                        setVenueInfo({
                          ...venueInfo, 
                          locationName,
                          location: venueInfo.district && locationName ? `${venueInfo.district}, ${locationName}` : ''
                        });
                      }} 
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500 outline-none" 
                      placeholder="e.g. Thamel, Naxal"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Short Description</label>
                  <textarea 
                    required 
                    value={venueInfo.description} 
                    onChange={e => setVenueInfo({...venueInfo, description: e.target.value})} 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500 outline-none h-20 resize-none" 
                    placeholder="Briefly describe your turf quality..."
                  />
                </div>

                <div className="flex gap-4">
                  <button onClick={() => setStep(1)} className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-100 rounded-2xl transition-colors">Back</button>
                  <button 
                    disabled={!venueInfo.name || !venueInfo.district || !venueInfo.locationName || !venueInfo.description}
                    onClick={handleNext} 
                    className="flex-[2] py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 disabled:opacity-50 shadow-lg active:scale-[0.98]"
                  >
                    Next: Photos & Amenities
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <h3 className="text-2xl font-bold text-slate-800 mb-2">Step 3: Features & Photos</h3>
              <p className="text-slate-500 text-sm mb-6">Visuals are mandatory. 2 photos required.</p>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-3">Venue Features (Amenities)</label>
                  <div className="grid grid-cols-2 gap-2">
                    {COMMON_AMENITIES.map(amenity => (
                      <button
                        key={amenity}
                        type="button"
                        onClick={() => toggleAmenity(amenity)}
                        className={`text-left px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                          venueInfo.amenities.includes(amenity)
                            ? 'bg-green-600 border-green-600 text-white'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-green-400'
                        }`}
                      >
                        {amenity}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-3">
                    Photos (Min 2 Compulsory)
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="relative">
                      <input
                        type="file"
                        id="venuePhoto1"
                        accept="image/*"
                        onChange={(e) => handleVenuePhotoUpload(e, 0)}
                        className="hidden"
                      />
                      <label
                        htmlFor="venuePhoto1"
                        className={`aspect-video rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden ${
                          venueInfo.images[0] 
                            ? 'border-green-500 bg-green-50' 
                            : 'border-slate-200 bg-slate-50 hover:border-green-400'
                        }`}
                      >
                        {venueInfo.images[0] ? (
                          <>
                            <img 
                              src={venueInfo.images[0]} 
                              className="w-full h-full object-cover"
                              alt="Venue preview 1"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                              <span className="text-white text-xs font-bold">Change Photo</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-3xl mb-2">📸</div>
                            <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">
                              Main Photo
                            </span>
                            <span className="text-slate-400 text-[10px] mt-1">Click to upload</span>
                          </>
                        )}
                      </label>
                      {venueInfo.images[0] && (
                        <button
                          type="button"
                          onClick={() => removePhoto(0)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    <div className="relative">
                      <input
                        type="file"
                        id="venuePhoto2"
                        accept="image/*"
                        onChange={(e) => handleVenuePhotoUpload(e, 1)}
                        className="hidden"
                      />
                      <label
                        htmlFor="venuePhoto2"
                        className={`aspect-video rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden ${
                          venueInfo.images[1] 
                            ? 'border-green-500 bg-green-50' 
                            : 'border-slate-200 bg-slate-50 hover:border-green-400'
                        }`}
                      >
                        {venueInfo.images[1] ? (
                          <>
                            <img 
                              src={venueInfo.images[1]} 
                              className="w-full h-full object-cover"
                              alt="Venue preview 2"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                              <span className="text-white text-xs font-bold">Change Photo</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-3xl mb-2">🏟️</div>
                            <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">
                              Extra Photo
                            </span>
                            <span className="text-slate-400 text-[10px] mt-1">Click to upload</span>
                          </>
                        )}
                      </label>
                      {venueInfo.images[1] && (
                        <button
                          type="button"
                          onClick={() => removePhoto(1)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <p className="text-xs text-slate-500">
                    Upload clear photos of your futsal ground. Minimum 2 photos required.
                    <br />
                    Supported formats: JPG, PNG, WebP (Max 10MB each)
                  </p>
                </div>

                {/* Upload Progress Indicator */}
                {uploading && (
                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-blue-700">Uploading Photos...</span>
                      <span className="text-xs text-blue-600">Please wait</span>
                    </div>
                    <div className="w-full h-2 bg-blue-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full animate-pulse w-3/4"></div>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="p-4 bg-red-50 text-red-600 text-xs font-bold rounded-xl border border-red-100">
                    {error}
                  </div>
                )}

                <div className="flex gap-4">
                  <button 
                    onClick={() => setStep(2)} 
                    className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-100 rounded-2xl transition-colors"
                  >
                    Back
                  </button>
                  <button 
                    disabled={loading || venueInfo.images[0] === '' || venueInfo.images[1] === ''}
                    onClick={handleSubmit} 
                    className="flex-[2] py-4 bg-green-600 text-white font-bold rounded-2xl hover:bg-green-700 shadow-xl shadow-green-100 active:scale-[0.98] disabled:opacity-50"
                  >
                    {loading ? 'Creating Account...' : 'Finish Registration'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OwnerSignup;