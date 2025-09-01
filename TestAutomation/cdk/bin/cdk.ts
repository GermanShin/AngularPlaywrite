import * as cdk from 'aws-cdk-lib';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { MyStack } from '../lib/my-stack';

const app = new cdk.App();
new MyStack(app, 'MyStack');

// Synthesize app
const assembly = app.synth();

// Convert each stack to YAML and write only YAML
assembly.stacks.forEach(stack => {
    const jsonTemplate = fs.readFileSync(stack.templateFullPath, 'utf-8');
    const yamlTemplate = yaml.stringify(JSON.parse(jsonTemplate));

    const yamlPath = path.join(
        assembly.directory,
        `${stack.stackName}.template.yaml`
    );
    fs.writeFileSync(yamlPath, yamlTemplate);
    console.log(`Generated YAML template at: ${yamlPath}`);
});
