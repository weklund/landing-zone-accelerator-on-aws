/**
 *  Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

const path = require('path');

/**
 * Initialized MacieOrganizationAdminAccount properties
 */
export interface MacieOrganizationalAdminAccountProps {
  /**
   * Macie admin account id
   */
  readonly adminAccountId: string;
  /**
   * Custom resource lambda log group encryption key
   */
  readonly kmsKey: cdk.aws_kms.Key;
  /**
   * Custom resource lambda log retention in days
   */
  readonly logRetentionInDays: number;
}

/**
 * Aws MacieSession organizational Admin Account
 */
export class MacieOrganizationAdminAccount extends Construct {
  public readonly id: string;

  static isLogGroupConfigured = false;

  constructor(scope: Construct, id: string, props: MacieOrganizationalAdminAccountProps) {
    super(scope, id);

    const MACIE_RESOURCE_TYPE = 'Custom::MacieEnableOrganizationAdminAccount';

    const customResourceProvider = cdk.CustomResourceProvider.getOrCreateProvider(this, MACIE_RESOURCE_TYPE, {
      codeDirectory: path.join(__dirname, 'enable-organization-admin-account/dist'),
      runtime: cdk.CustomResourceProviderRuntime.NODEJS_14_X,
      policyStatements: [
        {
          Sid: 'MacieEnableOrganizationAdminAccountTaskOrganizationActions',
          Effect: 'Allow',
          Action: [
            'organizations:DeregisterDelegatedAdministrator',
            'organizations:DescribeOrganization',
            'organizations:EnableAWSServiceAccess',
            'organizations:ListAWSServiceAccessForOrganization',
            'organizations:ListAccounts',
            'organizations:ListDelegatedAdministrators',
            'organizations:RegisterDelegatedAdministrator',
            'organizations:ServicePrincipal',
            'organizations:UpdateOrganizationConfiguration',
          ],
          Resource: '*',
          Condition: {
            StringLikeIfExists: {
              'organizations:DeregisterDelegatedAdministrator': ['macie.amazonaws.com'],
              'organizations:DescribeOrganization': ['macie.amazonaws.com'],
              'organizations:EnableAWSServiceAccess': ['macie.amazonaws.com'],
              'organizations:ListAWSServiceAccessForOrganization': ['macie.amazonaws.com'],
              'organizations:ListAccounts': ['macie.amazonaws.com'],
              'organizations:ListDelegatedAdministrators': ['macie.amazonaws.com'],
              'organizations:RegisterDelegatedAdministrator': ['macie.amazonaws.com'],
              'organizations:ServicePrincipal': ['macie.amazonaws.com'],
              'organizations:UpdateOrganizationConfiguration': ['macie.amazonaws.com'],
            },
          },
        },
        {
          Sid: 'MacieEnableOrganizationAdminAccountTaskMacieActions',
          Effect: 'Allow',
          Action: [
            'macie2:DisableOrganizationAdminAccount',
            'macie2:EnableMacie',
            'macie2:EnableOrganizationAdminAccount',
            'macie2:GetMacieSession',
            'macie2:ListOrganizationAdminAccounts',
            'macie2:DisableOrganizationAdminAccount',
            'macie2:GetMacieSession',
            'macie2:EnableMacie',
          ],
          Resource: '*',
        },
        {
          Sid: 'MacieEnableMacieTaskIamAction',
          Effect: 'Allow',
          Action: ['iam:CreateServiceLinkedRole'],
          Resource: '*',
          Condition: {
            StringLikeIfExists: {
              'iam:CreateServiceLinkedRole': ['macie.amazonaws.com'],
            },
          },
        },
      ],
    });

    const resource = new cdk.CustomResource(this, 'Resource', {
      resourceType: MACIE_RESOURCE_TYPE,
      serviceToken: customResourceProvider.serviceToken,
      properties: {
        region: cdk.Stack.of(this).region,
        adminAccountId: props.adminAccountId,
      },
    });

    /**
     * Pre-Creating log group to enable encryption and log retention.
     * Below construct needs to be static
     * isLogGroupConfigured flag used to make sure log group construct synthesize only once in the stack
     */
    if (!MacieOrganizationAdminAccount.isLogGroupConfigured) {
      const logGroup = new cdk.aws_logs.LogGroup(this, 'LogGroup', {
        logGroupName: `/aws/lambda/${
          (customResourceProvider.node.findChild('Handler') as cdk.aws_lambda.CfnFunction).ref
        }`,
        retention: props.logRetentionInDays,
        encryptionKey: props.kmsKey,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });

      resource.node.addDependency(logGroup);

      // Enable the flag to indicate log group configured
      MacieOrganizationAdminAccount.isLogGroupConfigured = true;
    }

    this.id = resource.ref;
  }
}
