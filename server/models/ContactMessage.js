import mongoose from 'mongoose';

const contactMessageSchema = new mongoose.Schema({
  nom: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 180 },
  subject: { type: String, required: true, trim: true, maxlength: 200 },
  message: { type: String, required: true, trim: true, maxlength: 5000 },
  lu: { type: Boolean, default: false },
  luLe: { type: Date, default: null },
  ip: { type: String, default: '' },
  userAgent: { type: String, default: '' }
}, {
  timestamps: true
});

contactMessageSchema.index({ createdAt: -1 });
contactMessageSchema.index({ email: 1 });
contactMessageSchema.index({ lu: 1, createdAt: -1 });

const ContactMessage = mongoose.model('ContactMessage', contactMessageSchema);
export default ContactMessage;
