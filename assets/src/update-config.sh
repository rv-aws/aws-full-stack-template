#! /bin/bash

FILE_NAME="config-tmp.ts"
touch $FILE_NAME

echo """export default {
	MAX_ATTACHMENT_SIZE: 5000000,	
    apiGateway: {
    REGION: '$API_GATEWAY_REGION',
    API_URL: '$API_GATEWAY_URL',
    },
    cognito: {
        REGION: '$COGNITO_REGION',
        USER_POOL_ID: '$COGNITO_USER_POOL_ID',
        APP_CLIENT_ID: '$COGNITO_APP_CLIENT_ID',
        IDENTITY_POOL_ID: '$COGNITO_IDENTITY_POOL_ID'
    }
};
""" >> $FILE_NAME
mv config.ts config.ts.bak
mv $FILE_NAME config.ts

