#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { Cdk2Stack } from '../lib/cdk2-stack';

const app = new cdk.App();
new Cdk2Stack(app, 'Cdk2Stack', {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION,
    },
});
