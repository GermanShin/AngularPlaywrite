import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as events from 'aws-cdk-lib/aws-events';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as targets from 'aws-cdk-lib/aws-events-targets';

export class Cdk3Stack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // S3 bucket for Playwright reports
        const reportsBucket = new s3.Bucket(this, 'PlaywrightReportsBucket', {
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
            enforceSSL: true,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            autoDeleteObjects: false,
        });

        // CodeBuild service role (least-privilege for this use case)
        const cbRole = new iam.Role(this, 'CodeBuildServiceRole', {
            assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
            description:
                'Service role for running Playwright tests in CodeBuild',
        });

        // Logs
        cbRole.addManagedPolicy(
            iam.ManagedPolicy.fromAwsManagedPolicyName(
                'CloudWatchLogsFullAccess'
            )
        );

        // SSM + optional KMS Decrypt (for SecureString params)
        cbRole.addToPolicy(
            new iam.PolicyStatement({
                actions: [
                    'ssm:GetParameter',
                    'ssm:GetParameters',
                    'ssm:GetParametersByPath',
                    'kms:Decrypt',
                ],
                resources: ['*'], // tighten to specific ARNs when you finalize names/keys
            })
        );

        // S3 write for uploading Playwright reports
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

        // 3) CodeBuild project (GitHub source via PAT you imported with import-source-credentials)
        const owner = 'GermanShin'; // <-- double-check exact GitHub owner/org
        const repo = 'AngularPlaywrite'; // <-- double-check exact repo name/spelling
        const branch = 'main';

        const project = new codebuild.Project(this, 'PlaywrightProject', {
            // Optional: set a stable name (otherwise CFN will generate one)
            // projectName: 'PlaywrightE2ETests',

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
                buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_5, // Amazon Linux 2 Standard:5.0
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
            // 4) Artifact destination in S3 (this is the Console “Artifacts” section)
            artifacts: codebuild.Artifacts.s3({
                bucket: reportsBucket,
                path: 'allure-results', // prefix in results bucket
                name: 'allure-results.zip', // object name within the build-id dir
                includeBuildId: true, // s3://.../allure-results/<build-id>/allure-results.zip
                packageZip: true,
                // path: 'playwright-reports',
                // includeBuildId: true,
                // packageZip: false,
            }),
        });

        // S3 bucket for Allure reports
        const siteBucket = new s3.Bucket(this, 'SiteBucket', {
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            // no website hosting; the bucket stays private and is only read by Lambda
        });

        // 1) Create a CodeBuild service role
        const allureRole = new iam.Role(this, 'AllureServiceRole', {
            assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
            description: 'Role for Allure renderer CodeBuild project',
        });

        // 2) Grant READ on results bucket (objects) + LIST on bucket (scoped to prefix)
        allureRole.addToPolicy(
            new iam.PolicyStatement({
                actions: ['s3:GetObject'],
                resources: [reportsBucket.arnForObjects('allure-results/*')],
            })
        );
        allureRole.addToPolicy(
            new iam.PolicyStatement({
                actions: ['s3:ListBucket'],
                resources: [reportsBucket.bucketArn],
                conditions: {
                    StringLike: { 's3:prefix': ['allure-results/*'] },
                },
            })
        );

        // 3) Grant READ/WRITE on site bucket (objects) + LIST on bucket (scoped to prefix)
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
            role: allureRole, // <- use your custom role
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
                buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_5, // Amazon Linux 2 Standard:5.0
                computeType: codebuild.ComputeType.SMALL,
            },
            environmentVariables: {
                RESULTS_BUCKET: { value: reportsBucket.bucketName },
                SITE_BUCKET: { value: siteBucket.bucketName }, // optional, if you ever need it in scripts
            },
            artifacts: codebuild.Artifacts.s3({
                bucket: siteBucket,
                path: 'reports',
                includeBuildId: true,
                packageZip: false,
            }),
        });

        // Your EventBridge rule that watches for Playwright SUCCEEDED
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
                    // This maps 1:1 to CodeBuild StartBuildRequest
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

        // 4) Outputs
        new cdk.CfnOutput(this, 'ReportsBucketName', {
            value: reportsBucket.bucketName,
        });
        new cdk.CfnOutput(this, 'CodeBuildProjectName', {
            value: project.projectName,
        });
    }
}
