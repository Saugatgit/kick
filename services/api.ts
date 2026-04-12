import { User, FutsalVenue, Booking, UserRole } from '../types';
import { GoogleGenAI } from "@google/genai";

const BASE_URL = '/api';

// Session management
export const SESSION_KEY = 'kickoff_session';
export const TOKEN_KEY = 'kickoff_token';

export const saveSession = (token: string, user: User) => {
  const session = { token, user, timestamp: Date.now() };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  localStorage.setItem(TOKEN_KEY, token);
};

export const getSession = (): { token: string; user: User; timestamp: number } | null => {
  try {
    const session = localStorage.getItem(SESSION_KEY);
    if (!session) return null;
    const parsed = JSON.parse(session);
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - parsed.timestamp > sevenDays) {
      clearSession();
      return null;
    }
    return parsed;
  } catch (e) {
    return null;
  }
};

export const clearSession = () => {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(TOKEN_KEY);
};

const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem(TOKEN_KEY)}`
});

export const api = {
  searchLocation: async (query: string, coords?: { latitude: number, longitude: number }): Promise<{ address: string } | null> => {
    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey) return { address: query };
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Formal address for: ${query}. ${coords ? `Nearby coordinates: lat ${coords.latitude}, lng ${coords.longitude}.` : ''} Respond only with the formatted address string.`,
      });
      return { address: response.text?.trim() || query };
    } catch (e) { 
      console.error('AI searchLocation failed:', e);
      return { address: query }; 
    }
  },

  login: async (email: string, password?: string): Promise<User | null> => {
    try {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error('Login failed:', errData.error || res.statusText);
        return null;
      }
      const data = await res.json();
      saveSession(data.token, { ...data.user, id: data.user._id });
      return { ...data.user, id: data.user._id };
    } catch (e) {
      console.error('Login request error:', e);
      return null;
    }
  },

  register: async (userData: Omit<User, 'id'>): Promise<User | null> => {
    try {
      const res = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      if (!res.ok) return null;
      const data = await res.json();
      const user = { ...userData, id: data.userId } as User;
      saveSession(data.token || '', user);
      return user;
    } catch (e) { 
      console.error('Register error:', e);
      return null; 
    }
  },

  onboardOwner: async (ownerData: any, venueData: any): Promise<{ user: User, venue: FutsalVenue } | null> => {
    const user = await api.register({ ...ownerData, role: UserRole.OWNER });
    if (!user) return null;
    const venue = await api.createVenue({ ...venueData, ownerId: user.id });
    return { user, venue };
  },

  onboardOwnerWithPhotos: async (formData: FormData): Promise<any> => {
    try {
      const res = await fetch(`${BASE_URL}/auth/onboard-owner-with-photos`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Registration failed');
      }
      return await res.json();
    } catch (e) { 
      console.error('Onboard owner with photos error:', e);
      throw e;
    }
  },

  getVenues: async (): Promise<FutsalVenue[]> => {
    try {
      const res = await fetch(`${BASE_URL}/venues`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.map((v: any) => ({ ...v, id: v._id }));
    } catch (e) { 
      console.error('getVenues error:', e);
      return []; 
    }
  },

  getVenueById: async (id: string): Promise<FutsalVenue | null> => {
    const all = await api.getVenues();
    return all.find(v => v.id === id) || null;
  },

  createVenue: async (venue: Omit<FutsalVenue, 'id'>): Promise<FutsalVenue> => {
    const res = await fetch(`${BASE_URL}/venues`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(venue)
    });
    const data = await res.json();
    return { ...data, id: data._id };
  },

  getOwnerVenues: async (ownerId: string): Promise<FutsalVenue[]> => {
    const all = await api.getVenues();
    return all.filter(v => v.ownerId === ownerId);
  },

  getBookings: async (): Promise<Booking[]> => {
    try {
      const res = await fetch(`${BASE_URL}/bookings`, { headers: getAuthHeaders() });
      if (!res.ok) return [];
      const data = await res.json();
      return data.map((b: any) => ({ ...b, id: b._id }));
    } catch (e) { 
      console.error('getBookings error:', e);
      return []; 
    }
  },

  getVenueBookings: async (venueId: string, date: string): Promise<Booking[]> => {
    try {
      const res = await fetch(`${BASE_URL}/bookings/venue/${venueId}?date=${date}`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.map((b: any) => ({ ...b, id: b._id }));
    } catch (e) { 
      console.error('Error fetching venue bookings:', e);
      return []; 
    }
  },

  getUserBookings: async (userId: string): Promise<(Booking & { venue?: FutsalVenue })[]> => {
    try {
      const res = await fetch(`${BASE_URL}/bookings/user/${userId}`, { headers: getAuthHeaders() });
      if (!res.ok) return [];
      const data = await res.json();
      return data.map((b: any) => {
        // The server populates venueId with venue data
        const venue = typeof b.venueId === 'object' ? b.venueId : null;
        if (venue && !venue.id) {
          venue.id = venue._id;
        }
        return {
          ...b,
          id: b._id,
          venue: venue ? {
            id: venue._id,
            ownerId: venue.ownerId,
            name: venue.name,
            location: venue.location,
            pricePerHour: venue.pricePerHour,
            images: venue.images || [],
            description: venue.description,
            rating: venue.rating,
            amenities: venue.amenities || []
          } : undefined,
          venueId: typeof b.venueId === 'object' ? b.venueId._id : b.venueId
        };
      });
    } catch (e) { 
      console.error('getUserBookings error:', e);
      return []; 
    }
  },

  createBooking: async (bookingData: Omit<Booking, 'id' | 'createdAt' | 'status'>): Promise<Booking> => {
    const res = await fetch(`${BASE_URL}/bookings`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(bookingData)
    });
    const data = await res.json();
    return { ...data, id: data._id };
  },

  cancelBooking: async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`${BASE_URL}/bookings/${id}/cancel`, {
        method: 'PATCH',
        headers: getAuthHeaders()
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('Cancel booking failed:', errorData);
        return false;
      }
      const data = await res.json();
      return data.success === true;
    } catch (error) {
      console.error('Cancel booking error:', error);
      return false;
    }
  },

  uncancelBooking: async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`${BASE_URL}/bookings/${id}/uncancel`, {
        method: 'PATCH',
        headers: getAuthHeaders()
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('Uncancel booking failed:', errorData);
        return false;
      }
      const data = await res.json();
      return data.success === true;
    } catch (error) {
      console.error('Uncancel booking error:', error);
      return false;
    }
  },

  toggleOfflineBooking: async (venueId: string, date: string, slotIndex: number, ownerId: string): Promise<void> => {
    try {
      const res = await fetch(`${BASE_URL}/bookings/toggle-offline`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ venueId, date, slotIndex })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('Toggle offline failed:', errorData);
        throw new Error(errorData.error || 'Failed to toggle offline booking');
      }
      return await res.json();
    } catch (error) {
      console.error('Toggle offline error:', error);
      throw error;
    }
  },

  getAllUsers: async (): Promise<User[]> => {
    try {
      const res = await fetch(`${BASE_URL}/admin/users`, { headers: getAuthHeaders() });
      if (!res.ok) return [];
      const data = await res.json();
      return data.map((u: any) => ({ ...u, id: u._id }));
    } catch (e) { 
      console.error('getAllUsers error:', e);
      return []; 
    }
  },

  deleteUser: async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`${BASE_URL}/admin/users/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('Delete user failed:', errorData);
        return false;
      }
      const data = await res.json();
      localStorage.removeItem('kickoff_venues');
      localStorage.removeItem('cached_venues');
      return data.success === true;
    } catch (error) {
      console.error('Delete user error:', error);
      return false;
    }
  },

  getOwnerBookings: async (ownerId: string): Promise<Booking[]> => {
    try {
      const res = await fetch(`${BASE_URL}/bookings/owner/${ownerId}`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.map((b: any) => ({ ...b, id: b._id }));
    } catch (e) {
      console.error('Error fetching owner bookings:', e);
      return [];
    }
  },

  getUserProfile: async (): Promise<User | null> => {
    try {
      const res = await fetch(`${BASE_URL}/users/me`, { headers: getAuthHeaders() });
      if (!res.ok) return null;
      const data = await res.json();
      return { ...data, id: data._id };
    } catch (e) { 
      console.error('getUserProfile error:', e);
      return null; 
    }
  },

  updateProfile: async (updates: Partial<User>): Promise<User | null> => {
    try {
      const res = await fetch(`${BASE_URL}/users/me`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates)
      });
      if (!res.ok) return null;
      const data = await res.json();
      const session = getSession();
      if (session) {
        const updatedUser = { ...session.user, ...updates };
        saveSession(session.token, updatedUser);
      }
      return { ...data, id: data._id };
    } catch (e) { 
      console.error('updateProfile error:', e);
      return null; 
    }
  },

  verifyToken: async (token: string): Promise<boolean> => {
    try {
      const res = await fetch(`${BASE_URL}/users/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  },

  approveBooking: async (bookingId: string): Promise<boolean> => {
    try {
      const res = await fetch(`${BASE_URL}/bookings/${bookingId}/approve`, {
        method: 'PATCH',
        headers: getAuthHeaders()
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('Approve booking failed:', errorData);
        return false;
      }
      const data = await res.json();
      return data.success === true;
    } catch (error) {
      console.error('Approve booking error:', error);
      return false;
    }
  },

  rejectBooking: async (bookingId: string): Promise<boolean> => {
    try {
      const res = await fetch(`${BASE_URL}/bookings/${bookingId}/reject`, {
        method: 'PATCH',
        headers: getAuthHeaders()
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('Reject booking failed:', errorData);
        return false;
      }
      const data = await res.json();
      return data.success === true;
    } catch (error) {
      console.error('Reject booking error:', error);
      return false;
    }
  }
};