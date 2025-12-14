import archiver from 'archiver';
import crypto from 'crypto';
import logger from '../utils/logger';

/**
 * Service for creating ZIP files for file uploads
 * Used for packaging user-uploaded images/videos before syncing to Priority ERP
 *
 * Note: Files are uploaded directly to Priority ERP (in-memory), not stored locally.
 */
export class ZipService {
  /**
   * Create ZIP in memory (Buffer) without saving to disk
   * Used for direct upload to Priority ERP
   *
   * @param applicatorId - Applicator ID for logging
   * @param files - Array of files with filename and buffer
   * @returns Object containing ZIP buffer, filename, file count, size, and checksum
   */
  async createApplicatorZipBuffer(
    applicatorId: string,
    files: Array<{ filename: string; buffer: Buffer }>
  ): Promise<{
    buffer: Buffer;
    filename: string;
    fileCount: number;
    sizeBytes: number;
    checksum: string;
  }> {
    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const filename = `applicator-${applicatorId}-${timestamp}.zip`;

    logger.info(`Creating ZIP buffer: ${filename} with ${files.length} files`);

    // Create archive in memory
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    // Calculate checksum for integrity verification
    const hash = crypto.createHash('sha256');

    // Collect data chunks in memory
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      archive.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      archive.on('end', () => {
        const buffer = Buffer.concat(chunks);
        logger.info(`ZIP buffer created: ${filename}, size: ${buffer.length} bytes`);

        resolve({
          buffer,
          filename,
          fileCount: files.length,
          sizeBytes: buffer.length,
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
}

// Export singleton instance
export const zipService = new ZipService();
