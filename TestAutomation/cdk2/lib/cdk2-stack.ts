import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';

export class Cdk2Stack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // 1) Reports bucket
        const reportsBucket = new s3.Bucket(this, 'PlaywrightReportsBucket', {
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
            enforceSSL: true,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            autoDeleteObjects: false,
        });

        // 2) CodeBuild service role
        const cbRole = new iam.Role(this, 'CodeBuildServiceRole', {
            assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
            description:
                'Service role for running Playwright tests in CodeBuild',
        });

        cbRole.addManagedPolicy(
            iam.ManagedPolicy.fromAwsManagedPolicyName(
                'CloudWatchLogsFullAccess'
            )
        );

        cbRole.addToPolicy(
            new iam.PolicyStatement({
                actions: [
                    'ssm:GetParameter',
                    'ssm:GetParameters',
                    'ssm:GetParametersByPath',
                    'kms:Decrypt',
                ],
                resources: ['*'],
            })
        );

        cbRole.addToPolicy(
            new iam.PolicyStatement({
                actions: [
                    's3:PutObject',
                    's3:PutObjectAcl',
                    's3:AbortMultipartUpload',
                    's3:ListBucket',
                    's3:GetBucketLocation',
                ],
                resources: [
                    reportsBucket.bucketArn,
                    `${reportsBucket.bucketArn}/*`,
                ],
            })
        );

        // 3) CodeBuild project referencing buildspec.yml in repo root
        const project = new codebuild.Project(this, 'PlaywrightTestsProject', {
            projectName: `PlaywrightE2ETests-${this.stackName}`,
            role: cbRole,
            source: codebuild.Source.gitHub({
                owner: 'GermanShin',
                repo: 'AngularPlaywrite',
                branchOrRef: 'main',
                cloneDepth: 1,
            }),
            environment: {
                buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
                computeType: codebuild.ComputeType.SMALL,
                environmentVariables: {
                    REPORTS_BUCKET: { value: reportsBucket.bucketName },
                    API_KEY: {
                        type: codebuild.BuildEnvironmentVariableType
                            .PARAMETER_STORE,
                        value: '/testautomation/API_KEY',
                    },
                },
            },
            // ✅ Allowed now because a source exists
            buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec.yml'),
        });

        new cdk.CfnOutput(this, 'ReportsBucketName', {
            value: reportsBucket.bucketName,
        });
        new cdk.CfnOutput(this, 'CodeBuildProjectName', {
            value: project.projectName,
        });
    }
}
