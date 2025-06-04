const AWS = require('aws-sdk');

const s3 = new AWS.S3({
  endpoint: process.env.S3_ENDPOINT,
  accessKeyId: process.env.S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  region: process.env.S3_REGION,
  s3ForcePathStyle: true, // Required for S3-compatible services
});

const bucket = process.env.S3_BUCKET_NAME;

const uploadFile = async (key, buffer, contentType) => {
  const params = {
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  };

  return s3.upload(params).promise();
};

const deleteFile = async (key) => {
  const params = {
    Bucket: bucket,
    Key: key,
  };

  return s3.deleteObject(params).promise();
};

const getFileUrl = (key, expires = 3600) => {
  const params = {
    Bucket: bucket,
    Key: key,
    Expires: expires,
  };

  return s3.getSignedUrl('getObject', params);
};

const getFileStream = (key) => {
  const params = {
    Bucket: bucket,
    Key: key,
  };

  return s3.getObject(params).createReadStream();
};

module.exports = {
  uploadFile,
  deleteFile,
  getFileUrl,
  getFileStream,
};
