import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import {
    Distribution,
    ViewerProtocolPolicy,
    AllowedMethods,
    CachePolicy,
} from 'aws-cdk-lib/aws-cloudfront';

export class Cdk3Stack extends cdk.Stack {
    public readonly bucketName: string;
    public readonly cloudFrontDomain: string;
    public readonly distributionId: string;

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const reportsBucket = new s3.Bucket(this, 'PlaywrightReportsBucket', {
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
            enforceSSL: true,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            autoDeleteObjects: false,
        });

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

        const owner = 'GermanShin';
        const repo = 'AngularPlaywrite';
        const branch = 'main';

        const project = new codebuild.Project(this, 'PlaywrightProject', {
            role: cbRole,

            source: codebuild.Source.gitHub({
                owner,
                repo,
                branchOrRef: branch,
                cloneDepth: 1,
                reportBuildStatus: true,
            }),

            buildSpec: codebuild.BuildSpec.fromSourceFilename(
                'TestAutomation/buildspec.yml'
            ),

            environment: {
                buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_5,
                computeType: codebuild.ComputeType.SMALL,
                privileged: false,
                environmentVariables: {
                    REPORTS_BUCKET: { value: reportsBucket.bucketName },
                    TEST_USERNAME_1: {
                        type: codebuild.BuildEnvironmentVariableType
                            .PARAMETER_STORE,
                        value: '/testautomation/local/username',
                    },
                    TEST_PASSWORD: {
                        type: codebuild.BuildEnvironmentVariableType
                            .PARAMETER_STORE,
                        value: '/testautomation/local/password',
                    },
                },
            },

            artifacts: codebuild.Artifacts.s3({
                bucket: reportsBucket,
                includeBuildId: false,
                packageZip: false,
            }),
        });

        const siteBucket = new s3.Bucket(this, 'SiteBucket', {
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
        });

        const origin = S3BucketOrigin.withOriginAccessControl(siteBucket);

        const dist = new Distribution(this, 'AllureDistribution', {
            defaultBehavior: {
                origin,
                viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowedMethods: AllowedMethods.ALLOW_GET_HEAD,
                cachePolicy: CachePolicy.CACHING_OPTIMIZED,
            },
            comment: 'Allure report distribution (S3 private via OAC)',
        });

        this.bucketName = siteBucket.bucketName;
        this.cloudFrontDomain = dist.distributionDomainName;
        this.distributionId = dist.distributionId;

        new cdk.CfnOutput(this, 'AllureBucketName', {
            value: this.bucketName,
            exportName: 'Allure-BucketName',
        });

        new cdk.CfnOutput(this, 'AllureCloudFrontDomain', {
            value: dist.distributionDomainName, // ⚠️ no protocol
            exportName: 'Allure-CloudFrontDomain',
        });

        new cdk.CfnOutput(this, 'AllureDistributionId', {
            value: this.distributionId,
            exportName: 'Allure-DistributionId',
        });

        const allureRole = new iam.Role(this, 'AllureServiceRole', {
            assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
            description: 'Role for Allure renderer CodeBuild project',
        });

        allureRole!.addToPolicy(
            new iam.PolicyStatement({
                actions: ['s3:ListBucket'],
                resources: [reportsBucket.bucketArn],
            })
        );
        reportsBucket.grantReadWrite(allureRole);
        reportsBucket.grantDelete(allureRole!);

        allureRole.addToPolicy(
            new iam.PolicyStatement({
                actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'],
                resources: [siteBucket.arnForObjects('reports/*')],
            })
        );

        allureRole.addToPolicy(
            new iam.PolicyStatement({
                actions: ['s3:ListBucket'],
                resources: [siteBucket.bucketArn],
                conditions: { StringLike: { 's3:prefix': ['reports/*'] } },
            })
        );

        const allureProject = new codebuild.Project(this, 'AllureProject', {
            role: allureRole,
            source: codebuild.Source.gitHub({
                owner,
                repo,
                branchOrRef: branch,
                cloneDepth: 1,
                reportBuildStatus: true,
            }),
            buildSpec: codebuild.BuildSpec.fromSourceFilename(
                'buildspec.allure.yml'
            ),
            environment: {
                buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_5,
                computeType: codebuild.ComputeType.SMALL,
            },
            environmentVariables: {
                RESULTS_BUCKET: { value: reportsBucket.bucketName },
                SITE_BUCKET: { value: siteBucket.bucketName },
            },
            artifacts: codebuild.Artifacts.s3({
                bucket: siteBucket,
                path: 'reports',
                includeBuildId: true,
                packageZip: false,
            }),
        });

        const rule = new events.Rule(this, 'OnPlaywrightSuccessDebug', {
            eventPattern: {
                source: ['aws.codebuild'],
                detailType: ['CodeBuild Build State Change'],
                detail: {
                    'build-status': ['SUCCEEDED', 'FAILED'],
                    'project-name': [project.projectName],
                },
            },
        });

        rule.addTarget(
            new targets.CodeBuildProject(allureProject, {
                event: events.RuleTargetInput.fromObject({
                    environmentVariablesOverride: [
                        {
                            name: 'buildId',
                            value: events.EventField.fromPath(
                                '$.detail.build-id'
                            ),
                            type: 'PLAINTEXT',
                        },
                        {
                            name: 'status',
                            value: events.EventField.fromPath(
                                '$.detail.build-status'
                            ),
                            type: 'PLAINTEXT',
                        },
                        {
                            name: 'project',
                            value: events.EventField.fromPath(
                                '$.detail.project-name'
                            ),
                            type: 'PLAINTEXT',
                        },
                    ],
                }),
                retryAttempts: 3,
            })
        );

        new cdk.CfnOutput(this, 'ReportsBucketName', {
            value: reportsBucket.bucketName,
        });
        new cdk.CfnOutput(this, 'CodeBuildProjectName', {
            value: project.projectName,
        });
    }
}
