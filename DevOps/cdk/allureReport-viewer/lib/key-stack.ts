import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { PublicKey, KeyGroup } from 'aws-cdk-lib/aws-cloudfront';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import * as fs from 'fs';

export class KeysStack extends cdk.Stack {
    public readonly keyPairId: string;
    public readonly keyGroupId: string;
    public readonly privateKeySecretArn: string;

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // Read params via CDK context (with sensible defaults)
        const pubKeyPath = this.node.tryGetContext('cfPublicKeyPath') ?? 'cf-public-key.pem';
        const privateKeySecretName = this.node.tryGetContext('privateKeySecretName') ?? 'allureReport/CloudFrontPrivateKey';

        // Load public key PEM (throws if file missing)
        const publicKeyPem = fs.readFileSync(pubKeyPath, 'utf8');

        // 1) CloudFront PublicKey
        const publicKey = new PublicKey(this, 'AllureCloudFrontPublicKey', {
            encodedKey: publicKeyPem,
            comment: 'Public key for CloudFront signed cookies (Allure)',
        });

        // 2) CloudFront KeyGroup (wraps the public key)
        const keyGroup = new KeyGroup(this, 'AllureCloudFrontKeyGroup', {
            items: [publicKey],
            comment: 'Key group used for CloudFront signed cookies (Allure)',
        });

        // 3) Reference the private key secret (already created via CLI)
        const privateKeySecret = Secret.fromSecretNameV2(this, 'AllurePrivateKeySecret', privateKeySecretName);

        // Expose outputs for later stacks (Lambda)
        this.keyPairId = publicKey.publicKeyId;
        this.keyGroupId = keyGroup.keyGroupId;
        this.privateKeySecretArn = privateKeySecret.secretArn;

        new cdk.CfnOutput(this, 'KeyPairId', { value: this.keyPairId });
        new cdk.CfnOutput(this, 'KeyGroupId', { value: this.keyGroupId });
        new cdk.CfnOutput(this, 'PrivateKeySecretArn', { value: this.privateKeySecretArn });
    }
}
