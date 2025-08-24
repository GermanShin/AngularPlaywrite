import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class MyStack extends cdk.Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Optional minimal resource to make synthesis visible
    new cdk.aws_s3.Bucket(this, 'MyBucket');
  }
}