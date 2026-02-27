import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';

jest.mock('../config/env', () => ({
  env: {
    CDK_DEFAULT_ACCOUNT: '123456789',
    CDK_DEFAULT_REGION: 'ap-southeast-1',
    IS_PRODUCTION: false,
  },
}));

import { PsiloStack } from '../lib/stack';

const app = new cdk.App();
const stack = new PsiloStack(app, 'TestStack', {
  env: { account: '123456789', region: 'ap-southeast-1' },
});
const template = Template.fromStack(stack);

describe('PsiloStack', () => {
  describe('Lambda functions', () => {
    it('application Lambdas use Node.js 22', () => {
      template.hasResourceProperties('AWS::Lambda::Function', { Runtime: 'nodejs22.x' });
    });

    it('application Lambdas have BUCKET_NAME environment variable', () => {
      // Both app Lambdas have BUCKET_NAME; check at least 2 exist with this env var
      template.resourcePropertiesCountIs(
        'AWS::Lambda::Function',
        {
          Environment: Match.objectLike({
            Variables: Match.objectLike({
              BUCKET_NAME: Match.anyValue(),
            }),
          }),
        },
        2,
      );
    });
  });

  describe('S3 bucket', () => {
    it('has versioning enabled', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        VersioningConfiguration: { Status: 'Enabled' },
      });
    });
  });

  describe('Cognito User Pool', () => {
    it('has email sign-in enabled', () => {
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        UsernameAttributes: ['email'],
      });
    });

    it('has UserProvisioning Lambda as post-confirmation trigger', () => {
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        LambdaConfig: {
          PostConfirmation: {
            'Fn::GetAtt': Match.arrayWith([Match.stringLikeRegexp('UserProvisioningFn')]),
          },
        },
      });
    });
  });

  describe('API Gateway', () => {
    it('has POST /files/presign route', () => {
      template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
        RouteKey: 'POST /files/presign',
      });
    });

    it('uses JWT authorization on the route', () => {
      template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
        RouteKey: 'POST /files/presign',
        AuthorizationType: 'JWT',
      });
    });

    it('has a JWT authorizer', () => {
      template.hasResourceProperties('AWS::ApiGatewayV2::Authorizer', {
        AuthorizerType: 'JWT',
      });
    });
  });
});
