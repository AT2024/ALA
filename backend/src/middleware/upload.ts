import multer from 'multer';
import path from 'path';
import fs from 'fs';
import logger from '../utils/logger';

/**
 * Multer configuration for file uploads
 * Handles images and videos for applicator comments
 */

// Ensure temp directory exists
const tempDir = path.resolve(process.cwd(), 'uploads', 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
  logger.info(`Created temp directory: ${tempDir}`);
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    const filename = `${basename}-${uniqueSuffix}${ext}`;
    cb(null, filename);
  }
});

// File filter for allowed types
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Allowed MIME types for images and videos
  const allowedMimes = [
    // Images
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    // Videos
    'video/mp4',
    'video/mpeg',
    'video/quicktime',
    'video/x-msvideo', // AVI
    'video/x-ms-wmv',  // WMV
    // Documents
    'application/pdf'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    logger.warn(`Rejected file upload: invalid MIME type ${file.mimetype}`);
    cb(new Error(`Invalid file type: ${file.mimetype}. Only images, videos, and PDFs are allowed.`));
  }
};

/**
 * Multer upload middleware
 *
 * Configuration:
 * - Max file size: 50MB per file
 * - Allowed types: Images (JPEG, PNG, GIF, WebP), Videos (MP4, MPEG, QuickTime, AVI, WMV), and PDFs
 * - Storage: Temporary directory (files cleaned up after ZIP creation)
 *
 * Usage:
 * ```typescript
 * router.post('/upload', uploadMiddleware.array('files', 10), handler);
 * ```
 */
export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max per file
    files: 10 // Max 10 files per request
  }
});

/**
 * Cleanup temporary files after processing
 * Call this in upload handler after creating ZIP
 *
 * @param files - Array of uploaded files from req.files
 */
export function cleanupTempFiles(files: Express.Multer.File[]): void {
  files.forEach(file => {
    try {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
        logger.debug(`Deleted temp file: ${file.filename}`);
      }
    } catch (err) {
      logger.error(`Error deleting temp file ${file.filename}: ${err}`);
    }
  });
}

/**
 * Cleanup old temp files (safety net)
 * Run periodically to prevent disk space issues
 *
 * @param olderThanHours - Delete files older than this many hours (default: 24)
 * @returns Number of files deleted
 */
export async function cleanupOldTempFiles(olderThanHours = 24): Promise<number> {
  try {
    const files = fs.readdirSync(tempDir);
    const cutoffTime = Date.now() - (olderThanHours * 60 * 60 * 1000);
    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(tempDir, file);
      const stats = fs.statSync(filePath);

      if (stats.mtimeMs < cutoffTime) {
        fs.unlinkSync(filePath);
        deletedCount++;
        logger.debug(`Deleted old temp file: ${file}`);
      }
    }

    if (deletedCount > 0) {
      logger.info(`Cleaned up ${deletedCount} old temp files`);
    }

    return deletedCount;
  } catch (err) {
    logger.error(`Error cleaning up temp files: ${err}`);
    throw err;
  }
}
