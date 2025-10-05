#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { KeysStack } from '../lib/key-stack';

const app = new cdk.App();
new KeysStack(app, 'AllureKeysStack', {
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'ap-southeast-2' },
});
