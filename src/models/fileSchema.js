const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  type: { type: String },
  storageProvider: { type: String, default: "cloudinary" },
  filename: { type: String, required: true }, // saved file name
  originalName: { type: String, required: true }, // original file name
  path: { type: String, required: true }, // server path (uploads/...)
  size: { type: Number, required: true }, // file size in bytes
  url: { type: String, required: true }, // ✅ public URL for frontend
  driveFileId: { type: String },
  driveFolderId: { type: String },
  driveCategoryFolderId: { type: String },
  mimeType: { type: String },
  uploadedAt: { type: Date, default: Date.now }, // timestamp
});

module.exports = mongoose.model("File", fileSchema);
