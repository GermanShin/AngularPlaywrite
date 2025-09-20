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
                reportBuildStatus: true, // posts commit status using your PAT
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
                    TEST_USERNAME: {
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

        // Create a log group (7-day retention just for debugging)
        const debugLog = new logs.LogGroup(this, 'PlaywrightEventDebugLog', {
            retention: logs.RetentionDays.ONE_WEEK,
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

        // Send a compliant logEvent: MUST be { timestamp, message }
        rule.addTarget(
            new targets.CloudWatchLogGroup(debugLog, {
                logEvent: events.RuleTargetInput.fromObject({
                    // EventBridge “time” is an RFC3339 string — valid for CloudWatch Logs' timestamp
                    timestamp: events.EventField.fromPath('$.time'),
                    // message must be a STRING. Keep it simple (e.g., the build-id).
                    message: events.EventField.fromPath('$.detail.build-id'),
                }),
            })
        );

        // Minimal: dump entire event to logs
        // rule.addTarget(
        //     new targets.CloudWatchLogGroup(debugLog, {
        //         // optional: shape the event payload so it’s easy to skim
        //         event: events.RuleTargetInput.fromObject({
        //             message: 'Playwright build finished',
        //             buildId: events.EventField.fromPath('$.detail.build-id'),
        //             project: events.EventField.fromPath(
        //                 '$.detail.project-name'
        //             ),
        //             status: events.EventField.fromPath('$.detail.build-status'),
        //             time: events.EventField.fromPath('$.time'),
        //             raw: events.EventField.fromPath('$'), // full event for deep debugging
        //         }),
        //     })
        // );

        // 4) Outputs
        new cdk.CfnOutput(this, 'ReportsBucketName', {
            value: reportsBucket.bucketName,
        });
        new cdk.CfnOutput(this, 'CodeBuildProjectName', {
            value: project.projectName,
        });
    }
}
