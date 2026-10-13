import { S3Client } from '@aws-sdk/client-s3'

let client: S3Client | undefined

export const getObjectStorage = (): {
  bucket: string
  client: S3Client
} => {
  const requiredEnvironmentVariables = [
    'S3_ENDPOINT',
    'S3_REGION',
    'S3_ACCESS_KEY',
    'S3_SECRET_KEY',
    'S3_BUCKET',
  ] as const
  const missingEnvironmentVariables = requiredEnvironmentVariables.filter(
    (name) => !process.env[name]
  )

  if (missingEnvironmentVariables.length > 0) {
    throw new Error(
      `Missing required object storage environment variables: ${missingEnvironmentVariables.join(', ')}`
    )
  }

  if (client) {
    return { bucket: process.env.S3_BUCKET as string, client }
  }

  client = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY as string,
      secretAccessKey: process.env.S3_SECRET_KEY as string,
    },
  })

  return { bucket: process.env.S3_BUCKET as string, client }
}
