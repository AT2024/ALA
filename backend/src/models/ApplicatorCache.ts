import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

/**
 * ApplicatorCache Model
 *
 * SAFETY-CRITICAL: This cache enables fail-safe validation when ERP is offline.
 *
 * Pattern: FAIL-CLOSED (not fail-open)
 * - Cache is updated on every successful ERP query
 * - TTL: 24 hours (configurable via CACHE_TTL_HOURS)
 * - If cache is stale or missing when ERP offline: BLOCK operation
 * - NEVER proceed with expired/stale metadata for medical devices
 *
 * See: .claude/rules/priority-integration.md for validation flow
 */

// ApplicatorCache attributes interface
interface ApplicatorCacheAttributes {
  serialNumber: string;       // Primary key - applicator serial number
  SIBD_NOUSE: string | null;  // 'Y' if applicator marked "NO USE"
  SIBD_EXPIRY: string | null; // Expiry date from ERP
  SIBD_TREATTYPE: string | null; // Treatment type compatibility
  SIBD_SEEDQTY: number | null;   // Seed quantity from ERP
  SIBD_SEEDLEN: number | null;   // Seed length from ERP
  PARTDES: string | null;        // Part description / applicator type
  PARTNAME: string | null;       // Catalog number
  cachedAt: Date;             // When this cache entry was last updated
}

// For creating a new cache entry
type ApplicatorCacheCreationAttributes = Optional<ApplicatorCacheAttributes, 'SIBD_NOUSE' | 'SIBD_EXPIRY' | 'SIBD_TREATTYPE' | 'SIBD_SEEDQTY' | 'SIBD_SEEDLEN' | 'PARTDES' | 'PARTNAME'>;

class ApplicatorCache extends Model<ApplicatorCacheAttributes, ApplicatorCacheCreationAttributes> implements ApplicatorCacheAttributes {
  public serialNumber!: string;
  public SIBD_NOUSE!: string | null;
  public SIBD_EXPIRY!: string | null;
  public SIBD_TREATTYPE!: string | null;
  public SIBD_SEEDQTY!: number | null;
  public SIBD_SEEDLEN!: number | null;
  public PARTDES!: string | null;
  public PARTNAME!: string | null;
  public cachedAt!: Date;
}

ApplicatorCache.init(
  {
    serialNumber: {
      type: DataTypes.STRING(100),
      primaryKey: true,
      allowNull: false,
      field: 'serial_number',
    },
    SIBD_NOUSE: {
      type: DataTypes.STRING(10),
      allowNull: true,
      field: 'sibd_nouse',
      comment: 'Y if applicator marked NO USE in Priority',
    },
    SIBD_EXPIRY: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'sibd_expiry',
      comment: 'Expiry date from Priority ERP',
    },
    SIBD_TREATTYPE: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'sibd_treattype',
      comment: 'Treatment type compatibility',
    },
    SIBD_SEEDQTY: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'sibd_seedqty',
      comment: 'Seed quantity from Priority',
    },
    SIBD_SEEDLEN: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      field: 'sibd_seedlen',
      comment: 'Seed length from Priority',
    },
    PARTDES: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'partdes',
      comment: 'Part description / applicator type from Priority',
    },
    PARTNAME: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'partname',
      comment: 'Catalog number from Priority',
    },
    cachedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'cached_at',
      comment: 'Timestamp when cache was last updated from ERP',
    },
  },
  {
    sequelize,
    modelName: 'ApplicatorCache',
    tableName: 'applicator_cache',
    timestamps: false, // We manage cachedAt manually
    indexes: [
      {
        fields: ['cached_at'], // For stale cache queries
      },
    ],
  }
);

export default ApplicatorCache;
