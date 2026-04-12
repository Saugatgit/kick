
export enum UserRole {
  USER = 'USER',
  OWNER = 'OWNER',
  ADMIN = 'ADMIN'
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string; // Hashed password
  role: UserRole;
  avatar?: string;
}

export interface FutsalVenue {
  id: string;
  ownerId: string;
  name: string;
  location: string;
  pricePerHour: number;
  images: string[];
  description: string;
  rating: number;
  amenities: string[];
}

export interface Booking {
  id: string;
  venueId: string;
  userId: string;
  isOfflineBlock?: boolean; // NEW
  date: string; // YYYY-MM-DD
  slotIndex: number; // 0 to 7 representing the 8 available hours
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
  createdAt: string;
}

export const TIME_SLOTS = [
  "16:00 - 17:00",
  "17:00 - 18:00",
  "18:00 - 19:00",
  "19:00 - 20:00",
  "20:00 - 21:00",
  "21:00 - 22:00",
  "22:00 - 23:00",
  "23:00 - 00:00"
];
