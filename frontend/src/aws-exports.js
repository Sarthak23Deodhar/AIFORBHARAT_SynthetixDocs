// ─── AWS Amplify Configuration ───────────────────────────────────────────────
// After deploying the backend with `serverless deploy`, fill in the
// UserPoolId and UserPoolClientId from the CloudFormation Outputs.
//
// Run: cd serverless-backend && serverless info --verbose
// Look for: UserPoolId and UserPoolClientId in the Stack Outputs section.

const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID || 'us-east-1_XXXXXXXXX';
const userPoolClientId = import.meta.env.VITE_COGNITO_CLIENT_ID || 'XXXXXXXXXXXXXXXXXXXXXXXXXX';

// Detect whether real Cognito credentials have been configured
export const isCognitoConfigured =
    !userPoolId.includes('XXXXX') && !userPoolClientId.includes('XXXXX');

const awsConfig = {
    Auth: {
        Cognito: {
            userPoolId,
            userPoolClientId,
            signUpVerificationMethod: 'code',
        }
    }
};

export default awsConfig;

