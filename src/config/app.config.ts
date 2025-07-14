
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
        "PushP2P",
        "PullP2PPayment",
    ],
    paymentTypesForMerchant: [
        "Collection",
        "LargeValueCollection",
    ],
    paymentTypeConsents: [
        "single-immediate-payment",
        "multi-payment",
        "future-dated-payment",
    ],
    discount: 200,
    aedConstant: 100,
    highValueMerchantcapCheck: 20000,
    paymentTypes: ['Collection', 'LargeValueCollection', 'PushP2P', 'PullP2PPayment', 'Me2Me', ''],
    paymentStatus: ['AcceptedSettlementCompleted', 'AcceptedCreditSettlementCompleted', 'AcceptedWithoutPosting']
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



export const paymentLabelFilters = [
    {
        key: "corporate_payment",
        Label: "Corporate Payment",
        filterParams: [
            { key: "group", operator: "eq", value: "payment-bulk" },
            { key: "chargeable", operator: "eq", value: true },
            { key: "success", operator: "eq", value: true },
            { key: "api_category", operator: "eq", value: null },
            { key: "discount_type", operator: "eq", value: null },
            { key: "type", operator: "eq", value: null }
        ]
    },
    {
        key: "payment_initiation",
        Label: "Payment Initiation",
        filterParams: [
            { key: "group", operator: "eq", value: "payment-non-bulk" },
            { key: "chargeable", operator: "eq", value: true },
            { key: "success", operator: "eq", value: true },
            { key: "api_category", operator: "eq", value: null },
            { key: "discount_type", operator: "eq", value: null },
            { key: "type", operator: "eq", value: null }
        ]
    },
    {
        key: "insurance",
        Label: "Insurance",
        filterParams: [
            { key: "group", operator: "eq", value: "insurance" },
            { key: "chargeable", operator: "eq", value: true },
            { key: "success", operator: "eq", value: true },
            { key: "api_category", operator: "eq", value: null },
            { key: "discount_type", operator: "eq", value: null },
            { key: "type", operator: "eq", value: null }
        ]
    },
    {
        key: "setup_and_consent",
        Label: "Setup and Consent",
        filterParams: [
            { key: "group", operator: "eq", value: "data" },
            { key: "chargeable", operator: "eq", value: true },
            { key: "success", operator: "eq", value: true },
            { key: "api_category", operator: "eq", value: "setup" },
            { key: "discount_type", operator: "eq", value: null },
            { key: "type", operator: "eq", value: null }
        ]
    },
    {
        key: "corporate_data",
        Label: "Corporate Data",
        filterParams: [
            { key: "group", operator: "eq", value: "data" },
            { key: "chargeable", operator: "eq", value: true },
            { key: "success", operator: "eq", value: true },
            { key: "api_category", operator: "eq", value: null },
            { key: "discount_type", operator: "eq", value: null },
            { key: "type", operator: "eq", value: "corporate" }
        ]
    },
    {
        key: "confirmation_of_payee_discounted",
        Label: "Confirmation of Payee(Discounted)",
        filterParams: [
            { key: "group", operator: "eq", value: "data" },
            { key: "chargeable", operator: "eq", value: true },
            { key: "success", operator: "eq", value: true },
            { key: "api_category", operator: "eq", value: null },
            { key: "discount_type", operator: "eq", value: "cop" },
            { key: "type", operator: "eq", value: null }
        ]
    },
    {
        key: "balance_discounted",
        Label: "Balance(Discounted)",
        filterParams: [
            { key: "group", operator: "eq", value: "data" },
            { key: "chargeable", operator: "eq", value: true },
            { key: "success", operator: "eq", value: true },
            { key: "api_category", operator: "eq", value: null },
            { key: "discount_type", operator: "eq", value: "balance" },
            { key: "type", operator: "eq", value: null }
        ]
    },
    {
        key: "bank_data_sharing",
        Label: "Bank Data Sharing",
        filterParams: [
            { key: "group", operator: "eq", value: "data" },
            { key: "chargeable", operator: "eq", value: true },
            { key: "success", operator: "eq", value: true },
            { key: "api_category", operator: "ne", value: "setup" },
            { key: "discount_type", operator: "ne", value: "cop" },
            { key: "discount_type", operator: "ne", value: "balance" },
            { key: "type", operator: "ne", value: "corporate" }
        ]
    },

    //LFI
    {
        key: "merchant_collection",
        Label: "Merchant Collection",
        filterParams: [
            { key: "group", operator: "eq", value: "payment-bulk" },
            { key: "group", operator: "eq", value: "payment-non-bulk" },
            { key: "type", operator: "eq", value: "merchant" },
            { key: "lfiChargable", operator: "eq", value: true },
            { key: "success", operator: "eq", value: true },
            { key: "raw_api_log_data.payment_type", operator: "ne", value: "LargeValueCollection" },
            { key: "api_category", operator: "eq", value: null },
            { key: "discount_type", operator: "eq", value: null }
        ]
    },
    {
        key: "peer_to_peer",
        Label: "Peer-to-Peer",
        filterParams: [
            { key: "group", operator: "eq", value: "payment-bulk" },
            { key: "group", operator: "eq", value: "payment-non-bulk" },
            { key: "type", operator: "eq", value: "peer-2-peer" },
            { key: "lfiChargable", operator: "eq", value: true },
            { key: "success", operator: "eq", value: true },
            { key: "raw_api_log_data.payment_type", operator: "ne", value: "LargeValueCollection" },
            { key: "api_category", operator: "eq", value: null },
            { key: "discount_type", operator: "eq", value: null }
        ]
    },
    {
        key: "me_to_me_transfer",
        Label: "Me-to-Me Transfer",
        filterParams: [
            { key: "group", operator: "eq", value: "payment-bulk" },
            { key: "group", operator: "eq", value: "payment-non-bulk" },
            { key: "type", operator: "eq", value: "me-2-me" },
            { key: "lfiChargable", operator: "eq", value: true },
            { key: "success", operator: "eq", value: true },
            { key: "raw_api_log_data.payment_type", operator: "ne", value: "LargeValueCollection" },
            { key: "api_category", operator: "eq", value: null },
            { key: "discount_type", operator: "eq", value: null }
        ]
    },
    {
        key: "large_value_collection",
        Label: "Large Value Collection",
        filterParams: [
            { key: "group", operator: "eq", value: "payment-bulk" },
            { key: "group", operator: "eq", value: "payment-non-bulk" },
            { key: "raw_api_log_data.payment_type", operator: "eq", value: "LargeValueCollection" },
            { key: "lfiChargable", operator: "eq", value: true },
            { key: "success", operator: "eq", value: true },
            { key: "api_category", operator: "eq", value: null },
            { key: "discount_type", operator: "eq", value: null },
            { key: "type", operator: "eq", value: null }
        ]
    },
    {
        key: "corporate_payments",
        Label: "Corporate Payments",
        filterParams: [
            { key: "group", operator: "eq", value: "payment-bulk" },
            { key: "type", operator: "eq", value: "corporate" },
            { key: "lfiChargable", operator: "eq", value: true },
            { key: "success", operator: "eq", value: true },
            { key: "api_category", operator: "eq", value: null },
            { key: "discount_type", operator: "eq", value: null }
        ]
    },
    {
        key: "corporate_treasury_data",
        Label: "Corporate Treasury Data",
        filterParams: [
            { key: "group", operator: "eq", value: "data" },
            { key: "type", operator: "eq", value: "corporate" },
            { key: "lfiChargable", operator: "eq", value: true },
            { key: "success", operator: "eq", value: true },
            { key: "api_category", operator: "eq", value: null },
            { key: "discount_type", operator: "eq", value: null }
        ]
    },
    {
        key: "customer_data",
        Label: "Customer Data",
        filterParams: [
            { key: "group", operator: "eq", value: "data" },
            { key: "lfiChargable", operator: "eq", value: true },
            { key: "success", operator: "eq", value: true },
            { key: "api_category", operator: "ne", value: "setup" },
            { key: "discount_type", operator: "ne", value: "cop" },
            { key: "discount_type", operator: "ne", value: "balance" },
            { key: "type", operator: "ne", value: "corporate" }
        ]
    }
]


