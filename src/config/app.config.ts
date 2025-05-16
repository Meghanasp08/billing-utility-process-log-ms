
export const AppConfig = {
    endpoints: [
        "/open-finance/account-information/v1.1/account-access-consents:GET",
        "/open-finance/payment/v1.1/payment-consents:GET",
        "/open-finance/payment/v1.1/payments:GET",
        "/open-finance/payment/v1.1/file-payments:GET",
        "/open-finance/confirmation-of-payee/v1.1/discovery:POST",
        "/open-finance/insurance/v1.1/insurance-consents:GET",
    ],
    peerToPeerTypes: [
        "Collection",
        "LargeValueCollection",
        "PushP2P",
        "PullP2PPayment",
    ],
    paymentTypeConsents: [
        "single-immediate-payment",
        "multi-payment",
        "future-dated-payment",
    ],
    discount: 200,
    aedConstant: 100,
    highValueMerchantcapCheck: 20000,
};

export const invoice_config = {
    startNumber: 1000,
    minDigits: 7,
    leadingChar: "0",
    prefix: "INV",
    prefixSeparator: "",
    suffix: "",
    suffixSeparator: ""
};

export const collection_memo_config = {
    startNumber: 4000,
    minDigits: 7,
    leadingChar: "0",
    prefix: "CM",
    prefixSeparator: "",
    suffix: "",
    suffixSeparator: ""
};
