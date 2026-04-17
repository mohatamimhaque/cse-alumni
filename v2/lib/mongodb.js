import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error('Please add your MongoDB URI to .env.local');
}

const options = {
  serverSelectionTimeoutMS: 15000,
  connectTimeoutMS: 15000,
};

let clientPromise = null;

/**
 * For networks that block SRV DNS lookups, resolve mongodb+srv:// 
 * to a standard mongodb:// URI using Google DNS-over-HTTPS.
 */
async function resolveSrvUri(srvUri) {
  const match = srvUri.match(/^mongodb\+srv:\/\/([^:]+):([^@]+)@([^/?]+)(\/?\??.*)$/);
  if (!match) return srvUri; // not SRV, use as-is

  const [, user, pass, host, queryPart] = match;

  try {
    // Resolve SRV records via Google DNS-over-HTTPS
    const srvRes = await fetch(`https://dns.google/resolve?name=_mongodb._tcp.${host}&type=SRV`);
    const srvData = await srvRes.json();

    if (!srvData.Answer || srvData.Answer.length === 0) {
      console.warn('⚠️ No SRV records found, falling back to original URI');
      return srvUri;
    }

    // Parse SRV records: "priority weight port target"
    const hosts = srvData.Answer.map((a) => {
      const parts = a.data.split(' ');
      return `${parts[3].replace(/\.$/, '')}:${parts[2]}`;
    });

    // Resolve TXT record for connection options
    let txtOptions = '';
    try {
      const txtRes = await fetch(`https://dns.google/resolve?name=${host}&type=TXT`);
      const txtData = await txtRes.json();
      if (txtData.Answer && txtData.Answer.length > 0) {
        txtOptions = txtData.Answer[0].data.replace(/"/g, '');
      }
    } catch {}

    // Build standard connection string
    const params = new URLSearchParams(queryPart.replace(/^\/??\??/, ''));
    if (txtOptions) {
      txtOptions.split('&').forEach((pair) => {
        const [k, v] = pair.split('=');
        if (k && !params.has(k)) params.set(k, v || '');
      });
    }
    if (!params.has('ssl')) params.set('ssl', 'true');
    if (!params.has('authSource')) params.set('authSource', 'admin');

    const standardUri = `mongodb://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${hosts.join(',')}/?${params.toString()}`;
    console.log(`✅ Resolved SRV to ${hosts.length} hosts via Google DNS`);
    return standardUri;
  } catch (err) {
    console.warn('⚠️ DNS-over-HTTPS resolution failed:', err.message, '— using original URI');
    return srvUri;
  }
}

async function getClient() {
  if (clientPromise) return clientPromise;

  // Resolve SRV if needed (bypasses local DNS issues)
  const resolvedUri = await resolveSrvUri(uri);
  const client = new MongoClient(resolvedUri, options);

  if (process.env.NODE_ENV === 'development') {
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = client.connect();
    }
    clientPromise = global._mongoClientPromise;
  } else {
    clientPromise = client.connect();
  }

  return clientPromise;
}

export default { then: (resolve, reject) => getClient().then(resolve, reject) };

export async function getDb() {
  const client = await getClient();
  return client.db('duet_reunion');
}
