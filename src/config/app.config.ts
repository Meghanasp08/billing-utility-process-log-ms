
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
    paymentTypes: ['Collection', 'LargeValueCollection', 'PushP2P', 'PullP2PPayment', 'Me2Me', ''],
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

export const paymentLabelFilters = {
    "Corporate Payment": {
        group: "payment-bulk",
        api_category: null,
        discount_type: null,
        type: null
    },
    "Payment Initiation": {
        group: "payment-non-bulk",
        api_category: null,
        discount_type: null,
        type: null
    },
    "Insurance": {
        group: "insurance",
        api_category: null,
        discount_type: null,
        type: null
    },
    "Setup and Consent": {
        group: "data",
        api_category: "setup",
        discount_type: null,
        type: null
    },
    "Corporate Data": {
        group: "data",
        api_category: null,
        discount_type: null,
        type: "corporate"
    },
    "Confirmation of Payee(Discounted)": {
        group: "data",
        api_category: null,
        discount_type: "cop",
        type: null
    },
    "Balance(Discounted)": {
        group: "data",
        api_category: null,
        discount_type: "balance",
        type: null
    },
    "Bank Data Sharing": {
        group: "data",
        api_category: { $ne: "setup" },
        discount_type: { $nin: ["cop", "balance"] },
        type: { $ne: "corporate" }
    },

    "Merchant Collection": {
        group: ["payment-bulk", "payment-non-bulk"],
        type: "merchant",
        payment_type: { $ne: "LargeValueCollection" },
        api_category: null,
        discount_type: null
    },
    "Peer-to-Peer": {
        group: ["payment-bulk", "payment-non-bulk"],
        type: "peer-2-peer",
        payment_type: { $ne: "LargeValueCollection" },
        api_category: null,
        discount_type: null
    },
    "Me-to-Me Transfer": {
        group: ["payment-bulk", "payment-non-bulk"],
        type: "me-2-me",
        payment_type: { $ne: "LargeValueCollection" },
        api_category: null,
        discount_type: null
    },
    "Large Value Collections": {
        group: ["payment-bulk", "payment-non-bulk"],
        payment_type: "LargeValueCollection",
        api_category: null,
        discount_type: null,
        type: null
    },
    "Corporate Payments": {
        group: "payment-bulk",
        type: "corporate",
        api_category: null,
        discount_type: null
    },
    "Corporate Treasury Data": {
        group: "data",
        type: "corporate",
        api_category: null,
        discount_type: null
    },
    "Customer Data": {
        group: "data",
        api_category: { $ne: "setup" },
        discount_type: { $nin: ["cop", "balance"] },
        type: { $ne: "corporate" }
    }
};


export const filter_master = [
    {
        key: "group",
        label: "Group",
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
        options: [
            { value: null, label: "All" },
            { value: "setup", label: "Setup" }
        ]
    },
    {
        key: "discount_type",
        label: "Discount Type",
        options: [
            { value: null, label: "All" },
            { value: "cop", label: "Confirmation of Payee" },
            { value: "balance", label: "Balance Check" }
        ]
    },
    {
        key: "type",
        label: "Type",
        options: [
            { value: null, label: "All" },
            { value: "corporate", label: "Corporate" }
        ]
    },
     {
        key: "payment_type",
        label: "Type",
        options: [
            { value: null, label: "All" },
            { value: "LargeValueCollection", label: "Large Value Collection" }
        ]
    }
]

