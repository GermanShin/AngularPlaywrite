#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { KeysStack } from '../lib/key-stack';
import { AuthStack } from '../lib/auth-stack';

const app = new cdk.App();
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'ap-southeast-2' };

new KeysStack(app, 'AllureKeysStack', { env });
new AuthStack(app, 'AllureAuthStack', { env });
