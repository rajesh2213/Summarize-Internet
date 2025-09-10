const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");

const r2 = new S3Client({
  endpoint: process.env.CLOUDFLARE_R2_URL, 
  region: "auto", 
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_KEY,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET,
  },
});

module.exports = { r2, PutObjectCommand, GetObjectCommand };
