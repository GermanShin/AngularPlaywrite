import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';

export class Cdk1Stack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // Example resource: simple S3 bucket
        new s3.Bucket(this, 'MyTestBucket', {
            versioned: true,
            removalPolicy: cdk.RemovalPolicy.DESTROY, // Only for testing!
            autoDeleteObjects: true,
        });
    }
}
