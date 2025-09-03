import * as cdk from 'aws-cdk-lib';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export class PlaywrightReportsStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // 1. Create S3 bucket for reports (only the first time)
        const artifactBucket = new s3.Bucket(this, 'PlaywrightReportsBucket', {
            removalPolicy: cdk.RemovalPolicy.RETAIN, // Keep bucket after stack deletion
            autoDeleteObjects: false, // Avoid deleting reports accidentally
        });
    }
}
