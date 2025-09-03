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

        // const project = new codebuild.CfnProject(
        //     this,
        //     'Prototype-CodeBuild-01092025-01',
        //     {
        //         name: 'Prototype-CodeBuild-01092025-01',

        //         serviceRole: cbRole.roleArn,

        //         // Match your current artifacts config
        //         artifacts: {
        //             type: 'NO_ARTIFACTS', // or 'S3' / 'CODEPIPELINE' to match your project
        //         },

        //         // Match your current source
        //         source: {
        //             type: 'GITHUB', // or 'GITHUB' | 'NO_SOURCE' | 'CODEPIPELINE' etc.
        //             location:
        //                 'https://github.com/GermanShin/AngularPlaywrite.git', // omit if CODEPIPELINE/NO_SOURCE
        //             // If your current project uses a buildspec file, set it here:
        //             buildSpec: 'TestAutomation/cdk1/buildspec.yml',
        //         },

        //         // Match your current environment
        //         environment: {
        //             type: 'LINUX_CONTAINER',
        //             computeType: 'BUILD_GENERAL1_MEDIUM', // or your existing compute type
        //             image: 'aws/codebuild/standard:7.0', // or your current image
        //             privilegedMode: true, // set according to current project
        //             // Keep your existing environment variables here for now.
        //             // We'll add SSM params *after* import:
        //             // environmentVariables: [ ... ],
        //         },
        //     }
        // );
    }
}
