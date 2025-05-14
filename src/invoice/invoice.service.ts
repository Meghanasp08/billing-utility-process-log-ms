import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as fs from "fs";
import * as moment from 'moment';
import { Model, Types } from 'mongoose';
import { PaginationEnum, } from 'src/common/constants/constants.enum';
import { PaginationDTO } from 'src/common/dto/common.dto';
import { collection_memo_config, invoice_config } from 'src/config/app.config';
import { GlobalConfiguration, GlobalConfigurationDocument } from 'src/configuration/schema/global_config.schema';
import { MailService } from 'src/mail/mail.service';
const puppeteer = require('puppeteer')
@Injectable()
export class InvoiceService {
    constructor(
        @InjectModel('Invoices') private readonly invoiceModel: Model<any>,
        @InjectModel('Logs') private readonly logsModel: Model<any>,
        @InjectModel('TppData') private readonly tppDataModel: Model<any>,
        @InjectModel('LfiData') private readonly lfiDataModel: Model<any>,
        @InjectModel('CollectionMemo') private readonly collectionMemoModel: Model<any>,
        @InjectModel('SingleDayTppInvoice') private readonly singleDayTppInvoiceModel: Model<any>,
        @InjectModel('SingleDayCollectionMemo') private readonly singleDayCollectionMemoModel: Model<any>,
        @InjectModel('Counter') private readonly CounterModel: Model<any>,
        @InjectModel(GlobalConfiguration.name) private globalModel: Model<GlobalConfigurationDocument>,
        private readonly mailService: MailService,
    ) { }

    async findAllInvoices(PaginationDTO: PaginationDTO): Promise<any> {
        const offset = PaginationDTO.Offset
            ? Number(PaginationDTO.Offset)
            : PaginationEnum.OFFSET;
        const limit = PaginationDTO.limit
            ? Number(PaginationDTO.limit)
            : PaginationEnum.LIMIT;
        const options: any = {};
        const status =
            PaginationDTO.status != null && PaginationDTO.status != 'all'
                ? PaginationDTO.status
                : null;
        Object.assign(options, {
            ...(status === null ? { status: { $ne: null } } : { status: status }),
        });
        const search = PaginationDTO.search ? PaginationDTO.search.trim() : null;
        if (search) {
            const searchRegex = new RegExp(search, "i");
            options.$or = [{ "tpp_id": search }, { "tpp_name": searchRegex },];
        }

        const month = Number(PaginationDTO?.month) ?? 0;
        const year = Number(PaginationDTO?.year) ?? 0;

        if (month && month !== 0) {
            options.invoice_month = month
        }
        if (year) {
            options.invoice_year = year
        }

        const count = await this.invoiceModel.find(options).countDocuments();
        const result = await this.invoiceModel.find(options).skip(offset).limit(limit).sort({ createdAt: -1 }).lean<any>()

        return {
            result,
            pagination: {
                offset: offset,
                limit: limit,
                total: count,
            },
        };
    }

