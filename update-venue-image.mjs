import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/kickoff';
const PORT = process.env.PORT || 5000;

const VENUE_IMAGE_URL = `http://localhost:${PORT}/uploads/venues/soccer-ball-goal-sunlight-118635243.jpeg`;

async function main() {
  try {
    await mongoose.connect(MONGO_URI, { dbName: process.env.MONGO_DB || undefined });
    console.log('Connected to MongoDB');

    const VenueSchema = new mongoose.Schema({ name: String, images: [String] }, { strict: false });
    const Venue = mongoose.model('Venue', VenueSchema);

    // Match common name variations
    const query = { name: { $regex: 'central futsal|arean central|arena central', $options: 'i' } };
    const update = { $set: { images: [VENUE_IMAGE_URL] } };

    const result = await Venue.updateMany(query, update);
    console.log('Update result:', result);

    const updated = await Venue.find(query).select('name images').lean();
    console.log('Updated documents:', updated);

    await mongoose.disconnect();
    console.log('Done.');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
