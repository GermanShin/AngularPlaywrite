// lib/auth-stack.ts
import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { UserPool, UserPoolClient, OAuthScope, AccountRecovery } from 'aws-cdk-lib/aws-cognito';
import * as ssm from 'aws-cdk-lib/aws-ssm';

export interface AuthProps extends StackProps {
    callbackUrls?: string[];
    logoutUrls?: string[];
}

export class AuthStack extends Stack {
    public readonly userPoolId: string;
    public readonly userPoolClientId: string;
    public readonly issuerUrl: string;
    public readonly hostedUiDomain?: string; // if you add a domain

    constructor(scope: Construct, id: string, props?: AuthProps) {
        super(scope, id, props);

        const pool = new UserPool(this, 'AllureUserPool', {
            selfSignUpEnabled: true,
            signInAliases: { email: true },
            autoVerify: { email: true },
            accountRecovery: AccountRecovery.EMAIL_ONLY,
            passwordPolicy: { minLength: 12 },
        });

        const client = new UserPoolClient(this, 'AllureAppClient', {
            userPool: pool,
            generateSecret: false,
            oAuth: {
                flows: { implicitCodeGrant: true },
                scopes: [OAuthScope.OPENID, OAuthScope.EMAIL, OAuthScope.PROFILE],
                callbackUrls: props?.callbackUrls ?? ['https://example.com/dev-null'],
                logoutUrls: props?.logoutUrls ?? ['https://example.com/dev-null'],
            },
        });

        this.userPoolId = pool.userPoolId;
        this.userPoolClientId = client.userPoolClientId;
        this.issuerUrl = `https://cognito-idp.${this.region}.amazonaws.com/${this.userPoolId}`;

        new ssm.StringParameter(this, 'IssuerUrlParam', {
            parameterName: '/allure/issuerUrl',
            stringValue: this.issuerUrl,
        });

        new ssm.StringParameter(this, 'UserPoolClientIdParam', {
            parameterName: '/allure/userPoolClientId',
            stringValue: this.userPoolClientId,
        });

        new CfnOutput(this, 'UserPoolId', { value: this.userPoolId });
        new CfnOutput(this, 'UserPoolClientId', { value: this.userPoolClientId });
        new CfnOutput(this, 'IssuerUrl', { value: this.issuerUrl });
    }
}
