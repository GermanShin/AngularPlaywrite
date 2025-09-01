import * as cdk from 'aws-cdk-lib';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import { Construct } from 'constructs';

export class MyStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // Create IAM Role for CodeBuild with minimal permissions
        const codeBuildRole = new iam.Role(this, 'CodeBuildServiceRole', {
            assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName(
                    'AmazonS3ReadOnlyAccess'
                ),
                iam.ManagedPolicy.fromAwsManagedPolicyName(
                    'CloudWatchLogsFullAccess'
                ),
            ],
        });

        // Create CodeBuild Project
        const codeBuildProject = new codebuild.Project(
            this,
            'PlaywrightTestProject',
            {
                projectName: 'PlaywrightE2ETests',
                role: codeBuildRole,
                environment: {
                    buildImage: codebuild.LinuxBuildImage.STANDARD_7_0, // Node.js 18+ included
                    privileged: true, // Needed for browsers in Playwright
                },
                buildSpec: codebuild.BuildSpec.fromObject({
                    version: '0.2',
                    phases: {
                        install: {
                            'runtime-versions': {
                                nodejs: '18',
                            },
                            commands: [
                                'echo "📂 Current directory:"',
                                'pwd', // log current location
                                'echo "📂 Files here:"',
                                'ls -la', // show files in current directory
                                'if [ -f package-lock.json ]; then echo "Found package-lock.json"; else echo "❌ package-lock.json not found"; fi',
                                'npm ci', // Install project dependencies
                                'npx playwright install --with-deps', // Install Playwright with browser dependencies
                            ],
                        },
                        build: {
                            commands: [
                                'npm run test:e2e', // Run Playwright tests
                            ],
                        },
                    },
                    artifacts: {
                        'base-directory': 'playwright-report',
                        files: ['**/*'],
                    },
                }),
            }
        );

        // 📦 Pipeline Artifact bucket
        const artifactBucket = new s3.Bucket(this, 'ArtifactBucket', {
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
        });

        // 📥 Source & Build Artifacts
        const sourceOutput = new codepipeline.Artifact();
        const buildOutput = new codepipeline.Artifact();

        // 🔗 GitHub source action using CodeStar connection
        const sourceAction =
            new codepipeline_actions.CodeStarConnectionsSourceAction({
                actionName: 'GitHub_Source',
                owner: 'GermanShin', // 👈 replace with your GitHub username/org
                repo: 'AngularPlaywrite', // 👈 replace with your repo name
                branch: 'main', // 👈 or whichever branch you want
                output: sourceOutput,
                connectionArn:
                    'arn:aws:codeconnections:ap-southeast-2:484907527321:connection/b6681a8b-1d22-4b12-a99b-769f740de7d7',
            });

        // 🏗️ Build action
        const buildAction = new codepipeline_actions.CodeBuildAction({
            actionName: 'Build',
            project: codeBuildProject,
            input: sourceOutput,
            outputs: [buildOutput],
        });

        // 🚀 Pipeline definition
        new codepipeline.Pipeline(this, 'PlaywrightPipeline', {
            artifactBucket,
            stages: [
                { stageName: 'Source', actions: [sourceAction] },
                { stageName: 'Build', actions: [buildAction] },
            ],
        });

        // 📌 Output CodeBuild Project name
        new cdk.CfnOutput(this, 'CodeBuildProjectName', {
            value: codeBuildProject.projectName,
        });

        new cdk.CfnOutput(this, 'CodeBuildProjectName', {
            value: codeBuildProject.projectName,
        });
    }
}
