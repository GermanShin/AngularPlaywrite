import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { KeysStack } from '../lib/key-stack';
import { AuthStack } from '../lib/auth-stack';
import { ApiGatewayStack } from '../lib/api-gw-stack';
import { CookieMinterStack } from '../lib/cookie-minter-stack';

const app = new cdk.App();
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'ap-southeast-2' };

const cloudFrontDomain = cdk.Fn.importValue('Allure-CloudFrontDomain'); // bare domain

// API first → gives callback URL
const api = new ApiGatewayStack(app, 'AllureApiGatewayStack', { env });

// Keys
const keys = new KeysStack(app, 'AllureKeysStack', { env });

// Auth creates Cognito + writes SSM values + uses API callback
new AuthStack(app, 'AllureAuthStack', {
    env,
    callbackUrls: [api.callbackUrl],
    logoutUrls: [api.callbackUrl],
});

// Cookie-minter reads from SSM and attaches route to existing API (by id)
new CookieMinterStack(app, 'AllureCookieMinterStack', {
    env,
    apiId: api.apiId,
    cloudFrontDomain,
    keyPairId: keys.keyPairId,
    privateKeySecretArn: keys.privateKeySecretArn,
});
