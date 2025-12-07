// lib/api-gateway-stack.ts
import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { HttpApi } from '@aws-cdk/aws-apigatewayv2-alpha';

export class ApiGatewayStack extends Stack {
    public readonly api: HttpApi;
    public readonly apiId: string;
    public readonly apiEndpoint: string;
    public readonly callbackUrl: string;

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        this.api = new HttpApi(this, 'AllureAuthApi');
        this.apiId = this.api.apiId;
        this.apiEndpoint = this.api.apiEndpoint;
        this.callbackUrl = `${this.api.apiEndpoint}/auth/callback`;

        new CfnOutput(this, 'ApiId', { value: this.apiId });
        new CfnOutput(this, 'ApiEndpoint', { value: this.apiEndpoint });
        new CfnOutput(this, 'CallbackUrl', { value: this.callbackUrl });
    }
}