export const filter_master = [
    {
        key: "group",
        label: "Group",
        operators: ["eq", '$ne', '$in', '$nin'],
        options: [
            { value: "payment-bulk", label: "Payment Bulk" },
            { value: "payment-non-bulk", label: "Payment Non-Bulk" },
            { value: "insurance", label: "Insurance" },
            { value: "data", label: "Data" }
        ]
    },
    {
        key: "api_category",
        label: "API Category",
        operators: ["eq", '$ne', '$in', '$nin'],
        options: [
            { value: null, label: "All" },
            { value: "setup", label: "Setup" }
        ]
    },
    {
        key: "discount_type",
        label: "Discount Type",
        operators: ["eq", '$ne', '$in', '$nin'],
        options: [
            { value: null, label: "All" },
            { value: "cop", label: "Confirmation of Payee" },
            { value: "balance", label: "Balance Check" }
        ]
    },
    {
        key: "type",
        label: "Type",
        operators: ["eq", '$ne', '$in', '$nin'],
        options: [
            { value: null, label: "All" },
            { value: "corporate", label: "Corporate" }
        ]
    },
    {
        key: "raw_api_log_data.payment_type",
        operators: ["eq", '$ne', '$in', '$nin'],
        label: "Payment Type",
        options: [
            { value: null, label: "All" },
            { value: "LargeValueCollection", label: "Large Value Collection" }
        ]
    },
    {
        key: "chargeable",
        operators: ["eq", '$ne'],
        label: "Chargeable",
        options: [
            { value: null, label: "All" },
            { value: true, label: "True" }
        ]
    },
    {
        key: "lfiChargable",
        operators: ["eq", '$ne'],
        label: "LFI chargable",
        options: [
            { value: null, label: "All" },
            { value: true, label: "True" }
        ]
    },
    {
        key: "success",
        operators: ["eq", '$ne'],
        label: "Success",
        options: [
            { value: null, label: "All" },
            { value: true, label: "True" }
        ]
    }
]

