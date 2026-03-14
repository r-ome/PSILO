const required = [
  "CDK_DEFAULT_ACCOUNT",
  "CDK_DEFAULT_REGION",
  "IS_PRODUCTION",
  "CLOUDFRONT_PRIVATE_KEY_SECRET_ARN",
  "CLOUDFRONT_PUBLIC_KEY_PEM",
];

const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error("Missing environment variables:");
  missing.forEach((key) => console.error(`   - ${key}`));
  process.exit(1);
}

console.log("All environment variables are set");
