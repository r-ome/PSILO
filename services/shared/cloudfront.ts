import { getSignedUrl } from "@aws-sdk/cloudfront-signer";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const sm = new SecretsManagerClient({});
let cachedPrivateKey: string | null = null;

export async function getPrivateKey(): Promise<string> {
  if (cachedPrivateKey) return cachedPrivateKey;
  const res = await sm.send(
    new GetSecretValueCommand({ SecretId: process.env.CLOUDFRONT_PRIVATE_KEY_SECRET_ARN! }),
  );
  cachedPrivateKey = res.SecretString!;
  return cachedPrivateKey;
}

export async function cfSignedUrl(
  key: string,
  privateKey: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  const url = `https://${process.env.CLOUDFRONT_DOMAIN!}/${encodedKey}`;
  const dateLessThan = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
  return getSignedUrl({
    url,
    keyPairId: process.env.CLOUDFRONT_KEY_PAIR_ID!,
    privateKey,
    dateLessThan,
  });
}
