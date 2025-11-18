import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import Applicator from '../models/Applicator';
import { Op } from 'sequelize';
import logger from '../utils/logger';

/**
 * Service for creating, managing, and cleaning up ZIP files for file uploads
 * Used for packaging user-uploaded images/videos before syncing to Priority ERP
 */
export class ZipService {
  private uploadsDir: string;

  constructor() {
    // Use absolute path that works in Docker container
    this.uploadsDir = path.resolve(process.cwd(), 'uploads', 'zips');
    this.ensureDirectoryExists();
  }

  /**
   * Ensure the uploads directory exists
   */
  private ensureDirectoryExists(): void {
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
      logger.info(`Created uploads directory: ${this.uploadsDir}`);
    }
  }

  /**
   * Create ZIP file from uploaded files
   *
   * @param applicatorId - Applicator ID for filename generation
   * @param files - Array of files with filename and buffer
   * @returns Object containing ZIP path, filename, file count, size, and checksum
   */
  async createApplicatorZip(
    applicatorId: string,
    files: Array<{ filename: string; buffer: Buffer }>
  ): Promise<{
    zipPath: string;
    filename: string;
    fileCount: number;
    sizeBytes: number;
    checksum: string;
  }> {
    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const filename = `applicator-${applicatorId}-${timestamp}.zip`;
    const zipPath = path.join(this.uploadsDir, filename);

    logger.info(`Creating ZIP file: ${filename} with ${files.length} files`);

    // Create ZIP with streaming (memory efficient for large files)
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    // Calculate checksum for integrity verification
    const hash = crypto.createHash('sha256');

    return new Promise((resolve, reject) => {
      output.on('close', () => {
        const stats = fs.statSync(zipPath);
        logger.info(`ZIP created: ${filename}, size: ${stats.size} bytes`);

        resolve({
          zipPath,
          filename,
          fileCount: files.length,
          sizeBytes: stats.size,
          checksum: hash.digest('hex')
        });
      });

      archive.on('error', (err) => {
        logger.error(`ZIP creation error: ${err.message}`);
        reject(err);
      });

      archive.on('warning', (err) => {
        if (err.code === 'ENOENT') {
          logger.warn(`ZIP warning: ${err.message}`);
        } else {
          reject(err);
        }
      });

      // Pipe archive data to the file
      archive.pipe(output);

      // Add files to archive
      files.forEach((file, index) => {
        try {
          archive.append(file.buffer, { name: file.filename });
          hash.update(file.buffer);
          logger.debug(`Added file ${index + 1}/${files.length}: ${file.filename}`);
        } catch (err) {
          logger.error(`Error adding file ${file.filename}: ${err}`);
          throw err;
        }
      });

      // Finalize the archive
      archive.finalize();
    });
  }

  /**
   * Read ZIP file and convert to Base64 for Priority upload
   *
   * @param zipPath - Path to ZIP file
   * @returns Base64 encoded string of ZIP file
   */
  async readZipAsBase64(zipPath: string): Promise<string> {
    if (!fs.existsSync(zipPath)) {
      throw new Error(`ZIP file not found: ${zipPath}`);
    }

    logger.debug(`Reading ZIP file as Base64: ${zipPath}`);
    const buffer = fs.readFileSync(zipPath);
    return buffer.toString('base64');
  }

  /**
   * Delete ZIP file after successful sync to Priority
   *
   * @param zipPath - Path to ZIP file to delete
   */
  async deleteZip(zipPath: string): Promise<void> {
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
      logger.info(`Deleted ZIP file: ${zipPath}`);
    } else {
      logger.warn(`ZIP file not found for deletion: ${zipPath}`);
    }
  }

  /**
   * Cleanup old synced ZIPs (safety net for cron job)
   * Removes ZIP files for applicators that have been successfully synced
   *
   * @returns Number of ZIPs deleted
   *
   * NOTE: Commented out until Applicator model includes attachment fields
   * (attachmentSyncStatus, attachmentZipPath)
   * TODO: Uncomment when feature is complete
   */
  async cleanupSyncedZips(): Promise<number> {
    logger.warn('cleanupSyncedZips() is not yet implemented - attachment fields not in model');
    return 0;

    /* // COMMENTED OUT - waiting for Applicator model updates
    logger.info('Starting cleanup of synced ZIP files');

    try {
      // Find applicators with synced status and ZIP paths
      const applicators = await Applicator.findAll({
        where: {
          attachmentSyncStatus: 'synced',
          attachmentZipPath: { [Op.ne]: null }
        }
      });

      let deletedCount = 0;

      for (const applicator of applicators) {
        if (applicator.attachmentZipPath && fs.existsSync(applicator.attachmentZipPath)) {
          try {
            fs.unlinkSync(applicator.attachmentZipPath);

            // Clear ZIP path in database
            await applicator.update({ attachmentZipPath: null });

            deletedCount++;
            logger.debug(`Cleaned up ZIP for applicator ${applicator.id}`);
          } catch (err) {
            logger.error(`Error deleting ZIP for applicator ${applicator.id}: ${err}`);
          }
        }
      }

      logger.info(`Cleanup completed: ${deletedCount} ZIP files deleted`);
      return deletedCount;
    } catch (err) {
      logger.error(`Cleanup job error: ${err}`);
      throw err;
    }
    */
  }

  /**
   * Cleanup orphaned ZIP files (files without database reference)
   * Run periodically to prevent disk space issues
   *
   * @param olderThanDays - Delete files older than this many days
   * @returns Number of orphaned files deleted
   *
   * NOTE: Commented out until Applicator model includes attachment fields
   * TODO: Uncomment when feature is complete
   */
  async cleanupOrphanedZips(olderThanDays: number = 7): Promise<number> {
    logger.warn('cleanupOrphanedZips() is not yet implemented - attachment fields not in model');
    return 0;

    /* // COMMENTED OUT - waiting for Applicator model updates
    logger.info(`Starting cleanup of orphaned ZIP files (older than ${olderThanDays} days)`);

    try {
      const files = fs.readdirSync(this.uploadsDir);
      const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
      let deletedCount = 0;

      for (const file of files) {
        const filePath = path.join(this.uploadsDir, file);
        const stats = fs.statSync(filePath);

        // Check if file is old enough
        if (stats.mtimeMs < cutoffTime) {
          // Check if file is referenced in database
          const applicator = await Applicator.findOne({
            where: {
              attachmentZipPath: filePath
            }
          });

          // If not referenced, it's orphaned - delete it
          if (!applicator) {
            fs.unlinkSync(filePath);
            deletedCount++;
            logger.debug(`Deleted orphaned ZIP: ${file}`);
          }
        }
      }

      logger.info(`Orphaned cleanup completed: ${deletedCount} files deleted`);
      return deletedCount;
    } catch (err) {
      logger.error(`Orphaned cleanup error: ${err}`);
      throw err;
    }
    */
  }

  /**
   * Get disk usage statistics for uploads directory
   *
   * @returns Object with total size and file count
   */
  async getDiskUsageStats(): Promise<{ totalSizeBytes: number; fileCount: number }> {
    try {
      const files = fs.readdirSync(this.uploadsDir);
      let totalSize = 0;

      for (const file of files) {
        const filePath = path.join(this.uploadsDir, file);
        const stats = fs.statSync(filePath);
        totalSize += stats.size;
      }

      return {
        totalSizeBytes: totalSize,
        fileCount: files.length
      };
    } catch (err) {
      logger.error(`Error getting disk usage stats: ${err}`);
      throw err;
    }
  }
}

// Export singleton instance
export const zipService = new ZipService();
