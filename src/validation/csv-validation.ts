import * as Joi from '@hapi/joi';

export const file1HeadersSchema = Joi.array().items(
    Joi.string().valid(
        'timestamp', 'tppName', 'lfiId', 'tppId', 'tppClientId',
        'apiSet', 'httpMethod', 'url', 'tppResponseCodeGroup',
        'executionTime', 'interactionId', 'resourceName', 'lfIResponseCodeGroup',
        'isAttended', 'records', 'paymentType', 'PaymentId', 'merchantId',
        'psuId', 'isLargeCorporate', 'userType', 'purpose'
    )
).required();

export const file2HeadersSchema = Joi.array().items(
    Joi.string().valid(
        'timestamp', 'tppName', 'lfiId', 'tppId', 'tppClientId',
        'status', 'currency', 'amount', 'paymentConsentType', 'paymentType',
        'transactionId', 'PaymentId', 'merchantId', 'psuId',
        'isLargeCorporate', 'numberOfSuccessfulTransactions', 'internationalPayment'

    )
).required();
export const fileHead = {
    file1Header: ['timestamp', 'tppName', 'lfiId', 'tppId', 'tppClientId',
        'apiSet', 'httpMethod', 'url', 'tppResponseCodeGroup',
        'executionTime', 'interactionId', 'resourceName', 'lfIResponseCodeGroup',
        'isAttended', 'records', 'paymentType', 'PaymentId', 'merchantId',
        'psuId', 'isLargeCorporate', 'userType', 'purpose'],

    file2Header: ['timestamp', 'tppName', 'lfiId', 'tppId', 'tppClientId',
        'status', 'currency', 'amount', 'paymentConsentType', 'paymentType',
        'transactionId', 'PaymentId', 'merchantId', 'psuId',
        'isLargeCorporate', 'numberOfSuccessfulTransactions', 'internationalPayment']
}
