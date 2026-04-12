import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Increased limit to handle base64 image uploads
app.use(express.json({ limit: '20mb' }));
app.use(cors());

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required');
  process.exit(1);
}

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/kickoff';
const PORT = process.env.PORT || 5001;
const UPLOAD_DIR = path.join(__dirname, 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Serve uploaded files as static assets
app.use('/uploads', express.static(UPLOAD_DIR));

// --- HELPER: SAVE BASE64 TO FILE ---
const saveImage = (base64String, subDir = '') => {
  if (!base64String || !base64String.startsWith('data:image')) {
    return base64String; // Return as is if it's already a URL (like Unsplash)
  }

  try {
    const matches = base64String.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return base64String;

    const extension = matches[1].split('/')[1];
    const data = matches[2];
    const buffer = Buffer.from(data, 'base64');
    
    const fileName = `img_${Date.now()}_${Math.floor(Math.random() * 1000)}.${extension}`;
    const filePath = path.join(UPLOAD_DIR, fileName);
    
    fs.writeFileSync(filePath, buffer);
    
    // Return the URL that will be stored in the database
    return `http://localhost:${PORT}/uploads/${fileName}`;
  } catch (err) {
    console.error('Error saving image:', err);
    return base64String;
  }
};

// --- MODELS ---
const User = mongoose.model('User', new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['USER', 'OWNER', 'ADMIN'], default: 'USER' },
  avatar: { type: String, default: '😊' }
}));

const Venue = mongoose.model('Venue', new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  location: { type: String, required: true },
  pricePerHour: { type: Number, required: true },
  images: [{ type: String }],
  description: String,
  amenities: [{ type: String }],
  rating: { type: Number, default: 5.0 }
}));

const Booking = mongoose.model('Booking', new mongoose.Schema({
  venueId: { type: mongoose.Schema.Types.ObjectId, ref: 'Venue', required: true },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: function() { return !this.isOfflineBlock; } // Only required for real bookings
  },
  isOfflineBlock: { type: Boolean, default: false }, // NEW FIELD
  blockedByOwnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Track who blocked
  date: { type: String, required: true },
  slotIndex: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['CONFIRMED', 'CANCELLED', 'PENDING', 'COMPLETED'],
    default: 'CONFIRMED' 
  },
  totalAmount: { type: Number, default: 0 },
  paymentStatus: { type: String, enum: ['PENDING', 'PAID', 'REFUNDED'], default: 'PENDING' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}));

// Create indexes
Booking.createIndexes([
  { venueId: 1, date: 1, slotIndex: 1 },
  { userId: 1 },
  { status: 1 }
]);

// --- AUTH MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token expired' });
    req.user = user;
    next();
  });
};

// Role authorization middleware
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
};
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads', 'venues');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Create unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'venue-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// --- ROUTES ---

