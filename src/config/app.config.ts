
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

export const paymentLabelFiltersOld = {
    "Corporate Payment": {
        group: "payment-bulk",
        chargeable: true,
        success: true,
        api_category: null,
        discount_type: null,
        type: null
    },
    "Payment Initiation": {
        group: "payment-non-bulk",
        chargeable: true,
        success: true,
        api_category: null,
        discount_type: null,
        type: null
    },
    "Insurance": {
        group: "insurance",
        chargeable: true,
        success: true,
        api_category: null,
        discount_type: null,
        type: null
    },
    "Setup and Consent": {
        group: "data",
        chargeable: true,
        success: true,
        api_category: "setup",
        discount_type: null,
        type: null
    },
    "Corporate Data": {
        group: "data",
        chargeable: true,
        success: true,
        api_category: null,
        discount_type: null,
        type: "corporate"
    },
    "Confirmation of Payee(Discounted)": {
        group: "data",
        chargeable: true,
        success: true,
        api_category: null,
        discount_type: "cop",
        type: null
    },
    "Balance(Discounted)": {
        group: "data",
        chargeable: true,
        success: true,
        api_category: null,
        discount_type: "balance",
        type: null
    },
    "Bank Data Sharing": {
        group: "data",
        chargeable: true,
        success: true,
        api_category: { $ne: "setup" },
        discount_type: { $nin: ["cop", "balance"] },
        type: { $ne: "corporate" }
    },

    //LFI
    "Merchant Collection": {
        group: ["payment-bulk", "payment-non-bulk"],
        type: "merchant",
        lfiChargable: true,
        success: true,
        payment_type: { $ne: "LargeValueCollection" },
        api_category: null,
        discount_type: null
    },
    "Peer-to-Peer": {
        group: ["payment-bulk", "payment-non-bulk"],
        type: "peer-2-peer",
        lfiChargable: true,
        success: true,
        payment_type: { $ne: "LargeValueCollection" },
        api_category: null,
        discount_type: null
    },
    "Me-to-Me Transfer": {
        group: ["payment-bulk", "payment-non-bulk"],
        type: "me-2-me",
        lfiChargable: true,
        success: true,
        payment_type: { $ne: "LargeValueCollection" },
        api_category: null,
        discount_type: null
    },
    "Large Value Collections": {
        group: ["payment-bulk", "payment-non-bulk"],
        payment_type: "LargeValueCollection",
        lfiChargable: true,
        success: true,
        api_category: null,
        discount_type: null,
        type: null
    },
    "Corporate Payments": {
        group: "payment-bulk",
        type: "corporate",
        lfiChargable: true,
        success: true,
        api_category: null,
        discount_type: null
    },
    "Corporate Treasury Data": {
        group: "data",
        type: "corporate",
        lfiChargable: true,
        success: true,
        api_category: null,
        discount_type: null
    },
    "Customer Data": {
        group: "data",
        lfiChargable: true,
        success: true,
        api_category: { $ne: "setup" },
        discount_type: { $nin: ["cop", "balance"] },
        type: { $ne: "corporate" }
    }
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
            { key: "discount_type", operator: "nin", value: ["cop", "balance"] },
            { key: "type", operator: "ne", value: "corporate" }
        ]
    },

    //LFI
    {
        key: "merchant_collection",
        Label: "Merchant Collection",
        filterParams: [
            { key: "group", operator: "in", value: ["payment-bulk", "payment-non-bulk"] },
            { key: "type", operator: "eq", value: "merchant" },
            { key: "lfiChargable", operator: "eq", value: true },
            { key: "success", operator: "eq", value: true },
            { key: "payment_type", operator: "ne", value: "LargeValueCollection" },
            { key: "api_category", operator: "eq", value: null },
            { key: "discount_type", operator: "eq", value: null }
        ]
    },
    {
        key: "peer_to_peer",
        Label: "Peer-to-Peer",
        filterParams: [
            { key: "group", operator: "in", value: ["payment-bulk", "payment-non-bulk"] },
            { key: "type", operator: "eq", value: "peer-2-peer" },
            { key: "lfiChargable", operator: "eq", value: true },
            { key: "success", operator: "eq", value: true },
            { key: "payment_type", operator: "ne", value: "LargeValueCollection" },
            { key: "api_category", operator: "eq", value: null },
            { key: "discount_type", operator: "eq", value: null }
        ]
    },
    {
        key: "me_to_me_transfer",
        Label: "Me-to-Me Transfer",
        filterParams: [
            { key: "group", operator: "in", value: ["payment-bulk", "payment-non-bulk"] },
            { key: "type", operator: "eq", value: "me-2-me" },
            { key: "lfiChargable", operator: "eq", value: true },
            { key: "success", operator: "eq", value: true },
            { key: "payment_type", operator: "ne", value: "LargeValueCollection" },
            { key: "api_category", operator: "eq", value: null },
            { key: "discount_type", operator: "eq", value: null }
        ]
    },
    {
        key: "large_value_collections",
        Label: "Large Value Collections",
        filterParams: [
            { key: "group", operator: "in", value: ["payment-bulk", "payment-non-bulk"] },
            { key: "payment_type", operator: "eq", value: "LargeValueCollection" },
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
            { key: "discount_type", operator: "nin", value: ["cop", "balance"] },
            { key: "type", operator: "ne", value: "corporate" }
        ]
    }
]


export const filter_master = [
    {
        key: "group",
        label: "Group",
        operators: ["eq", '$ne', '$in', '$nin', '$gte', '$lte'],
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
        operators: ["eq", '$ne', '$in', '$nin', '$gte', '$lte'],
        options: [
            { value: null, label: "All" },
            { value: "setup", label: "Setup" }
        ]
    },
    {
        key: "discount_type",
        label: "Discount Type",
        operators: ["eq", '$ne', '$in', '$nin', '$gte', '$lte'],
        options: [
            { value: null, label: "All" },
            { value: "cop", label: "Confirmation of Payee" },
            { value: "balance", label: "Balance Check" }
        ]
    },
    {
        key: "type",
        label: "Type",
        operators: ["eq", '$ne', '$in', '$nin', '$gte', '$lte'],
        options: [
            { value: null, label: "All" },
            { value: "corporate", label: "Corporate" }
        ]
    },
    {
        key: "payment_type",
        operators: ["eq", '$ne', '$in', '$nin', '$gte', '$lte'],
        label: "Type",
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

