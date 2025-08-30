import * as cdk from 'aws-cdk-lib';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as iam from 'aws-cdk-lib/aws-iam';
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

        new cdk.CfnOutput(this, 'CodeBuildProjectName', {
            value: codeBuildProject.projectName,
        });
    }
}
