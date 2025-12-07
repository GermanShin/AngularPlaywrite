// lib/cookie-minter-stack.ts
import { Stack, StackProps, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { CfnIntegration, CfnRoute } from 'aws-cdk-lib/aws-apigatewayv2';
import * as path from 'path';

export interface CookieMinterProps extends StackProps {
    apiId: string; // from ApiGatewayStack
    cloudFrontDomain: string; // bare domain (no protocol)
    keyPairId: string; // from KeysStack
    privateKeySecretArn: string; // from KeysStack
}

export class CookieMinterStack extends Stack {
    constructor(scope: Construct, id: string, props: CookieMinterProps) {
        super(scope, id, props);

        // Read Auth values from SSM (no direct dependency on AuthStack)
        const issuerUrl = ssm.StringParameter.valueForStringParameter(this, '/allure/issuerUrl');
        const userPoolClientId = ssm.StringParameter.valueForStringParameter(this, '/allure/userPoolClientId');

        const fn = new NodejsFunction(this, 'CookieMinterFn', {
            runtime: Runtime.NODEJS_20_X,
            entry: path.resolve(process.cwd(), 'lambda/auth/index.js'),
            handler: 'handler',
            timeout: Duration.seconds(10),
            bundling: { minify: true, target: 'node20' }, // uses local esbuild (no Docker)
            environment: {
                ISSUER_URL: issuerUrl,
                USER_POOL_CLIENT_ID: userPoolClientId,
                CLOUDFRONT_DOMAIN: props.cloudFrontDomain,
                KEY_PAIR_ID: props.keyPairId,
                PRIVATE_KEY_SECRET_ARN: props.privateKeySecretArn,
                CF_COOKIE_TTL_SECONDS: '3600',
            },
        });

        // Allow reading private key
        fn.addToRolePolicy(
            new PolicyStatement({
                actions: ['secretsmanager:GetSecretValue'],
                resources: [props.privateKeySecretArn],
            })
        );

        // L1 integration so we don't mutate the API construct from another stack
        const integration = new CfnIntegration(this, 'AuthIntegration', {
            apiId: props.apiId,
            integrationType: 'AWS_PROXY',
            integrationUri: fn.functionArn,
            payloadFormatVersion: '2.0',
            integrationMethod: 'POST', // not required for AWS_PROXY but harmless
        });

        new CfnRoute(this, 'AuthRoute', {
            apiId: props.apiId,
            routeKey: 'ANY /auth/callback', // or 'GET /auth/callback' + 'POST /auth/callback'
            target: `integrations/${integration.ref}`,
        });

        // Permit API Gateway to invoke the Lambda
        fn.addPermission('InvokeByHttpApi', {
            principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
            sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${props.apiId}/*/*/auth/callback`,
        });
    }
}
