import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
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

        cbRole.addToPrincipalPolicy(
            new iam.PolicyStatement({
                actions: [
                    'ssm:GetParameter',
                    'ssm:GetParameters',
                    'ssm:GetParametersByPath',
                ],
                resources: [
                    this.formatArn({
                        service: 'ssm',
                        resource: 'parameter',
                        resourceName: '/testautomation/*',
                    }),
                ],
            })
        );

        // new codebuild.CfnProject(this, 'PrototypeCodeBuild0109202501', {
        //     name: 'Prototype-CodeBuild-01092025-01',
        //     serviceRole: 'arn:aws:iam::484907527321:role/CodeBuildS3Role',
        //     source: {
        //         type: 'GITHUB',
        //         location: 'https://github.com/GermanShin/AngularPlaywrite.git',
        //         buildSpec: 'TestAutomation/cdk1/buildspec.yml',
        //         gitCloneDepth: 1,
        //         gitSubmodulesConfig: { fetchSubmodules: false },
        //         reportBuildStatus: false,
        //         insecureSsl: false,
        //     },
        //     artifacts: { type: 'NO_ARTIFACTS' },
        //     cache: { type: 'NO_CACHE' },
        //     environment: {
        //         type: 'LINUX_CONTAINER',
        //         image: 'aws/codebuild/amazonlinux-x86_64-standard:5.0',
        //         computeType: 'BUILD_GENERAL1_MEDIUM',
        //         privilegedMode: false,
        //         imagePullCredentialsType: 'CODEBUILD',
        //         environmentVariables: [],
        //     },
        //     timeoutInMinutes: 60,
        //     queuedTimeoutInMinutes: 480,
        //     encryptionKey:
        //         'arn:aws:kms:ap-southeast-2:484907527321:alias/aws/s3',
        //     logsConfig: {
        //         cloudWatchLogs: { status: 'ENABLED' },
        //         s3Logs: { status: 'DISABLED', encryptionDisabled: false },
        //     },
        // });
    }
}
