import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createLogger } from '@/utils/logger';
// import OSS from 'ali-oss'; // Uncomment if/when you add AliCloud

const log = createLogger('cloudStorage');

export async function uploadToCloudStorage(file: File, objectKey: string, storageData: any) {
  const { provider, endpoint, bucket, credentials } = storageData;

  log.info(`Routing upload to provider: ${provider}`);

  if (provider === 'aws') {
    return await uploadToAWS(file, objectKey, endpoint, bucket, credentials);
  } 
  else if (provider === 'ali') {
    // return await uploadToAli(file, objectKey, endpoint, bucket, credentials);
    throw new Error("AliCloud upload not yet fully implemented.");
  } 
  else {
    throw new Error(`Unknown cloud storage provider from DJI: ${provider}`);
  }
}

// --- PROVIDER IMPLEMENTATIONS ---

async function uploadToAWS(file: File, objectKey: string, endpoint: string, bucket: string, credentials: any) {
  
  // 1. Extract the region from the endpoint (e.g., s3.us-east-1.amazonaws.com)
  const region = endpoint.includes('s3.') ? endpoint.split('.')[1] : 'us-east-1';

  // 2. Initialize the AWS S3 Client using the temporary STS tokens
  const s3Client = new S3Client({
    region: region,
    credentials: {
      accessKeyId: credentials.access_key_id,
      secretAccessKey: credentials.access_key_secret,
      sessionToken: credentials.security_token,
    }
  });

  // Convert the browser File object into raw byte data
  const fileArrayBuffer = await file.arrayBuffer();
  const rawBytes = new Uint8Array(fileArrayBuffer);

  // 3. Prepare the upload command
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    Body: rawBytes,
    ContentType: 'application/zip',
  });

  // 4. Execute the upload
  try {
    const response = await s3Client.send(command);
    log.info("AWS S3 Upload successful:", response);
    return response;
  } catch (error) {
    log.error("AWS S3 Upload failed:", error);
    throw error;
  }
}

/*
async function uploadToAli(file: File, objectKey: string, endpoint: string, bucket: string, credentials: any) {
    // AliCloud logic goes here later!
}
*/