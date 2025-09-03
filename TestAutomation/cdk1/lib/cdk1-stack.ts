import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class Cdk1Stack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // 1. Create S3 bucket for reports (only the first time)
        const artifactBucket = new s3.Bucket(this, 'PlaywrightReportsBucket', {
            removalPolicy: cdk.RemovalPolicy.RETAIN, // Keep bucket after stack deletion
            autoDeleteObjects: false, // Avoid deleting reports accidentally
        });

        // 2. Replace with your actual role ARN (from IAM console)
        const cbRole = iam.Role.fromRoleArn(
            this,
            'ImportedCodeBuildRole',
            'arn:aws:iam::484907527321:role/CodeBuildS3Role',
            {
                // If you want CDK to add policies to it:
                mutable: true,
            }
        );
    }
}