// Maintenance: Reset/Seed Database
app.post('/api/admin/system/seed', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    await User.deleteMany({});
    await Venue.deleteMany({});
    await Booking.deleteMany({});
    res.json({ message: 'Database reset successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// User Registration
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role, avatar } = req.body;
    const processedAvatar = saveImage(avatar);
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ 
      name, 
      email: email.toLowerCase(), 
      password: hashedPassword, 
      role, 
      avatar: processedAvatar 
    });
    await user.save();
    res.status(201).json({ userId: user._id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Owner Onboarding
app.post('/api/auth/onboard-owner', async (req, res) => {
  try {
    const { ownerData, venueData } = req.body;
    
    // Process images
    ownerData.avatar = saveImage(ownerData.avatar);
    venueData.images = (venueData.images || []).map(img => saveImage(img));

    const hashedPassword = await bcrypt.hash(ownerData.password, 10);
    const user = new User({ ...ownerData, password: hashedPassword, role: 'OWNER' });
    await user.save();
    
    const venue = new Venue({ ...venueData, ownerId: user._id });
    await venue.save();
    
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user, venue });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Create Venue
app.post('/api/venues', authenticateToken, async (req, res) => {
  try {
    const venueData = { ...req.body, ownerId: req.user.id };
    // Process base64 images to files
    if (venueData.images) {
      venueData.images = venueData.images.map(img => saveImage(img));
    }
    const venue = new Venue(venueData);
    await venue.save();
    res.status(201).json(venue);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get all venues
app.get('/api/venues', async (req, res) => { 
  try {
    const venues = await Venue.find();
    res.json(venues);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get single venue
app.get('/api/venues/:id', async (req, res) => {
  try {
    const venue = await Venue.findById(req.params.id);
    if (!venue) return res.status(404).json({ error: 'Venue not found' });
    res.json(venue);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get owner's venues
app.get('/api/venues/owner/:ownerId', authenticateToken, async (req, res) => {
  try {
    const venues = await Venue.find({ ownerId: req.params.ownerId });
    res.json(venues);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ 
      token, 
      user: { 
        _id: user._id, 
        name: user.name, 
        role: user.role, 
        avatar: user.avatar 
      } 
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Create Booking
app.post('/api/bookings', authenticateToken, async (req, res) => {
  try {
    const { venueId, date, slotIndex } = req.body;
    
    // Get venue to calculate price
    const venue = await Venue.findById(venueId);
    if (!venue) {
      return res.status(404).json({ error: 'Venue not found' });
    }
    
    // Check if slot is already booked or pending
    const existingBooking = await Booking.findOne({
      venueId,
      date,
      slotIndex,
      status: { $in: ['CONFIRMED', 'PENDING'] }
    });
    
    if (existingBooking) {
      return res.status(400).json({ error: 'This time slot is already booked or pending approval' });
    }
    
    // Calculate total amount
    const totalAmount = venue.pricePerHour;
    
    const booking = new Booking({ 
      venueId, 
      userId: req.user.id,
      date,
      slotIndex,
      totalAmount,
      status: 'PENDING'
    });
    
    await booking.save();
    res.status(201).json(booking);
  } catch (err) { 
    console.error('Booking creation error:', err);
    res.status(500).json({ error: err.message }); 
  }
});

// ============ CANCEL BOOKING ENDPOINT ============
// ============ CANCEL BOOKING ENDPOINT ============
app.patch('/api/bookings/:id/cancel', authenticateToken, async (req, res) => {
  try {
    
    // Find the booking with populated venue info
    const booking = await Booking.findById(req.params.id).populate('venueId');
    if (!booking) {
      return res.status(404).json({ 
        success: false,
        error: 'Booking not found' 
      });
    }
    
    
    // Check if booking is already cancelled
    if (booking.status === 'CANCELLED') {
      return res.status(400).json({ 
        success: false,
        error: 'Booking is already cancelled' 
      });
    }
    
    // Check authorization - allow if user owns booking OR is owner of venue OR is admin
    let isAuthorized = false;
    let reason = '';
    
    // 1. User owns the booking
    if (booking.userId.toString() === req.user.id) {
      isAuthorized = true;
      reason = 'User owns the booking';
    }
    // 2. User is admin
    else if (req.user.role === 'ADMIN') {
      isAuthorized = true;
      reason = 'User is admin';
    }
    // 3. User is owner of the venue
    else if (req.user.role === 'OWNER') {
      // Get the venue to check ownership
      let venue;
      if (booking.venueId && booking.venueId._id) {
        // venue is already populated
        venue = booking.venueId;
      } else {
        // venue not populated, fetch it
        venue = await Venue.findById(booking.venueId);
      }
      
      if (venue) {
        
        if (venue.ownerId.toString() === req.user.id) {
          isAuthorized = true;
          reason = 'User owns the venue';
        } else {
          reason = 'User does not own this venue';
        }
      } else {
        reason = 'Venue not found';
      }
    } else {
      reason = 'User is not owner or admin';
    }
    
    
    if (!isAuthorized) {
      return res.status(403).json({ 
        success: false,
        error: 'You are not authorized to cancel this booking' 
      });
    }
    
    // Update booking status
    booking.status = 'CANCELLED';
    booking.updatedAt = new Date();
    await booking.save();
    
    
    res.json({ 
      success: true,
      message: 'Booking cancelled successfully',
      booking: {
        id: booking._id,
        status: booking.status,
        date: booking.date,
        slotIndex: booking.slotIndex,
        venueId: booking.venueId._id || booking.venueId
      }
    });
    
  } catch (err) {
    console.error('Cancellation error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});
// ============ UNCANCEL BOOKING ENDPOINT ============
// Add this endpoint to your server.js after the cancel endpoint:

// ============ UNCANCEL BOOKING ENDPOINT ============
app.patch('/api/bookings/:id/uncancel', authenticateToken, async (req, res) => {
  try {
    
    // Find the booking with populated venue info
    const booking = await Booking.findById(req.params.id).populate('venueId');
    if (!booking) {
      return res.status(404).json({ 
        success: false,
        error: 'Booking not found' 
      });
    }
    
    
    // Check if booking is already confirmed
    if (booking.status === 'CONFIRMED') {
      return res.status(400).json({ 
        success: false,
        error: 'Booking is already active' 
      });
    }
    
    // Check if booking is cancelled
    if (booking.status !== 'CANCELLED') {
      return res.status(400).json({ 
        success: false,
        error: 'Only cancelled bookings can be restored' 
      });
    }
    
    // Check authorization - allow if user owns booking OR is owner of venue OR is admin
    let isAuthorized = false;
    let reason = '';
    
    // 1. User owns the booking
    if (booking.userId.toString() === req.user.id) {
      isAuthorized = true;
      reason = 'User owns the booking';
    }
    // 2. User is admin
    else if (req.user.role === 'ADMIN') {
      isAuthorized = true;
      reason = 'User is admin';
    }
    // 3. User is owner of the venue
    else if (req.user.role === 'OWNER') {
      // Get the venue to check ownership
      let venue;
      if (booking.venueId && booking.venueId._id) {
        // venue is already populated
        venue = booking.venueId;
      } else {
        // venue not populated, fetch it
        venue = await Venue.findById(booking.venueId);
      }
      
      if (venue) {
        
        if (venue.ownerId.toString() === req.user.id) {
          isAuthorized = true;
          reason = 'User owns the venue';
        } else {
          reason = 'User does not own this venue';
        }
      } else {
        reason = 'Venue not found';
      }
    } else {
      reason = 'User is not owner or admin';
    }
    
    
    if (!isAuthorized) {
      return res.status(403).json({ 
        success: false,
        error: 'You are not authorized to restore this booking' 
      });
    }
    
    // Check if slot is already booked by someone else
    const existingBooking = await Booking.findOne({
      venueId: booking.venueId,
      date: booking.date,
      slotIndex: booking.slotIndex,
      status: 'CONFIRMED',
      _id: { $ne: booking._id } // Exclude the current booking
    });
    
    if (existingBooking) {
      return res.status(400).json({ 
        success: false,
        error: 'This time slot is now booked by another user' 
      });
    }
    
    // Restore booking status
    booking.status = 'CONFIRMED';
    booking.updatedAt = new Date();
    await booking.save();
    
    
    res.json({ 
      success: true,
      message: 'Booking restored successfully',
      booking: {
        id: booking._id,
        status: booking.status,
        date: booking.date,
        slotIndex: booking.slotIndex,
        venueId: booking.venueId._id || booking.venueId
      }
    });
    
  } catch (err) {
    console.error('Uncancel error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

// ============ APPROVE BOOKING ENDPOINT ============
app.patch('/api/bookings/:id/approve', authenticateToken, authorizeRoles('OWNER'), async (req, res) => {
  try {
    // Find the booking with populated venue info
    const booking = await Booking.findById(req.params.id).populate('venueId');
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    // Check if booking is pending
    if (booking.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        error: 'Only pending bookings can be approved'
      });
    }

    // Check if user is owner of the venue
    let venue;
    if (booking.venueId && booking.venueId._id) {
      venue = booking.venueId;
    } else {
      venue = await Venue.findById(booking.venueId);
    }

    if (!venue || venue.ownerId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'You are not authorized to approve this booking'
      });
    }

    // Check if slot is still available (no other confirmed bookings)
    const conflictingBooking = await Booking.findOne({
      venueId: booking.venueId,
      date: booking.date,
      slotIndex: booking.slotIndex,
      status: 'CONFIRMED',
      _id: { $ne: booking._id }
    });

    if (conflictingBooking) {
      return res.status(400).json({
        success: false,
        error: 'This time slot is now booked by another user'
      });
    }

    // Approve the booking
    booking.status = 'CONFIRMED';
    booking.updatedAt = new Date();
    await booking.save();

    res.json({
      success: true,
      message: 'Booking approved successfully',
      booking: {
        id: booking._id,
        status: booking.status,
        date: booking.date,
        slotIndex: booking.slotIndex,
        venueId: booking.venueId._id || booking.venueId
      }
    });

  } catch (err) {
    console.error('Approval error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// ============ REJECT BOOKING ENDPOINT ============
app.patch('/api/bookings/:id/reject', authenticateToken, authorizeRoles('OWNER'), async (req, res) => {
  try {
    // Find the booking with populated venue info
    const booking = await Booking.findById(req.params.id).populate('venueId');
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    // Check if booking is pending
    if (booking.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        error: 'Only pending bookings can be rejected'
      });
    }

    // Check if user is owner of the venue
    let venue;
    if (booking.venueId && booking.venueId._id) {
      venue = booking.venueId;
    } else {
      venue = await Venue.findById(booking.venueId);
    }

    if (!venue || venue.ownerId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'You are not authorized to reject this booking'
      });
    }

    // Reject the booking (delete it)
    await Booking.findByIdAndDelete(booking._id);

    res.json({
      success: true,
      message: 'Booking rejected and removed'
    });

  } catch (err) {
    console.error('Rejection error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Get user bookings
app.get('/api/bookings/user/:userId', authenticateToken, async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.params.userId })
      .populate('venueId', 'name images pricePerHour location')
      .sort({ date: -1, createdAt: -1 });
    res.json(bookings);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get owner's bookings (all bookings for all venues owned by this owner)
app.get('/api/bookings/owner/:ownerId', authenticateToken, async (req, res) => {
  try {
    // Find all venues owned by this owner
    const venues = await Venue.find({ ownerId: req.params.ownerId });
    
    const venueIds = venues.map(v => v._id);
    
    // Find all bookings for those venues, excluding offline blocks
    const bookings = await Booking.find({ 
      venueId: { $in: venueIds },
      isOfflineBlock: { $ne: true }  // Exclude offline bookings
    })
      .populate('userId', 'name email avatar')
      .populate('venueId', 'name pricePerHour ownerId')
        .sort({ date: -1, slotIndex: 1 });

      // Return a simplified view for the owner
      res.json(bookings.map(b => ({
        id: b._id,
        venueName: b.venueId?.name || null,
        date: b.date,
        slot: b.slotIndex,
        status: b.status
      })));
  } catch (err) { 
    console.error('Error fetching owner bookings:', err);
    res.status(500).json({ error: err.message }); 
  }
});

// Get venue bookings
// Get venue bookings with proper population
app.get('/api/bookings/venue/:venueId', authenticateToken, async (req, res) => {
  try {
    const { date } = req.query;
    const query = { venueId: req.params.venueId };
    if (date) query.date = date;
    
    const bookings = await Booking.find(query)
      .populate({
        path: 'userId',
        select: 'name email avatar role',
        match: { isOfflineBlock: { $ne: true } } // Only populate for real users
      })
      .populate({
        path: 'blockedByOwnerId',
        select: 'name email',
        match: { isOfflineBlock: true } // Only populate for offline blocks
      })
      .populate({
        path: 'venueId',
        select: 'name pricePerHour ownerId'
      })
      .sort({ slotIndex: 1 });
    
    res.json(bookings);
  } catch (err) { 
    console.error('Error fetching venue bookings:', err);
    res.status(500).json({ error: err.message }); 
  }
});

// Toggle Offline Booking (Owner blocks/unblocks slot)
app.post('/api/bookings/toggle-offline', authenticateToken, async (req, res) => {
  try {
    const { venueId, date, slotIndex } = req.body;
    
    
    // Verify venue exists and belongs to owner
    const venue = await Venue.findById(venueId);
    if (!venue) {
      return res.status(404).json({ 
        success: false,
        error: 'Venue not found' 
      });
    }
    
    
    if (venue.ownerId.toString() !== req.user.id) {
      return res.status(403).json({ 
        success: false,
        error: 'Only venue owner can manage offline bookings' 
      });
    }
    
    // Check if slot already has a booking
    const existingBooking = await Booking.findOne({
      venueId,
      date,
      slotIndex,
      status: 'CONFIRMED'
    });
    
    if (existingBooking) {
      
      // If it's an offline booking, remove it
      if (existingBooking.isOfflineBlock === true) {
        await Booking.findByIdAndDelete(existingBooking._id);
        return res.json({ 
          success: true,
          action: 'unblocked', 
          message: 'Slot unblocked' 
        });
      } else {
        return res.status(400).json({ 
          success: false,
          error: 'Slot already booked by a user' 
        });
      }
    } else {
      // Create offline booking to block slot
      const offlineBooking = new Booking({
        venueId,
        date,
        slotIndex,
        userId: req.user.id, // Store owner's ID but mark as offline
        isOfflineBlock: true,
        blockedByOwnerId: req.user.id,
        status: 'CONFIRMED',
        totalAmount: 0,
        paymentStatus: 'PAID'
      });
      
      await offlineBooking.save();
      
      return res.json({ 
        success: true,
        action: 'blocked', 
        message: 'Slot blocked',
        booking: offlineBooking
      });
    }
  } catch (err) {
    console.error('Toggle offline error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});
// Create venue with photo uploads (multiple photos)
app.post('/api/venues/upload', authenticateToken, upload.array('photos', 5), async (req, res) => {
  try {
    
    const { name, location, pricePerHour, description, amenities } = req.body;
    const ownerId = req.user.id;
    
    if (!req.files || req.files.length < 2) {
      return res.status(400).json({ 
        success: false, 
        error: 'At least 2 photos are required' 
      });
    }
    
    // Convert amenities string to array
    let amenitiesArray = [];
    if (amenities) {
      amenitiesArray = amenities.split(',').map(item => item.trim()).filter(item => item !== '');
    }
    
    // Create image URLs from uploaded files
    const images = req.files.map(file => 
      `http://localhost:${PORT}/uploads/venues/${file.filename}`
    );
    
    const venue = new Venue({
      ownerId,
      name,
      location,
      pricePerHour: Number(pricePerHour),
      images,
      description,
      rating: 5.0,
      amenities: amenitiesArray
    });
    
    await venue.save();
    
    res.status(201).json({
      success: true,
      message: 'Venue created successfully',
      venue
    });
    
  } catch (err) {
    console.error('Error creating venue:', err);
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});

// Owner onboarding with venue photos
app.post('/api/auth/onboard-owner-with-photos', upload.array('venuePhotos', 5), async (req, res) => {
  try {
    
    const { ownerName, ownerEmail, ownerPassword, venueName, venueLocation, 
            venuePrice, venueDescription, venueAmenities } = req.body;
    
    // Check if all required fields are present
    if (!req.files || req.files.length < 2) {
      return res.status(400).json({ 
        success: false, 
        error: 'At least 2 venue photos are required' 
      });
    }
    
    // 1. Create owner account
    const hashedPassword = await bcrypt.hash(ownerPassword, 10);
    const owner = new User({
      name: ownerName,
      email: ownerEmail.toLowerCase(),
      password: hashedPassword,
      role: 'OWNER',
      avatar: '🏢' // Default avatar
    });
    
    await owner.save();
    
    // 2. Create venue with uploaded photos
    const venueImages = req.files.map(file => 
      `http://localhost:${PORT}/uploads/venues/${file.filename}`
    );
    
    let amenitiesArray = [];
    if (venueAmenities) {
      amenitiesArray = venueAmenities.split(',').map(item => item.trim()).filter(item => item !== '');
    }
    
    const venue = new Venue({
      ownerId: owner._id,
      name: venueName,
      location: venueLocation,
      pricePerHour: Number(venuePrice),
      images: venueImages,
      description: venueDescription,
      rating: 5.0,
      amenities: amenitiesArray
    });
    
    await venue.save();
    
    // 3. Create token
    const token = jwt.sign({ id: owner._id, role: owner.role }, JWT_SECRET, { expiresIn: '7d' });
    
    res.status(201).json({
      success: true,
      message: 'Owner account and venue created successfully',
      token,
      user: {
        _id: owner._id,
        name: owner.name,
        email: owner.email,
        role: owner.role,
        avatar: owner.avatar
      },
      venue
    });
    
  } catch (err) {
    console.error('Onboard owner error:', err);
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});

// Admin: Get all users
app.get('/api/admin/users', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const users = await User.find({}, '-password');
    res.json(users);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin: Delete user
// Admin: Delete user
// Admin: Delete user (with automatic venue deletion)
app.delete('/api/admin/users/:id', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    
    // Find the user to delete
    const userToDelete = await User.findById(req.params.id);
    if (!userToDelete) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }
    
    
    // Prevent deleting yourself
    if (userToDelete._id.toString() === req.user.id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot delete your own account' 
      });
    }
    
    // Prevent deleting admin accounts
    if (userToDelete.role === 'ADMIN') {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot delete admin accounts' 
      });
    }
    
    let deletedVenuesCount = 0;
    let deletedBookingsCount = 0;
    
    // If user is an OWNER, delete their venues and bookings FIRST
    if (userToDelete.role === 'OWNER') {
      
      // 1. Find all venues owned by this user
      const venuesToDelete = await Venue.find({ ownerId: userToDelete._id });
      
      if (venuesToDelete.length > 0) {
        // Get venue IDs for booking deletion
        const venueIds = venuesToDelete.map(v => v._id);
        
        // 2. Delete all bookings for these venues
        const bookingResult = await Booking.deleteMany({ 
          venueId: { $in: venueIds } 
        });
        deletedBookingsCount = bookingResult.deletedCount;
        
        // 3. Delete the venues
        const venueResult = await Venue.deleteMany({ ownerId: userToDelete._id });
        deletedVenuesCount = venueResult.deletedCount;
        
        // Log details of deleted venues
        venuesToDelete.forEach((venue, index) => {
        });
      } else {
      }
    }
    
    // 4. Finally, delete the user account
    await User.findByIdAndDelete(req.params.id);
    
    if (userToDelete.role === 'OWNER') {
    }
    
    res.json({ 
      success: true,
      message: `User ${userToDelete.name} deleted successfully`,
      deletedUser: {
        id: userToDelete._id,
        name: userToDelete.name,
        role: userToDelete.role
      },
      deletedData: {
        venues: deletedVenuesCount,
        bookings: deletedBookingsCount
      }
    });
    
  } catch (err) {
    console.error('❌ Error deleting user:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

// Get user profile
app.get('/api/users/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update user profile
app.put('/api/users/me', authenticateToken, async (req, res) => {
  try {
    const { name, avatar, phone } = req.body;
    const updates = {};
    
    if (name) updates.name = name;
    if (avatar) updates.avatar = saveImage(avatar);
    if (phone) updates.phone = phone;
    
    const user = await User.findByIdAndUpdate(
      req.user.id,
      updates,
      { new: true, select: '-password' }
    );
    
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Test endpoint
app.get('/api/test/cancel', authenticateToken, (req, res) => {
  res.json({ 
    success: true, 
    message: 'Test endpoint works',
    user: req.user 
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});
app.use('/uploads/venues', express.static(path.join(__dirname, 'uploads', 'venues')));


// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong!' 
      : err.message 
  });
});

// Helper function to delete old bookings
const deleteOldBookings = async () => {
  try {
    // Get today and yesterday as YYYY-MM-DD strings
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const todayStr = today.toISOString().split('T')[0];
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Delete bookings older than yesterday (strictly before yesterday)
    const result = await Booking.deleteMany({
      date: { $lt: yesterdayStr }
    });

    if (result.deletedCount > 0) {
      console.log(`Cleaned up ${result.deletedCount} old bookings (before ${yesterdayStr}).`);
    }

    return result.deletedCount;
  } catch (err) {
    console.error('Error deleting old bookings:', err);
    return 0;
  }
};

// Endpoint to manually trigger cleanup
app.post('/api/admin/cleanup-old-bookings', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const deletedCount = await deleteOldBookings();
    res.json({ 
      success: true, 
      message: `Deleted ${deletedCount} old bookings`,
      deletedCount 
    });
  } catch (err) {
    console.error('Error in cleanup endpoint:', err);
    res.status(500).json({ error: err.message });
  }
});

// Automatic cleanup on server startup and every 24 hours
const scheduleCleanup = () => {
  // Run cleanup immediately on startup
  deleteOldBookings();
  
  // Then run every 24 hours (86400000 ms)
  setInterval(() => {
    deleteOldBookings();
  }, 24 * 60 * 60 * 1000);
};


// MongoDB Connection
mongoose.connect(MONGO_URI)
  .then(() => {
    
    // Start automatic cleanup schedule
    scheduleCleanup();
  })
  .catch(err => {
    // Log the DB connection error but do not exit — allow server to start for development
    console.error('MongoDB connection error (continuing without DB):', err && err.message ? err.message : err);
  })
  .finally(() => {
    // Start HTTP server regardless of DB connection state to avoid nodemon crashing
    app.listen(PORT);
  });