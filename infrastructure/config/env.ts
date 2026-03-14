import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

function getServerEnv() {
  const cdkDefaultAccount = process.env.CDK_DEFAULT_ACCOUNT;
  const cdkDefaultRegion = process.env.CDK_DEFAULT_REGION;
  const isProduction = process.env.IS_PRODUCTION === "true";
  const cloudfrontPrivateKeySecretArn =
    process.env.CLOUDFRONT_PRIVATE_KEY_SECRET_ARN;
  const cloudfrontPublicKeyPem = process.env.CLOUDFRONT_PUBLIC_KEY_PEM;

  if (!cdkDefaultAccount) {
    throw new Error("Missing CDK_DEFAULT_ACCOUNT");
  }

  if (!cdkDefaultRegion) {
    throw new Error("Missing CDK_DEFAULT_REGION");
  }

  if (!cloudfrontPrivateKeySecretArn) {
    throw new Error("Missing CLOUDFRONT_PRIVATE_KEY_SECRET_ARN");
  }

  if (!cloudfrontPublicKeyPem) {
    throw new Error("Missing CLOUDFRONT_PUBLIC_KEY_PEM");
  }

  return {
    CDK_DEFAULT_ACCOUNT: cdkDefaultAccount,
    CDK_DEFAULT_REGION: cdkDefaultRegion,
    IS_PRODUCTION: isProduction,
    CLOUDFRONT_PUBLIC_KEY_PEM: cloudfrontPublicKeyPem,
    CLOUDFRONT_PRIVATE_KEY_SECRET_ARN: cloudfrontPrivateKeySecretArn,
  };
}

export const env = getServerEnv();
