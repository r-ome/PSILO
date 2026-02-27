import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigatewayv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigatewayv2Integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as apigatewayv2Authorizers from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as path from "path";
import { env } from "../config/env";

export class PsiloStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const isProd = env.IS_PRODUCTION;

    const userBucket = new s3.Bucket(this, "UserBucket", {
      bucketName: `psilo-${this.account}`,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: isProd
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProd,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT],
          allowedOrigins: ["*"],
          allowedHeaders: ["*"],
        },
      ],
    });

    const userProvisioningFn = new NodejsFunction(this, "UserProvisioningFn", {
      entry: path.join(
        __dirname,
        "../../services/user-provisioning/src/handler.ts",
      ),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      environment: {
        BUCKET_NAME: userBucket.bucketName,
      },
      timeout: cdk.Duration.seconds(10),
      bundling: {
        esbuildVersion: "0.21",
      },
    });

    userBucket.grantWrite(userProvisioningFn);

    const userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: "psilo-user-pool",
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      lambdaTriggers: {
        postConfirmation: userProvisioningFn,
      },
      removalPolicy: isProd
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    const userPoolClient = new cognito.UserPoolClient(this, "UserPoolClient", {
      userPool,
      authFlows: {
        userPassword: true,
      },
      generateSecret: false,
    });

    const generatePresignedUrlFn = new NodejsFunction(this, "GeneratePresignedUrlFn", {
      entry: path.join(__dirname, "../../services/generate-presigned-url/src/handler.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      environment: {
        BUCKET_NAME: userBucket.bucketName,
      },
      timeout: cdk.Duration.seconds(10),
      bundling: {
        esbuildVersion: "0.21",
      },
    });

    userBucket.grantPut(generatePresignedUrlFn);

    const httpApi = new apigatewayv2.HttpApi(this, "HttpApi", {
      corsPreflight: {
        allowOrigins: ["*"],
        allowMethods: [apigatewayv2.CorsHttpMethod.POST],
        allowHeaders: ["Authorization", "Content-Type"],
      },
    });

    const cognitoAuthorizer = new apigatewayv2Authorizers.HttpJwtAuthorizer(
      "CognitoAuthorizer",
      `https://cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}`,
      {
        jwtAudience: [userPoolClient.userPoolClientId],
      },
    );

    httpApi.addRoutes({
      path: "/files/presign",
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration(
        "GeneratePresignedUrlIntegration",
        generatePresignedUrlFn,
      ),
      authorizer: cognitoAuthorizer,
    });

    new cdk.CfnOutput(this, "HttpApiUrl", { value: httpApi.url! });

    new cdk.CfnOutput(this, "UserPoolId", { value: userPool.userPoolId });
    new cdk.CfnOutput(this, "UserPoolClientId", {
      value: userPoolClient.userPoolClientId,
    });
    new cdk.CfnOutput(this, "BucketName", { value: userBucket.bucketName });
  }
}
