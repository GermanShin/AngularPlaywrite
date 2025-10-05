import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { UserPool, UserPoolClient, OAuthScope, ProviderAttribute, AccountRecovery } from 'aws-cdk-lib/aws-cognito';

export class AuthStack extends cdk.Stack {
    public readonly userPoolId: string;
    public readonly userPoolClientId: string;
    public readonly issuerUrl: string;
    public readonly hostedUiDomain: string;

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // 1) Create the user pool
        const pool = new UserPool(this, 'AllureUserPool', {
            selfSignUpEnabled: true,
            signInAliases: { email: true },
            autoVerify: { email: true },
            accountRecovery: AccountRecovery.EMAIL_ONLY,
            passwordPolicy: { minLength: 12 },
        });

        // 2) Create app client (no secret; used by browser)
        const client = new UserPoolClient(this, 'AllureAppClient', {
            userPool: pool,
            generateSecret: false,
            oAuth: {
                flows: { implicitCodeGrant: true },
                scopes: [OAuthScope.OPENID, OAuthScope.EMAIL, OAuthScope.PROFILE],
                callbackUrls: [
                    // temporary placeholder; update later to your API callback
                    'https://example.com/dev-null',
                ],
                logoutUrls: ['https://example.com/dev-null'],
            },
        });

        // 3) Hosted UI domain (use a unique prefix)
        const domainPrefix = this.node.tryGetContext('cognitoDomainPrefix') ?? `allure-${this.account}-${this.region}`;

        const domain = pool.addDomain('AllureDomain', {
            cognitoDomain: { domainPrefix },
        });

        this.userPoolId = pool.userPoolId;
        this.userPoolClientId = client.userPoolClientId;
        this.issuerUrl = `https://cognito-idp.${this.region}.amazonaws.com/${this.userPoolId}`;
        this.hostedUiDomain = `https://${domain.domainName}.auth.${this.region}.amazoncognito.com`;

        new cdk.CfnOutput(this, 'UserPoolId', { value: this.userPoolId });
        new cdk.CfnOutput(this, 'UserPoolClientId', { value: this.userPoolClientId });
        new cdk.CfnOutput(this, 'IssuerUrl', { value: this.issuerUrl });
        new cdk.CfnOutput(this, 'HostedUiDomain', { value: this.hostedUiDomain });
    }
}
