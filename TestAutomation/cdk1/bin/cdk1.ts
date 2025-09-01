#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { Cdk1Stack } from '../lib/cdk1-stack';

const app = new cdk.App();
new Cdk1Stack(app, 'Cdk1Stack');