    async invoiceCreation(
        invoiceDto: any,
    ): Promise<any> {

        let month = invoiceDto?.month;
        let year = invoiceDto?.year;
        if (month < 1 || month > 12)
            throw new Error('Invalid month (1-12)');

        await this.invoiceModel.deleteMany({
            invoice_month: month,
            invoice_year: year
        });
        await this.collectionMemoModel.deleteMany({
            invoice_month: month,
            invoice_year: year
        });

        const vat = await this.globalModel.findOne({
            key: 'vatPercentageValue',
        });

        const globalConfiData = await this.globalModel.find();
        const paymentApiHubFee = globalConfiData.find(item => item.key === "paymentApiHubFee")?.value;
        const insuranceApiHubFee = globalConfiData.find(item => item.key === "insuranceApiHubFee")?.value;
        const discountApiHubFee = globalConfiData.find(item => item.key === "discountApiHubFee")?.value;
        let nonLargeValueMerchantBps = globalConfiData.find(item => item.key === "nonLargeValueMerchantBps")?.value;
        const paymentLargeValueFeePeer = globalConfiData.find(item => item.key === "paymentNonLargevalueFeePeer")?.value;
        const paymentFeeMe2me = globalConfiData.find(item => item.key === "paymentFeeMe2me")?.value;
        const nonBulkLargeValueCapMerchant = globalConfiData.find(item => item.key === "nonBulkLargeValueCapMerchant")?.value;
        const bulkLargeCorporatefee = globalConfiData.find(item => item.key === "bulkLargeCorporatefee")?.value;
        const dataLargeCorporateMdp = globalConfiData.find(item => item.key === "dataLargeCorporateMdp")?.value;

        const vatPercent = vat?.value ?? 5
        const vatDecimal = vatPercent / 100;
        nonLargeValueMerchantBps = Number(nonLargeValueMerchantBps) / 10000
        const tppData = await this.tppDataModel.find();

        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        const currentDate = new Date();
        const futureDate = new Date();
        futureDate.setDate(currentDate.getDate() + 30);
        console.log(startDate, endDate)

        for (const tpp of tppData) {
            const result = await this.logsModel.aggregate(
                [
                    {
                        $match: {
                            "raw_api_log_data.tpp_id": tpp?.tpp_id,
                            "chargeable": true,
                            "success": true,
                            $expr: {
                                $and: [
                                    {
                                        $eq: [
                                            {
                                                $month: "$raw_api_log_data.timestamp"
                                            },
                                            month
                                        ]
                                    },
                                    {
                                        $eq: [
                                            {
                                                $year: "$raw_api_log_data.timestamp"
                                            },
                                            year
                                        ]
                                    }
                                ]
                            }
                        }
                    },
                    {
                        $addFields: {
                            paymentTypeLabel: {
                                $switch: {
                                    branches: [
                                        {
                                            case: {
                                                $eq: ["$group", "payment-bulk"]
                                            },
                                            then: "Corporate Payment"   //-- paymentApiHubFee
                                        },
                                        {
                                            case: {
                                                $eq: [
                                                    "$group",
                                                    "payment-non-bulk"
                                                ]
                                            },
                                            then: "Payment Initiation"    //--paymentApiHubFee
                                        },
                                        {
                                            case: {
                                                $eq: ["$group", "insurance"]
                                            },
                                            then: "Insurance"    //-- insuranceApiHubFee
                                        },
                                        {
                                            case: {
                                                $and: [
                                                    {
                                                        $eq: ["$group", "data"]
                                                    },
                                                    {
                                                        $eq: [
                                                            "$api_category",
                                                            "setup"
                                                        ]
                                                    }
                                                ]
                                            },
                                            then: "Setup and Consent"    //-- paymentApiHubFee
                                        },
                                        {
                                            case: {
                                                $and: [
                                                    {
                                                        $eq: ["$group", "data"]
                                                    },
                                                    {
                                                        $eq: ["$type", "corporate"]
                                                    }
                                                ]
                                            },
                                            then: "Corporate Data"   //-- paymentApiHubFee
                                        },
                                        {
                                            case: {
                                                $and: [
                                                    {
                                                        $eq: ["$group", "data"]
                                                    },
                                                    {
                                                        $eq: ["$discount_type", "cop"]
                                                    }
                                                ]
                                            },
                                            then: "Confirmation of Payee(Discounted)"  //-- discountApiHubFee
                                        },
                                        {
                                            case: {
                                                $and: [
                                                    {
                                                        $eq: ["$group", "data"]
                                                    },
                                                    {
                                                        $eq: [
                                                            "$discount_type",
                                                            "balance"
                                                        ]
                                                    }
                                                ]
                                            },
                                            then: "Balance(Discounted)"  //-- discountApiHubFee
                                        },
                                        {
                                            case: {
                                                $eq: ["$group", "data"]
                                            },
                                            then: "Bank Data Sharing"   //--paymentApiHubFee
                                        }
                                    ],
                                    default: null
                                }
                            }
                        }
                    },
                    {
                        $addFields: {
                            category: {
                                $cond: {
                                    if: {
                                        $in: [
                                            "$paymentTypeLabel",
                                            [
                                                "Corporate Payment",
                                                "Payment Initiation"
                                            ]
                                        ]
                                    },
                                    then: "service_initiation",
                                    else: "data_sharing"
                                }
                            }
                        }
                    },
                    {
                        $match: {
                            paymentTypeLabel: {
                                $ne: null
                            }
                        }
                    },
                    {
                        $group: {
                            _id: {
                                category: "$category",
                                description: "$paymentTypeLabel"
                            },
                            quantity: {
                                $sum: "$apiHubVolume"
                            },
                            unit_price: {
                                $first: "$api_hub_fee"
                            },
                            total: {
                                $sum: "$applicableApiHubFee"
                            }
                        }
                    },
                    {
                        $project: {
                            _id: 0,
                            category: "$_id.category",
                            item: {
                                description: "$_id.description",
                                quantity: "$quantity",
                                unit_price: {
                                    $round: ["$unit_price", 3]
                                },
                                total: {
                                    $round: ["$total", 3]
                                },
                                vat_amount: {
                                    $round: [
                                        { $multiply: ["$total", vatDecimal] },
                                        3
                                    ]
                                },
                                full_total: {
                                    $round: [
                                        {
                                            $add: [
                                                "$total",
                                                {
                                                    $multiply: ["$total", vatDecimal]
                                                }
                                            ]
                                        },
                                        3
                                    ]
                                }
                            }
                        }
                    },
                    {
                        $group: {
                            _id: "$category",
                            items: {
                                $push: "$item"
                            }
                        }
                    },
                    {
                        $addFields: {
                            allItems: {
                                $cond: {
                                    if: {
                                        $eq: ["$_id", "service_initiation"]
                                    },
                                    then: [
                                        "Corporate Payment",
                                        "Payment Initiation"
                                    ],
                                    else: [
                                        "Insurance",
                                        "Setup and Consent",
                                        "Corporate Data",
                                        "Confirmation of Payee",
                                        "Balance(Discounted)",
                                        "Bank Data Sharing"
                                    ]
                                }
                            }
                        }
                    },
                    {
                        $addFields: {
                            items: {
                                $map: {
                                    input: "$allItems",
                                    as: "desc",
                                    in: {
                                        $let: {
                                            vars: {
                                                matchedItem: {
                                                    $first: {
                                                        $filter: {
                                                            input: "$items",
                                                            as: "item",
                                                            cond: {
                                                                $eq: [
                                                                    "$$item.description",
                                                                    "$$desc"
                                                                ]
                                                            }
                                                        }
                                                    }
                                                }
                                            },
                                            in: {
                                                description: "$$desc",
                                                quantity: {
                                                    $ifNull: [
                                                        "$$matchedItem.quantity",
                                                        0
                                                    ]
                                                },
                                                unit_price: {
                                                    $ifNull: [
                                                        "$$matchedItem.unit_price",
                                                        {
                                                            $switch: {
                                                                branches: [
                                                                    {
                                                                        case: { $eq: ["$$desc", "Corporate Payment"] },
                                                                        then: paymentApiHubFee
                                                                    },
                                                                    {
                                                                        case: { $eq: ["$$desc", "Payment Initiation"] },
                                                                        then: paymentApiHubFee
                                                                    },
                                                                    {
                                                                        case: { $eq: ["$$desc", "Insurance"] },
                                                                        then: insuranceApiHubFee
                                                                    },
                                                                    {
                                                                        case: { $eq: ["$$desc", "Setup and Consent"] },
                                                                        then: paymentApiHubFee
                                                                    },
                                                                    {
                                                                        case: { $eq: ["$$desc", "Corporate Data"] },
                                                                        then: paymentApiHubFee
                                                                    },
                                                                    {
                                                                        case: { $eq: ["$$desc", "Confirmation of Payee"] },
                                                                        then: discountApiHubFee
                                                                    },
                                                                    {
                                                                        case: { $eq: ["$$desc", "Balance(Discounted)"] },
                                                                        then: discountApiHubFee
                                                                    },
                                                                    {
                                                                        case: { $eq: ["$$desc", "Bank Data Sharing"] },
                                                                        then: paymentApiHubFee
                                                                    }
                                                                ],
                                                                default: 0.25 // Fallback if description doesn't match
                                                            }
                                                        }
                                                    ]
                                                },
                                                total: {
                                                    $ifNull: [
                                                        "$$matchedItem.total",
                                                        0
                                                    ]
                                                },
                                                vat_amount: {
                                                    $ifNull: [
                                                        "$$matchedItem.vat_amount",
                                                        0
                                                    ]
                                                },
                                                full_total: {
                                                    $ifNull: [
                                                        "$$matchedItem.full_total",
                                                        0
                                                    ]
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    {
                        $addFields: {
                            sub_total: {
                                $sum: "$items.total"
                            }
                        }
                    },
                    {
                        $addFields: {
                            vat_amount: {
                                $round: [
                                    {
                                        $multiply: ["$sub_total", vatDecimal]
                                    },
                                    3
                                ]
                            },
                            category_total: {
                                $round: [
                                    {
                                        $add: [
                                            "$sub_total",
                                            {
                                                $multiply: ["$sub_total", vatDecimal]
                                            }
                                        ]
                                    },
                                    3
                                ]
                            }
                        }
                    },
                    {
                        $project: {
                            _id: 0,
                            category: "$_id",
                            items: 1,
                            sub_total: 1,
                            vat_amount: 1,
                            category_total: 1
                        }
                    }
                ]
            );
            const result_of_lfi = await this.logsModel.aggregate(
                [
                    {
                        $match: {
                            "raw_api_log_data.tpp_id": tpp?.tpp_id,
                            lfiChargable: true,
                            success: true,
                            $expr: {
                                $and: [
                                    {
                                        $eq: [
                                            {
                                                $month:
                                                    "$raw_api_log_data.timestamp"
                                            },
                                            month
                                        ]
                                    },
                                    {
                                        $eq: [
                                            {
                                                $year:
                                                    "$raw_api_log_data.timestamp"
                                            },
                                            year
                                        ]
                                    }
                                ]
                            }
                        }
                    },
                    {
                        $addFields: {
                            label: {
                                $switch: {
                                    branches: [
                                        {
                                            case: {
                                                $and: [
                                                    {
                                                        $in: [
                                                            "$group",
                                                            [
                                                                "payment-bulk",
                                                                "payment-non-bulk"
                                                            ]
                                                        ]
                                                    },
                                                    {
                                                        $eq: ["$type", "merchant"]
                                                    },
                                                    {
                                                        $ne: [
                                                            "$raw_api_log_data.payment_type",
                                                            "LargeValueCollection"
                                                        ]
                                                    }
                                                ]
                                            },
                                            then: "Merchant Collection"   //-- nonLargeValueMerchantBps/10000
                                        },
                                        {
                                            case: {
                                                $and: [
                                                    {
                                                        $in: [
                                                            "$group",
                                                            [
                                                                "payment-bulk",
                                                                "payment-non-bulk"
                                                            ]
                                                        ]
                                                    },
                                                    {
                                                        $eq: ["$type", "peer-2-peer"]
                                                    },
                                                    {
                                                        $ne: [
                                                            "$raw_api_log_data.payment_type",
                                                            "LargeValueCollection"
                                                        ]
                                                    }
                                                ]
                                            },
                                            then: "Peer-to-Peer"   //paymentNonLargevalueFeePeer
                                        },
                                        {
                                            case: {
                                                $and: [
                                                    {
                                                        $in: [
                                                            "$group",
                                                            [
                                                                "payment-bulk",
                                                                "payment-non-bulk"
                                                            ]
                                                        ]
                                                    },
                                                    {
                                                        $eq: ["$type", "me-2-me"]
                                                    },
                                                    {
                                                        $ne: [
                                                            "$raw_api_log_data.payment_type",
                                                            "LargeValueCollection"
                                                        ]
                                                    }
                                                ]
                                            },
                                            then: "Me-to-Me Transfer"  //paymentFeeMe2me
                                        },
                                        {
                                            case: {
                                                $and: [
                                                    {
                                                        $in: [
                                                            "$group",
                                                            [
                                                                "payment-bulk",
                                                                "payment-non-bulk"
                                                            ]
                                                        ]
                                                    },
                                                    {
                                                        $eq: [
                                                            "$raw_api_log_data.payment_type",
                                                            "LargeValueCollection"
                                                        ]
                                                    }
                                                ]
                                            },
                                            then: "Large Value Collections"  // nonBulkLargeValueCapMerchant
                                        },
                                        {
                                            case: {
                                                $and: [
                                                    {
                                                        $eq: [
                                                            "$group",
                                                            "payment-bulk"
                                                        ]
                                                    },
                                                    {
                                                        $eq: ["$type", "corporate"]
                                                    }
                                                ]
                                            },
                                            then: "Corporate Payments" // bulkLargeCorporatefee
                                        },
                                        {
                                            case: {
                                                $and: [
                                                    {
                                                        $eq: ["$group", "data"]
                                                    },
                                                    {
                                                        $eq: ["$type", "corporate"]
                                                    }
                                                ]
                                            },
                                            then: "Corporate Treasury Data" // dataLargeCorporateMdp
                                        },
                                        {
                                            case: {
                                                $eq: ["$group", "data"]
                                            },
                                            then: "Customer Data"       //Take mppRate from lfi
                                        }
                                    ],
                                    default: "Others"
                                }
                            }
                        }
                    },
                    {
                        $group: {
                            _id: {
                                lfi_id: "$raw_api_log_data.lfi_id",
                                label: "$label"
                            },
                            quantity: {
                                $sum: "$volume"
                            },
                            unit_price: {
                                $first: "$unit_price"
                            },
                            total: {
                                $sum: "$applicableFee"
                            },
                            capped: {
                                $max: "$isCapped"
                            }
                        }
                    },
                    {
                        $group: {
                            _id: "$_id.lfi_id",
                            labels: {
                                $push: {
                                    label: "$_id.label",
                                    quantity: "$quantity",
                                    unit_price: {
                                        $round: ["$unit_price", 4]
                                    },
                                    total: {
                                        $round: ["$total", 3]
                                    },
                                    capped: "$capped",
                                }
                            }
                        }
                    },
                    {
                        '$lookup': {
                            'from': 'lfi_data',
                            'localField': '_id',
                            'foreignField': 'lfi_id',
                            'as': 'lfi_data'
                        }
                    }, {
                        '$unwind': {
                            'path': '$lfi_data'
                        }
                    },
                    {
                        $addFields: {
                            labels: {
                                $map: {
                                    input: [
                                        "Merchant Collection",
                                        "Peer-to-Peer",
                                        "Me-to-Me Transfer",
                                        "Large value collection",
                                        "Corporate Payments",
                                        "Corporate Treasury Data",
                                        "Customer Data"
                                    ],
                                    as: "expectedLabel",
                                    in: {
                                        $let: {
                                            vars: {
                                                matched: {
                                                    $first: {
                                                        $filter: {
                                                            input: "$labels",
                                                            as: "existing",
                                                            cond: {
                                                                $eq: ["$$existing.label", "$$expectedLabel"]
                                                            }
                                                        }
                                                    }
                                                },
                                                defaultUnitPrice: {
                                                    $switch: {
                                                        branches: [
                                                            { case: { $eq: ["$$expectedLabel", "Merchant Collection"] }, then: nonLargeValueMerchantBps },
                                                            { case: { $eq: ["$$expectedLabel", "Peer-to-Peer"] }, then: paymentLargeValueFeePeer },
                                                            { case: { $eq: ["$$expectedLabel", "Me-to-Me Transfer"] }, then: paymentFeeMe2me },
                                                            { case: { $eq: ["$$expectedLabel", "Large value collection"] }, then: nonBulkLargeValueCapMerchant },
                                                            { case: { $eq: ["$$expectedLabel", "Corporate Payments"] }, then: bulkLargeCorporatefee },
                                                            { case: { $eq: ["$$expectedLabel", "Corporate Treasury Data"] }, then: dataLargeCorporateMdp },
                                                            { case: { $eq: ["$$expectedLabel", "Customer Data"] }, then: "$lfi_data.mdp_rate" }
                                                        ],
                                                        default: 0.025
                                                    }
                                                }
                                            },
                                            in: {
                                                $cond: {
                                                    if: "$$matched",
                                                    then: "$$matched",
                                                    else: {
                                                        label: "$$expectedLabel",
                                                        quantity: 0,
                                                        unit_price: "$$defaultUnitPrice",
                                                        total: 0
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },

                    // {
                    //     $addFields: {
                    //         labels: {
                    //             $map: {
                    //                 input: "$labels",
                    //                 as: "item",
                    //                 in: {
                    //                     $mergeObjects: [
                    //                         "$$item",
                    //                         {
                    //                             vat_amount: {
                    //                                 $round: [
                    //                                     {
                    //                                         $multiply: [
                    //                                             "$$item.total",
                    //                                             vatDecimal
                    //                                         ]
                    //                                     },
                    //                                     3
                    //                                 ]
                    //                             },
                    //                             full_total: {
                    //                                 $round: [
                    //                                     {
                    //                                         $add: [
                    //                                             "$$item.total",
                    //                                             {
                    //                                                 $multiply: [
                    //                                                     "$$item.total",
                    //                                                     vatDecimal
                    //                                                 ]
                    //                                             }
                    //                                         ]
                    //                                     },
                    //                                     3
                    //                                 ]
                    //                             }
                    //                         }
                    //                     ]
                    //                 }
                    //             }
                    //         }
                    //     }
                    // },
                    {
                        $addFields: {
                            full_total: {
                                $round: [
                                    {
                                        $sum: "$labels.total"
                                    },
                                    3
                                ]
                            },
                            'lfi_name': '$lfi_data.lfi_name'
                            // vat: {
                            //     $round: [
                            //         {
                            //             $multiply: [
                            //                 {
                            //                     $sum: "$labels.total"
                            //                 },
                            //                 vatDecimal
                            //             ]
                            //         },
                            //         3
                            //     ]
                            // },
                            // actual_total: {
                            //     $round: [
                            //         {
                            //             $add: [
                            //                 {
                            //                     $sum: "$labels.total"
                            //                 },
                            //                 {
                            //                     $multiply: [
                            //                         {
                            //                             $sum: "$labels.total"
                            //                         },
                            //                         vatDecimal
                            //                     ]
                            //                 }
                            //             ]
                            //         },
                            //         3
                            //     ]
                            // }
                        }
                    }
                ]
            )
            const invoice_total = result.reduce((sum, item) => sum + item.category_total, 0);
            const vat = invoice_total * vatDecimal;

            const lfi_total = result_of_lfi.reduce((sum, item) => sum + item.full_total, 0);

            const total = Number(invoice_total) + Number(lfi_total);
            const roundedTotal = Math.round(total * 100) / 100;
            const roundedVat = Math.round(vat * 100) / 100;

            const updated_result = await this.ensureCategories(result);

            const invoice_data = {
                invoice_number: await this.generateInvoiceNumber(),
                tpp_id: tpp?.tpp_id,
                tpp_name: tpp?.tpp_name,
                billing_address_line1: 'billing_address_line1',
                billing_address_line2: 'billing_address_line2',
                billing_address_city: 'billing_address_city',
                billing_address_state: 'billing_address_state',
                billing_address_postal_code: '1111',
                billing_address_country: 'country',
                invoice_month: month,
                invoice_year: year,
                billing_period_start: startDate,  // Month First
                billing_period_end: endDate,   // Month Last
                issued_date: new Date(),        // Generate Date
                due_date: futureDate,  //issued_date + 30 days
                generated_at: new Date(),        // Generate Date
                currency: 'AED',         //AED default
                tpp_usage_per_lfi: result_of_lfi,
                invoice_items: updated_result,
                // subtotal: 0, // vendaaaa
                vat_percent: vatPercent, // Default 5 percent
                vat_total: roundedVat,  // vat percent of invoice total
                total_amount: roundedTotal,  // total of invoice array
                invoice_total: invoice_total,
                lfi_total: lfi_total,
                status: 1,
                notes: 'Invoice Added',
            }

            const invoice = new this.invoiceModel(invoice_data)
            await invoice.save();


            for (const obj of result_of_lfi) {

                const tpp_id = tpp?.tpp_id;
                let collection_memo_data = await this.collectionMemoModel.findOne(
                    {
                        lfi_id: obj?._id,
                        month: month,
                        year: year
                    }
                );
                if (collection_memo_data) {
                    console.log("LOG_ID1")

                    const new_tpp_data = {
                        tpp_id: tpp_id,
                        tpp_name: tpp?.tpp_name,
                        collection_memo_subitem: obj.labels,
                        full_total: obj?.full_total,
                        vat_percent: vatPercent,
                        // vat: obj?.vat,
                        // actual_total: obj?.actual_total,
                        date: new Date()
                    };

                    const tppExists = collection_memo_data.tpp.some((t: any) => t.tpp_id === tpp_id);
                    console.log("LOG_ID2")
                    if (!tppExists) {
                        console.log("LOG_ID3")
                        collection_memo_data.tpp.push(new_tpp_data);
                        // collection_memo_data.vat_total = collection_memo_data?.vat_total ?? 0 + obj?.vat
                        collection_memo_data.total_amount = collection_memo_data?.total_amount ?? 0 + obj?.full_total
                        await collection_memo_data.save();
                    }
                } else {
                    console.log("LABELS", futureDate)

                    const lfiData = await this.lfiDataModel.findOne({ lfi_id: obj?._id });
                    console.log("LFI_NAME", lfiData?.lfi_name)

                    const coll_memo_tpp = new this.collectionMemoModel({
                        invoice_number: await this.generateCollectionMemoInvNumber(),
                        lfi_id: obj?._id,
                        lfi_name: lfiData?.lfi_name,
                        billing_period_start: startDate,  // Month First
                        billing_period_end: endDate,   // Month Last
                        generated_at: new Date(),        // Generate Date
                        currency: 'AED',         //AED default
                        invoice_month: month,
                        invoice_year: year,
                        due_date: futureDate,  //issued_date + 30 days
                        tpp: [{
                            tpp_id: tpp_id,
                            tpp_name: tpp?.tpp_name,
                            collection_memo_subitem: obj?.labels,
                            full_total: obj?.full_total,
                            vat_percent: 5,
                            // vat: obj?.vat,
                            // actual_total: obj?.actual_total,
                            date: new Date()
                        }],
                        vat_percent: 5, // Default 5 percent
                        // vat_total: obj?.vat,  // vat percent of invoice total
                        total_amount: obj?.full_total,  // total of invoice array
                        status: 1,
                    })
                    await coll_memo_tpp.save();
                }
            }
        }
    }

    async ensureCategories(inputArray) {
        // Define default values for each category
        const globalConfiData = await this.globalModel.find();
        const paymentApiHubFee = globalConfiData.find(item => item.key === "paymentApiHubFee")?.value;
        const insuranceApiHubFee = globalConfiData.find(item => item.key === "insuranceApiHubFee")?.value;
        const discountApiHubFee = globalConfiData.find(item => item.key === "discountApiHubFee")?.value;
        const categoryDefaults = {
            data_sharing: {
                "items": [
                    {
                        "description": "Insurance",
                        "quantity": 0,
                        "unit_price": insuranceApiHubFee,
                        "total": 0,
                        "vat_amount": 0,
                        "full_total": 0
                    },
                    {
                        "description": "Setup and Consent",
                        "quantity": 0,
                        "unit_price": paymentApiHubFee,
                        "total": 0,
                        "vat_amount": 0,
                        "full_total": 0
                    },
                    {
                        "description": "Corporate Payment",
                        "quantity": 0,
                        "unit_price": paymentApiHubFee,
                        "total": 0,
                        "vat_amount": 0,
                        "full_total": 0
                    },
                    {
                        "description": "Confirmation of Payee(Discounted)",
                        "quantity": 0,
                        "unit_price": discountApiHubFee,
                        "total": 0,
                        "vat_amount": 0,
                        "full_total": 0
                    },
                    {
                        "description": "Balance(Discounted)",
                        "quantity": 0,
                        "unit_price": discountApiHubFee,
                        "total": 0,
                        "vat_amount": 0,
                        "full_total": 0
                    },
                    {
                        "description": "Bank Data Sharing",
                        "quantity": 0,
                        "unit_price": paymentApiHubFee,
                        "total": 0,
                        "vat_amount": 0,
                        "full_total": 0
                    }
                ],
                "sub_total": 0,
                "vat_amount": 0,
                "category_total": 0,
                "category": "data_sharing"
            },
            service_initiation: {
                "items": [
                    {
                        "description": "Corporate Payment",
                        "quantity": 0,
                        "unit_price": paymentApiHubFee,
                        "total": 0.0,
                        "vat_amount": 0,
                        "full_total": 0
                    },
                    {
                        "description": "Payment Initiation",
                        "quantity": 0,
                        "unit_price": paymentApiHubFee,
                        "total": 0.00,
                        "vat_amount": 0,
                        "full_total": 0
                    }
                ],
                "sub_total": 0,
                "vat_amount": 0,
                "category_total": 0,
                "category": "service_initiation"
            }
        };

        // List of required categories
        const requiredCategories = Object.keys(categoryDefaults);

        // Check existing categories in the input array
        const existingCategories = inputArray.map(item => item.category);

        // Add missing categories with their specific defaults
        requiredCategories.forEach(category => {
            if (!existingCategories.includes(category)) {
                inputArray.push({
                    ...categoryDefaults[category],  // Spread the default values
                    category: category              // Explicitly add the category name
                });
            }
        });

        return inputArray;
    }

    async billingTpp(
        tpp_id: any,
        invoiceDto: any,
    ): Promise<any> {

        const tppData = await this.tppDataModel.findOne({ tpp_id: tpp_id });
        if (!tppData)
            throw new Error('Invalid TppID');
        console.log(invoiceDto?.startDate, invoiceDto.endDate)
        const startDate = invoiceDto?.startDate
            ? new Date(
                moment(invoiceDto.startDate.toString()).startOf('day').format()
            )
            : undefined

        const endDate = invoiceDto?.endDate
            ? new Date(
                moment(invoiceDto.endDate.toString()).startOf('day').format()
            ) : undefined

        console.log(startDate, endDate);
        const result = await this.logsModel.aggregate(
            [
                {
                    '$match': {
                        'raw_api_log_data.tpp_id': tpp_id,
                        "chargeable": true,
                        "success": true,
                        "apiHubVolume": { $gt: 0 },
                        $and: [
                            startDate && endDate
                                ? {
                                    'raw_api_log_data.timestamp': {
                                        $gte: startDate,
                                        $lte: endDate
                                    }
                                }
                                : {}
                        ]
                    }
                }, {
                    '$addFields': {
                        'paymentTypeLabel': {
                            '$switch': {
                                'branches': [
                                    {
                                        'case': {
                                            '$eq': [
                                                '$group', 'payment-bulk'
                                            ]
                                        },
                                        'then': 'Corporate Payment'
                                    }, {
                                        'case': {
                                            '$eq': [
                                                '$group', 'payment-non-bulk'
                                            ]
                                        },
                                        'then': 'Payment Initiation'
                                    }, {
                                        'case': {
                                            '$eq': [
                                                '$group', 'insurance'
                                            ]
                                        },
                                        'then': 'Insurance'
                                    }, {
                                        'case': {
                                            '$and': [
                                                {
                                                    '$eq': [
                                                        '$group', 'data'
                                                    ]
                                                }, {
                                                    '$eq': [
                                                        '$api_category', 'setup'
                                                    ]
                                                }
                                            ]
                                        },
                                        'then': 'Setup and Consent'
                                    }, {
                                        'case': {
                                            '$and': [
                                                {
                                                    '$eq': [
                                                        '$group', 'data'
                                                    ]
                                                }, {
                                                    '$eq': [
                                                        '$type', 'corporate'
                                                    ]
                                                }
                                            ]
                                        },
                                        'then': 'Corporate Payment Data'
                                    }, {
                                        'case': {
                                            '$and': [
                                                {
                                                    '$eq': [
                                                        '$group', 'data'
                                                    ]
                                                }, {
                                                    '$eq': [
                                                        '$discount_type', 'cop'
                                                    ]
                                                }
                                            ]
                                        },
                                        'then': 'Confirmation of Payee(Discounted)'
                                    }, {
                                        'case': {
                                            '$and': [
                                                {
                                                    '$eq': [
                                                        '$group', 'data'
                                                    ]
                                                }, {
                                                    '$eq': [
                                                        '$discount_type', 'balance'
                                                    ]
                                                }
                                            ]
                                        },
                                        'then': 'Balance(Discounted)'
                                    }, {
                                        'case': {
                                            '$eq': [
                                                '$group', 'data'
                                            ]
                                        },
                                        'then': 'Bank Data Sharing'
                                    }
                                ],
                                'default': null
                            }
                        }
                    }
                }, {
                    '$addFields': {
                        'category': {
                            '$cond': {
                                'if': {
                                    '$in': [
                                        '$paymentTypeLabel', [
                                            'Corporate Payment', 'Payment Initiation'
                                        ]
                                    ]
                                },
                                'then': 'service_initiation',
                                'else': 'data_sharing'
                            }
                        }
                    }
                }, {
                    '$match': {
                        'paymentTypeLabel': {
                            '$ne': null
                        }
                    }
                }, {
                    '$group': {
                        '_id': {
                            'category': '$category',
                            'description': '$paymentTypeLabel'
                        },
                        'quantity': {
                            '$sum': "$apiHubVolume"
                        },
                        'unit_price': {
                            '$first': "$api_hub_fee"
                        },
                        'total': {
                            '$sum': "$applicableApiHubFee"
                        }
                    }
                }, {
                    '$project': {
                        '_id': 0,
                        'category': '$_id.category',
                        'item': {
                            'description': '$_id.description',
                            'quantity': '$quantity',
                            'unit_price': {
                                '$round': [
                                    '$unit_price', 3
                                ]
                            },
                            'total': {
                                '$round': [
                                    '$total', 3
                                ]
                            }
                        }
                    }
                }, {
                    '$group': {
                        '_id': '$category',
                        'items': {
                            '$push': '$item'
                        }
                    }
                }, {
                    '$addFields': {
                        'allItems': {
                            '$cond': {
                                'if': {
                                    '$eq': [
                                        '$_id', 'service_initiation'
                                    ]
                                },
                                'then': [
                                    'Corporate Payment', 'Payment Initiation'
                                ],
                                'else': [
                                    'Insurance', 'Setup and Consent', 'Corporate Payment Data', 'Confirmation of Payee(Discounted)', 'Balance(Discounted)', 'Bank Data Sharing'
                                ]
                            }
                        }
                    }
                },
                {
                    '$addFields': {
                        'sub_total': {
                            '$sum': '$items.total'
                        }
                    }
                },
                // {
                //     '$addFields': {
                //         'vat_amount': {
                //             '$round': [
                //                 {
                //                     '$multiply': [
                //                         '$sub_total', 0.05
                //                     ]
                //                 }, 3
                //             ]
                //         },
                //         'category_total': {
                //             '$round': [
                //                 {
                //                     '$add': [
                //                         '$sub_total', {
                //                             '$multiply': [
                //                                 '$sub_total', 0.05
                //                             ]
                //                         }
                //                     ]
                //                 }, 3
                //             ]
                //         }
                //     }
                // }, 
                {
                    '$project': {
                        '_id': 0,
                        'category': '$_id',
                        'items': 1,
                        // 'sub_total': 1,
                        // 'vat_amount': 1,
                        'category_total': '$sub_total'
                    }
                }
            ]
        );
        const result_of_lfi = await this.logsModel.aggregate(
            [
                {
                    '$match': {
                        'raw_api_log_data.tpp_id': tpp_id,
                        "lfiChargable": true,
                        "success": true,
                        "volume": { $gt: 0 },
                        $and: [
                            startDate && endDate
                                ? {
                                    'raw_api_log_data.timestamp': {
                                        $gte: new Date(startDate),
                                        $lte: new Date(endDate)
                                    }
                                }
                                : {}
                        ]
                    }
                }, {
                    $addFields: {
                        label: {
                            $switch: {
                                branches: [
                                    {
                                        case: {
                                            $and: [
                                                {
                                                    $in: [
                                                        "$group",
                                                        [
                                                            "payment-bulk",
                                                            "payment-non-bulk"
                                                        ]
                                                    ]
                                                },
                                                {
                                                    $eq: ["$type", "merchant"]
                                                },
                                                {
                                                    $ne: [
                                                        "$raw_api_log_data.payment_type",
                                                        "LargeValueCollection"
                                                    ]
                                                }
                                            ]
                                        },
                                        then: "Merchant Collection"
                                    },
                                    {
                                        case: {
                                            $and: [
                                                {
                                                    $in: [
                                                        "$group",
                                                        [
                                                            "payment-bulk",
                                                            "payment-non-bulk"
                                                        ]
                                                    ]
                                                },
                                                {
                                                    $eq: ["$type", "peer-2-peer"]
                                                },
                                                {
                                                    $ne: [
                                                        "$raw_api_log_data.payment_type",
                                                        "LargeValueCollection"
                                                    ]
                                                }
                                            ]
                                        },
                                        then: "Peer-to-Peer"
                                    },
                                    {
                                        case: {
                                            $and: [
                                                {
                                                    $in: [
                                                        "$group",
                                                        [
                                                            "payment-bulk",
                                                            "payment-non-bulk"
                                                        ]
                                                    ]
                                                },
                                                {
                                                    $eq: ["$type", "me-2-me"]
                                                },
                                                {
                                                    $ne: [
                                                        "$raw_api_log_data.payment_type",
                                                        "LargeValueCollection"
                                                    ]
                                                }
                                            ]
                                        },
                                        then: "Me-to-Me Transfer"
                                    },
                                    {
                                        case: {
                                            $and: [
                                                {
                                                    $in: [
                                                        "$group",
                                                        [
                                                            "payment-bulk",
                                                            "payment-non-bulk"
                                                        ]
                                                    ]
                                                },
                                                {
                                                    $eq: [
                                                        "$raw_api_log_data.payment_type",
                                                        "LargeValueCollection"
                                                    ]
                                                }
                                            ]
                                        },
                                        then: "Large Value Collections"
                                    },
                                    {
                                        case: {
                                            $and: [
                                                {
                                                    $eq: [
                                                        "$group",
                                                        "payment-bulk"
                                                    ]
                                                },
                                                {
                                                    $eq: ["$type", "corporate"]
                                                }
                                            ]
                                        },
                                        then: "Corporate Payments"
                                    },
                                    {
                                        case: {
                                            $and: [
                                                {
                                                    $eq: ["$group", "data"]
                                                },
                                                {
                                                    $eq: ["$type", "corporate"]
                                                }
                                            ]
                                        },
                                        then: "Corporate Treasury Data"
                                    },
                                    {
                                        case: {
                                            $eq: ["$group", "data"]
                                        },
                                        then: "Customer Data"
                                    }
                                ],
                                default: "Others"
                            }
                        }
                    }
                },
                {
                    $group: {
                        _id: {
                            lfi_id: "$raw_api_log_data.lfi_id",
                            label: "$label"
                        },
                        quantity: {
                            $sum: "$volume"
                        },
                        unit_price: {
                            $first: "$unit_price"
                        },
                        total: {
                            $sum: "$applicableFee"
                        },
                        capped: {
                            $max: "$isCapped"
                        }
                    }
                },
                {
                    $group: {
                        _id: "$_id.lfi_id",
                        labels: {
                            $push: {
                                label: "$_id.label",
                                quantity: "$quantity",
                                unit_price: {
                                    $round: ["$unit_price", 4]
                                },
                                total: {
                                    $round: ["$total", 3]
                                },
                                capped: "$capped",
                            }
                        }
                    }
                }, {
                    $addFields: {
                        labels: {
                            $filter: {
                                input: "$labels",
                                as: "labelItem",
                                cond: {
                                    $ne: ["$$labelItem.label", "Others"]
                                }
                            }
                        }
                    }
                }, {
                    '$sort': {
                        'lfi_id': 1,
                        'label': 1
                    }
                }, {
                    '$addFields': {
                        'full_total': {
                            '$round': [
                                {
                                    '$sum': '$labels.total'
                                }, 3
                            ]
                        }
                    }
                }, {
                    '$lookup': {
                        'from': 'lfi_data',
                        'localField': '_id',
                        'foreignField': 'lfi_id',
                        'as': 'lfi_data'
                    }
                }, {
                    '$unwind': {
                        'path': '$lfi_data'
                    }
                }

                // {
                //     '$addFields': {
                //         'vat': {
                //             '$round': [
                //                 {
                //                     '$multiply': [
                //                         '$full_total', 0.05
                //                     ]
                //                 }, 2
                //             ]
                //         },
                //         'actual_total': {
                //             '$round': [
                //                 {
                //                     '$add': [
                //                         '$full_total', {
                //                             '$multiply': [
                //                                 '$full_total', 0.05
                //                             ]
                //                         }
                //                     ]
                //                 }, 2
                //             ]
                //         }
                //     }
                // }
            ]
        )
        let invoice_total = result.reduce((sum, item) => sum + item.category_total, 0);
        let lfi_total = result_of_lfi.reduce((sum, item) => sum + item.full_total, 0);

        const total = Number(invoice_total) + Number(lfi_total)
        const vat = invoice_total * 0.05;

        const roundedTotal = Math.round(total * 100) / 100; // 0.23
        const roundedVat = Math.round(vat * 100) / 100;
        invoice_total = invoice_total.toFixed(2)
        lfi_total = lfi_total.toFixed(2)
        // let updated_result = []
        // if (result.length != 0) {
        //     updated_result = await this.ensureCategories(result);
        // }

        const invoice_data = {
            tpp_id: tpp_id,
            tpp_name: tppData?.tpp_name,
            tpp_usage_per_lfi: result_of_lfi,
            invoice_items: result,
            invoice_total: invoice_total,
            lfi_total: lfi_total,
            // subtotal: 0, // vendaaaa
            // vat_percent: 5, // Default 5 percent
            // vat_total: roundedVat,  // vat percent of invoice total
            total_amount: roundedTotal,  // total of invoice array
        }

        return invoice_data
    }

    async generateInvoiceNumberOld(key = 'INV'): Promise<string> {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const random = Math.floor(1000 + Math.random() * 9000); // 4-digit random number
        return `${key}-${year}-${month}${day}-${random}`;
    }

    async generateInvoiceNumber(): Promise<string> {

        const config = invoice_config;
        const counter = await this.CounterModel.findOne({ key: 'invoice_counter' });

        if (counter) {

            await this.CounterModel.findOneAndUpdate(
                { key: 'invoice_counter' },
                { $inc: { lastInvoiceNumber: 1 } },
                { returnDocument: 'after', upsert: true }
            );

        } else {
            await this.CounterModel.create(
                {
                    key: 'invoice_counter',
                    lastInvoiceNumber: config.startNumber + 1
                },
            );
        }
        const year = moment().format('YY');   // "25"
        const month = moment().format('MM');  // "05"
        let startNumber = counter?.lastInvoiceNumber ?? config.startNumber
        const nextNumber = startNumber + 1;
        const paddedNumber = String(nextNumber).padStart(config.minDigits, config.leadingChar);

        const prefixPart = config.prefix ? config.prefix + config.prefixSeparator : "";
        const suffixPart = config.suffix ? config.suffixSeparator + config.suffix : "";

        return `${prefixPart}${year}${month}${paddedNumber}${suffixPart}`;
    }

    async generateCollectionMemoInvNumber(): Promise<string> {

        const config = collection_memo_config;
        const counter = await this.CounterModel.findOne({ key: 'collection_memo_counter' });

        if (counter) {

            await this.CounterModel.findOneAndUpdate(
                { key: 'collection_memo_counter' },
                { $inc: { lastcollectionMemoNumber: 1 } },
                { returnDocument: 'after', upsert: true }
            );

        } else {
            await this.CounterModel.create(
                {
                    key: 'collection_memo_counter',
                    lastcollectionMemoNumber: config.startNumber + 1
                },
            );
        }

        const year = moment().format('YY');   // "25"
        const month = moment().format('MM');  // "05"
        let startNumber = counter?.lastcollectionMemoNumber ?? config.startNumber
        const nextNumber = startNumber + 1;
        const paddedNumber = String(nextNumber).padStart(config.minDigits, config.leadingChar);

        const prefixPart = config.prefix ? config.prefix + config.prefixSeparator : "";
        const suffixPart = config.suffix ? config.suffixSeparator + config.suffix : "";

        return `${prefixPart}${year}${month}${paddedNumber}${suffixPart}`;
    }

    async getInvoiceDetails(id: string): Promise<any> {
        const result = await this.invoiceModel.findById(new Types.ObjectId(id)).exec()
        if (!result) {
            throw new BadRequestException('Invoice Detail not found');
        }
        return result;
    }

    async billingLfiStatement(
        lfi_id: any,
        invoiceDto: any,
    ): Promise<any> {

        const lfiData = await this.lfiDataModel.findOne({ lfi_id: lfi_id }).lean<any>()
        if (!lfiData)
            throw new Error('Invalid Lfi-ID');

        const startDate = invoiceDto?.startDate
            ? new Date(
                moment(invoiceDto.startDate.toString()).startOf('day').format()
            )
            : undefined

        const endDate = invoiceDto?.endDate
            ? new Date(
                moment(invoiceDto.endDate.toString()).startOf('day').format()
            ) : undefined

        const vat_details = await this.globalModel.findOne({
            key: 'vatPercentageValue',
        });
        const vatPercent = vat_details?.value ?? 5
        const vatDecimal = vatPercent / 100;

        let aggregation: any = [
            {
                '$match': {
                    'raw_api_log_data.lfi_id': lfi_id,
                    'lfiChargable': true,
                    "success": true,
                    "volume": { $gt: 0 },
                    $and: [
                        startDate && endDate
                            ? {
                                'raw_api_log_data.timestamp': {
                                    $gte: startDate,
                                    $lte: endDate
                                }
                            }
                            : {}
                    ]
                }
            }, {
                $addFields: {
                    label: {
                        $switch: {
                            branches: [
                                {
                                    case: {
                                        $and: [
                                            {
                                                $in: [
                                                    "$group",
                                                    [
                                                        "payment-bulk",
                                                        "payment-non-bulk"
                                                    ]
                                                ]
                                            },
                                            {
                                                $eq: ["$type", "merchant"]
                                            },
                                            {
                                                $ne: [
                                                    "$raw_api_log_data.payment_type",
                                                    "LargeValueCollection"
                                                ]
                                            }
                                        ]
                                    },
                                    then: "Merchant Collection"
                                },
                                {
                                    case: {
                                        $and: [
                                            {
                                                $in: [
                                                    "$group",
                                                    [
                                                        "payment-bulk",
                                                        "payment-non-bulk"
                                                    ]
                                                ]
                                            },
                                            {
                                                $eq: ["$type", "peer-2-peer"]
                                            },
                                            {
                                                $ne: [
                                                    "$raw_api_log_data.payment_type",
                                                    "LargeValueCollection"
                                                ]
                                            }
                                        ]
                                    },
                                    then: "Peer-to-Peer"
                                },
                                {
                                    case: {
                                        $and: [
                                            {
                                                $in: [
                                                    "$group",
                                                    [
                                                        "payment-bulk",
                                                        "payment-non-bulk"
                                                    ]
                                                ]
                                            },
                                            {
                                                $eq: ["$type", "me-2-me"]
                                            },
                                            {
                                                $ne: [
                                                    "$raw_api_log_data.payment_type",
                                                    "LargeValueCollection"
                                                ]
                                            }
                                        ]
                                    },
                                    then: "Me-to-Me Transfer"
                                },
                                {
                                    case: {
                                        $and: [
                                            {
                                                $in: [
                                                    "$group",
                                                    [
                                                        "payment-bulk",
                                                        "payment-non-bulk"
                                                    ]
                                                ]
                                            },
                                            {
                                                $eq: [
                                                    "$raw_api_log_data.payment_type",
                                                    "LargeValueCollection"
                                                ]
                                            }
                                        ]
                                    },
                                    then: "Large Value Collections"
                                },
                                {
                                    case: {
                                        $and: [
                                            {
                                                $eq: [
                                                    "$group",
                                                    "payment-bulk"
                                                ]
                                            },
                                            {
                                                $eq: ["$type", "corporate"]
                                            }
                                        ]
                                    },
                                    then: "Corporate Payments"
                                },
                                {
                                    case: {
                                        $and: [
                                            {
                                                $eq: ["$group", "data"]
                                            },
                                            {
                                                $eq: ["$type", "corporate"]
                                            }
                                        ]
                                    },
                                    then: "Corporate Treasury Data"
                                },
                                {
                                    case: {
                                        $eq: ["$group", "data"]
                                    },
                                    then: "Customer Data"
                                }
                            ],
                            default: "Others"
                        }
                    }
                }
            }, {
                '$group': {
                    '_id': {
                        'tpp_id': '$raw_api_log_data.tpp_id',
                        'label': '$label'
                    },
                    quantity: {
                        $sum: "$volume"
                    },
                    unit_price: {
                        $first: "$unit_price"
                    },
                    total: {
                        $sum: "$applicableFee"
                    },
                    capped: {
                        $max: "$isCapped"
                    }
                }
            }, {
                '$group': {
                    '_id': '$_id.tpp_id',
                    labels: {
                        $push: {
                            label: "$_id.label",
                            quantity: "$quantity",
                            unit_price: {
                                $round: ["$unit_price", 4]
                            },
                            total: {
                                $round: ["$total", 3]
                            },
                            capped: "$capped",
                        }
                    }
                }
            },

            {
                '$addFields': {
                    'labels': {
                        '$filter': {
                            'input': '$labels',
                            'as': 'labelItem',
                            'cond': {
                                '$ne': [
                                    '$$labelItem.label', 'Others'
                                ]
                            }
                        }
                    }
                }
            }, {
                '$sort': {
                    'tpp_id': 1,
                    'label': 1
                }
            }, {
                '$lookup': {
                    'from': 'tpp_data',
                    'localField': '_id',
                    'foreignField': 'tpp_id',
                    'as': 'tpp_details'
                }
            }, {
                '$unwind': {
                    'path': '$tpp_details',
                    'preserveNullAndEmptyArrays': true
                }
            }, {
                '$addFields': {
                    'full_total': {
                        '$round': [
                            {
                                '$sum': '$labels.total'
                            }, 3
                        ]
                    }
                }
            },
            //  {
            //     '$addFields': {
            //         'vat': {
            //             '$round': [
            //                 {
            //                     '$multiply': [
            //                         '$full_total', vatDecimal
            //                     ]
            //                 }, 4
            //             ]
            //         },
            //         'actual_total': {
            //             '$round': [
            //                 {
            //                     '$add': [
            //                         '$full_total', {
            //                             '$multiply': [
            //                                 '$full_total', vatDecimal
            //                             ]
            //                         }
            //                     ]
            //                 }, 4
            //             ]
            //         }
            //     }
            // }
        ]
        const result = await this.logsModel.aggregate(aggregation);

        const total = result.reduce((sum, item) => sum + item.full_total, 0);

        // const vat = total * vatDecimal;

        const roundedTotal = Math.round(total * 100) / 100; // 0.23
        // const roundedVat = Math.round(vat * 100) / 100;

        // const updated_result = await this.ensureCategories(result);
        const tpp_data = {
            invoice_number: await this.generateInvoiceNumber(),
            lfi_id: lfi_id,
            lfi_name: lfiData?.lfi_name,
            billing_period_start: startDate,  // Month First
            billing_period_end: endDate,   // Month Last
            generated_at: new Date(),        // Generate Date
            currency: 'AED',         //AED default
            tpp_data: result,
            // vat_percent: vatPercent, // Default 5 percent
            // vat_total: roundedVat,  // vat percent of invoice total
            total_amount: roundedTotal,  // total of invoice array
            status: 1,
        }
        return tpp_data;
    }

    async findAllCollectionMemo(PaginationDTO: PaginationDTO): Promise<any> {
        const offset = PaginationDTO.Offset
            ? Number(PaginationDTO.Offset)
            : PaginationEnum.OFFSET;
        const limit = PaginationDTO.limit
            ? Number(PaginationDTO.limit)
            : PaginationEnum.LIMIT;
        const options: any = {};

        const search = PaginationDTO.search ? PaginationDTO.search.trim() : null;
        if (search) {
            const searchRegex = new RegExp(search, "i");
            options.$or = [{ "lfi_id": search }, { "lfi_name": searchRegex }
            ];
        }
        const month = Number(PaginationDTO?.month) ?? 0;
        const year = Number(PaginationDTO?.year) ?? 0;

        if (month && year && month !== 0) {

            options.invoice_month = month
            options.invoice_year = year
        }

        const count = await this.collectionMemoModel.find(options).countDocuments();
        const result = await this.collectionMemoModel.find(options).skip(offset).limit(limit).sort({ createdAt: -1 }).lean<any>();

        return {
            result,
            pagination: {
                offset: offset,
                limit: limit,
                total: count,
            },
        };
    }
    async findCollectionMemoById(ID: any): Promise<any> {

        const result = await this.collectionMemoModel.findById(ID).exec();

        return result

    }

    async invoiceCreationSingleDay(): Promise<any> {

        // Get yesterday's start and end timestamps
        // const fromDate = moment().subtract(2, 'day').startOf('day').toDate();
        const fromDate = moment().subtract(2, 'day').startOf('day').toDate();
        const toDate = moment().subtract(2, 'day').endOf('day').toDate();
        const generated_for = moment().subtract(2, 'day').toDate();

        const yesterday = moment().subtract(2, 'day');
        const month = yesterday.month() + 1; // Months are 0-indexed in Moment.js
        const year = yesterday.year();

        console.log(generated_for, fromDate, toDate)

        const tppData = await this.tppDataModel.find();
        console.log('TPP_DATA', tppData)

        const currentDate = new Date();
        for (const tpp of tppData) {

            const result = await this.logsModel.aggregate(
                [
                    {
                        '$match': {
                            'raw_api_log_data.tpp_id': tpp?.tpp_id,
                            "chargeable": true,
                            "success": true,
                            'raw_api_log_data.timestamp': {
                                $gte: fromDate,
                                $lte: toDate
                            }
                        }
                    }, {
                        '$addFields': {
                            'paymentTypeLabel': {
                                '$switch': {
                                    'branches': [
                                        {
                                            'case': {
                                                '$eq': [
                                                    '$group', 'payment-bulk'
                                                ]
                                            },
                                            'then': 'Corporate Payment'
                                        }, {
                                            'case': {
                                                '$eq': [
                                                    '$group', 'payment-non-bulk'
                                                ]
                                            },
                                            'then': 'Payment Initiation'
                                        }, {
                                            'case': {
                                                '$eq': [
                                                    '$group', 'insurance'
                                                ]
                                            },
                                            'then': 'Insurance'
                                        }, {
                                            'case': {
                                                '$and': [
                                                    {
                                                        '$eq': [
                                                            '$group', 'data'
                                                        ]
                                                    }, {
                                                        '$eq': [
                                                            '$api_category', 'setup'
                                                        ]
                                                    }
                                                ]
                                            },
                                            'then': 'Setup and Consent'
                                        }, {
                                            'case': {
                                                '$and': [
                                                    {
                                                        '$eq': [
                                                            '$group', 'data'
                                                        ]
                                                    }, {
                                                        '$eq': [
                                                            '$type', 'corporate'
                                                        ]
                                                    }
                                                ]
                                            },
                                            'then': 'Corporate Payment Data'
                                        }, {
                                            'case': {
                                                '$and': [
                                                    {
                                                        '$eq': [
                                                            '$group', 'data'
                                                        ]
                                                    }, {
                                                        '$eq': [
                                                            '$discount_type', 'cop'
                                                        ]
                                                    }
                                                ]
                                            },
                                            'then': 'Confirmation of Payee(Discounted)'
                                        }, {
                                            'case': {
                                                '$and': [
                                                    {
                                                        '$eq': [
                                                            '$group', 'data'
                                                        ]
                                                    }, {
                                                        '$eq': [
                                                            '$discount_type', 'balance'
                                                        ]
                                                    }
                                                ]
                                            },
                                            'then': 'Balance(Discounted)'
                                        }, {
                                            'case': {
                                                '$eq': [
                                                    '$group', 'data'
                                                ]
                                            },
                                            'then': 'Bank Data Sharing'
                                        }
                                    ],
                                    'default': null
                                }
                            }
                        }
                    }, {
                        '$addFields': {
                            'category': {
                                '$cond': {
                                    'if': {
                                        '$in': [
                                            '$paymentTypeLabel', [
                                                'Corporate Payment', 'Payment Initiation'
                                            ]
                                        ]
                                    },
                                    'then': 'service_initiation',
                                    'else': 'data_sharing'
                                }
                            }
                        }
                    }, {
                        '$match': {
                            'paymentTypeLabel': {
                                '$ne': null
                            }
                        }
                    }, {
                        '$group': {
                            '_id': {
                                'category': '$category',
                                'description': '$paymentTypeLabel'
                            },
                            'quantity': {
                                '$sum': 1
                            },
                            'unit_price': {
                                '$first': '$applicableApiHubFee'
                            },
                            'total': {
                                '$sum': '$applicableApiHubFee'
                            }
                        }
                    }, {
                        '$project': {
                            '_id': 0,
                            'category': '$_id.category',
                            'item': {
                                'description': '$_id.description',
                                'quantity': '$quantity',
                                'unit_price': {
                                    '$round': [
                                        '$unit_price', 4
                                    ]
                                },
                                'total': {
                                    '$round': [
                                        '$total', 4
                                    ]
                                }
                            }
                        }
                    }, {
                        '$group': {
                            '_id': '$category',
                            'items': {
                                '$push': '$item'
                            }
                        }
                    },
                    //  {
                    //     '$addFields': {
                    //         'allItems': {
                    //             '$cond': {
                    //                 'if': {
                    //                     '$eq': [
                    //                         '$_id', 'service_initiation'
                    //                     ]
                    //                 },
                    //                 'then': [
                    //                     'Corporate Treasury', 'Payment Initiation'
                    //                 ],
                    //                 'else': [
                    //                     'Insurance', 'Setup and Consent', 'Corporate Treasury Data', 'Confirmation of Payee', 'Balance(Discounted)', 'Bank Data Sharing'
                    //                 ]
                    //             }
                    //         }
                    //     }
                    // }, 
                    // {
                    //     '$addFields': {
                    //         'items': {
                    //             '$map': {
                    //                 'input': '$allItems',
                    //                 'as': 'desc',
                    //                 'in': {
                    //                     '$let': {
                    //                         'vars': {
                    //                             'matchedItem': {
                    //                                 '$first': {
                    //                                     '$filter': {
                    //                                         'input': '$items',
                    //                                         'as': 'item',
                    //                                         'cond': {
                    //                                             '$eq': [
                    //                                                 '$$item.description', '$$desc'
                    //                                             ]
                    //                                         }
                    //                                     }
                    //                                 }
                    //                             }
                    //                         },
                    //                         'in': {
                    //                             'description': '$$desc',
                    //                             'quantity': {
                    //                                 '$ifNull': [
                    //                                     '$$matchedItem.quantity', 0
                    //                                 ]
                    //                             },
                    //                             'unit_price': {
                    //                                 '$ifNull': [
                    //                                     '$$matchedItem.unit_price', 0.25
                    //                                 ]
                    //                             },
                    //                             'total': {
                    //                                 '$ifNull': [
                    //                                     '$$matchedItem.total', 0
                    //                                 ]
                    //                             }
                    //                         }
                    //                     }
                    //                 }
                    //             }
                    //         }
                    //     }
                    // }, 
                    {
                        '$addFields': {
                            'sub_total': {
                                '$sum': '$items.total'
                            }
                        }
                    }, {
                        '$addFields': {
                            'vat_amount': {
                                '$round': [
                                    {
                                        '$multiply': [
                                            '$sub_total', 0.05
                                        ]
                                    }, 4
                                ]
                            },
                            'category_total': {
                                '$round': [
                                    {
                                        '$add': [
                                            '$sub_total', {
                                                '$multiply': [
                                                    '$sub_total', 0.05
                                                ]
                                            }
                                        ]
                                    }, 4
                                ]
                            }
                        }
                    }, {
                        '$project': {
                            '_id': 0,
                            'category': '$_id',
                            'items': 1,
                            'sub_total': 1,
                            'vat_amount': 1,
                            'category_total': 1
                        }
                    }
                ]
            );
            console.log('FIRSTLOG', result)
            const result_of_lfi = await this.logsModel.aggregate(
                [
                    {
                        '$match': {
                            'raw_api_log_data.tpp_id': tpp?.tpp_id,
                            "lfiChargable": true,
                            "success": true,
                            'raw_api_log_data.timestamp': {
                                $gte: fromDate,
                                $lte: toDate
                            }
                        }
                    }, {
                        '$addFields': {
                            'label': {
                                '$switch': {
                                    'branches': [
                                        {
                                            'case': {
                                                '$and': [
                                                    {
                                                        '$eq': [
                                                            '$group', 'payment-non-bulk'
                                                        ]
                                                    }, {
                                                        '$eq': [
                                                            '$type', 'merchant'
                                                        ]
                                                    }
                                                ]
                                            },
                                            'then': 'Merchant Collection'
                                        }, {
                                            'case': {
                                                '$and': [
                                                    {
                                                        '$eq': [
                                                            '$group', 'payment-non-bulk'
                                                        ]
                                                    }, {
                                                        '$eq': [
                                                            '$type', 'peer-2-peer'
                                                        ]
                                                    }
                                                ]
                                            },
                                            'then': 'Peer-to-Peer'
                                        }, {
                                            'case': {
                                                '$and': [
                                                    {
                                                        '$eq': [
                                                            '$group', 'payment-non-bulk'
                                                        ]
                                                    }, {
                                                        '$eq': [
                                                            '$type', 'me-2-me'
                                                        ]
                                                    }
                                                ]
                                            },
                                            'then': 'Me-to-Me Transfer'
                                        }, {
                                            'case': {
                                                '$and': [
                                                    {
                                                        '$in': [
                                                            '$group', [
                                                                'payment-bulk', 'payment-non-bulk'
                                                            ]
                                                        ]
                                                    }, {
                                                        '$eq': [
                                                            '$largevaluecollection', true
                                                        ]
                                                    }
                                                ]
                                            },
                                            'then': 'Large value collection'
                                        }, {
                                            'case': {
                                                '$and': [
                                                    {
                                                        '$eq': [
                                                            '$group', 'payment-bulk'
                                                        ]
                                                    }
                                                ]
                                            },
                                            'then': 'Bulk payments'
                                        }, {
                                            'case': {
                                                '$and': [
                                                    {
                                                        '$eq': [
                                                            '$group', 'data'
                                                        ]
                                                    }, {
                                                        '$eq': [
                                                            '$type', 'corporate'
                                                        ]
                                                    }
                                                ]
                                            },
                                            'then': 'Corporate Payment Data'
                                        }, {
                                            'case': {
                                                '$eq': [
                                                    '$group', 'data'
                                                ]
                                            },
                                            'then': 'Customer Data'
                                        }
                                    ],
                                    'default': 'Others'
                                }
                            }
                        }
                    }, {
                        '$group': {
                            '_id': {
                                'lfi_id': '$raw_api_log_data.lfi_id',
                                'label': '$label'
                            },
                            'quantity': {
                                '$sum': 1
                            },
                            'unit_price': {
                                '$avg': '$applicableFee'
                            },
                            'total': {
                                '$sum': '$applicableFee'
                            }
                        }
                    }, {
                        '$group': {
                            '_id': '$_id.lfi_id',
                            'labels': {
                                '$push': {
                                    'label': '$_id.label',
                                    'quantity': '$quantity',
                                    'unit_price': {
                                        '$round': [
                                            '$unit_price', 4
                                        ]
                                    },
                                    'total': {
                                        '$round': [
                                            '$total', 4
                                        ]
                                    }
                                }
                            }
                        }
                    },
                    {
                        $addFields: {
                            labels: {
                                $filter: {
                                    input: "$labels",
                                    as: "labelItem",
                                    cond: {
                                        $ne: ["$$labelItem.label", "Others"]
                                    }
                                }
                            }
                        }
                    },
                    //  {
                    //     '$addFields': {
                    //         'allLabels': [
                    //             'Merchant Collection', 'Peer-to-Peer', 'Me-to-Me Transfer', 'Large value collection', 'Bulk payments', 'Corporate Treasury Data', 'Customer Data'
                    //         ]
                    //     }
                    // }, 
                    // {
                    //     '$project': {
                    //         'lfi_id': '$_id',
                    //         'labels': {
                    //             '$map': {
                    //                 'input': '$allLabels',
                    //                 'as': 'lbl',
                    //                 'in': {
                    //                     '$let': {
                    //                         'vars': {
                    //                             'found': {
                    //                                 '$first': {
                    //                                     '$filter': {
                    //                                         'input': '$labels',
                    //                                         'as': 'l',
                    //                                         'cond': {
                    //                                             '$eq': [
                    //                                                 '$$l.label', '$$lbl'
                    //                                             ]
                    //                                         }
                    //                                     }
                    //                                 }
                    //                             }
                    //                         },
                    //                         'in': {
                    //                             'label': '$$lbl',
                    //                             'quantity': {
                    //                                 '$ifNull': [
                    //                                     '$$found.quantity', 0
                    //                                 ]
                    //                             },
                    //                             'unit_price': {
                    //                                 '$ifNull': [
                    //                                     '$$found.unit_price', 0.25
                    //                                 ]
                    //                             },
                    //                             'total': {
                    //                                 '$ifNull': [
                    //                                     '$$found.total', 0
                    //                                 ]
                    //                             }
                    //                         }
                    //                     }
                    //                 }
                    //             }
                    //         }
                    //     }
                    // }, 
                    {
                        '$sort': {
                            'lfi_id': 1,
                            'label': 1
                        }
                    }, {
                        '$addFields': {
                            'full_total': {
                                '$round': [
                                    {
                                        '$sum': '$labels.total'
                                    }, 4
                                ]
                            }
                        }
                    }, {
                        '$addFields': {
                            'vat': {
                                '$round': [
                                    {
                                        '$multiply': [
                                            '$full_total', 0.05
                                        ]
                                    }, 4
                                ]
                            },
                            'actual_total': {
                                '$round': [
                                    {
                                        '$add': [
                                            '$full_total', {
                                                '$multiply': [
                                                    '$full_total', 0.05
                                                ]
                                            }
                                        ]
                                    }, 4
                                ]
                            }
                        }
                    }
                ]
            )

            const invoice_data = {
                invoice_number: await this.generateInvoiceNumber(),
                tpp_id: tpp?.tpp_id,
                tpp_name: tpp?.tpp_name,
                generated_at: new Date(),
                invoice_month: month,
                invoice_year: year,
                generated_for: generated_for,       // yesterday
                tpp_usage_per_lfi: result_of_lfi,
                invoice_items: result,
            }
            const invoice = new this.singleDayTppInvoiceModel(invoice_data)
            const invoices = await invoice.save();
            console.log("ID-", invoices?._id)


            for (const obj of result_of_lfi) {
                console.log(obj)
                const tpp_id = tpp?.tpp_id; // replace with your actual ID
                let collection_memo_data = await this.singleDayCollectionMemoModel.find({ lfi_id: obj?._id });
                if (collection_memo_data.length !== 0) {
                    console.log("LOG_ID1")

                    const new_tpp_data = {
                        tpp_id: tpp_id,
                        tpp_name: tpp?.tpp_name,
                        collection_memo_subitem: obj.labels,
                        full_total: obj?.full_total,
                        vat_percent: 5,
                        vat: obj?.vat,
                        actual_total: obj?.actual_total,
                        date: new Date()
                    };

                    for (const memo of collection_memo_data) {
                        const tppExists = memo.tpp.some((t: any) => t.tpp_id === tpp_id);
                        console.log("LOG_ID2")
                        if (!tppExists) {
                            console.log("LOG_ID3")
                            memo.tpp.push(new_tpp_data);
                            await memo.save();
                        } else {
                            console.log("LOG_ID4")
                        }
                    }
                } else {

                    const lfiData = await this.lfiDataModel.findOne({ lfi_id: obj?._id });
                    const coll_memo_tpp = new this.singleDayCollectionMemoModel({
                        lfi_id: obj?._id,
                        lfi_name: lfiData.lfi_name,
                        generated_at: new Date(),        // Generate Date
                        generated_for: generated_for,
                        invoice_month: month,
                        invoice_year: year,
                        currency: 'AED',         //AED default
                        tpp: [{
                            tpp_id: tpp_id,
                            tpp_name: tpp?.tpp_name,
                            collection_memo_subitem: obj?.labels,
                            full_total: obj?.full_total,
                            vat_percent: 5,
                            vat: obj?.vat,
                            actual_total: obj?.actual_total,
                            date: new Date()
                        }],

                    })
                    await coll_memo_tpp.save();
                }
            }
        }
        return 'completed';

    }

    async invoiceCreationMonthlyTpp(): Promise<any> {

        // const startDate = moment().subtract(1, 'months').startOf('month');
        const startDate = moment().startOf('month').toDate();
        const endDate = moment().endOf('month').toDate();
        console.log(startDate, endDate);

        const futureDate = new Date();
        const currentDate = new Date();
        futureDate.setDate(currentDate.getDate() + 30);

        const tppData = await this.tppDataModel.find();
        console.log('TPP_DATA', tppData)

        const day = moment();
        const month = day.month() + 1; // Months are 0-indexed in Moment.js
        const year = day.year();
        console.log(month, year);

        for (const tpp of tppData) {

            const result_of_tpp = await this.singleDayTppInvoiceModel.aggregate(
                [
                    {
                        '$match': {
                            'tpp_id': tpp?.tpp_id,
                            'createdAt': {
                                $gte: startDate,
                                $lte: endDate
                            }
                        }
                    }, {
                        '$group': {
                            '_id': '$tpp_id',
                            'tpp_name': {
                                '$first': '$tpp_name'
                            },
                            'generated_for': {
                                '$last': '$generated_for'
                            },
                            'createdAt': {
                                '$last': '$createdAt'
                            },
                            'updatedAt': {
                                '$last': '$updatedAt'
                            },
                            'all_invoice_items': {
                                '$push': '$invoice_items'
                            },
                            'all_tpp_usage': {
                                '$push': '$tpp_usage_per_lfi'
                            }
                        }
                    }, {
                        '$addFields': {
                            'invoice_items': {
                                '$reduce': {
                                    'input': '$all_invoice_items',
                                    'initialValue': [],
                                    'in': {
                                        '$concatArrays': [
                                            '$$value', '$$this'
                                        ]
                                    }
                                }
                            },
                            'tpp_usage_per_lfi': {
                                '$reduce': {
                                    'input': '$all_tpp_usage',
                                    'initialValue': [],
                                    'in': {
                                        '$concatArrays': [
                                            '$$value', '$$this'
                                        ]
                                    }
                                }
                            }
                        }
                    }, {
                        '$unwind': '$invoice_items'
                    }, {
                        '$unwind': '$invoice_items.items'
                    }, {
                        '$group': {
                            '_id': {
                                'tpp_id': '$_id',
                                'category': '$invoice_items.category',
                                'description': '$invoice_items.items.description'
                            },
                            'tpp_name': {
                                '$first': '$tpp_name'
                            },
                            'generated_for': {
                                '$first': '$generated_for'
                            },
                            'createdAt': {
                                '$first': '$createdAt'
                            },
                            'updatedAt': {
                                '$first': '$updatedAt'
                            },
                            'quantity': {
                                '$sum': '$invoice_items.items.quantity'
                            },
                            'unit_price': {
                                '$first': '$invoice_items.items.unit_price'
                            },
                            'total': {
                                '$sum': '$invoice_items.items.total'
                            },
                            'sub_total': {
                                '$sum': '$invoice_items.sub_total'
                            },
                            'vat_amount': {
                                '$sum': '$invoice_items.vat_amount'
                            },
                            'category_total': {
                                '$sum': '$invoice_items.category_total'
                            },
                            'tpp_usage_per_lfi': {
                                '$first': '$tpp_usage_per_lfi'
                            }
                        }
                    }, {
                        '$group': {
                            '_id': {
                                'tpp_id': '$_id.tpp_id',
                                'category': '$_id.category'
                            },
                            'tpp_name': {
                                '$first': '$tpp_name'
                            },
                            'generated_for': {
                                '$first': '$generated_for'
                            },
                            'createdAt': {
                                '$first': '$createdAt'
                            },
                            'updatedAt': {
                                '$first': '$updatedAt'
                            },
                            'items': {
                                '$push': {
                                    'description': '$_id.description',
                                    'quantity': '$quantity',
                                    'unit_price': '$unit_price',
                                    'total': '$total'
                                }
                            },
                            'sub_total': {
                                '$first': '$sub_total'
                            },
                            'vat_amount': {
                                '$first': '$vat_amount'
                            },
                            'category_total': {
                                '$first': '$category_total'
                            },
                            'tpp_usage_per_lfi': {
                                '$first': '$tpp_usage_per_lfi'
                            }
                        }
                    }, {
                        '$group': {
                            '_id': '$_id.tpp_id',
                            'tpp_name': {
                                '$first': '$tpp_name'
                            },
                            'generated_for': {
                                '$first': '$generated_for'
                            },
                            'createdAt': {
                                '$first': '$createdAt'
                            },
                            'updatedAt': {
                                '$first': '$updatedAt'
                            },
                            'invoice_items': {
                                '$push': {
                                    'category': '$_id.category',
                                    'items': '$items',
                                    'sub_total': '$sub_total',
                                    'vat_amount': '$vat_amount',
                                    'category_total': '$category_total'
                                }
                            },
                            'tpp_usage_per_lfi': {
                                '$first': '$tpp_usage_per_lfi'
                            }
                        }
                    }, {
                        '$unwind': {
                            'path': '$tpp_usage_per_lfi',
                            'preserveNullAndEmptyArrays': true
                        }
                    }, {
                        '$unwind': {
                            'path': '$tpp_usage_per_lfi.labels',
                            'preserveNullAndEmptyArrays': true
                        }
                    }, {
                        '$group': {
                            '_id': {
                                'tpp_id': '$_id',
                                'category': '$_id.category',
                                'label': '$tpp_usage_per_lfi.labels.label'
                            },
                            'tpp_name': {
                                '$first': '$tpp_name'
                            },
                            'invoice_items': {
                                '$first': '$invoice_items'
                            },
                            'generated_for': {
                                '$first': '$generated_for'
                            },
                            'createdAt': {
                                '$first': '$createdAt'
                            },
                            'updatedAt': {
                                '$first': '$updatedAt'
                            },
                            'items': {
                                '$first': '$items'
                            },
                            'sub_total': {
                                '$first': '$sub_total'
                            },
                            'vat_amount': {
                                '$first': '$vat_amount'
                            },
                            'category_total': {
                                '$first': '$category_total'
                            },
                            'lfi_id': {
                                '$first': '$tpp_usage_per_lfi._id'
                            },
                            'quantity': {
                                '$sum': '$tpp_usage_per_lfi.labels.quantity'
                            },
                            'unit_price': {
                                '$first': '$tpp_usage_per_lfi.labels.unit_price'
                            },
                            'total': {
                                '$sum': '$tpp_usage_per_lfi.labels.total'
                            },
                            'full_total': {
                                '$sum': '$tpp_usage_per_lfi.full_total'
                            },
                            'vat': {
                                '$sum': '$tpp_usage_per_lfi.vat'
                            },
                            'actual_total': {
                                '$sum': '$tpp_usage_per_lfi.actual_total'
                            }
                        }
                    }, {
                        '$group': {
                            '_id': {
                                'tpp_id': '$_id.tpp_id',
                                'category': '$_id.category'
                            },
                            'tpp_name': {
                                '$first': '$tpp_name'
                            },
                            'generated_for': {
                                '$first': '$generated_for'
                            },
                            'createdAt': {
                                '$first': '$createdAt'
                            },
                            'updatedAt': {
                                '$first': '$updatedAt'
                            },
                            'items': {
                                '$first': '$items'
                            },
                            'sub_total': {
                                '$first': '$sub_total'
                            },
                            'vat_amount': {
                                '$first': '$vat_amount'
                            },
                            'category_total': {
                                '$first': '$category_total'
                            },
                            'invoice_items': {
                                '$first': '$invoice_items'
                            },
                            'labels': {
                                '$push': {
                                    'label': '$_id.label',
                                    'quantity': '$quantity',
                                    'unit_price': '$unit_price',
                                    'total': '$total'
                                }
                            },
                            'full_total': {
                                '$first': '$full_total'
                            },
                            'vat': {
                                '$first': '$vat'
                            },
                            'actual_total': {
                                '$first': '$actual_total'
                            },
                            'lfi_id': {
                                '$first': '$lfi_id'
                            }
                        }
                    }, {
                        '$group': {
                            '_id': '$_id.tpp_id',
                            'tpp_name': {
                                '$first': '$tpp_name'
                            },
                            'generated_for': {
                                '$first': '$generated_for'
                            },
                            'createdAt': {
                                '$first': '$createdAt'
                            },
                            'updatedAt': {
                                '$first': '$updatedAt'
                            },
                            'invoice_items': {
                                '$first': '$invoice_items'
                            },
                            'tpp_usage_per_lfi': {
                                '$push': {
                                    'labels': '$labels',
                                    'full_total': '$full_total',
                                    'vat': '$vat',
                                    'actual_total': '$actual_total',
                                    'lfi_id': '$lfi_id'
                                }
                            }
                        }
                    }, {
                        '$project': {
                            '_id': 0,
                            'tpp_id': '$_id',
                            'tpp_name': 1,
                            'generated_for': 1,
                            'createdAt': 1,
                            'updatedAt': 1,
                            'invoice_items': 1,
                            'tpp_usage_per_lfi': 1
                        }
                    }
                ]
            )
            console.log(result_of_tpp[0]?.invoice_items)
            const total = result_of_tpp[0]?.invoice_items.reduce((sum, item) => sum + item.category_total, 0);

            console.log(total)
            const vat = total * 0.05;

            const roundedTotal = Math.round(total * 100) / 100; // 0.23
            const roundedVat = Math.round(vat * 100) / 100;

            const invoice_data = {
                invoice_number: await this.generateInvoiceNumber(),
                tpp_id: tpp?.tpp_id,
                tpp_name: tpp?.tpp_name,
                billing_address_line1: 'billing_address_line1',
                billing_address_line2: 'billing_address_line2',
                billing_address_city: 'billing_address_city',
                billing_address_state: 'billing_address_state',
                billing_address_postal_code: '1111',
                billing_address_country: 'country',
                billing_period_start: startDate,  // Month First
                billing_period_end: endDate,   // Month Last
                issued_date: new Date(),        // Generate Date
                due_date: futureDate,  //issued_date + 30 days
                generated_at: new Date(),        // Generate Date
                currency: 'AED',         //AED default
                tpp_usage_per_lfi: result_of_tpp[0]?.tpp_usage_per_lfi,
                invoice_items: result_of_tpp[0]?.invoice_items,
                vat_percent: 5, // Default 5 percent
                vat_total: roundedVat,  // vat percent of invoice total
                total_amount: roundedTotal,  // total of invoice array
                status: 1,
                notes: 'Invoice Added',
            }
            const invoice = new this.invoiceModel(invoice_data)
            await invoice.save();
        }

    }

    async invoiceCreationMonthlyLfi(): Promise<any> {

        const startDate = moment().subtract(1, 'months').startOf('month');
        const endDate = moment().subtract(1, 'months').endOf('month');
        const lfiData = await this.lfiDataModel.find();

        for (const obj of lfiData) {

            const result_of_collection_memo = await this.singleDayCollectionMemoModel.aggregate(
                [
                    {
                        '$match': {
                            'lfi_id': obj.lfi_id,
                            'createdAt': {
                                $gte: startDate,
                                $lte: endDate
                            }
                        }
                    }, {
                        '$unwind': '$tpp'
                    }, {
                        '$unwind': '$tpp.collection_memo_subitem'
                    }, {
                        '$group': {
                            '_id': {
                                'tpp_id': '$tpp.tpp_id',
                                'tpp_name': '$tpp.tpp_name'
                            },
                            'collection_memo_subitem': {
                                '$push': {
                                    'label': '$tpp.collection_memo_subitem.label',
                                    'quantity': {
                                        '$round': [
                                            '$tpp.collection_memo_subitem.quantity', 4
                                        ]
                                    },
                                    'unit_price': {
                                        '$round': [
                                            '$tpp.collection_memo_subitem.unit_price', 4
                                        ]
                                    },
                                    'total': {
                                        '$round': [
                                            '$tpp.collection_memo_subitem.total', 4
                                        ]
                                    }
                                }
                            },
                            'full_total': {
                                '$sum': '$tpp.collection_memo_subitem.total'
                            },
                            'generated_for': {
                                '$first': '$tpp.date'
                            },
                            'generated_at': {
                                '$first': '$createdAt'
                            }
                        }
                    }, {
                        '$addFields': {
                            'full_total': {
                                '$round': [
                                    '$full_total', 4
                                ]
                            },
                            'vat_percent': 5,
                            'vat': {
                                '$round': [
                                    {
                                        '$multiply': [
                                            '$full_total', 0.05
                                        ]
                                    }, 4
                                ]
                            },
                            'actual_total': {
                                '$round': [
                                    {
                                        '$add': [
                                            '$full_total', {
                                                '$multiply': [
                                                    '$full_total', 0.05
                                                ]
                                            }
                                        ]
                                    }, 4
                                ]
                            }
                        }
                    }, {
                        '$group': {
                            '_id': '1221',
                            'tpp': {
                                '$push': {
                                    'tpp_id': '$_id.tpp_id',
                                    'tpp_name': '$_id.tpp_name',
                                    'collection_memo_subitem': '$collection_memo_subitem',
                                    'full_total': '$full_total',
                                    'vat_percent': '$vat_percent',
                                    'vat': '$vat',
                                    'actual_total': '$actual_total',
                                    'date': '$generated_at'
                                }
                            },
                            'generated_for': {
                                '$first': '$generated_for'
                            },
                            'generated_at': {
                                '$first': '$generated_at'
                            }
                        }
                    }, {
                        '$project': {
                            '_id': 0,
                            'lfi_id': '$_id',
                            'generated_at': 1,
                            'generated_for': 1,
                            'tpp': 1
                        }
                    }
                ]
            )
            const total = result_of_collection_memo[0]?.tpp.reduce((sum, item) => sum + item.full_total, 0);

            const vat = total * 0.05;

            const roundedTotal = Math.round(total * 100) / 100; // 0.23
            const roundedVat = Math.round(vat * 100) / 100;
            const lfiData = await this.lfiDataModel.findOne({ lfi_id: obj?._id });
            const coll_memo_tpp = new this.collectionMemoModel({
                invoice_number: await this.generateCollectionMemoInvNumber(),
                lfi_id: obj?._id,
                lfi_name: lfiData.lfi_name,
                billing_period_start: startDate,  // Month First
                billing_period_end: endDate,   // Month Last
                generated_at: new Date(),        // Generate Date
                currency: 'AED',         //AED default
                tpp: result_of_collection_memo[0].tpp,
                vat_percent: 5, // Default 5 percent
                vat_total: roundedVat,  // vat percent of invoice total
                total_amount: roundedTotal,  // total of invoice array
                status: 1,
            })
            await coll_memo_tpp.save();
        }
        return 'completed';
    }
    async invoiceTppAggregation(data: any) {
        let tpp_id = data.tpp_id
        let month = data.month
        let year = data.year

        const result = await this.invoiceModel.findOne({
            tpp_id: tpp_id,
            invoice_month: month,
            invoice_year: year
        })

        return result
    }
    async invoiceLfi_PDF_Aggregation(data: any) {
        let lfi_id = data.lfi_id
        let month = data.month
        let year = data.year

        const result = await this.collectionMemoModel.findOne({
            lfi_id: lfi_id,
            invoice_month: month,
            invoice_year: year
        })

        return result
    }

    async generateInvoicePDFTpp(data: any, mail: boolean = false) {
        if (!fs.existsSync(`./temp`)) {
            fs.mkdirSync(`./temp`)
        }

        const currentDate = new Date();
        const timestamp = currentDate.getTime();
        const invoice_data = await this.invoiceTppAggregation(data)
        let attachment_html = await this.invoiceTemplate(invoice_data)
        const attachmentPath = `./temp/invoice${timestamp}.pdf`

        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage()
        await page.setContent(attachment_html, {
            waitUntil: 'networkidle0',
        });
        await page.content();


        // Generate PDF with header and footer
        const pdfBuffer = await page.pdf({
            path: attachmentPath,
            format: 'A4',
            printBackground: true,
            displayHeaderFooter: true,
            headerTemplate: await this.header_template(),
            footerTemplate: await this.footer_template(),
            margin: {
                top: '100px',
                bottom: '100px',
                left: '20px',
                right: '20px'
            }
        });
        await browser.close();
        let result;
        if (mail) {
            try {
                const mailResponse = await this.mailService.sendInvoiceEmail(attachmentPath); // Ensure mailservi.sendmail returns a response
                // Optionally delete the PDF after sending
                fs.unlink(attachmentPath, (unlinkErr) => {
                    if (unlinkErr) {
                        console.error('Error deleting PDF file:', unlinkErr);
                    } else {
                        console.log(`Deleted temp PDF: ${attachmentPath}`);
                    }
                });
                result = mailResponse
            } catch (error) {
                console.error('Error sending mail:', error);
                throw new Error('Failed to send mail with the PDF attachment');
            }
        } else {
            result = attachmentPath
        }

        return result;
    }

    async invoiceTemplate(data: any): Promise<any> {
        let nebras_taxable_amount = data.invoice_items?.reduce((sum, item) => sum + item.sub_total, 0);

        let lfi_list = ''
        let lfi_count = 2;

        let total_due = Number(data.total_amount);

        const monthName = moment().month(data.invoice_month - 1).format('MMMM');

        for (const item of data?.tpp_usage_per_lfi) {
            lfi_list += `<tr>
                        <td class="table-td">00${lfi_count}</td>
                        <td class="table-td">${item?._id} - ${monthName} ${data.invoice_year}</td>
                        <td class="table-total">${item.full_total} </td>
                    </tr>`
            lfi_count++


            // invoice_phase += `<tr>
            //     <td class="right-align">${invoice?.tranche}</td>
            //     <td class="right-align">${item?.invoice_number}</td>
            //     <td class="right-align">AED ${await this.formatWithCommas(item?.gross_value)}</td>
            //     <td class="right-align">${moment(item?.invoice_date).format('DD-MMM-YY')}</td>
            // </tr>`;
        }
        let tableHtml = '';

        if (lfi_list && lfi_list.trim() !== '') {
            tableHtml = `
                <table>
                <thead>
                    <tr>
                    <th>#</th>
                    <th>Item</th>
                    <th class="table-total">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${lfi_list}
                </tbody>
                </table>
            `;
        }

        const serviceInitiationItem = data?.invoice_items.find(item => item.category === 'service_initiation');
        let service_initiation = ''

        for (const service_items of serviceInitiationItem.items) {
            service_initiation += ` <tr>
                <td>${service_items.description}</td>
                <td class="table-total">${service_items.quantity}</td>
                <td class="table-total">${service_items.unit_price}</td>
                <td class="table-total">${service_items.total}</td>
                <td class="table-total">5</td>
                <td class="table-total">${service_items.vat_amount}</td>
                <td class="table-total">${service_items.full_total}</td>
            </tr>`;
        }

        const dataSharingItem = data?.invoice_items.find(item => item.category === 'data_sharing');
        let data_sharing = ''

        for (const data_items of dataSharingItem.items) {
            data_sharing += ` <tr>
                <td>${data_items.description}</td>
                <td class="table-total">${data_items.quantity}</td>
                <td class="table-total">${data_items.unit_price}</td>
                <td class="table-total">${data_items.total}</td>
                <td class="table-total">5</td>
                <td class="table-total">${data_items.vat_amount}</td>
                <td class="table-total">${data_items.full_total}</td>
            </tr>`;
        }

        let collection_memo = ''
        let displayIndex = 0;
        for (const memo of data?.tpp_usage_per_lfi || []) {
            displayIndex++;
            collection_memo += ` 
            <div class="new-page-section">

            <div class="">
                <div class="header">
                    <div>
                        <div class="title">Collection Memo</div>
                        <div class="memo-number">Collection Memo # 00${displayIndex}</div>
                        <div class="date">${moment(data.generated_at).format('D MMMM YYYY')}</div>
                        <div class="lfi-info">
                            <div>LFI ${memo.lfi_name}</div>
                            <div class="lfi-info-space">LFI-${memo._id}</div>
                            <div class="lfi-info-space">4567 Business Park<br>Innovation City, IC 12345<br>United Arab
                                Emirates</div>
                        </div>
                    </div>

                </div>

                <div class="collection-summary">
                <div class="summary-title">LFI-${memo.lfi_name} Collection Summary:</div>
                <div class="billing-period">Billing Period: ${moment(data.billing_period_start).format('D MMMM YYYY')} to ${moment(data.billing_period_end).format('Do MMMM YYYY')}</div>
                <table>
                  <thead>
                    <tr>
                      <th>Charge Type</th>
                      <th class="table-total">Vol</th>
                      <th class="table-total">Unit Price</th>
                      <th class="table-total">Total</th>
                    </tr>
                </thead>
                <tbody>
            `;

            for (const label of memo.labels || []) {

                collection_memo += `
                    <tr>
                      <td>${label.label} ${label?.capped === true ? '**' : ''} </td>
                      <td class="table-total">${label.quantity}</td>
                      <td class="table-total">${label.unit_price.toFixed(4)}</td>
                      <td class="table-total">${label.total.toFixed(2)}</td>
                    </tr>
              `;
            }

            collection_memo += `
                    <tr>
                      <td class="sub-total-row" colspan="3">SUB TOTAL</td>
                      <td class="table-total">${memo.full_total.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
          
                <div class="invoice-summary-wrapper">
                    <div class="note">
                        ** - Inclusive of capped amount
                    </div>
                    <div class="invoice-total">
                        <span class="invoice-total-label">Total</span>
                        <span class="invoice-total-amount">AED ${(memo.full_total).toFixed(2)}</span>
                    </div>
                </div>
              </div>

                <div class="note">
                    Note- This is a collection memo on behalf of the LFIs and Nebras is authorized to collect fees on behalf of the Licensed Financial Institutes.
                </div>
                

            </div>
        </div>
              
              
            `;
        }

        return `
        <!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TPP Statement of Account</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            color: #333;
        }

        .container {
            /* max-width: 800px; */
            margin: 0 auto;
            padding: 0 20px;
            position: relative;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            /* margin-bottom: 40px; */
        }

        .title {
            color: #1b194f;
            font-size: 24px;
            font-weight: bold;
        }

        .date {
            margin-top: 10px;
            font-size: 16px;
            color: #1b194f;
        }



        .table-td {
            font-size: 14px;
            font-weight: bold;
            color: #1b194f;
        }
        .note {
            margin-top: 30px;
            margin-bottom: 30px;
            font-style: italic;
            color: #1b194f;
        }
        
        .billing-row {
            display: flex;
            margin-bottom: 5px;
        }

        .billing-label {
            width: 183px;
            color: #1b194f;
            font-weight: 500;
        }
        .billing-sub-label{
            color: #1b194f;
        }

        .statement-summary {
            margin-bottom: 30px;
        }

        .statement-summary h2 {
            color: #1b194f;
            font-size: 20px;
            margin-bottom: 5px;
        }

        .period {
            margin-bottom: 20px;
            font-size: 14px;
            font-weight: 600;
            color: #1b194f;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom:30px;
            font-size:14px;
        }

        thead {
            background-color: #c2c1eb !important;
        }

        th,
        td {
            padding: 10px;
            text-align: left;
            border: 1px solid #d1c4e9;
        }

        th {
            color: #1b194f;
        }

        .total-row {
            background-color: #ffeb3b;
            font-weight: bold;
            padding: 10px;
            margin: 20px 0;
            text-align: center;
            font-size: 18px;
        }

        .payment-section {
            display: flex;
            justify-content: space-between;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #000;
        }

        .payment-block {
            width: 48%;
        }

        .payment-title {
            font-weight: bold;
            margin-bottom: 10px;
            color: #1b194f;
        }

        .payment-list {
            color: #1b194f;

        }

        .highlight {
            background-color: #ffeb3b !important;
            padding: 0 2px;
        }

        .invoice-title {
            color: #1b194f;
            font-size: 24px;
            font-weight: bold;
        }

        .invoice-number {
            margin-top: 10px;
            font-size: 16px;
            color: #1b194f;
        }

        .invoice-number span {
            background-color: #ffeb3b;
            padding: 2px 5px;
            font-weight: bold;
        }

        .invoice-date {
            margin-top: 5px;
            font-size: 16px;
            color: #1b194f;
            padding-bottom: 10px;
        }


        .invoice-summary {
            margin-bottom: 15px;
            margin-top: 10px;

        }

        .invoice-summary-title {
            color: #1b194f;
            font-size: 20px;
            font-weight: bold;
            padding-bottom: 5px;

        }

        .billing-period {
            font-size: 14px;
            font-weight: 600;
            color: #1b194f;

        }

        .section {
            margin-bottom: 30px;
        }

        .section-title {
            font-weight: bold;
            color: #1b194f;
            margin-bottom: 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .section-amount {
            font-weight: bold;
            color: #1b194f;
        }



        th,
        td {
            padding: 8px;
            text-align: left;
            border: 1px solid #000000;
            color: #1b194f;
        }



        .sub-total-row {
            font-weight: bold;
            /* background-color: #f5f5f5; */
        }

        .vat-row {
            /* background-color: #f5f5f5; */
        }

       .invoice-summary-wrapper {            display: flex;
            justify-content: space-between; /* pushes items to the edges */
            align-items: center; /* vertical alignment */
            margin-top: 30px;
            margin-bottom: 50px;
            }
            
        .invoice-total {
            text-align: right;
            }
            
        .invoice-total-label {
            font-weight: bold;
            color: #1b194f;
            display: inline-block;
            margin-right: 20px;
            }
            
        .invoice-total-amount {
            font-weight: bold;
            font-size: 18px;
            color: #1b194f;
            }
            
        .note {
            font-size: 12px;
            color: #555;
            margin-left: 20px;
            white-space: nowrap; /* keep in one line */
            }
            lor: #1b194f;

        }

        .table-total {
            text-align: right;

        }

        .payment-list {
            color: #1b194f;

        }

        .memo-number {
            margin-top: 10px;
            font-size: 16px;
            color: #1b194f;

            font-weight: bold;



        }

        .date {
            margin-top: 5px;
            font-size: 16px;
            color: #1b194f;
        }

        .lfi-info {
            margin-top: 20px;
            color: #1b194f;
            font-weight: bold;
        }



        .collection-summary {
            margin: 30px 0;
        }

        .summary-title {
            font-size: 16px;
            font-weight: bold;
            color: #1b194f;
            margin-bottom: 5px;
        }

        .billing-period {
            color: #1b194f;
            margin-bottom: 20px;
            font-size: 14px;
            font-weight: 600;
        }

        .total-label {
            display: inline-block;
            text-align: right;
            color: #1b194f;
            font-weight: bold;
        }

        .total-amount {
            display: inline-block;
            margin-left: 50px;
            color: #1b194f;
            font-weight: bold;
            font-size: 16px;
        }

        .note {
            margin-top: 30px;
            margin-bottom: 30px;
            font-style: italic;
            color: #1b194f;
        }


        .table-total {
            text-align: right;
        }

        .payment-list {
            color: #1b194f;

        }

        img {
            width: auto;
            height: 60.858px
        }


        .lfi-info-space {
            margin-top: 5px;
        }
        .billing-info{
            margin-bottom: 20px;
        }

        @media print {
            .total-row {
                background-color: #ffeb3b !important;
                font-weight: bold;
                padding: 10px;
                margin: 20px 0;
                text-align: center;
                font-size: 18px;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }

            .highlight {
                background-color: #ffeb3b !important;
                padding: 0 2px;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }

            thead {
                background-color: #c2c1eb !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }

            .new-page-section {
                page-break-before: always;
                break-before: page;
            }

            .invoice-number span {
    background-color: #ffeb3b;
    padding: 2px 5px;
    font-weight: bold;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

        }

      
    </style>
</head>

<body>
    <div class="container">
        <div class="header">
            <div class="header-left">
                <div class="title">TPP Monthly Billing Summary </div>
                <div class="date">${moment(data.createdAt).format('DD MMMM YYYY')}</div>
            </div>
            <!-- <div class="logo">
                <div class="logo-badge">
                 <img src="https://nebras.html.omniaconnect.net/en/assets/images/Logo.svg" alt="" srcset="">
                </div>
            </div> -->
        </div>


        <div class="billing-info">
            <h3 class="billing-sub-label">Billed To:</h3>
            <div class="billing-row">
                <div class="billing-label">TPP NAME :</div>
                <div class="billing-sub-label">${data.tpp_name}</div>
            </div>
            <div class="billing-row">
                <div class="billing-label">TPP ID :</div>
                <div class="billing-sub-label">${data.tpp_id}</div>
            </div>
            <div class="billing-row">
                <div class="billing-label">TPP ADDRESS :</div>
                <div class="billing-sub-label">${data.billing_address_line1}<br>${data.billing_address_line2}<br>${data.billing_address_country}</div>
            </div>

            <div class="billing-row">
                <div class="billing-label">Invoice Currency: </div>
                <div class="billing-sub-label">AED </div>
            </div>
            <div class="billing-row">
                <div class="billing-label">TPP TRN: </div>
                <div class="billing-sub-label" ></div>
            </div>
            <div class="billing-row">
                <div class="billing-label">Nebras TRN: </div>
                <div class="billing-sub-label"></div>
            </div>
            <div class="billing-row">
                <div class="billing-label">Period: </div>
                <div class="billing-sub-label">${moment(data.billing_period_start).format('D MMMM YYYY')} to ${moment(data.billing_period_end).format('Do MMMM YYYY')}</div>
            </div>

        </div>



        <div class="statement-summary">
            <table>
                <thead>
                    <tr>
                        <th>Number </th>
                        <th>Description </th>
                        <th class="table-total">Taxable Amount </th>
                        <th class="table-total">VAT % </th>
                        <th class="table-total">VAT Amount  </th>
                        <th class="table-total">Gross Amount  </th>


                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td class="table-td">001</td>
                        <td class="table-td">Nebras Invoice - ${monthName} ${data.invoice_year}</td>
                        <td class="table-td table-total">${nebras_taxable_amount}</td>
                        <td class="table-td table-total">${data.vat_percent}</td>
                        <td class="table-td table-total">${data.vat_total}</td>
                        <td class="table-total">${data.invoice_total}</td>
                    </tr>
                  
                </tbody>
            </table>

            
            ${tableHtml}
                

            <div class="total-row">
                Total due <b>${total_due.toFixed(4)}</b> by <b>${moment(data.due_date).format('Do MMMM YYYY')}</b>
            </div>
        </div>

        <div class="payment-section">
            <div class="payment-block">
                <div class="payment-title">Payment Details</div>
                <div class="payment-list">Bank: Nebras Bank</div>
                <div class="payment-list">IBAN: <span class="highlight">UA000000000010101</span></div>
                <div class="payment-list">Email Address: <span class="highlight">finance@nebraspenfinance.ae</span>
                </div>
            </div>
            <div class="payment-block">
                <div class="payment-title">Payment terms</div>
                <div class="payment-list">30 days from date of invoice</div>
            </div>
        </div>

        <!-- <div class="footer">
            <div class="footer-block">
                Nebras Open Finance LLC<br>
                11th Floor, EIF Building, Sultan Bin Zayed The First St<br>
                Al Nahyan, Abu Dhabi, United Arab Emirates
            </div>
            <div class="footer-block footer-right">
                نبراس للتمويل المفتوح ذ.م.م<br>
                الطابق 11، بناء صندوق الإمارات للاستثمار، شارع سلطان بن زايد الأول<br>
                آل نهيان، أبوظبي، الإمارات العربية المتحدة
            </div>
        </div> -->

        <!-- <div class="bottom-bar"></div> -->


        <div class="new-page-section">
            <div class="">
                <div class="header">
                    <div>
                        <div class="invoice-title">Tax Invoice </div>
                        <div class="invoice-number">Invoice # <span>- ${data.invoice_number}</span></div>
                        <div class="invoice-date">${moment(data.createdAt).format('DD MMMM YYYY')}</div>
                    </div>

                </div>
                <div class="billing-info">
                    <div class="billing-row">
                        <div class="billing-label">Billing Period: </div>
                        <div class="billing-sub-label">${moment(data.billing_period_start).format('D MMMM YYYY')} to ${moment(data.billing_period_end).format('Do MMMM YYYY')}</div>
                    </div>
                    <div class="billing-row">
                        <div class="billing-label">Invoice Currency: </div>
                        <div class="billing-sub-label">AED </div>
                    </div>
                    <div class="billing-row">
                        <div class="billing-label">TPP TRN: </div>
                        <div class="billing-sub-label" >TPP123456</div>
                    </div>
                  
                    <div class="billing-row">
                        <div class="billing-label">Invoice Number: </div>
                        <div class="billing-sub-label">${data.invoice_number}</div>
                    </div>
               
                
              
                    <div class="billing-row">
                        <div class="billing-label">Nebras TRN: </div>
                        <div class="billing-sub-label"></div>
                    </div>
               
        
                </div>


                <div class="section">
                    <div class="section-title">
                        <span>Service Initiation</span>
                        <span class="section-amount">${serviceInitiationItem?.category_total ?? 0}</span>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>Description </th>
                                <th class="table-total">Vol</th>
                                <th class="table-total">Unit Price</th>
                                <th class="table-total">Taxable Amount </th>
                                <th class="table-total">VAT % </th>
                                <th class="table-total">VAT Amount  </th>
                                <th class="table-total">Gross Amount </th>
                            </tr>
                        </thead>
                        <tbody>
                            ${service_initiation}
                            <tr class="">
                                <td class="sub-total-row " colspan="6">SUB TOTAL</td>
                                <td class="table-total">${serviceInitiationItem?.category_total ?? 0}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="section">
                    <div class="section-title">
                        <span>Data Sharing</span>
                        <span class="section-amount">${dataSharingItem?.category_total ?? 0}</span>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>Description </th>
                                <th class="table-total">Vol</th>
                                <th class="table-total">Unit Price</th>
                                <th class="table-total">Taxable Amount </th>
                                <th class="table-total">VAT % </th>
                                <th class="table-total">VAT Amount  </th>
                                <th class="table-total">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data_sharing}
                            <tr>
                                <td class="sub-total-row" colspan="6">SUB TOTAL</td>
                                <td class="table-total">${dataSharingItem?.sub_total ?? 0}</td>
                            </tr>
                            <tr class="vat-row">
                                <td class="sub-total-row" colspan="6">VAT</td>
                                <td class="table-total">${dataSharingItem?.vat_amount ?? 0}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="invoice-total">
                    <span class="invoice-total-label">Invoice Total</span>
                    <span class="invoice-total-amount"> AED ${data?.invoice_total ?? 0}</span>
                </div>


            </div>
        </div>



        ${collection_memo}



    </div>
</body>

</html>
        `

    }

    async generateInvoicePDFLfi(data: any, mail: boolean = false) {
        if (!fs.existsSync(`./temp`)) {
            fs.mkdirSync(`./temp`)
        }

        const currentDate = new Date();
        const timestamp = currentDate.getTime();
        const invoice_data = await this.invoiceLfi_PDF_Aggregation(data)
        let attachment_html = await this.lfi_invoiceTemplate(invoice_data)
        const attachmentPath = `./temp/invoice-lfi${timestamp}.pdf`

        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage()
        await page.setContent(attachment_html, {
            waitUntil: 'networkidle0',
        });
        await page.content();


        // Generate PDF with header and footer
        const pdfBuffer = await page.pdf({
            path: attachmentPath,
            format: 'A4',
            printBackground: true,
            displayHeaderFooter: true,
            headerTemplate: await this.header_template(),
            footerTemplate: await this.footer_template(),
            margin: {
                top: '100px',
                bottom: '100px',
                left: '20px',
                right: '20px'
            }
        });
        await browser.close();
        console.log("PDF Generation Completed");

        return attachmentPath
    }
    async header_template() {
        return `

        <div class="header">
    
        <div style = "display: flex;text-align: right;justify-content: flex-end;">
            <div style = " padding: 15px; display: inline-block; position: relative;">
                <svg width="1300" height="60.858" viewBox="0 0 373 192" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                        d="M331.023 61.047H300.804V47.8828H330.61C331.874 47.8828 332.682 46.9866 332.682 45.7407V19.4379H345.21V44.5012C345.21 45.6708 345.128 46.8022 344.962 47.8892H356.124C357.345 47.8892 358.336 46.8976 358.336 45.6708V19.4379H370.865V43.7257C370.865 55.2626 363.523 61.4283 354.465 61.4283C348.776 61.4283 344.473 59.2544 341.74 55.8156C340.729 57.1632 339.528 58.2946 338.129 59.2163C336.527 60.2715 334.353 61.047 331.016 61.047H331.023ZM173.803 120.759C175.386 119.456 176.638 117.81 177.566 115.826C178.494 113.843 178.958 111.58 178.958 109.031C178.958 105.866 178.183 103.107 176.632 100.749C175.081 98.3909 172.964 96.5602 170.263 95.2571C167.568 93.9541 164.548 93.3057 161.199 93.3057H126.963V104.379H162.508C163.735 104.379 164.733 105.37 164.733 106.603V141.061C164.733 142.288 163.735 143.286 162.508 143.286H126.963V154.359H161.199C164.542 154.359 167.568 153.711 170.263 152.408C172.958 151.105 175.081 149.274 176.632 146.916C178.183 144.557 178.958 141.799 178.958 138.633C178.958 136.091 178.494 133.821 177.566 131.838C176.638 129.849 175.38 128.209 173.803 126.906C172.227 125.603 170.441 124.643 168.458 124.02V123.645C170.441 123.028 172.221 122.062 173.803 120.759ZM84.1779 154.353H118.414V143.28H82.8685C81.6417 143.28 80.6501 142.288 80.6438 141.055V106.597C80.6438 105.37 81.6417 104.372 82.8685 104.372H118.414V93.2994H84.1779C80.8344 93.2994 77.8088 93.9477 75.1137 95.2508C72.4186 96.5539 70.2955 98.3845 68.7445 100.743C67.1936 103.101 66.4181 105.86 66.4181 109.025C66.4181 111.568 66.8821 113.837 67.8102 115.82C68.7382 117.81 69.9968 119.45 71.5732 120.753C73.1495 122.056 74.9357 123.016 76.9189 123.639V124.014C74.9357 124.63 73.1559 125.596 71.5732 126.899C69.9904 128.202 68.7382 129.849 67.8102 131.832C66.8821 133.815 66.4181 136.078 66.4181 138.627C66.4181 141.792 67.1936 144.551 68.7445 146.909C70.2955 149.268 72.4122 151.098 75.1137 152.401C77.8088 153.704 80.8281 154.353 84.1779 154.353ZM216.709 47.8892H186.993C185.963 47.8892 184.902 47.8002 183.815 47.6286C182.728 47.457 181.742 47.1137 180.853 46.5988C179.963 46.084 179.251 45.3657 178.704 44.4504C178.157 43.535 177.891 42.3273 177.891 40.8399V19.4379H165.362V57.6971C165.362 61.9941 164.873 64.8417 163.9 66.933C162.928 69.0242 161.211 70.0731 158.751 70.0731C157.779 70.0731 155.579 69.8633 154.111 68.9543V78.1584C155.198 78.6161 156.412 78.9593 157.76 79.1881C159.107 79.417 160.436 79.5314 161.752 79.5314C164.841 79.5314 167.415 79.0038 169.475 77.9423C171.534 76.8808 173.18 75.3934 174.413 73.4737C175.647 71.5541 176.53 69.2594 177.077 66.5961C177.624 63.9328 177.891 60.9643 177.891 57.6971V54.1757H178.304C178.501 55.2118 179.13 57.5891 180.897 59.2163C182.397 60.602 184.927 61.0533 186.402 61.0533H216.709V47.8892ZM223.409 173.206V170.479H226.136V173.206H223.409ZM30.6188 171.127C29.8433 170.695 28.8772 170.479 27.7203 170.479H19.3425V186.599H22.8386V180.98H27.6059C28.7627 180.98 29.7416 180.764 30.5362 180.319C31.3371 179.88 31.9409 179.263 32.3541 178.475C32.7673 177.681 32.9771 176.753 32.9771 175.691C32.9771 174.63 32.78 173.708 32.3796 172.932C31.9791 172.157 31.3943 171.553 30.6188 171.121V171.127ZM28.8327 177.484C28.4322 177.91 27.8665 178.119 27.1292 178.119H22.8322V173.352H27.1292C27.644 173.352 28.0699 173.447 28.4068 173.632C28.7437 173.822 28.9979 174.089 29.1696 174.433C29.3412 174.776 29.4302 175.208 29.4302 175.723C29.4302 176.473 29.2331 177.064 28.8327 177.484ZM13.0561 154.353H0.527593V93.2994H12.7065L41.056 132.099H41.501V93.2994H54.0295V154.353H41.8506L13.501 115.553H13.0561V154.353ZM12.6874 171.102C11.4606 170.498 9.97958 170.199 8.23792 170.199C6.49626 170.199 5.05971 170.498 3.82657 171.102C2.59343 171.706 1.6463 172.621 0.985236 173.854C0.330526 175.081 0 176.645 0 178.545C0 180.446 0.330526 181.959 0.985236 183.198C1.63995 184.438 2.58707 185.359 3.82657 185.969C5.05971 186.58 6.5344 186.885 8.23792 186.885C9.94144 186.885 11.4543 186.58 12.6874 185.969C13.9142 185.359 14.8549 184.431 15.516 183.198C16.1707 181.959 16.5013 180.408 16.5013 178.545C16.5013 176.683 16.1707 175.087 15.516 173.854C14.8613 172.627 13.9142 171.706 12.6874 171.102ZM12.9099 178.92C12.9099 179.734 12.8082 180.458 12.6048 181.094C12.4014 181.73 12.1026 182.264 11.7149 182.702C11.3208 183.141 10.8377 183.471 10.2593 183.688C9.68082 183.904 9.00705 184.018 8.23792 184.018C7.46879 184.018 6.82043 183.91 6.242 183.688C5.66357 183.465 5.18045 183.141 4.78636 182.702C4.39861 182.264 4.09986 181.73 3.90917 181.094C3.71212 180.458 3.6168 179.734 3.6168 178.92V178.189C3.6168 177.357 3.71212 176.626 3.90917 175.984C4.10622 175.342 4.39861 174.808 4.78636 174.375C5.1741 173.943 5.66357 173.619 6.242 173.396C6.82043 173.18 7.48786 173.066 8.23792 173.066C8.98798 173.066 9.67446 173.174 10.2593 173.396C10.8377 173.619 11.3208 173.943 11.7149 174.375C12.1026 174.808 12.4014 175.342 12.6048 175.984C12.8082 176.626 12.9099 177.363 12.9099 178.189V178.92ZM145.594 61.0533H133.065V0H145.594V61.0533ZM227.21 173.206V170.479H229.937V173.206H227.21ZM191.366 154.353H204.606V132.105H221.584L232.339 154.353H247.004L234.564 129.881C237.939 128.279 240.52 125.952 242.294 122.895C244.073 119.837 244.963 116.322 244.963 112.35C244.963 108.612 244.22 105.307 242.739 102.427C241.257 99.5477 239.02 97.3103 236.026 95.7085C233.032 94.1066 229.288 93.3057 224.782 93.3057H191.366V154.359V154.353ZM204.606 104.379H224.044C225.881 104.379 227.42 104.696 228.665 105.332C229.911 105.968 230.858 106.902 231.507 108.142C232.155 109.381 232.486 110.868 232.486 112.597C232.486 115.312 231.742 117.46 230.261 119.043C228.78 120.632 226.708 121.42 224.038 121.42H204.6V104.372L204.606 104.379ZM351.509 173.206V170.479H354.236V173.206H351.509ZM38.844 183.713H48.3278V186.605H35.3289V170.485H48.1879V173.352H38.8504V176.95H47.1137V179.791H38.8504V183.713H38.844ZM345.217 79.061H332.688V66.5135H345.217V79.061ZM360.091 152.458C356.315 153.717 351.986 154.353 347.124 154.353C343.691 154.353 340.424 154.009 337.335 153.323C334.245 152.636 331.512 151.53 329.135 150.011C326.758 148.492 324.895 146.572 323.554 144.252C322.206 141.932 321.539 139.11 321.539 135.786V134.883C321.539 134.572 321.564 134.324 321.622 134.152H334.328C334.271 134.324 334.239 134.552 334.239 134.839V135.614C334.239 137.451 334.741 138.996 335.739 140.254C336.737 141.513 338.212 142.46 340.163 143.089C342.108 143.718 344.371 144.036 346.946 144.036C348.605 144.036 350.079 143.935 351.37 143.737C352.66 143.54 353.804 143.254 354.802 142.879C355.8 142.504 356.633 142.066 357.294 141.545C357.948 141.03 358.438 140.426 358.756 139.739C359.067 139.053 359.226 138.277 359.226 137.419C359.226 135.875 358.724 134.61 357.726 133.637C356.722 132.665 355.349 131.832 353.607 131.145C351.859 130.459 349.901 129.83 347.727 129.251C345.553 128.679 343.316 128.088 341.028 127.491C338.739 126.887 336.502 126.143 334.328 125.253C332.154 124.363 330.209 123.289 328.486 122.03C326.77 120.772 325.397 119.164 324.368 117.212C323.338 115.261 322.823 112.915 322.823 110.163C322.823 107.239 323.44 104.715 324.666 102.599C325.899 100.476 327.628 98.7278 329.859 97.3548C332.091 95.9818 334.665 94.9648 337.589 94.3037C340.507 93.6426 343.685 93.3121 347.124 93.3121C350.327 93.3121 353.359 93.6426 356.226 94.3037C359.086 94.9648 361.603 96.0072 363.784 97.4438C365.958 98.8803 367.661 100.686 368.894 102.859C370.127 105.04 370.738 107.62 370.738 110.595V111.625H358.285V110.938C358.285 109.394 357.828 108.072 356.912 106.985C355.997 105.898 354.707 105.033 353.048 104.404C351.389 103.775 349.444 103.457 347.206 103.457C344.803 103.457 342.757 103.686 341.066 104.143C339.375 104.601 338.091 105.275 337.201 106.165C336.311 107.055 335.873 108.097 335.873 109.305C335.873 110.678 336.375 111.816 337.373 112.699C338.371 113.589 339.75 114.365 341.492 115.019C343.24 115.68 345.198 116.265 347.371 116.78C349.545 117.295 351.776 117.867 354.071 118.503C356.359 119.132 358.59 119.876 360.771 120.74C362.945 121.598 364.89 122.672 366.612 123.963C368.328 125.253 369.702 126.842 370.731 128.736C371.761 130.631 372.276 132.893 372.276 135.531C372.276 140.063 371.189 143.699 369.015 146.452C366.841 149.204 363.86 151.213 360.084 152.471L360.091 152.458ZM370.871 12.5476H358.343V0H370.871V12.5476ZM239.44 173.206V170.479H242.167V173.206H239.44ZM271.47 142.784H298.23L302.19 154.353H316.492L293.03 93.2994H276.675L253.214 154.353H267.509L271.47 142.784ZM284.634 104.379H285.079L294.575 132.105H275.131L284.634 104.379ZM347.715 173.206V170.479H350.442V173.206H347.715ZM276.504 170.479H279.828V186.586H276.504V170.479ZM270.669 183.789H267.319C267.071 183.789 266.829 183.764 266.588 183.713C266.353 183.662 266.143 183.579 265.958 183.465C265.774 183.351 265.622 183.204 265.507 183.02C265.393 182.842 265.329 182.613 265.329 182.353V181.73C265.329 180.802 265.17 179.975 264.865 179.276C264.56 178.577 264.128 177.992 263.594 177.528C263.06 177.07 262.424 176.721 261.706 176.486C260.988 176.257 260.2 176.136 259.367 176.136C258.534 176.136 257.746 176.257 257.028 176.486C256.31 176.721 255.674 177.07 255.14 177.528C254.606 177.986 254.18 178.577 253.869 179.276C253.563 179.975 253.405 180.802 253.405 181.73V182.353C253.405 182.62 253.347 182.842 253.227 183.02C253.106 183.204 252.953 183.351 252.775 183.465C252.591 183.579 252.375 183.662 252.133 183.713C251.885 183.764 251.644 183.789 251.415 183.789H245.834C246.158 183.478 246.444 183.077 246.686 182.594C246.94 182.079 247.074 181.558 247.074 181.043C247.074 180.115 246.915 179.295 246.61 178.602C246.305 177.91 245.879 177.325 245.345 176.854C244.811 176.39 244.175 176.034 243.457 175.812C242.739 175.589 241.95 175.475 241.118 175.475C240.285 175.475 239.497 175.596 238.785 175.837C238.073 176.079 237.444 176.441 236.916 176.912C236.389 177.388 235.975 177.973 235.683 178.66C235.391 179.346 235.244 180.147 235.244 181.043C235.244 181.571 235.371 182.098 235.619 182.607C235.855 183.084 236.134 183.484 236.458 183.796H230.318C230.108 183.796 229.886 183.757 229.663 183.675C229.447 183.599 229.25 183.471 229.079 183.306C228.907 183.135 228.767 182.918 228.665 182.651C228.557 182.391 228.507 182.067 228.507 181.692V176.924H225.182V182.137C225.182 182.467 225.131 182.74 225.036 182.95C224.941 183.16 224.813 183.332 224.667 183.459C224.521 183.586 224.362 183.675 224.197 183.719C224.025 183.77 223.873 183.796 223.733 183.796H217.879C217.891 183.579 217.898 183.357 217.91 183.122C217.917 182.874 217.923 182.601 217.923 182.315C217.923 181.259 217.828 180.3 217.631 179.467C217.434 178.628 217.116 177.903 216.671 177.318C216.226 176.727 215.641 176.27 214.936 175.952C214.23 175.634 213.359 175.475 212.342 175.475C211.325 175.475 210.448 175.64 209.736 175.971C209.024 176.301 208.439 176.753 207.994 177.312C207.549 177.865 207.232 178.507 207.035 179.213C206.838 179.918 206.742 180.649 206.742 181.399C206.742 182.194 206.863 182.918 207.092 183.554C207.327 184.196 207.664 184.743 208.09 185.188C208.516 185.633 209.043 185.982 209.653 186.224C210.264 186.465 210.95 186.586 211.7 186.586H214.364C214.211 187.52 213.83 188.22 213.238 188.665C212.628 189.129 211.726 189.364 210.562 189.364C210.257 189.364 209.971 189.332 209.711 189.275C209.45 189.218 209.17 189.129 208.878 189.014L208.764 188.97V191.538L208.814 191.557C208.98 191.62 209.17 191.678 209.38 191.735C209.558 191.779 209.781 191.817 210.035 191.849C210.289 191.881 210.575 191.894 210.893 191.894C212.851 191.894 214.395 191.436 215.489 190.54C216.569 189.65 217.281 188.321 217.599 186.592H223.739C223.981 186.592 224.26 186.567 224.572 186.522C224.883 186.478 225.22 186.395 225.557 186.275C225.894 186.154 226.237 185.995 226.574 185.798C226.886 185.62 227.178 185.385 227.432 185.099C227.572 185.27 227.737 185.436 227.928 185.601C228.144 185.791 228.386 185.957 228.64 186.103C228.901 186.249 229.174 186.364 229.46 186.453C229.752 186.542 230.045 186.592 230.191 186.592H251.447C252.191 186.592 252.769 186.44 253.297 186.135C253.786 185.855 254.161 185.512 254.415 185.118C254.936 185.836 255.617 186.37 256.449 186.72C257.314 187.075 258.299 187.26 259.373 187.26C260.448 187.26 261.433 187.075 262.297 186.72C263.13 186.376 263.816 185.836 264.331 185.118C264.592 185.512 264.967 185.855 265.45 186.135C265.978 186.44 266.556 186.592 267.16 186.592H273.993V170.485H270.669V183.796V183.789ZM214.611 183.789H212.336C211.872 183.789 211.484 183.738 211.192 183.637C210.906 183.541 210.67 183.389 210.505 183.185C210.334 182.982 210.219 182.728 210.156 182.429C210.092 182.124 210.06 181.762 210.06 181.355C210.06 180.948 210.098 180.535 210.181 180.147C210.257 179.759 210.391 179.403 210.569 179.105C210.747 178.806 210.982 178.564 211.268 178.386C211.548 178.208 211.91 178.119 212.336 178.119C212.762 178.119 213.149 178.215 213.442 178.399C213.734 178.583 213.963 178.85 214.135 179.194C214.306 179.543 214.433 179.975 214.503 180.484C214.58 180.999 214.611 181.584 214.611 182.232V183.802V183.789ZM242.986 183.128C242.573 183.656 241.944 183.923 241.111 183.923C240.279 183.923 239.649 183.656 239.236 183.128C238.817 182.594 238.607 181.895 238.607 181.037C238.607 180.63 238.664 180.242 238.772 179.893C238.88 179.537 239.039 179.225 239.249 178.958C239.452 178.698 239.713 178.488 240.024 178.335C240.329 178.183 240.698 178.107 241.111 178.107C241.524 178.107 241.893 178.183 242.198 178.335C242.503 178.488 242.764 178.698 242.974 178.958C243.183 179.225 243.342 179.537 243.45 179.893C243.558 180.249 243.616 180.63 243.616 181.037C243.616 181.889 243.406 182.594 242.986 183.128ZM261.706 182.855C261.598 183.211 261.439 183.516 261.229 183.777C261.026 184.031 260.765 184.241 260.454 184.387C260.149 184.539 259.78 184.616 259.367 184.616C258.954 184.616 258.585 184.539 258.28 184.387C257.975 184.234 257.714 184.031 257.505 183.77C257.295 183.516 257.136 183.204 257.028 182.848C256.92 182.493 256.863 182.105 256.863 181.704C256.863 181.304 256.92 180.916 257.028 180.56C257.136 180.204 257.295 179.893 257.505 179.626C257.714 179.359 257.969 179.149 258.28 179.003C258.585 178.85 258.954 178.774 259.367 178.774C259.78 178.774 260.149 178.85 260.454 179.003C260.759 179.155 261.02 179.365 261.229 179.626C261.439 179.893 261.598 180.204 261.706 180.56C261.814 180.916 261.871 181.304 261.871 181.704C261.871 182.105 261.814 182.499 261.706 182.848V182.855ZM62.172 170.479H65.4837V186.599H62.2674L55.6504 177.693C55.4914 177.477 55.3326 177.229 55.1546 176.962C54.983 176.695 54.8558 176.492 54.7795 176.352H54.6651V186.599H51.3534V170.479H54.5698L61.0469 179.174C61.1423 179.283 61.2567 179.435 61.3965 179.632C61.5364 179.829 61.6699 180.02 61.797 180.211C61.9241 180.401 62.0068 180.547 62.0576 180.656H62.172V170.479ZM308.241 176.924H311.566V186.586H304.021C303.792 186.586 303.544 186.548 303.283 186.472C303.023 186.395 302.775 186.281 302.546 186.128C302.317 185.976 302.114 185.791 301.942 185.588C301.809 185.429 301.713 185.258 301.65 185.073C301.523 186.135 301.3 187.088 300.976 187.908C300.633 188.785 300.15 189.529 299.539 190.114C298.929 190.699 298.16 191.15 297.245 191.449C296.336 191.747 295.242 191.9 293.99 191.9C292.484 191.9 291.244 191.665 290.304 191.201C289.356 190.737 288.606 190.069 288.079 189.23C287.551 188.391 287.183 187.374 286.986 186.211C286.795 185.054 286.693 183.751 286.693 182.34V182.257H289.706V182.34C289.706 183.668 289.789 184.781 289.96 185.645C290.126 186.51 290.393 187.209 290.736 187.724C291.079 188.232 291.53 188.601 292.064 188.811C292.611 189.021 293.278 189.129 294.048 189.129C294.817 189.129 295.471 189.021 296.024 188.811C296.571 188.601 297.022 188.239 297.366 187.724C297.715 187.209 297.976 186.51 298.141 185.645C298.313 184.781 298.395 183.662 298.395 182.34V170.485H301.72V181.825C301.72 182.194 301.79 182.512 301.923 182.753C302.057 183.001 302.235 183.198 302.451 183.351C302.673 183.503 302.921 183.611 303.194 183.688C303.468 183.757 303.741 183.796 303.995 183.796H308.216V176.931L308.241 176.924ZM367.547 183.789H363.618C363.409 183.789 363.186 183.751 362.97 183.668C362.754 183.592 362.557 183.465 362.385 183.3C362.214 183.128 362.074 182.912 361.972 182.645C361.864 182.384 361.813 182.06 361.813 181.685V170.479H358.489V182.137C358.489 182.467 358.438 182.74 358.343 182.95C358.247 183.16 358.12 183.332 357.974 183.459C357.828 183.586 357.669 183.675 357.504 183.719C357.332 183.77 357.179 183.796 357.04 183.796H354.63C354.421 183.796 354.198 183.757 353.976 183.675C353.76 183.599 353.563 183.471 353.391 183.306C353.219 183.135 353.079 182.918 352.978 182.651C352.87 182.391 352.819 182.067 352.819 181.692V176.924H349.494V182.137C349.494 182.467 349.444 182.74 349.348 182.95C349.253 183.16 349.126 183.332 348.98 183.459C348.833 183.586 348.674 183.675 348.509 183.719C348.338 183.77 348.185 183.796 348.045 183.796H344.632C344.384 183.796 344.142 183.77 343.901 183.719C343.666 183.668 343.456 183.586 343.272 183.471C343.087 183.357 342.935 183.211 342.82 183.026C342.706 182.848 342.642 182.62 342.642 182.359V181.736C342.642 180.808 342.483 179.982 342.178 179.283C341.873 178.583 341.441 177.999 340.907 177.535C340.373 177.077 339.737 176.727 339.019 176.492C338.301 176.263 337.513 176.142 336.68 176.142C335.847 176.142 335.059 176.263 334.341 176.492C333.623 176.727 332.987 177.077 332.453 177.535C331.919 177.992 331.493 178.583 331.182 179.283C330.876 179.982 330.718 180.808 330.718 181.736V182.359C330.718 182.626 330.66 182.848 330.54 183.026C330.419 183.211 330.266 183.357 330.088 183.471C329.904 183.586 329.688 183.668 329.446 183.719C329.198 183.77 328.957 183.796 328.728 183.796H324.787C324.8 183.579 324.806 183.357 324.819 183.122C324.825 182.874 324.832 182.601 324.832 182.315C324.832 181.259 324.736 180.3 324.539 179.467C324.342 178.628 324.024 177.903 323.579 177.318C323.134 176.727 322.55 176.27 321.844 175.952C321.139 175.634 320.268 175.475 319.251 175.475C318.234 175.475 317.356 175.64 316.645 175.971C315.933 176.301 315.341 176.753 314.903 177.312C314.458 177.865 314.14 178.507 313.943 179.213C313.746 179.918 313.651 180.649 313.651 181.399C313.651 182.194 313.771 182.918 314 183.554C314.235 184.196 314.572 184.743 314.998 185.188C315.424 185.633 315.952 185.982 316.562 186.224C317.172 186.465 317.859 186.586 318.609 186.586H321.272C321.119 187.52 320.738 188.22 320.147 188.665C319.537 189.129 318.634 189.364 317.471 189.364C317.166 189.364 316.88 189.332 316.619 189.275C316.359 189.218 316.079 189.129 315.786 189.014L315.672 188.97V191.538L315.723 191.557C315.888 191.62 316.079 191.678 316.289 191.735C316.467 191.779 316.689 191.817 316.943 191.849C317.197 191.881 317.484 191.894 317.801 191.894C319.759 191.894 321.304 191.436 322.397 190.54C323.478 189.65 324.19 188.321 324.507 186.592H328.893C329.497 186.592 330.076 186.44 330.603 186.135C331.093 185.855 331.468 185.512 331.722 185.118C332.243 185.836 332.923 186.37 333.756 186.72C334.62 187.075 335.606 187.26 336.68 187.26C337.754 187.26 338.739 187.075 339.604 186.72C340.437 186.376 341.123 185.836 341.638 185.118C341.899 185.512 342.274 185.855 342.757 186.135C343.284 186.44 343.863 186.592 344.467 186.592H348.032C348.274 186.592 348.554 186.567 348.865 186.522C349.177 186.478 349.513 186.395 349.85 186.275C350.187 186.154 350.531 185.995 350.867 185.798C351.179 185.62 351.471 185.385 351.726 185.099C351.865 185.27 352.031 185.442 352.221 185.601C352.437 185.791 352.679 185.957 352.94 186.103C353.2 186.249 353.474 186.364 353.753 186.453C354.046 186.542 354.338 186.592 354.624 186.592H357.033C357.275 186.592 357.554 186.567 357.866 186.522C358.184 186.478 358.514 186.395 358.851 186.275C359.188 186.154 359.531 185.995 359.868 185.798C360.18 185.62 360.472 185.385 360.726 185.099C360.866 185.27 361.031 185.436 361.222 185.601C361.438 185.791 361.68 185.957 361.934 186.103C362.195 186.249 362.468 186.364 362.754 186.453C363.04 186.542 363.339 186.592 363.625 186.592H370.877V170.485H367.553V183.796L367.547 183.789ZM321.514 183.789H319.238C318.774 183.789 318.386 183.738 318.094 183.637C317.808 183.541 317.573 183.389 317.407 183.185C317.236 182.982 317.121 182.728 317.058 182.429C316.994 182.124 316.962 181.762 316.962 181.355C316.962 180.948 317 180.541 317.083 180.147C317.159 179.759 317.293 179.403 317.471 179.105C317.649 178.806 317.884 178.564 318.17 178.386C318.45 178.208 318.812 178.119 319.238 178.119C319.664 178.119 320.052 178.215 320.344 178.399C320.636 178.583 320.865 178.85 321.037 179.194C321.208 179.543 321.336 179.975 321.405 180.484C321.482 180.999 321.514 181.584 321.514 182.232V183.802V183.789ZM339.006 182.855C338.898 183.211 338.739 183.516 338.53 183.777C338.326 184.031 338.066 184.241 337.754 184.387C337.449 184.539 337.08 184.616 336.667 184.616C336.254 184.616 335.885 184.539 335.58 184.387C335.275 184.234 335.015 184.031 334.805 183.77C334.595 183.516 334.436 183.204 334.328 182.848C334.22 182.493 334.163 182.105 334.163 181.704C334.163 181.304 334.22 180.916 334.328 180.56C334.436 180.204 334.595 179.893 334.805 179.626C335.015 179.359 335.269 179.149 335.58 179.003C335.885 178.85 336.254 178.774 336.667 178.774C337.08 178.774 337.449 178.85 337.754 179.003C338.059 179.155 338.32 179.365 338.53 179.626C338.739 179.893 338.898 180.204 339.006 180.56C339.114 180.916 339.172 181.304 339.172 181.704C339.172 182.105 339.114 182.499 339.006 182.848V182.855ZM304.485 188.582H307.212V191.309H304.485V188.582ZM308.286 188.582H311.013V191.309H308.286V188.582ZM204.994 186.484L205.026 186.586H196.725C196.261 186.586 195.86 186.656 195.53 186.789C195.199 186.923 194.926 187.107 194.71 187.33C194.493 187.552 194.335 187.806 194.239 188.08C194.137 188.359 194.087 188.652 194.087 188.957C194.087 189.51 194.157 189.993 194.296 190.394C194.436 190.794 194.678 191.258 195.008 191.767L195.091 191.894H191.894L191.868 191.862C191.569 191.487 191.315 191.055 191.112 190.572C190.908 190.088 190.807 189.523 190.807 188.887C190.807 188.251 190.915 187.673 191.137 187.075C191.353 186.472 191.69 185.919 192.135 185.429C192.58 184.94 193.152 184.539 193.832 184.241C194.512 183.942 195.332 183.789 196.26 183.789H201.339C201.301 183.668 201.263 183.541 201.218 183.408C201.174 183.236 201.123 183.039 201.072 182.823C201.021 182.601 200.977 182.346 200.945 182.079C200.869 181.495 200.767 180.948 200.627 180.452C200.487 179.963 200.303 179.543 200.081 179.194C199.858 178.85 199.579 178.583 199.254 178.393C198.93 178.208 198.523 178.113 198.047 178.113C197.614 178.113 197.22 178.189 196.877 178.342C196.534 178.494 196.222 178.691 195.962 178.927C195.701 179.162 195.491 179.448 195.332 179.759C195.174 180.077 195.065 180.401 195.008 180.719L194.996 180.789H191.989V180.7C192.04 179.95 192.224 179.244 192.548 178.602C192.873 177.96 193.305 177.407 193.839 176.95C194.373 176.492 195.002 176.13 195.714 175.863C196.426 175.602 197.208 175.469 198.047 175.469C199.14 175.469 200.062 175.647 200.799 175.99C201.536 176.333 202.146 176.823 202.623 177.433C203.094 178.043 203.462 178.768 203.717 179.588C203.971 180.408 204.155 181.304 204.276 182.257C204.371 183.026 204.46 183.681 204.524 184.152C204.581 184.59 204.638 184.946 204.689 185.194C204.74 185.442 204.791 185.652 204.835 185.823C204.886 186.008 204.943 186.23 205.013 186.478L204.994 186.484ZM73.6453 170.479H85.5191V173.346H77.1414V177.344H84.6292V180.185H77.1414V186.599H73.6453V170.479ZM88.246 170.479H91.7421V186.599H88.246V170.479ZM66.4181 60.7927C63.3988 72.5139 56.9852 83.5804 34.5217 83.5804C7.20181 83.5804 0.52123 66.5135 0.52123 49.0016V40.859H13.0497V45.3911C13.0497 60.6211 16.1707 72.3931 34.3945 72.3931C45.0224 72.3931 54.4744 65.9668 54.4744 51.2454V19.4379H66.9965V45.6708C66.9965 46.8976 67.9882 47.8892 69.2086 47.8892H80.2179V19.4379H92.7464V47.8892H103.66C104.881 47.8892 105.872 46.8976 105.872 45.6708V19.4379H118.401V43.7257C118.401 55.2626 111.059 61.4283 102.001 61.4283C93.9605 61.4283 88.691 57.0806 86.6951 50.9593H86.3264C85.017 55.5423 80.9171 59.4006 75.298 60.8563C72.2025 61.6572 69.1196 61.5936 66.4118 60.7927H66.4181ZM106.127 170.479H109.438V186.599H106.222L99.6049 177.693C99.446 177.477 99.2871 177.229 99.1091 176.962C98.9375 176.695 98.8104 176.492 98.7341 176.352H98.6197V186.599H95.308V170.479H98.5243L105.002 179.174C105.097 179.283 105.211 179.435 105.351 179.632C105.491 179.829 105.624 180.02 105.752 180.211C105.879 180.401 105.961 180.547 106.012 180.656H106.127V170.479ZM168.413 183.713H177.897V186.605H164.898V170.485H177.757V173.352H168.419V176.95H176.683V179.791H168.419V183.713H168.413ZM150.577 178.164V178.895C150.577 180.02 150.736 180.967 151.047 181.73C151.359 182.493 151.836 183.065 152.465 183.446C153.1 183.827 153.914 184.024 154.918 184.024C155.7 184.024 156.38 183.891 156.959 183.624C157.537 183.357 157.982 182.963 158.294 182.448C158.605 181.933 158.764 181.298 158.764 180.547H162.146C162.146 181.971 161.834 183.154 161.218 184.094C160.601 185.035 159.743 185.734 158.65 186.198C157.556 186.662 156.304 186.891 154.893 186.891C153.221 186.891 151.785 186.599 150.596 186.008C149.407 185.423 148.505 184.507 147.888 183.268C147.272 182.028 146.96 180.458 146.96 178.545C146.96 175.723 147.653 173.632 149.039 172.259C150.424 170.886 152.376 170.206 154.893 170.206C156.272 170.206 157.505 170.441 158.599 170.911C159.692 171.382 160.557 172.087 161.192 173.028C161.828 173.969 162.139 175.151 162.139 176.575H158.618C158.618 175.825 158.465 175.189 158.16 174.668C157.855 174.153 157.423 173.752 156.87 173.479C156.317 173.206 155.668 173.066 154.931 173.066C153.927 173.066 153.107 173.263 152.452 173.651C151.804 174.045 151.327 174.617 151.022 175.38C150.717 176.142 150.564 177.07 150.564 178.164H150.577ZM140.814 170.479H144.125V186.599H140.909L134.292 177.693C134.133 177.477 133.974 177.229 133.796 176.962C133.624 176.695 133.497 176.492 133.421 176.352H133.307V186.599H129.995V170.479H133.211L139.688 179.174C139.784 179.283 139.898 179.435 140.038 179.632C140.178 179.829 140.311 180.02 140.439 180.211C140.566 180.401 140.648 180.547 140.699 180.656H140.814V170.479ZM117.555 170.479L111.358 186.599H114.975L116.125 183.427H123.143L124.293 186.599H128.069L121.871 170.479H117.555ZM117.136 180.611L118.566 176.638C118.642 176.403 118.744 176.104 118.871 175.736C118.998 175.367 119.119 174.986 119.246 174.585C119.373 174.185 119.475 173.835 119.551 173.543H119.691C119.767 173.778 119.85 174.038 119.939 174.331C120.028 174.623 120.117 174.916 120.212 175.214C120.308 175.513 120.397 175.78 120.486 176.022C120.568 176.263 120.645 176.473 120.708 176.645L122.138 180.617H117.142L117.136 180.611Z"
                        fill="#1B194F" />
                    <path d="M164.955 117.25H80.4404V130.414H164.955V117.25Z" fill="url(#paint0_linear_2688_10865)" />
                    <path d="M301.014 47.8893H216.499V61.0534H301.014V47.8893Z" fill="url(#paint1_linear_2688_10865)" />
                    <defs>
                        <linearGradient id="paint0_linear_2688_10865" x1="80.4404" y1="123.829" x2="164.949" y2="123.829"
                            gradientUnits="userSpaceOnUse">
                            <stop stop-color="#1B194F" />
                            <stop offset="0.5" stop-color="#5CE8C2" />
                            <stop offset="0.99" stop-color="#1B194F" />
                        </linearGradient>
                        <linearGradient id="paint1_linear_2688_10865" x1="216.499" y1="54.4682" x2="301.014" y2="54.4682"
                            gradientUnits="userSpaceOnUse">
                            <stop stop-color="#1B194F" />
                            <stop offset="0.5" stop-color="#5CE8C2" />
                            <stop offset="0.99" stop-color="#1B194F" />
                        </linearGradient>
                    </defs>
                </svg>
    
            </div>
        </div>
    </div>
                `
    }

    async footer_template() {
        return `<div style="width: 100%; text-align: center; padding-top: 20px;">
<svg width="800" height="110" xmlns="http://www.w3.org/2000/svg">
<!-- Gradient definition -->
<defs>
<linearGradient id="bottomGradient" x1="0%" y1="0%" x2="100%" y2="0%">
<stop offset="0%" stop-color="#1b194f" />
<stop offset="100%" stop-color="#4ab0a3" />
</linearGradient>
</defs>
 
    <!-- Line separator -->
<!-- <line x1="10" y1="17" x2="700" y2="10" stroke="#eee" stroke-width="1" /> -->
 
    <!-- English text - left side -->
<text x="50" y="40" fill="#1b194f" style="font-size: 12px; font-family: Arial, sans-serif;">
      Nebras Open Finance LLC
</text>
<text x="50" y="60" fill="#1b194f" style="font-size: 12px; font-family: Arial, sans-serif;">
      11th Floor, EIF Building, Sultan Bin Zayed The First St
</text>
<text x="50" y="80" fill="#1b194f" style="font-size: 12px; font-family: Arial, sans-serif;">
      Al Nahyan, Abu Dhabi, United Arab Emirates
</text>
 
    <!-- Arabic text - right side -->
<text x="770" y="40" fill="#1b194f" text-anchor="end" style="font-size: 12px; font-family: Arial, sans-serif;">
      نبراس للتمويل المفتوح ذ.م.م
</text>
<text x="770" y="60" fill="#1b194f" text-anchor="end" style="font-size: 12px; font-family: Arial, sans-serif;">
      الطابق 11، بناء صندوق الإمارات للاستثمار، شارع سلطان بن زايد الأول
</text>
<text x="770" y="80" fill="#1b194f" text-anchor="end" style="font-size: 12px; font-family: Arial, sans-serif;">
      آل نهيان، أبوظبي، الإمارات العربية المتحدة
</text>
 
    <!-- Bottom bar with gradient -->
<rect x="50" y="100" width="720" height="15" fill="url(#bottomGradient)" />
</svg>
</div>`
    }
    async footer_template_old() {
        return `
                <style>
                    .footer {
                        margin:0 auto;
                        margin-top: 40px;
                        padding-top: 20px;
                        border-top: 1px solid #eee;
                        display: flex;
                        justify-content: space-between;
                        font-size: 12px;
                        width: 80%;
                    }

                    .footer-block {
                        width: 48%;
                        color: #1b194f;
                    }

                    .footer-right {
                        text-align: right;
                        direction: rtl;
                        font-family: 'Tahoma','Arial', 'Segoe UI', sans-serif;
                    }

                    .bottom-bar {
                        height: 30px;
                        background: blue;

                    }
                </style>


                <div class="footer">
                    <div class="footer-block">
                        Nebras Open Finance LLC<br>
                        11th Floor, EIF Building, Sultan Bin Zayed The First St<br>
                        Al Nahyan, Abu Dhabi, United Arab Emirates
                    </div>
                    <div class="footer-block footer-right">
                        نبراس للتمويل المفتوح ذ.م.م<br>
                        الطابق 11، بناء صندوق الإمارات للاستثمار، شارع سلطان بن زايد الأول<br>
                        آل نهيان، أبوظبي، الإمارات العربية المتحدة
                    </div>
                </div>

                <div class="bottom-bar"></div>
            `
    }

    async lfi_invoiceTemplate(data: any): Promise<any> {

        let revenue_data = '';
        let total_vat = data?.tpp.reduce((sum, item) => sum + item.vat, 0);
        let grand_total = data?.tpp.reduce((sum, item) => sum + item.full_total, 0);

        for (const tpp_data of data.tpp || []) {
            revenue_data += `<tr class="tpp-name">
                <td rowspan="${(tpp_data.collection_memo_subitem?.length || 0) + 2}">
                ${tpp_data.tpp_id}  (${tpp_data.tpp_name})
                </td>
            </tr>`;

            for (const item of tpp_data.collection_memo_subitem || []) {
                revenue_data += `
                <tr>
                    <td>${item.label} ${item?.capped === true ? '**' : ''}</td>
                    <td>${item.quantity}</td>
                    <td>${item.unit_price}</td>
                    <td>${item.total}</td>
                </tr>`;
            }

            revenue_data += `
                <tr class="sub-total">
                <td colspan="3">Sub Total</td>
                <td class="table-total">${tpp_data?.full_total}</td>
                </tr>`;
        }

        return `
        <!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LFI Statement of Revenue</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            color: #333;
        }

        .container {
            margin: 0 auto;
            padding: 30px;
            background-color: #fff;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: start;
        }

        .header h1 {
            font-size: 22px;
            margin: 0;
            color: #000046;
        }

        .logo img {
            height: 80px;
        }

        .section {
            /* margin-top: 30px; */
        }

        .section h2 {
            font-size: 18px;
            font-weight: bold;
            color: #1b194f;
        }

        .section p {
            margin: 4px 0;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            /* font-size: 14px; */
        }

        th,
        td {
            border: 1px solid #000046;
            padding: 8px;
            text-align: left;
        }

        th {
            color: #000046;
            font-weight: bold;
            border: 1px solid #000000;
        }

        thead {
            background-color: #c2c1eb !important;
        }


        .sub-total,
        .vat {
            font-weight: bold;
        }

        .section-title {
            background-color: #f2f2f2;
            font-weight: bold;
        }

    
        .rtl {
            direction: rtl;
            text-align: right;
            font-size: 12px;
            color: #444;
        }
        .lif-details{
            color: #1b194f;
    font-weight: 600;
        }
        .date{
            font-weight: 600;  
            color: #1b194f;

        }

        @media print {
           

            thead {
                background-color: #c2c1eb !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }

      
        }

    </style>
</head>

<body>
    <div class="container">
        <div class="header">
            <div>
                <h1>LFI STATEMENT OF REVENUE</h1>
                <p style="color: #1b194f;"><strong>Revenue Statement #001</strong><br><strong>${moment(data.createdAt).format('DD MMMM YYYY')}</strong> </p>
                <p class="lif-details"><br>${data.lfi_id}<br>Address1</p>
                <p class="lif-details">Invoice Currency : AED</p>
            </div>

        </div>

        <div class="section">
            <h2>Revenue Summary:</h2>
            <p class="date">Billing Period: ${moment(data.billing_period_start).format('D MMMM YYYY')} to ${moment(data.billing_period_end).format('Do MMMM YYYY')}</p>
        </div>

        <table>
            <thead>
                <tr>
                    <th>TPP NAME</th>
                    <th>Charge Type</th>
                    <th>Vol</th>
                    <th>Unit Price</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                ${revenue_data}
                <tr class="sub-total">
                    <td class="" colspan="4">Grand Total</td>
                    <td class="table-total">${grand_total}</td>
                </tr>
            </tbody>
        </table>


    </div>
</body>

</html>
        `
    }
}


//CappedCode
// [
//     {
//       '$match': {
//         'raw_api_log_data.tpp_id': '876789',
//         'lfiChargable': true,
//         'success': true,
//         '$expr': {
//           '$and': [
//             {
//               '$eq': [
//                 {
//                   '$month': '$raw_api_log_data.timestamp'
//                 }, 4
//               ]
//             }, {
//               '$eq': [
//                 {
//                   '$year': '$raw_api_log_data.timestamp'
//                 }, 2025
//               ]
//             }
//           ]
//         }
//       }
//     }, {
//       '$addFields': {
//         'label': {
//           '$switch': {
//             'branches': [
//               {
//                 'case': {
//                   '$and': [
//                     {
//                       '$in': [
//                         '$group', [
//                           'payment-bulk', 'payment-non-bulk'
//                         ]
//                       ]
//                     }, {
//                       '$eq': [
//                         '$type', 'merchant'
//                       ]
//                     }, {
//                       '$eq': [
//                         '$isCapped', false
//                       ]
//                     }, {
//                       '$ne': [
//                         '$raw_api_log_data.payment_type', 'LargeValueCollection'
//                       ]
//                     }
//                   ]
//                 },
//                 'then': 'Merchant Collection'
//               }, {
//                 'case': {
//                   '$and': [
//                     {
//                       '$in': [
//                         '$group', [
//                           'payment-bulk', 'payment-non-bulk'
//                         ]
//                       ]
//                     }, {
//                       '$eq': [
//                         '$type', 'merchant'
//                       ]
//                     }, {
//                       '$eq': [
//                         '$isCapped', true
//                       ]
//                     }, {
//                       '$ne': [
//                         '$raw_api_log_data.payment_type', 'LargeValueCollection'
//                       ]
//                     }
//                   ]
//                 },
//                 'then': 'Merchant Collection (Capped)'
//               }, {
//                 'case': {
//                   '$and': [
//                     {
//                       '$in': [
//                         '$group', [
//                           'payment-bulk', 'payment-non-bulk'
//                         ]
//                       ]
//                     }, {
//                       '$eq': [
//                         '$type', 'peer-2-peer'
//                       ]
//                     }, {
//                       '$eq': [
//                         '$isCapped', false
//                       ]
//                     }, {
//                       '$ne': [
//                         '$raw_api_log_data.payment_type', 'LargeValueCollection'
//                       ]
//                     }
//                   ]
//                 },
//                 'then': 'Peer-to-Peer'
//               }, {
//                 'case': {
//                   '$and': [
//                     {
//                       '$in': [
//                         '$group', [
//                           'payment-bulk', 'payment-non-bulk'
//                         ]
//                       ]
//                     }, {
//                       '$eq': [
//                         '$type', 'peer-2-peer'
//                       ]
//                     }, {
//                       '$eq': [
//                         '$isCapped', true
//                       ]
//                     }, {
//                       '$ne': [
//                         '$raw_api_log_data.payment_type', 'LargeValueCollection'
//                       ]
//                     }
//                   ]
//                 },
//                 'then': 'Peer-to-Peer (Capped)'
//               }, {
//                 'case': {
//                   '$and': [
//                     {
//                       '$in': [
//                         '$group', [
//                           'payment-bulk', 'payment-non-bulk'
//                         ]
//                       ]
//                     }, {
//                       '$eq': [
//                         '$type', 'me-2-me'
//                       ]
//                     }, {
//                       '$eq': [
//                         '$isCapped', false
//                       ]
//                     }, {
//                       '$ne': [
//                         '$raw_api_log_data.payment_type', 'LargeValueCollection'
//                       ]
//                     }
//                   ]
//                 },
//                 'then': 'Me-to-Me Transfer'
//               }, {
//                 'case': {
//                   '$and': [
//                     {
//                       '$in': [
//                         '$group', [
//                           'payment-bulk', 'payment-non-bulk'
//                         ]
//                       ]
//                     }, {
//                       '$eq': [
//                         '$type', 'me-2-me'
//                       ]
//                     }, {
//                       '$eq': [
//                         '$isCapped', true
//                       ]
//                     }, {
//                       '$ne': [
//                         '$raw_api_log_data.payment_type', 'LargeValueCollection'
//                       ]
//                     }
//                   ]
//                 },
//                 'then': 'Me-to-Me Transfer (Capped)'
//               }, {
//                 'case': {
//                   '$and': [
//                     {
//                       '$in': [
//                         '$group', [
//                           'payment-bulk', 'payment-non-bulk'
//                         ]
//                       ]
//                     }, {
//                       '$eq': [
//                         '$raw_api_log_data.payment_type', 'LargeValueCollection'
//                       ]
//                     }
//                   ]
//                 },
//                 'then': 'Large Value Collections'
//               }, {
//                 'case': {
//                   '$and': [
//                     {
//                       '$eq': [
//                         '$group', 'payment-bulk'
//                       ]
//                     }, {
//                       '$eq': [
//                         '$type', 'corporate'
//                       ]
//                     }
//                   ]
//                 },
//                 'then': 'Corporate Payments'
//               }, {
//                 'case': {
//                   '$and': [
//                     {
//                       '$eq': [
//                         '$group', 'data'
//                       ]
//                     }, {
//                       '$eq': [
//                         '$type', 'corporate'
//                       ]
//                     }
//                   ]
//                 },
//                 'then': 'Corporate Treasury Data'
//               }, {
//                 'case': {
//                   '$eq': [
//                     '$group', 'data'
//                   ]
//                 },
//                 'then': 'Customer Data'
//               }
//             ],
//             'default': 'Others'
//           }
//         }
//       }
//     }, {
//       '$addFields': {
//         'computedUnitPrice': {
//           '$cond': {
//             'if': {
//               '$eq': [
//                 '$isCapped', true
//               ]
//             },
//             'then': '$cappedAt',
//             'else': '$unit_price'
//           }
//         },
//         'computedVolume': {
//           '$cond': {
//             'if': {
//               '$eq': [
//                 '$isCapped', true
//               ]
//             },
//             'then': 1,
//             'else': '$volume'
//           }
//         }
//       }
//     }, {
//       '$group': {
//         '_id': {
//           'lfi_id': '$raw_api_log_data.lfi_id',
//           'label': '$label',
//           'isCapped': '$isCapped'
//         },
//         'quantity': {
//           '$sum': '$computedVolume'
//         },
//         'unit_price': {
//           '$first': '$computedUnitPrice'
//         },
//         'total': {
//           '$sum': '$applicableFee'
//         }
//       }
//     }, {
//       '$group': {
//         '_id': '$_id.lfi_id',
//         'labels': {
//           '$push': {
//             'label': '$_id.label',
//             'quantity': '$quantity',
//             'unit_price': {
//               '$round': [
//                 '$unit_price', 4
//               ]
//             },
//             'total': {
//               '$round': [
//                 '$total', 3
//               ]
//             }
//           }
//         }
//       }
//     }, {
//       '$addFields': {
//         'labels': {
//           '$map': {
//             'input': [
//               'Merchant Collection', 'Merchant Collection (Capped)', 'Peer-to-Peer', 'Peer-to-Peer (Capped)', 'Me-to-Me Transfer', 'Me-to-Me Transfer (Capped)', 'Large value collection', 'Corporate Payments', 'Corporate Treasury Data', 'Customer Data'
//             ],
//             'as': 'expectedLabel',
//             'in': {
//               '$let': {
//                 'vars': {
//                   'matched': {
//                     '$first': {
//                       '$filter': {
//                         'input': '$labels',
//                         'as': 'existing',
//                         'cond': {
//                           '$eq': [
//                             '$$existing.label', '$$expectedLabel'
//                           ]
//                         }
//                       }
//                     }
//                   }
//                 },
//                 'in': {
//                   '$cond': {
//                     'if': '$$matched',
//                     'then': '$$matched',
//                     'else': {
//                       'label': '$$expectedLabel',
//                       'quantity': 0,
//                       'unit_price': 0,
//                       'total': 0
//                     }
//                   }
//                 }
//               }
//             }
//           }
//         }
//       }
//     }, {
//       '$addFields': {
//         'labels': {
//           '$map': {
//             'input': '$labels',
//             'as': 'item',
//             'in': {
//               '$mergeObjects': [
//                 '$$item', {
//                   'vat_amount': {
//                     '$round': [
//                       {
//                         '$multiply': [
//                           '$$item.total', 0.05
//                         ]
//                       }, 3
//                     ]
//                   },
//                   'full_total': {
//                     '$round': [
//                       {
//                         '$add': [
//                           '$$item.total', {
//                             '$multiply': [
//                               '$$item.total', 0.05
//                             ]
//                           }
//                         ]
//                       }, 3
//                     ]
//                   }
//                 }
//               ]
//             }
//           }
//         }
//       }
//     }, {
//       '$addFields': {
//         'full_total': {
//           '$round': [
//             {
//               '$sum': '$labels.total'
//             }, 3
//           ]
//         },
//         'vat': {
//           '$round': [
//             {
//               '$multiply': [
//                 {
//                   '$sum': '$labels.total'
//                 }, 0.05
//               ]
//             }, 3
//           ]
//         },
//         'actual_total': {
//           '$round': [
//             {
//               '$add': [
//                 {
//                   '$sum': '$labels.total'
//                 }, {
//                   '$multiply': [
//                     {
//                       '$sum': '$labels.total'
//                     }, 0.05
//                   ]
//                 }
//               ]
//             }, 3
//           ]
//         }
//       }
//     }
//   ]