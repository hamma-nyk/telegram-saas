import mongoose, { Schema, Document, Model } from 'mongoose';

// Format struktur Album
export interface IAlbum {
  id: string;
  title: string;
  accessHash: string;
}

export interface IUser extends Document {
  username: string;
  password?: string;
  email: string;
  phone: string;
  telegramSession?: string | null;
  telegramConnected: boolean;
  temp2FA?: string | null; 
  savedAlbums?: IAlbum[];
  savedMusicChannels?: IAlbum[];
  createdAt: Date;
  updatedAt: Date;
}

const userSchema: Schema<IUser> = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  telegramSession: { type: String, default: null }, 
  telegramConnected: { type: Boolean, default: false },
  temp2FA: { type: String, default: null },
  savedAlbums: { type: Array, default: [] },
  savedMusicChannels: { type: Array, default: [] },
}, { 
  timestamps: true,
  collection: 'tb_user' 
});

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>("User", userSchema);
export default User;