import * as cdk from '@aws-cdk/core';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import s3 = require('@aws-cdk/aws-s3');
import s3deploy = require('@aws-cdk/aws-s3-deployment');
import lambda = require('@aws-cdk/aws-lambda');
import iam = require('@aws-cdk/aws-iam');
import cognito = require('@aws-cdk/aws-cognito');
import codepipeline = require('@aws-cdk/aws-codepipeline');
import codepipelineactions = require('@aws-cdk/aws-codepipeline-actions');
import codebuild = require('@aws-cdk/aws-codebuild');
import api = require ('@aws-cdk/aws-apigateway');
import cf = require ('@aws-cdk/aws-cloudfront');

var path = require('path');

export class MasterFullStackSingleStack extends cdk.Stack {

  private readonly projectName: string = 'MyCdkGoals';
  private readonly tableName: string = 'CdkGoals';
  private readonly websiteIndexDocument: string = 'index.html';

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /* Dynamo Objects */
    //#region
    /* Create DynamoDB Goals Table */
    const goalsTable = new dynamodb.Table(this, 'TGoals', {
      tableName: `${this.projectName}-${this.tableName}`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'goalId', type: dynamodb.AttributeType.STRING },
      readCapacity: 1,
      writeCapacity: 1,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    /* Create DynamoDB Role/Policy */
    const dynamoDbRole = new iam.Role(this, 'DynamoDbRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });

    const goalsPolicy = new iam.Policy(this, 'GoalsPolicy', {
      policyName: 'GoalsPolicy',
      roles: [dynamoDbRole],
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['dynamodb:*'],
          resources: [goalsTable.tableArn],
        })
      ]
    });

    //#endregion

    /* S3 Objects */
    //Todo - grant access to cloudfront user and uncomment block all
    //#region
    /* Assets Source Bucket will be used as a codebuild source for the react code */
    const sourceAssetBucket = new s3.Bucket(this, 'SourceAssetBucket', {
      bucketName: `aws-fullstack-template-source-assets-${getRandomInt(1000000)}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      versioned: true
    });

    /* Website Bucket is the target bucket for the react application */
    const websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      bucketName: `aws-fullstack-template-website-${getRandomInt(1000000)}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      websiteIndexDocument: this.websiteIndexDocument,
      websiteErrorDocument: this.websiteIndexDocument,
    });


    /* Pipleine Artifacts Bucket is used by CodePipeline during Builds */
    const pipelineArtifactsBucket = new s3.Bucket(this, 'PipelineArtifactsBucket', {
      bucketName: `aws-fullstack-template-codepipeline-artifacts-${getRandomInt(1000000)}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    /* S3 Website Deployment */
    /* Seed the website bucket with the react source */
    const s3WebsiteDeploy = new s3deploy.BucketDeployment(this, 'S3WebsiteDeploy', {
      sources: [s3deploy.Source.asset('../assets/archive')],
      destinationBucket: sourceAssetBucket
    });

    /* Set Website Bucket Allow Policy */
    websiteBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        resources: [
          `${websiteBucket.bucketArn}/*`
        ],
        actions: ["s3:Get*"],
        principals: [new iam.AnyPrincipal]
      })
    );
    //#endregion

    /* Cloudfront CDN Distribution */
    //#region 

    const assetsCdn = new cf.CloudFrontWebDistribution(this, 'AssetsCdn', {
      defaultRootObject: 'index.html',
      comment: `CDN for ${websiteBucket}`,
      originConfigs: [
        {
          s3OriginSource: {
            s3BucketSource: websiteBucket,
            // as of now, using the OAE causes a circular stack bug.  Amazon is aware.
            // originAccessIdentity: new OriginAccessIdentity(this, 'WebsiteBucketOriginAccessIdentity', {
            //   comment: `OriginAccessIdentity for ${websiteBucket}`
            // }),
          },
          behaviors: [ { isDefaultBehavior: true } ]
        }
      ]
    });

    //#endregion

    /* Lambda Objects */
    //#region
    const functionListGoals = new lambda.Function(this, 'FunctionListGoals', {
      functionName: `${this.projectName}-ListGoals`,
      runtime: lambda.Runtime.NODEJS_12_X,
      description: 'Get list of goals for userId',
      handler: 'ListGoals.handler',
      memorySize: 256,
      timeout: cdk.Duration.seconds(120),
      role: dynamoDbRole,
      environment: { TABLE_NAME: goalsTable.tableName },
      code: lambda.Code.fromAsset(path.dirname('../functions/ListGoals.js')),
    });

    const functionCreateGoal = new lambda.Function(this, 'FunctionCreateGoal', {
      functionName: `${this.projectName}-CreateGoal`,
      runtime: lambda.Runtime.NODEJS_12_X,
      description: 'Create goal for user id',
      handler: 'CreateGoal.handler',
      memorySize: 256,
      timeout: cdk.Duration.seconds(120),
      role: dynamoDbRole,
      environment: { TABLE_NAME: goalsTable.tableName },
      code: lambda.Code.fromAsset(path.dirname('../functions/CreateGoal.js')),
    });

    const functionDeleteGoal = new lambda.Function(this, 'FunctionDeleteGoal', {
      functionName: `${this.projectName}-DeleteGoal`,
      runtime: lambda.Runtime.NODEJS_12_X,
      description: 'Delete goal for user id',
      handler: 'DeleteGoal.handler',
      memorySize: 256,
      timeout: cdk.Duration.seconds(120),
      role: dynamoDbRole,
      environment: { TABLE_NAME: goalsTable.tableName },
      code: lambda.Code.fromAsset(path.dirname('../functions/DeleteGoal.js')),
    });

    const functionUpdateGoal = new lambda.Function(this, 'FunctionUpdateGoal', {
      functionName: `${this.projectName}-UpdateGoal`,
      runtime: lambda.Runtime.NODEJS_12_X,
      description: 'Update goal for user id',
      handler: 'UpdateGoal.handler',
      memorySize: 256,
      timeout: cdk.Duration.seconds(120),
      role: dynamoDbRole,
      environment: { TABLE_NAME: goalsTable.tableName },
      code: lambda.Code.fromAsset(path.dirname('../functions/UpdateGoal.js')),
    });

    const functionGetGoal = new lambda.Function(this, 'FunctionGetGoal', {
      functionName: `${this.projectName}-GetGoal`,
      runtime: lambda.Runtime.NODEJS_12_X,
      description: 'Get goal for user id',
      handler: 'GetGoal.handler',
      memorySize: 256,
      timeout: cdk.Duration.seconds(120),
      //role: dynamoDbRole,
      environment: { TABLE_NAME: goalsTable.tableName },
      code: lambda.Code.fromAsset(path.dirname('../functions/GetGoal.js')),
    });

    goalsTable.grantReadWriteData(functionListGoals);
    goalsTable.grantReadWriteData(functionCreateGoal);
    goalsTable.grantReadWriteData(functionDeleteGoal);
    goalsTable.grantReadWriteData(functionUpdateGoal);
    goalsTable.grantReadWriteData(functionGetGoal);

    //#endregion

    /* Cognito Objects */
    //#region
    /* Cognito SNS Policy */
    const cognitoSnsRole = new iam.Role(this, 'SnsRole', {
      assumedBy: new iam.ServicePrincipal('cognito-idp.amazonaws.com'),
    });

    const snsPolicy = new iam.Policy(this, 'CognitoSnsPolicy', {
      policyName: 'CognitoSnsPolicy',
      roles: [cognitoSnsRole],
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['sns:publish'],
          resources: ['*'],
        })
      ]
    });

    /* Cognito User Pool */
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `${this.projectName}-UserPool`,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      standardAttributes: {
        email: {
          required: true,
          mutable: false,
        },
      },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: false,
        requireDigits: false,
        requireSymbols: false,
        requireUppercase: false,
      },
      userVerification: {
        emailSubject: 'Your verification code',
        emailBody: 'Here is your verification code: {####}',
        emailStyle: cognito.VerificationEmailStyle.CODE,
        smsMessage: 'Your username is {username}, Your verification code is {####}',
      },
    });

    // /* User Pool Client */
    const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPoolClientName: `${this.projectName}-UserPoolClient`,
      generateSecret: false,
      userPool: userPool
    });

    /* Identity Pool */
    const identityPool = new cognito.CfnIdentityPool(this, 'IdentityPool', {
      identityPoolName: `${this.projectName}Identity`,
      allowUnauthenticatedIdentities: true,
      cognitoIdentityProviders: [
        { clientId: userPoolClient.userPoolClientId, providerName: userPool.userPoolProviderName },
      ],
    });

    /* Cognito Roles */
    /* Unauthorized Role/Policy */
    const unauthorizedRole = new iam.Role(this, 'CognitoUnAuthorizedRole', {
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: { 'cognito-identity.amazonaws.com:aud': identityPool.ref },
          'ForAnyValue:StringLike': { 'cognito-identity.amazonaws.com:amr': 'unauthenticated' },
        },
        'sts:AssumeRoleWithWebIdentity'
      )
    });

    const cognitoUnauthorizedPolicy = new iam.Policy(this, 'CognitoUnauthorizedPolicy', {
      policyName: 'CognitoUnauthorizedPolicy',
      roles: [unauthorizedRole],
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['mobileanalytics:PutEvents', 'cognito-sync:*'],
          resources: ['*'],
        })
      ]
    })
    /* Authorized Role/Policy */
    const authorizedRole = new iam.Role(this, 'CognitoAuthorizedRole', {
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: { 'cognito-identity.amazonaws.com:aud': identityPool.ref },
          'ForAnyValue:StringLike': { 'cognito-identity.amazonaws.com:amr': 'authenticated' },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
    });

    const authorizedPolicy = new iam.Policy(this, 'CognitoAuthorizedPolicy', {
      policyName: 'CognitoAuthorizedPolicy',
      roles: [authorizedRole],
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['mobileanalytics:PutEvents', 'cognito-sync:*', 'cognito-identity:*'],
          resources: ['*']
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['execute-api:Invoke'],
          resources: [`*`]
        })
      ]
    });

    /* Create Default Policy */
    const defaultPolicy = new cognito.CfnIdentityPoolRoleAttachment(this, 'DefaultValid', {
      identityPoolId: identityPool.ref,
      roles: {
        unauthenticated: unauthorizedRole.roleArn,
        authenticated: authorizedRole.roleArn,
      },
    });
    //#endregion

    /* Api Gateway */
    //#region
    const appApi = new api.RestApi(this, 'AppApi', {
      restApiName: this.projectName,
    });

    const authorizer = new api.CfnAuthorizer(this, 'ApiAuthorizer', {
      restApiId: appApi.restApiId,
      name: 'ApiAuthorizer',
      type: 'COGNITO_USER_POOLS',
      identitySource: 'method.request.header.Authorization',
      providerArns: [userPool.userPoolArn]
    });


    appApi.root.addMethod('ANY');

    const items = appApi.root.addResource('goals');
    const getAllIntegration = new api.LambdaIntegration(functionListGoals);
    items.addMethod('GET', getAllIntegration, {
      authorizationType: api.AuthorizationType.IAM,
      authorizer: { authorizerId: authorizer.ref }
    });

    const createOneIntegration = new api.LambdaIntegration(functionCreateGoal);
    items.addMethod('POST', createOneIntegration, {
      authorizationType: api.AuthorizationType.IAM,
      authorizer: { authorizerId: authorizer.ref }
    });
    addCorsOptions(items);

    const singleItem = items.addResource('{id}');
    const getOneIntegration = new api.LambdaIntegration(functionGetGoal);
    singleItem.addMethod('GET', getOneIntegration, {
      authorizationType: api.AuthorizationType.IAM,
      authorizer: { authorizerId: authorizer.ref }
    });

    const updateOneIntegration = new api.LambdaIntegration(functionUpdateGoal);
    singleItem.addMethod('PUT', updateOneIntegration, {
      authorizationType: api.AuthorizationType.IAM,
      authorizer: { authorizerId: authorizer.ref }
    });

    const deleteOneIntegration = new api.LambdaIntegration(functionDeleteGoal);
    singleItem.addMethod('DELETE', deleteOneIntegration, {
      authorizationType: api.AuthorizationType.IAM,
      authorizer: { authorizerId: authorizer.ref }
    });
    addCorsOptions(singleItem);

    //#endregion

    /* CodeBuild Roles/Policies */
    //#region 
    const codeBuildRole = new iam.Role(this, 'CodeBuildRole', {
      roleName: 'CodeBuildRole',
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
    });

    codeBuildRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:*'],
      resources: [
        sourceAssetBucket.bucketArn, 
        pipelineArtifactsBucket.bucketArn, 
        websiteBucket.bucketArn,
        `${websiteBucket.bucketArn}/*`
      ]
    }));

    codeBuildRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['logs:CreateLogStream', 'logs:PutLogEvents', 'logs:CreateLogGroup', 'cloudfront:CreateInvalidation'],
      resources: ['*'],
    }));

    const codePipelineRole = new iam.Role(this, 'CodePipelineRole', {
      roleName: 'CodePipelineRole',
      assumedBy: new iam.ServicePrincipal('codepipeline.amazonaws.com')
    });

    codePipelineRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:*'],
      resources: [
        sourceAssetBucket.bucketArn, 
        pipelineArtifactsBucket.bucketArn, 
        websiteBucket.bucketArn,
        `${websiteBucket.bucketArn}/*`
      ]
    }));

    //#endregion

    /* CodeBuild Pipeline Project */
    //#region 
    const codeBuildProject = new codebuild.PipelineProject(this, 'CodeBuildProject', {
      projectName: `${this.projectName}-build`,
      description: `CodeBuild Project for ${this.projectName}.`,
      environment: {
        computeType: codebuild.ComputeType.SMALL,
        buildImage: codebuild.LinuxBuildImage.STANDARD_3_0,
        environmentVariables: {
          API_GATEWAY_REGION: { value: cdk.Aws.REGION },
          API_GATEWAY_URL: { value: appApi.url.slice(0, -1) },
          COGNITO_REGION: { value: cdk.Aws.REGION },
          COGNITO_USER_POOL_ID: { value: userPool.userPoolId },
          COGNITO_APP_CLIENT_ID: { value: userPoolClient.userPoolClientId },
          COGNITO_IDENTITY_POOL_ID: { value: identityPool.ref },
          WEBSITE_BUCKET: { value: websiteBucket.bucketName }
        }
      },
      role: codeBuildRole,
      buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec.yml'),
      timeout: cdk.Duration.minutes(5),
    });
    cdk.Tag.add(codeBuildProject, 'app-name', `${this.projectName}`);

    codePipelineRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['codebuild:BatchGetBuilds', 'codebuild:StartBuild'],
      resources: [codeBuildProject.projectArn],
    }));

    //#endregion

    /* Code Pipeline Object */
    //#region 
    const sourceOutput = new codepipeline.Artifact(`${this.projectName}-SourceArtifact`);
    const buildOutput = new codepipeline.Artifact(`${this.projectName}-BuildArtifact`);

    const codePipeline = new codepipeline.Pipeline(this, 'AssetsCodePipeline', {
      pipelineName: `${this.projectName}-Assets-Pipeline`,
      role: codePipelineRole,
      artifactBucket: pipelineArtifactsBucket,
      stages: [
        {
          stageName: 'Source',
          actions: [
            new codepipelineactions.S3SourceAction({
              actionName: 's3Source',
              bucket: sourceAssetBucket,
              bucketKey: 'assets.zip',
              output: sourceOutput,
              //trigger: codepipelineactions.S3Trigger.POLL
            }),
          ],
        },
        {
          stageName: 'Build',
          actions: [
            new codepipelineactions.CodeBuildAction({
              actionName: 'build-and-deploy',
              project: codeBuildProject,
              input: sourceOutput,
              outputs: [buildOutput]
            }),
          ],
        }
      ],
    });
    //#endregion

    /* Outputs */
    //#region 
    new cdk.CfnOutput(this, 'WebsiteBucketUrl', { value: websiteBucket.bucketWebsiteUrl });
    new cdk.CfnOutput(this, 'CloudFrontCdnUrl', { value: `http://${assetsCdn.distributionDomainName}` });
    //#endregion

  }
}



export function addCorsOptions(apiResource: api.IResource) {
  apiResource.addMethod('OPTIONS', new api.MockIntegration({
    integrationResponses: [{
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
        'method.response.header.Access-Control-Allow-Origin': "'*'",
        'method.response.header.Access-Control-Allow-Credentials': "'false'",
        'method.response.header.Access-Control-Allow-Methods': "'OPTIONS,GET,PUT,POST,DELETE'",
      },
    }],
    passthroughBehavior: api.PassthroughBehavior.NEVER,
    requestTemplates: {
      "application/json": "{\"statusCode\": 200}"
    },
  }), {
    methodResponses: [{
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Headers': true,
        'method.response.header.Access-Control-Allow-Methods': true,
        'method.response.header.Access-Control-Allow-Credentials': true,
        'method.response.header.Access-Control-Allow-Origin': true,
      },
    }]
  })
}

const getRandomInt = (max: number) => {
  return Math.floor(Math.random() * Math.floor(max));
}
