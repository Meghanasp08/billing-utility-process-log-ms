import * as Joi from '@hapi/joi';

export const file1HeadersSchema = Joi.array().items(
    Joi.string().valid(
        'timestamp', 'tppName', 'lfiId', 'lfiName', 'tppId', 'tppClientId',
        'apiSet', 'httpMethod', 'url', 'tppResponseCodeGroup',
        'executionTime', 'interactionId', 'resourceName', 'lfIResponseCodeGroup',
        'isAttended', 'records', 'paymentType', 'paymentId', 'merchantId',
        'psuId', 'isLargeCorporate', 'userType', 'purpose'
    )
).required();

export const file2HeadersSchema = Joi.array().items(
    Joi.string().valid(
        'timestamp', 'tppName', 'lfiId', 'lfiName', 'tppId', 'tppClientId',
        'status', 'currency', 'amount', 'paymentConsentType', 'paymentType',
        'transactionId', 'paymentId', 'merchantId', 'psuId',
        'isLargeCorporate', 'numberOfSuccessfulTransactions', 'internationalPayment'

    )
).required();


export const file1HeadersIncludeSchema = [
    'timestamp', 'tppName', 'lfiId', 'lfiName', 'tppId', 'tppClientId',
    'apiSet', 'httpMethod', 'url', 'tppResponseCodeGroup',
    'executionTime', 'interactionId', 'resourceName', 'lfIResponseCodeGroup',
    'isAttended', 'records', 'paymentType', 'paymentId', 'merchantId',
    'psuId', 'isLargeCorporate', 'userType', 'purpose'
];

export const file2HeadersIncludeSchema = [
    'timestamp', 'tppName', 'lfiId', 'lfiName', 'tppId', 'tppClientId',
    'status', 'currency', 'amount', 'paymentConsentType', 'paymentType',
    'transactionId', 'paymentId', 'merchantId', 'psuId',
    'isLargeCorporate', 'numberOfSuccessfulTransactions', 'internationalPayment'
];

export const lfiTppHeaderSchema = [
    'OrganisationId', 'OrganisationName', 'RegisteredName', 'AddressLine2', 'Size', 'Country',
    'Postcode', 'Org Status', 'ContactType', 'EmailAddress',
    'FirstName', 'LastName', 'User Status'
];
// Function to validate headers
export function validateHeaders(normalizedHeaders: string[], expectedHeaders: string[]) {
    const missingHeaders = expectedHeaders.filter(header => !normalizedHeaders.includes(header));

    if (missingHeaders.length > 0) {
        throw new Error(
            `Validation failed. Missing required headers: ${missingHeaders.join(', ')}`
        );
    }
    return null
    // Extra columns are ignored, so no need to handle them.
}
