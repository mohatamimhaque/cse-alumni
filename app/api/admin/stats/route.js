import sql from '@/lib/db';
import { isAdmin, adminUnauthorized } from '@/lib/auth';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

// Initialize S3 client for R2
const initS3Client = () => {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKey = process.env.R2_ACCESS_KEY_ID;
  const secretKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKey || !secretKey) {
    return null;
  }

  try {
    return new S3Client({
      region: 'auto',
      credentials: {
        accessKeyId: accessKey.trim(),
        secretAccessKey: secretKey.trim(),
      },
      endpoint: endpoint.trim(),
    });
  } catch (error) {
    return null;
  }
};

const R2_BUCKET = process.env.R2_BUCKET_NAME || 'reunion-photos';

// GET /api/admin/stats - Get storage and operation stats (admin only)
export async function GET() {
  if (!(await isAdmin())) return adminUnauthorized();

  try {
    // Database stats
    const memberStats = await sql`SELECT COUNT(*) as count FROM members`;
    const analyticsStats = await sql`SELECT COUNT(*) as count FROM analytics`;
    const totalMembers = Number(memberStats[0]?.count || 0);
    const totalAnalytics = Number(analyticsStats[0]?.count || 0);

    // R2 storage stats
    let r2Objects = 0;
    let r2StorageBytes = 0;
    let r2Error = null;

    try {
      const s3Client = initS3Client();
      
      if (!s3Client) {
        r2Error = 'R2 not configured';
      } else {
        let continuationToken = undefined;
        let hasMore = true;

        while (hasMore) {
          try {
            const response = await s3Client.send(
              new ListObjectsV2Command({
                Bucket: R2_BUCKET,
                ContinuationToken: continuationToken,
                MaxKeys: 1000,
              })
            );

            if (response.Contents && response.Contents.length > 0) {
              r2Objects += response.Contents.length;
              r2StorageBytes += response.Contents.reduce((sum, obj) => sum + (obj.Size || 0), 0);
            }

            hasMore = response.IsTruncated === true;
            continuationToken = response.NextContinuationToken;
          } catch (loopError) {
            r2Error = loopError.message;
            hasMore = false;
          }
        }
      }
    } catch (error) {
      r2Error = error.message;
    }

    // Convert bytes to MB/GB
    const r2StorageMB = (r2StorageBytes / (1024 * 1024)).toFixed(2);
    const r2StorageGB = (r2StorageBytes / (1024 * 1024 * 1024)).toFixed(3);

    return Response.json({
      database: {
        members: totalMembers,
        analyticsRecords: totalAnalytics,
        totalRecords: totalMembers + totalAnalytics,
      },
      storage: {
        r2Objects,
        r2StorageBytes,
        r2StorageMB: parseFloat(r2StorageMB),
        r2StorageGB: parseFloat(r2StorageGB),
        r2StorageFormatted: r2StorageGB >= 1 ? `${r2StorageGB} GB` : `${r2StorageMB} MB`,
        r2Error: r2Error || null,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
