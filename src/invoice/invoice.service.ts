import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as fs from "fs";
// import * as moment from 'moment';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Model, Types } from 'mongoose';
import { PaginationEnum, } from 'src/common/constants/constants.enum';
import { PaginationDTO } from 'src/common/dto/common.dto';
import { collection_memo_config, invoice_config } from 'src/config/app.config';
import { GlobalConfiguration, GlobalConfigurationDocument } from 'src/configuration/schema/global_config.schema';
import { MailService } from 'src/mail/mail.service';
import { UpdateInvoiceValueDto } from './dto/invoice.dto';
const puppeteer = require('puppeteer')
const moment = require('moment-timezone');
const { Parser } = require('json2csv');

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
        @InjectQueue('invoice') private invoiceQueue: Queue,
    ) { }

    async findAllInvoices(PaginationDTO: PaginationDTO): Promise<any> {
        const offset = PaginationDTO.offset
            ? Number(PaginationDTO.offset)
            : PaginationEnum.OFFSET;
        const limit = PaginationDTO.limit
            ? Number(PaginationDTO.limit)
            : PaginationEnum.LIMIT;

        const options: any = {};
        const status =
            PaginationDTO.invoice_status != null && Number(PaginationDTO.invoice_status) != 0
                ? Number(PaginationDTO.invoice_status)
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
        console.log(options)
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
            throw new NotFoundException('Invalid month (1-12)');

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
        const paymentApiHubFee = globalConfiData.find(item => item.key === "paymentApiHubFee")?.value ?? 0;
        const insuranceQuoteApiHubFee = globalConfiData.find(item => item.key === "insuranceQuoteApiHubFee")?.value ?? 0;
        const insuranceDataApiHubFee = globalConfiData.find(item => item.key === "insuranceDataApiHubFee")?.value ?? 0;
        const discountApiHubFee = globalConfiData.find(item => item.key === "discountApiHubFee")?.value ?? 0;
        let nonLargeValueMerchantBps = globalConfiData.find(item => item.key === "nonLargeValueMerchantBps")?.value ?? 0;
        const paymentLargeValueFeePeer = globalConfiData.find(item => item.key === "paymentNonLargevalueFeePeer")?.value ?? 0;
        const paymentFeeMe2me = globalConfiData.find(item => item.key === "paymentFeeMe2me")?.value ?? 0;
        const paymentLargeValueFee = globalConfiData.find(item => item.key === "paymentLargeValueFee")?.value ?? 0;
        const bulkLargeCorporatefee = globalConfiData.find(item => item.key === "bulkLargeCorporatefee")?.value ?? 0;
        const dataLargeCorporateMdp = globalConfiData.find(item => item.key === "dataLargeCorporateMdp")?.value ?? 0;
        const dataServiceFeePercentage = globalConfiData.find(item => item.key === "serviceFeePercentage")?.value ?? 0;
        const nonLargeValueCapMerchant = globalConfiData.find(item => item.key === "nonLargeValueCapMerchant")?.value ?? 0;

        const vatPercent = vat?.value ?? 5;
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
                            "raw_api_log_data.tpp_id":
                                tpp?.tpp_id,
                            chargeable: true,
                            success: true,
                            duplicate: false,
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
                                                $and: [
                                                    {
                                                        $eq: [
                                                            "$group",
                                                            "payment-bulk"
                                                        ]
                                                    },
                                                    {
                                                        $eq: [
                                                            "$successfullQuote",
                                                            false
                                                        ]
                                                    }
                                                ]
                                            },
                                            then: "Corporate Payment" //-- paymentApiHubFee
                                        },
                                        {
                                            case: {
                                                $and: [
                                                    {
                                                        $eq: [
                                                            "$group",
                                                            "payment-data"
                                                        ]
                                                    },
                                                    {
                                                        $eq: [
                                                            "$successfullQuote",
                                                            false
                                                        ]
                                                    }
                                                ]
                                            },
                                            then: "Payment Data" //-- paymentApiHubFee
                                        },
                                        {
                                            case: {
                                                $and: [
                                                    {
                                                        $eq: [
                                                            "$group",
                                                            "payment-non-bulk"
                                                        ]
                                                    },
                                                    {
                                                        $eq: [
                                                            "$successfullQuote",
                                                            false
                                                        ]
                                                    }
                                                ]
                                            },
                                            then: "Payment Initiation" //--paymentApiHubFee
                                        },
                                        {
                                            case: {
                                                $and: [
                                                    {
                                                        $eq: ["$group", "insurance"]
                                                    },
                                                    {
                                                        $eq: [
                                                            "$api_category",
                                                            "Insurance Data Sharing"
                                                        ]
                                                    },
                                                    {
                                                        $eq: [
                                                            "$successfullQuote",
                                                            false
                                                        ]
                                                    }
                                                ]
                                            },
                                            then: "Insurance Data Sharing" //-- insuranceApiHubFee
                                        },
                                        {
                                            case: {
                                                $and: [
                                                    {
                                                        $eq: ["$group", "insurance"]
                                                    },
                                                    {
                                                        $eq: [
                                                            "$api_category",
                                                            "Insurance Quote Sharing"
                                                        ]
                                                    },
                                                    {
                                                        $eq: [
                                                            "$successfullQuote",
                                                            false
                                                        ]
                                                    }
                                                ]
                                            },
                                            then: "Insurance Quote Sharing" //-- insuranceApiHubFee
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
                                                            "Setup and Consent" //////
                                                        ]
                                                    },
                                                    {
                                                        $eq: [
                                                            "$successfullQuote",
                                                            false
                                                        ]
                                                    }
                                                ]
                                            },
                                            then: "Setup and Consent" //-- paymentApiHubFee
                                        },
                                        {
                                            case: {
                                                $and: [
                                                    {
                                                        $eq: ["$group", "data"]
                                                    },
                                                    {
                                                        $eq: ["$type", "corporate"]
                                                    },
                                                    {
                                                        $eq: [
                                                            "$successfullQuote",
                                                            false
                                                        ]
                                                    }
                                                ]
                                            },
                                            then: "Corporate Data" //-- paymentApiHubFee
                                        },
                                        {
                                            case: {
                                                $and: [
                                                    {
                                                        $eq: ["$group", "data"]
                                                    },
                                                    {
                                                        $eq: ["$discount_type", "cop"]
                                                    },
                                                    {
                                                        $eq: [
                                                            "$successfullQuote",
                                                            false
                                                        ]
                                                    }
                                                ]
                                            },
                                            then: "Confirmation of Payee(Discounted)" //-- discountApiHubFee
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
                                                    },
                                                    {
                                                        $eq: [
                                                            "$successfullQuote",
                                                            false
                                                        ]
                                                    }
                                                ]
                                            },
                                            then: "Balance(Discounted)" //-- discountApiHubFee
                                        },
                                        {
                                            case: {
                                                $and: [
                                                    {
                                                        $eq: ["$group", "data"]
                                                    },
                                                    {
                                                        $eq: [
                                                            "$successfullQuote",
                                                            false
                                                        ]
                                                    }
                                                ]
                                            },
                                            then: "Bank Data Sharing" //--paymentApiHubFee
                                        },
                                        {
                                            case: {
                                                $and: [
                                                    {
                                                        $eq: [
                                                            "$successfullQuote",
                                                            true
                                                        ]
                                                    },
                                                    {
                                                        $eq: [
                                                            "$api_category",
                                                            "Insurance Quote Sharing"
                                                        ]
                                                    }
                                                ]
                                            },
                                            then: "Insurance Brokerage Collection"
                                        },
                                        {
                                            case: {
                                                $and: [
                                                    {
                                                        $eq: [
                                                            "$successfullQuote",
                                                            true
                                                        ]
                                                    },
                                                    {
                                                        $eq: [
                                                            "$api_category",
                                                            "FX Quotes"
                                                        ]
                                                    }
                                                ]
                                            },
                                            then: "FX Brokerage Collection"
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
                                $switch: {
                                    branches: [
                                        {
                                            case: {
                                                $in: [
                                                    "$paymentTypeLabel",
                                                    [
                                                        "Corporate Payment",
                                                        "Payment Initiation",
                                                        "Payment Data"
                                                    ]
                                                ]
                                            },
                                            then: "service_initiation"
                                        },
                                        {
                                            case: {
                                                $in: [
                                                    "$paymentTypeLabel",
                                                    [
                                                        "Insurance Brokerage Collection",
                                                        "FX Brokerage Collection"
                                                    ]
                                                ]
                                            },
                                            then: "service_fee"
                                        }
                                    ],
                                    default: "data_sharing"
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
                            // quantity: {
                            //   $sum: "$apiHubVolume"
                            // },
                            quantity: {
                                $sum: {
                                    $cond: {
                                        if: {
                                            $in: [
                                                "$paymentTypeLabel",
                                                [
                                                    "Insurance Brokerage Collection",
                                                    "FX Brokerage Collection"
                                                ]
                                            ]
                                        },
                                        then: "$brokerage_fee",
                                        else: "$apiHubVolume"
                                    }
                                }
                            },
                            // unit_price: {
                            //   $first: "$api_hub_fee"
                            // },
                            unit_price: {
                                $first: {
                                    $cond: {
                                        if: {
                                            $in: [
                                                "$paymentTypeLabel",
                                                [
                                                    "Insurance Brokerage Collection",
                                                    "FX Brokerage Collection"
                                                ]
                                            ]
                                        },
                                        then: dataServiceFeePercentage,
                                        else: "$api_hub_fee"
                                    }
                                }
                            },
                            // total: {
                            //   $sum: "$applicableApiHubFee"
                            // }
                            total: {
                                $sum: {
                                    $cond: {
                                        if: {
                                            $in: [
                                                "$paymentTypeLabel",
                                                [
                                                    "Insurance Brokerage Collection",
                                                    "FX Brokerage Collection"
                                                ]
                                            ]
                                        },
                                        then: {
                                            $multiply: [
                                                "$brokerage_fee",
                                                dataServiceFeePercentage / 100
                                            ]
                                        },
                                        else: "$applicableApiHubFee"
                                    }
                                }
                            }
                        }
                    },
                    {
                        $addFields: {
                            vat_amount: {
                                $trunc: [
                                    {
                                        $multiply: ["$total", vatDecimal]
                                    },
                                    2
                                ]
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
                                    $round: ["$unit_price", 4]
                                },
                                total: {
                                    $round: ["$total", 2]
                                },
                                vat_amount: "$vat_amount",
                                full_total: {
                                    $round: [
                                        {
                                            $add: ["$total", "$vat_amount"]
                                        },
                                        2
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
                                $switch: {
                                    branches: [
                                        {
                                            case: {
                                                $eq: [
                                                    "$_id",
                                                    "service_initiation"
                                                ]
                                            },
                                            then: [
                                                "Corporate Payment",
                                                "Payment Initiation",
                                                "Payment Data"
                                            ]
                                        },
                                        {
                                            case: {
                                                $eq: ["$_id", "service_fee"]
                                            },
                                            then: [
                                                "FX Brokerage Collection",
                                                "Insurance Brokerage Collection"
                                            ] // empty array for service_fee
                                        }
                                    ],
                                    default: [
                                        "Insurance Data Sharing",
                                        "Insurance Quote Sharing",
                                        "Setup and Consent",
                                        "Corporate Data",
                                        "Confirmation of Payee(Discounted)",
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
                                                key: {
                                                    $switch: {
                                                        branches: [
                                                            {
                                                                case: {
                                                                    $eq: [
                                                                        "$$desc",
                                                                        "Corporate Payment"
                                                                    ]
                                                                },
                                                                then: "corporate_payment"
                                                            },
                                                            {
                                                                case: {
                                                                    $eq: [
                                                                        "$$desc",
                                                                        "Payment Initiation"
                                                                    ]
                                                                },
                                                                then: "payment_initiation"
                                                            },
                                                            {
                                                                case: {
                                                                    $eq: [
                                                                        "$$desc",
                                                                        "Payment Data"
                                                                    ]
                                                                },
                                                                then: "payment_data"
                                                            },
                                                            {
                                                                case: {
                                                                    $eq: [
                                                                        "$$desc",
                                                                        "Insurance Data Sharing"
                                                                    ]
                                                                },
                                                                then: "insurance_data_sharing"
                                                            },
                                                            {
                                                                case: {
                                                                    $eq: [
                                                                        "$$desc",
                                                                        "Insurance Quote Sharing"
                                                                    ]
                                                                },
                                                                then: "insurance_quote_sharing"
                                                            },
                                                            {
                                                                case: {
                                                                    $eq: [
                                                                        "$$desc",
                                                                        "Setup and Consent"
                                                                    ]
                                                                },
                                                                then: "setup_and_consent"
                                                            },
                                                            {
                                                                case: {
                                                                    $eq: [
                                                                        "$$desc",
                                                                        "Corporate Data"
                                                                    ]
                                                                },
                                                                then: "corporate_data"
                                                            },
                                                            {
                                                                case: {
                                                                    $eq: [
                                                                        "$$desc",
                                                                        "Confirmation of Payee(Discounted)"
                                                                    ]
                                                                },
                                                                then: "confirmation_of_payee_discounted"
                                                            },
                                                            {
                                                                case: {
                                                                    $eq: [
                                                                        "$$desc",
                                                                        "Balance(Discounted)"
                                                                    ]
                                                                },
                                                                then: "balance_discounted"
                                                            },
                                                            {
                                                                case: {
                                                                    $eq: [
                                                                        "$$desc",
                                                                        "Bank Data Sharing"
                                                                    ]
                                                                },
                                                                then: "bank_data_sharing"
                                                            },
                                                            {
                                                                case: {
                                                                    $eq: [
                                                                        "$$desc",
                                                                        "Insurance Brokerage Collection"
                                                                    ]
                                                                },
                                                                then: "insurance_brokerage_collection"
                                                            },
                                                            {
                                                                case: {
                                                                    $eq: [
                                                                        "$$desc",
                                                                        "FX Brokerage Collection"
                                                                    ]
                                                                },
                                                                then: "fx_brokerage_collection"
                                                            }
                                                        ],
                                                        default: "unknown"
                                                    }
                                                },
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
                                                                        case: {
                                                                            $eq: [
                                                                                "$$desc",
                                                                                "Corporate Payment"
                                                                            ]
                                                                        },
                                                                        then: paymentApiHubFee
                                                                    },
                                                                    {
                                                                        case: {
                                                                            $eq: [
                                                                                "$$desc",
                                                                                "Payment Initiation"
                                                                            ]
                                                                        },
                                                                        then: paymentApiHubFee
                                                                    },
                                                                    {
                                                                        case: {
                                                                            $eq: [
                                                                                "$$desc",
                                                                                "Payment Data"
                                                                            ]
                                                                        },
                                                                        then: paymentApiHubFee
                                                                    },
                                                                    {
                                                                        case: {
                                                                            $eq: [
                                                                                "$$desc",
                                                                                "Insurance Data Sharing"
                                                                            ]
                                                                        },
                                                                        then: insuranceDataApiHubFee
                                                                    },
                                                                    {
                                                                        case: {
                                                                            $eq: [
                                                                                "$$desc",
                                                                                "Insurance Quote Sharing"
                                                                            ]
                                                                        },
                                                                        then: insuranceQuoteApiHubFee
                                                                    },
                                                                    {
                                                                        case: {
                                                                            $eq: [
                                                                                "$$desc",
                                                                                "Setup and Consent"
                                                                            ]
                                                                        },
                                                                        then: paymentApiHubFee
                                                                    },
                                                                    {
                                                                        case: {
                                                                            $eq: [
                                                                                "$$desc",
                                                                                "Corporate Data"
                                                                            ]
                                                                        },
                                                                        then: paymentApiHubFee
                                                                    },
                                                                    {
                                                                        case: {
                                                                            $eq: [
                                                                                "$$desc",
                                                                                "Confirmation of Payee"
                                                                            ]
                                                                        },
                                                                        then: discountApiHubFee
                                                                    },
                                                                    {
                                                                        case: {
                                                                            $eq: [
                                                                                "$$desc",
                                                                                "Balance(Discounted)"
                                                                            ]
                                                                        },
                                                                        then: discountApiHubFee
                                                                    },
                                                                    {
                                                                        case: {
                                                                            $eq: [
                                                                                "$$desc",
                                                                                "Bank Data Sharing"
                                                                            ]
                                                                        },
                                                                        then: paymentApiHubFee
                                                                    },
                                                                    {
                                                                        case: {
                                                                            $eq: [
                                                                                "$$desc",
                                                                                "FX Brokerage Collection"
                                                                            ]
                                                                        },
                                                                        then: dataServiceFeePercentage
                                                                    },
                                                                    {
                                                                        case: {
                                                                            $eq: [
                                                                                "$$desc",
                                                                                "Insurance Brokerage Collection"
                                                                            ]
                                                                        },
                                                                        then: dataServiceFeePercentage
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
                                    2
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
                                    2
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
            )
            const result_of_lfi = await this.logsModel.aggregate([
                {
                    $match: {
                        "raw_api_log_data.tpp_id":
                            tpp?.tpp_id,
                        // lfiChargable: true,
                        success: true,
                        duplicate: false,
                        // successfullQuote: false
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
                                                // {
                                                //     $eq: ["$isCapped", true]
                                                // },
                                                {
                                                    $eq: [
                                                        "$successfullQuote",
                                                        false
                                                    ]
                                                },
                                                {
                                                    $eq: ["$lfiChargable", true]
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
                                    // {
                                    //     case: {
                                    //         $and: [
                                    //             {
                                    //                 $in: [
                                    //                     "$group",
                                    //                     [
                                    //                         "payment-bulk",
                                    //                         "payment-non-bulk"
                                    //                     ]
                                    //                 ]
                                    //             },
                                    //             {
                                    //                 $eq: ["$type", "merchant"]
                                    //             },
                                    //             {
                                    //                 $eq: ["$isCapped", false]
                                    //             },
                                    //             {
                                    //                 $eq: [
                                    //                     "$successfullQuote",
                                    //                     false
                                    //                 ]
                                    //             },
                                    //             {
                                    //                 $eq: ["$lfiChargable", true]
                                    //             },
                                    //             {
                                    //                 $ne: [
                                    //                     "$raw_api_log_data.payment_type",
                                    //                     "LargeValueCollection"
                                    //                 ]
                                    //             }
                                    //         ]
                                    //     },
                                    //     then: "Merchant Collection Non-Capped"
                                    // },
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
                                                    $eq: [
                                                        "$successfullQuote",
                                                        false
                                                    ]
                                                },
                                                {
                                                    $eq: ["$lfiChargable", true]
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
                                                    $eq: [
                                                        "$successfullQuote",
                                                        false
                                                    ]
                                                },
                                                {
                                                    $eq: ["$lfiChargable", true]
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
                                                },
                                                {
                                                    $eq: [
                                                        "$successfullQuote",
                                                        false
                                                    ]
                                                },
                                                {
                                                    $eq: ["$lfiChargable", true]
                                                }
                                            ]
                                        },
                                        then: "Large Value Collection"
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
                                                },
                                                {
                                                    $eq: [
                                                        "$successfullQuote",
                                                        false
                                                    ]
                                                },
                                                {
                                                    $eq: ["$lfiChargable", true]
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
                                                },
                                                {
                                                    $eq: [
                                                        "$successfullQuote",
                                                        false
                                                    ]
                                                },
                                                {
                                                    $eq: ["$lfiChargable", true]
                                                }
                                            ]
                                        },
                                        then: "Corporate Treasury Data"
                                    },
                                    {
                                        case: {
                                            $and: [
                                                {
                                                    $eq: ["$group", "data"]
                                                },
                                                {
                                                    $eq: [
                                                        "$successfullQuote",
                                                        false
                                                    ]
                                                },
                                                {
                                                    $eq: ["$lfiChargable", true]
                                                }
                                            ]
                                        },
                                        then: "Customer Data"
                                    },
                                    {
                                        case: {
                                            $and: [
                                                {
                                                    $eq: [
                                                        "$api_category",
                                                        "FX Quotes"
                                                    ]
                                                },
                                                {
                                                    $eq: [
                                                        "$successfullQuote",
                                                        true
                                                    ]
                                                },
                                                {
                                                    $eq: ["$chargeable", true]
                                                }
                                            ]
                                        },
                                        then: "FX Brokerage Collection"
                                    },
                                    {
                                        case: {
                                            $and: [
                                                {
                                                    $eq: [
                                                        "$api_category",
                                                        "Insurance Quote Sharing"
                                                    ]
                                                },
                                                {
                                                    $eq: [
                                                        "$successfullQuote",
                                                        true
                                                    ]
                                                },
                                                {
                                                    $eq: ["$chargeable", true]
                                                }
                                            ]
                                        },
                                        then: "Insurance Brokerage Collection"
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
                        count: {
                            $sum: 1
                        },
                        unit_price: {
                            $first: "$unit_price"
                        },
                        total: {
                            $sum: {
                                $cond: {
                                    if: {
                                        $in: [
                                            "$label",
                                            [
                                                "Insurance Brokerage Collection",
                                                "FX Brokerage Collection"
                                            ]
                                        ]
                                    },
                                    then: "$brokerage_fee",
                                    else: "$applicableFee"
                                }
                            }
                        },
                        capped: {
                            $max: "$isCapped"
                        },
                        cappedAmount: {
                            $first: "$cappedAt"
                        },
                        brokerage_fee: {
                            $first: "$brokerage_fee"
                        },
                        brokerage: {
                            $first: {
                                $cond: {
                                    if: {
                                        $in: [
                                            "$label",
                                            [
                                                "Insurance Brokerage Collection",
                                                "FX Brokerage Collection"
                                            ]
                                        ]
                                    },
                                    then: true,
                                    else: false
                                }
                            }
                        }
                    }
                },
                {
                    $match: {
                        total: {
                            $ne: 0
                        }
                    }
                },
                {
                    $group: {
                        _id: "$_id.lfi_id",
                        labels: {
                            $push: {
                                $cond: [
                                    {
                                        $eq: ["$brokerage", false]
                                    },
                                    // only push when brokerage == true
                                    {
                                        label: "$_id.label",
                                        quantity: "$quantity",
                                        // {
                                        //     $cond: {
                                        //         if: {
                                        //             $eq: [
                                        //                 "$_id.label",
                                        //                 "Merchant Collection Capped"
                                        //             ]
                                        //         },
                                        //         then: "$count",
                                        //         else: "$quantity"
                                        //     }
                                        // },
                                        unit_price: "$unit_price",
                                        //  {
                                        //     $cond: {
                                        //         if: {
                                        //             $eq: [
                                        //                 "$_id.label",
                                        //                 "Merchant Collection Capped"
                                        //             ]
                                        //         },
                                        //         then: "$cappedAmount",
                                        //         else: {
                                        //             $round: ["$unit_price", 4]
                                        //         }
                                        //     }
                                        // },
                                        total: {
                                            $round: ["$total", 2]
                                        },
                                        capped: "$capped"
                                    },
                                    "$$REMOVE" // don't push anything if brokerage != true
                                ]
                            }
                        },
                        commissions: {
                            $push: {
                                $cond: [
                                    {
                                        $eq: ["$brokerage", true]
                                    },
                                    // only push when brokerage == true
                                    {
                                        label: "$_id.label",
                                        quantity: "$count",
                                        unit_price: "$brokerage_fee",
                                        total: {
                                            $round: ["$total", 2]
                                        },
                                        brokerage: "$brokerage",
                                        key: {
                                            $replaceAll: {
                                                input: {
                                                    $toLower: "$_id.label"
                                                },
                                                find: " ",
                                                replacement: "_"
                                            }
                                        }
                                    },
                                    "$$REMOVE" // don't push anything if brokerage != true
                                ]
                            }
                        }
                    }
                },
                {
                    $lookup: {
                        from: "lfi_data",
                        localField: "_id",
                        foreignField: "lfi_id",
                        as: "lfi_data"
                    }
                },
                {
                    $unwind: {
                        path: "$lfi_data"
                    }
                },
                {
                    $addFields: {
                        labels: {
                            $map: {
                                input: [
                                    "Merchant Collection",
                                    // "Merchant Collection Non-Capped",
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
                                                            $eq: [
                                                                "$$existing.label",
                                                                "$$expectedLabel"
                                                            ]
                                                        }
                                                    }
                                                }
                                            },
                                            defaultUnitPrice: {
                                                $switch: {
                                                    branches: [
                                                        {
                                                            case: {
                                                                $eq: [
                                                                    "$$expectedLabel",
                                                                    "Merchant Collection"
                                                                ]
                                                            },
                                                            then: nonLargeValueMerchantBps
                                                        },
                                                        // {
                                                        //     case: {
                                                        //         $eq: [
                                                        //             "$$expectedLabel",
                                                        //             "Merchant Collection Non-Capped"
                                                        //         ]
                                                        //     },
                                                        //     then: nonLargeValueMerchantBps
                                                        // },
                                                        {
                                                            case: {
                                                                $eq: [
                                                                    "$$expectedLabel",
                                                                    "Peer-to-Peer"
                                                                ]
                                                            },
                                                            then: paymentLargeValueFeePeer
                                                        },
                                                        {
                                                            case: {
                                                                $eq: [
                                                                    "$$expectedLabel",
                                                                    "Me-to-Me Transfer"
                                                                ]
                                                            },
                                                            then: paymentFeeMe2me
                                                        },
                                                        {
                                                            case: {
                                                                $eq: [
                                                                    "$$expectedLabel",
                                                                    "Large value collection"
                                                                ]
                                                            },
                                                            then: paymentLargeValueFee
                                                        },
                                                        {
                                                            case: {
                                                                $eq: [
                                                                    "$$expectedLabel",
                                                                    "Corporate Payments"
                                                                ]
                                                            },
                                                            then: bulkLargeCorporatefee
                                                        },
                                                        {
                                                            case: {
                                                                $eq: [
                                                                    "$$expectedLabel",
                                                                    "Corporate Treasury Data"
                                                                ]
                                                            },
                                                            then: dataLargeCorporateMdp
                                                        },
                                                        {
                                                            case: {
                                                                $eq: [
                                                                    "$$expectedLabel",
                                                                    "Customer Data"
                                                                ]
                                                            },
                                                            then: "$lfi_data.mdp_rate"
                                                        }
                                                    ],
                                                    default: 0.025
                                                }
                                            },
                                            labelKey: {
                                                $switch: {
                                                    branches: [
                                                        {
                                                            case: {
                                                                $eq: [
                                                                    "$$expectedLabel",
                                                                    "Merchant Collection"
                                                                ]
                                                            },
                                                            then: "merchant_collection"
                                                        },
                                                        // {
                                                        //     case: {
                                                        //         $eq: [
                                                        //             "$$expectedLabel",
                                                        //             "Merchant Collection Non-Capped"
                                                        //         ]
                                                        //     },
                                                        //     then: "merchant_collection_non_capped"
                                                        // },
                                                        {
                                                            case: {
                                                                $eq: [
                                                                    "$$expectedLabel",
                                                                    "Peer-to-Peer"
                                                                ]
                                                            },
                                                            then: "peer_to_peer"
                                                        },
                                                        {
                                                            case: {
                                                                $eq: [
                                                                    "$$expectedLabel",
                                                                    "Me-to-Me Transfer"
                                                                ]
                                                            },
                                                            then: "me_to_me_transfer"
                                                        },
                                                        {
                                                            case: {
                                                                $eq: [
                                                                    "$$expectedLabel",
                                                                    "Large value collection"
                                                                ]
                                                            },
                                                            then: "large_value_collection"
                                                        },
                                                        {
                                                            case: {
                                                                $eq: [
                                                                    "$$expectedLabel",
                                                                    "Corporate Payments"
                                                                ]
                                                            },
                                                            then: "corporate_payments"
                                                        },
                                                        {
                                                            case: {
                                                                $eq: [
                                                                    "$$expectedLabel",
                                                                    "Corporate Treasury Data"
                                                                ]
                                                            },
                                                            then: "corporate_treasury_data"
                                                        },
                                                        {
                                                            case: {
                                                                $eq: [
                                                                    "$$expectedLabel",
                                                                    "Customer Data"
                                                                ]
                                                            },
                                                            then: "customer_data"
                                                        }
                                                    ],
                                                    default: "other"
                                                }
                                            }
                                        },
                                        in: {
                                            $cond: {
                                                if: "$$matched",
                                                then: {
                                                    $mergeObjects: [
                                                        "$$matched",
                                                        {
                                                            key: "$$labelKey"
                                                        }
                                                    ]
                                                },
                                                else: {
                                                    label: "$$expectedLabel",
                                                    quantity: 0,
                                                    unit_price:
                                                        "$$defaultUnitPrice",
                                                    total: 0,
                                                    key: "$$labelKey"
                                                }
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
                        labels_total: {
                            $sum: "$labels.total"
                        },
                        commissions_total: {
                            $sum: "$commissions.total"
                        }
                    }
                },
                {
                    $addFields: {
                        full_total: {
                            $round: [
                                {
                                    $subtract: [
                                        "$labels_total",
                                        "$commissions_total"
                                    ]
                                },
                                2
                            ]
                        },
                        lfi_name: "$lfi_data.lfi_name"
                    }
                }
            ])
            const invoice_total = result.reduce((sum, item) => sum + item.category_total, 0);
            const vat = result.reduce((sum, item) => sum + item.vat_amount, 0);

            const lfi_total = result_of_lfi.reduce((sum, item) => sum + item.full_total, 0);
            const total = Number(invoice_total) + Number(lfi_total);

            const roundedTotal = Number(total.toFixed(2));
            const roundedVat = Number(vat.toFixed(2));

            const updated_result = await this.ensureCategories(result);

            const invoice_data = {
                invoice_number: await this.generateInvoiceNumber(),
                tpp_id: tpp?.tpp_id,
                tpp_name: tpp?.tpp_name,
                tpp_email: tpp?.email,
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
                invoice_total: Number(invoice_total.toFixed(2)),
                lfi_total: Number(lfi_total.toFixed(2)),
                status: 2,
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
                        collection_memo_subitem: [
                            ...(obj?.labels || []),
                            ...(obj?.commissions || [])
                        ],
                        full_total: obj?.full_total,
                        vat_percent: vatPercent,
                        // vat: obj?.vat,
                        // actual_total: obj?.actual_total,
                        date: new Date()
                    };
                    // new_tpp_data.collection_memo_subitem.push(obj.commissions);
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
                        lfi_email: lfiData?.email,
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
                            collection_memo_subitem: [
                                ...(obj?.labels || []),
                                ...(obj?.commissions || [])
                            ],
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
        const paymentApiHubFee = globalConfiData.find(item => item.key === "paymentApiHubFee")?.value ?? 0;
        const insuranceQuoteApiHubFee = globalConfiData.find(item => item.key === "insuranceQuoteApiHubFee")?.value ?? 0;
        const insuranceDataApiHubFee = globalConfiData.find(item => item.key === "insuranceDataApiHubFee")?.value ?? 0;
        const discountApiHubFee = globalConfiData.find(item => item.key === "discountApiHubFee")?.value ?? 0;
        const categoryDefaults = {
            data_sharing: {
                "items": [
                    {
                        "description": "Insurance Quote Sharing",
                        "key": "insurance_quote_sharing",
                        "quantity": 0,
                        "unit_price": insuranceQuoteApiHubFee,
                        "total": 0,
                        "vat_amount": 0,
                        "full_total": 0
                    },
                    {
                        "description": "Insurance Data Sharing",
                        "key": "Insurance_data_sharing",
                        "quantity": 0,
                        "unit_price": insuranceDataApiHubFee,
                        "total": 0,
                        "vat_amount": 0,
                        "full_total": 0
                    },
                    {
                        "description": "Setup and Consent",
                        "key": "setup_and_consent",
                        "quantity": 0,
                        "unit_price": paymentApiHubFee,
                        "total": 0,
                        "vat_amount": 0,
                        "full_total": 0
                    },
                    {
                        "description": "Corporate Data",
                        "key": "corporate_data",
                        "quantity": 0,
                        "unit_price": paymentApiHubFee,
                        "total": 0,
                        "vat_amount": 0,
                        "full_total": 0
                    },
                    {
                        "description": "Confirmation of Payee(Discounted)",
                        "key": "confirmation_of_payee_discounted",
                        "quantity": 0,
                        "unit_price": discountApiHubFee,
                        "total": 0,
                        "vat_amount": 0,
                        "full_total": 0
                    },
                    {
                        "description": "Balance(Discounted)",
                        "key": "balance_discounted",
                        "quantity": 0,
                        "unit_price": discountApiHubFee,
                        "total": 0,
                        "vat_amount": 0,
                        "full_total": 0
                    },
                    {
                        "description": "Bank Data Sharing",
                        "key": "bank_data_sharing",
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
                        "key": "corporate_payment",
                        "quantity": 0,
                        "unit_price": paymentApiHubFee,
                        "total": 0.0,
                        "vat_amount": 0,
                        "full_total": 0
                    },
                    {
                        "description": "Payment Initiation",
                        "key": "payment_initiation",
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

    async updateInvoiceData(id: string, updateInvoiceValueDto: UpdateInvoiceValueDto) {

        const existingInvoice = await this.invoiceModel.findById(id);
        if (!existingInvoice) {
            throw new NotFoundException(`Invoice data with ID ${id} not found.`);
        }

        const updatedInvoiceData = await this.invoiceModel.findByIdAndUpdate(
            id,
            { $set: updateInvoiceValueDto },
            { new: true }
        );

        return updatedInvoiceData;
    }

    async bulkUpdate(data: Array<{ _id: string, [key: string]: any }>) {
        const operations = data.map(item => ({
            updateOne: {
                filter: { _id: new Types.ObjectId(item._id) },
                update: { $set: item }
            }
        }));

        return await this.invoiceModel.bulkWrite(operations);
    }

    async updateManyInvoices(data: any) {
        const options: any = {};

        // Search handling
        let search = data?.search;
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            options.$or = [
                { tpp_id: search },
                { tpp_name: searchRegex }
            ];
        }

        data.invoice_status != null && Number(data.invoice_status) != 0
            ? options.status = Number(data.invoice_status)
            : null;

        // Final query
        const filter = {
            invoice_month: data?.month,
            invoice_year: data?.year,
            ...options
        };

        // Update operation
        return await this.invoiceModel.updateMany(
            filter,
            {
                $set: {
                    status: data.status,
                }
            }
        );

    }
    async invoiceTppCsv(data: any) {
        const timezone: string = moment.tz.guess();
        const result_tpp = await this.logsModel.aggregate(
            [
                {
                    $match: {
                        "raw_api_log_data.tpp_id": data?.tpp_id,
                        chargeable: true,
                        success: true,
                        duplicate: false,
                        $expr: {
                            $and: [
                                {
                                    $eq: [
                                        {
                                            $month: "$raw_api_log_data.timestamp"
                                        },
                                        data?.month
                                    ]
                                },
                                {
                                    $eq: [
                                        {
                                            $year: "$raw_api_log_data.timestamp"
                                        },
                                        data?.year
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
                                            $and: [
                                                {
                                                    $eq: [
                                                        "$group",
                                                        "payment-bulk"
                                                    ]
                                                },
                                                {
                                                    $eq: [
                                                        "$successfullQuote",
                                                        false
                                                    ]
                                                }
                                            ]
                                        },
                                        then: "Corporate Payment" //-- paymentApiHubFee
                                    },
                                    {
                                        case: {
                                            $and: [
                                                {
                                                    $eq: [
                                                        "$group",
                                                        "payment-data"
                                                    ]
                                                },
                                                {
                                                    $eq: [
                                                        "$successfullQuote",
                                                        false
                                                    ]
                                                }
                                            ]
                                        },
                                        then: "Payment Data" //-- paymentApiHubFee
                                    },
                                    {
                                        case: {
                                            $and: [
                                                {
                                                    $eq: [
                                                        "$group",
                                                        "payment-non-bulk"
                                                    ]
                                                },
                                                {
                                                    $eq: [
                                                        "$successfullQuote",
                                                        false
                                                    ]
                                                }
                                            ]
                                        },
                                        then: "Payment Initiation" //--paymentApiHubFee
                                    },
                                    {
                                        case: {
                                            $and: [
                                                {
                                                    $eq: ["$group", "insurance"]
                                                },
                                                {
                                                    $eq: [
                                                        "$api_category",
                                                        "Insurance Data Sharing"
                                                    ]
                                                },
                                                {
                                                    $eq: [
                                                        "$successfullQuote",
                                                        false
                                                    ]
                                                }
                                            ]
                                        },
                                        then: "Insurance Data Sharing" //-- insuranceApiHubFee
                                    },
                                    {
                                        case: {
                                            $and: [
                                                {
                                                    $eq: ["$group", "insurance"]
                                                },
                                                {
                                                    $eq: [
                                                        "$api_category",
                                                        "Insurance Quote Sharing"
                                                    ]
                                                },
                                                {
                                                    $eq: [
                                                        "$successfullQuote",
                                                        false
                                                    ]
                                                }
                                            ]
                                        },
                                        then: "Insurance Quote Sharing" //-- insuranceApiHubFee
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
                                                        "Setup and Consent" 
                                                    ]
                                                },
                                                {
                                                    $eq: [
                                                        "$successfullQuote",
                                                        false
                                                    ]
                                                }
                                            ]
                                        }, 
                                        then: "Setup and Consent" //-- paymentApiHubFee
                                    },
                                    {
                                        case: {
                                            $and: [
                                                {
                                                    $eq: ["$group", "data"]
                                                },
                                                {
                                                    $eq: ["$type", "corporate"]
                                                },
                                                {
                                                    $eq: [
                                                        "$successfullQuote",
                                                        false
                                                    ]
                                                }
                                            ]
                                        },
                                        then: "Corporate Data" //-- paymentApiHubFee
                                    },
                                    {
                                        case: {
                                            $and: [
                                                {
                                                    $eq: ["$group", "data"]
                                                },
                                                {
                                                    $eq: ["$discount_type", "cop"]
                                                },
                                                {
                                                    $eq: [
                                                        "$successfullQuote",
                                                        false
                                                    ]
                                                }
                                            ]
                                        },
                                        then: "Confirmation of Payee(Discounted)" //-- discountApiHubFee
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
                                                },
                                                {
                                                    $eq: [
                                                        "$successfullQuote",
                                                        false
                                                    ]
                                                }
                                            ]
                                        },
                                        then: "Balance(Discounted)" //-- discountApiHubFee
                                    },
                                    {
                                        case: {
                                            $and: [
                                                {
                                                    $eq: ["$group", "data"]
                                                },
                                                {
                                                    $eq: [
                                                        "$successfullQuote",
                                                        false
                                                    ]
                                                }
                                            ]
                                        },
                                        then: "Bank Data Sharing" //--paymentApiHubFee
                                    },
                                    {
                                        case: {
                                            $and: [
                                                {
                                                    $eq: [
                                                        "$successfullQuote",
                                                        true
                                                    ]
                                                },
                                                {
                                                    $eq: [
                                                        "$api_category",
                                                        "Insurance Quote Sharing"
                                                    ]
                                                }
                                            ]
                                        },
                                        then: "Insurance Brokerage Collection"
                                    },
                                    {
                                        case: {
                                            $and: [
                                                {
                                                    $eq: [
                                                        "$successfullQuote",
                                                        true
                                                    ]
                                                },
                                                {
                                                    $eq: [
                                                        "$api_category",
                                                        "FX Quotes"
                                                    ]
                                                }
                                            ]
                                        },
                                        then: "FX Brokerage Collection"
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


            ]
        );
        
        const result_of_lfi = await this.logsModel.aggregate(
            [
                {
                    $match: {
                        "raw_api_log_data.tpp_id": data?.tpp_id,
                        success: true,
                        duplicate: false,
                        $expr: {
                            $and: [
                                {
                                    $eq: [
                                        {
                                            $month:
                                                "$raw_api_log_data.timestamp"
                                        },
                                        data?.month
                                    ]
                                },
                                {
                                    $eq: [
                                        {
                                            $year:
                                                "$raw_api_log_data.timestamp"
                                        },
                                        data?.year
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
                                                // {
                                                //     $eq: ["$isCapped", true]
                                                // },
                                                {
                                                    $eq: [
                                                        "$successfullQuote",
                                                        false
                                                    ]
                                                },
                                                {
                                                    $eq: ["$lfiChargable", true]
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
                                    // {
                                    //     case: {
                                    //         $and: [
                                    //             {
                                    //                 $in: [
                                    //                     "$group",
                                    //                     [
                                    //                         "payment-bulk",
                                    //                         "payment-non-bulk"
                                    //                     ]
                                    //                 ]
                                    //             },
                                    //             {
                                    //                 $eq: ["$type", "merchant"]
                                    //             },
                                    //             {
                                    //                 $eq: ["$isCapped", false]
                                    //             },
                                    //             {
                                    //                 $eq: [
                                    //                     "$successfullQuote",
                                    //                     false
                                    //                 ]
                                    //             },
                                    //             {
                                    //                 $eq: ["$lfiChargable", true]
                                    //             },
                                    //             {
                                    //                 $ne: [
                                    //                     "$raw_api_log_data.payment_type",
                                    //                     "LargeValueCollection"
                                    //                 ]
                                    //             }
                                    //         ]
                                    //     },
                                    //     then: "Merchant Collection Non-Capped"
                                    // },
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
                                                    $eq: [
                                                        "$successfullQuote",
                                                        false
                                                    ]
                                                },
                                                {
                                                    $eq: ["$lfiChargable", true]
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
                                                    $eq: [
                                                        "$successfullQuote",
                                                        false
                                                    ]
                                                },
                                                {
                                                    $eq: ["$lfiChargable", true]
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
                                                },
                                                {
                                                    $eq: [
                                                        "$successfullQuote",
                                                        false
                                                    ]
                                                },
                                                {
                                                    $eq: ["$lfiChargable", true]
                                                }
                                            ]
                                        },
                                        then: "Large Value Collection"
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
                                                },
                                                {
                                                    $eq: [
                                                        "$successfullQuote",
                                                        false
                                                    ]
                                                },
                                                {
                                                    $eq: ["$lfiChargable", true]
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
                                                },
                                                {
                                                    $eq: [
                                                        "$successfullQuote",
                                                        false
                                                    ]
                                                },
                                                {
                                                    $eq: ["$lfiChargable", true]
                                                }
                                            ]
                                        },
                                        then: "Corporate Treasury Data"
                                    },
                                    {
                                        case: {
                                            $and: [
                                                {
                                                    $eq: ["$group", "data"]
                                                },
                                                {
                                                    $eq: [
                                                        "$successfullQuote",
                                                        false
                                                    ]
                                                },
                                                {
                                                    $eq: ["$lfiChargable", true]
                                                }
                                            ]
                                        },
                                        then: "Customer Data"
                                    },
                                    {
                                        case: {
                                            $and: [
                                                {
                                                    $eq: [
                                                        "$api_category",
                                                        "FX Quotes"
                                                    ]
                                                },
                                                {
                                                    $eq: [
                                                        "$successfullQuote",
                                                        true
                                                    ]
                                                },
                                                {
                                                    $eq: ["$chargeable", true]
                                                }
                                            ]
                                        },
                                        then: "FX Brokerage Collection"
                                    },
                                    {
                                        case: {
                                            $and: [
                                                {
                                                    $eq: [
                                                        "$api_category",
                                                        "Insurance Quote Sharing"
                                                    ]
                                                },
                                                {
                                                    $eq: [
                                                        "$successfullQuote",
                                                        true
                                                    ]
                                                },
                                                {
                                                    $eq: ["$chargeable", true]
                                                }
                                            ]
                                        },
                                        then: "Insurance Brokerage Collection"
                                    }
                                ],
                                default: "Others"
                            }
                        }
                    }
                },
                {
                    $match: {
                        total: { $ne: 0 }
                    }
                },
            ]
        )
        
        const log = [...result_tpp, ...result_of_lfi];
        const uniqueByInteraction = [
            ...new Map(log.map(item => [item.raw_api_log_data.interaction_id, item])).values()
        ];

        let result;
        try {
            // Define the CSV headers
            const flattenedLog = uniqueByInteraction.map(({ _id, ...entry }) => ({
                timestamp: moment
                    .utc(entry.raw_api_log_data.timestamp)   // Parse as UTC
                    .tz(timezone)                            // Convert to local timezone
                    .format('YYYY-MM-DD HH:mm:ss'),
                lfi_id: entry.raw_api_log_data.lfi_id,
                lfi_name: entry.raw_api_log_data.lfi_name,
                tpp_id: entry.raw_api_log_data.tpp_id,
                tpp_name: entry.raw_api_log_data.tpp_name,
                tpp_client_id: entry.raw_api_log_data.tpp_client_id,
                api_set_sub: entry.raw_api_log_data.api_set_sub,
                http_method: entry.raw_api_log_data.http_method,
                url: entry.raw_api_log_data.url,
                tpp_response_code_group: entry.raw_api_log_data.tpp_response_code_group,
                execution_time: entry.raw_api_log_data.execution_time,
                interaction_id: entry.raw_api_log_data.interaction_id,
                resource_name: entry.raw_api_log_data.resource_name,
                lfi_response_code_group: entry.raw_api_log_data.lfi_response_code_group,
                is_attended: entry.raw_api_log_data.is_attended,
                records: entry.raw_api_log_data.records,
                payment_type: entry.raw_api_log_data.payment_type,
                payment_id: entry.raw_api_log_data.payment_id,
                merchant_id: entry.raw_api_log_data.merchant_id,
                psu_id: entry.raw_api_log_data.psu_id,
                is_large_corporate: entry.raw_api_log_data.is_large_corporate,
                user_type: entry.raw_api_log_data.user_type,
                purpose: entry.raw_api_log_data.purpose,
                status: entry.payment_logs.status,
                currency: entry.payment_logs.currency,
                amount: entry.payment_logs.amount,
                payment_consent_type: entry.payment_logs.payment_consent_type,
                transaction_id: entry.payment_logs.transaction_id,
                number_of_successful_transactions: entry.payment_logs.number_of_successful_transactions,
                international_payment: entry.payment_logs.international_payment,
                chargeable: entry.chargeable,
                lfiChargable: entry.lfiChargable,
                success: entry.success,
                group: entry.group,
                type: entry.type,
                discountType: entry.discountType,
                api_category: entry.api_category,
                discounted: entry.discounted,
                api_hub_fee: entry.api_hub_fee,
                applicableApiHubFee: entry.applicableApiHubFee,
                apiHubVolume: entry.apiHubVolume,
                calculatedFee: entry.calculatedFee,
                applicableFee: entry.applicableFee,
                unit_price: entry.unit_price,
                volume: entry.volume,
                appliedLimit: entry.appliedLimit,
                limitApplied: entry.limitApplied,
                isCapped: entry.isCapped,
                cappedAt: entry.cappedAt,
                numberOfPages: entry.numberOfPages,
                duplicate: entry.duplicate,
                category: entry?.category,
            }));

            const outputPath = './output/log_detail.csv';

            const directory = outputPath.substring(0, outputPath.lastIndexOf('/'));
            if (!fs.existsSync(directory)) {
                fs.mkdirSync(directory, { recursive: true });
            }

            // Define the CSV headers
            const fields = Object.keys(flattenedLog[0]); // Dynamically generate headers from data keys
            const parser = new Parser({ fields });
            const csv = parser.parse(flattenedLog);

            // Write the CSV file
            fs.writeFileSync(outputPath, csv, 'utf8');
            result = outputPath;
        } catch (error) {
            console.error("Error creating CSV file:", error);
        }

        // return log;
    }

    async invoiceLfiCsv(data: any) {
        const timezone: string = moment.tz.guess();
        const log = await this.logsModel.aggregate(
            [
                {
                    $match: {
                        "raw_api_log_data.lfi_id": data?.lfi_id,
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
                                        data?.month
                                    ]
                                },
                                {
                                    $eq: [
                                        {
                                            $year:
                                                "$raw_api_log_data.timestamp"
                                        },
                                        data?.year
                                    ]
                                }
                            ]
                        }
                    }
                },
                {
                    $addFields: {
                        category: {
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
                                        then: "Large Value Collection"  // paymentLargeValueFee
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
                    $match: {
                        total: { $ne: 0 }
                    }
                },
            ]
        )

        let result;
        try {
            // Define the CSV headers
            const flattenedLog = log.map(({ _id, ...entry }) => ({
                timestamp: moment
                    .utc(entry.raw_api_log_data.timestamp)   // Parse as UTC
                    .tz(timezone)                            // Convert to local timezone
                    .format('YYYY-MM-DD HH:mm:ss'),
                lfi_id: entry.raw_api_log_data.lfi_id,
                lfi_name: entry.raw_api_log_data.lfi_name,
                tpp_id: entry.raw_api_log_data.tpp_id,
                tpp_name: entry.raw_api_log_data.tpp_name,
                tpp_client_id: entry.raw_api_log_data.tpp_client_id,
                api_set_sub: entry.raw_api_log_data.api_set_sub,
                http_method: entry.raw_api_log_data.http_method,
                url: entry.raw_api_log_data.url,
                tpp_response_code_group: entry.raw_api_log_data.tpp_response_code_group,
                execution_time: entry.raw_api_log_data.execution_time,
                interaction_id: entry.raw_api_log_data.interaction_id,
                resource_name: entry.raw_api_log_data.resource_name,
                lfi_response_code_group: entry.raw_api_log_data.lfi_response_code_group,
                is_attended: entry.raw_api_log_data.is_attended,
                records: entry.raw_api_log_data.records,
                payment_type: entry.raw_api_log_data.payment_type,
                payment_id: entry.raw_api_log_data.payment_id,
                merchant_id: entry.raw_api_log_data.merchant_id,
                psu_id: entry.raw_api_log_data.psu_id,
                is_large_corporate: entry.raw_api_log_data.is_large_corporate,
                user_type: entry.raw_api_log_data.user_type,
                purpose: entry.raw_api_log_data.purpose,
                status: entry.payment_logs.status,
                currency: entry.payment_logs.currency,
                amount: entry.payment_logs.amount,
                payment_consent_type: entry.payment_logs.payment_consent_type,
                transaction_id: entry.payment_logs.transaction_id,
                number_of_successful_transactions: entry.payment_logs.number_of_successful_transactions,
                international_payment: entry.payment_logs.international_payment,
                chargeable: entry.chargeable,
                lfiChargable: entry.lfiChargable,
                success: entry.success,
                group: entry.group,
                type: entry.type,
                discountType: entry.discountType,
                api_category: entry.api_category,
                discounted: entry.discounted,
                api_hub_fee: entry.api_hub_fee,
                applicableApiHubFee: entry.applicableApiHubFee,
                apiHubVolume: entry.apiHubVolume,
                calculatedFee: entry.calculatedFee,
                applicableFee: entry.applicableFee,
                unit_price: entry.unit_price,
                volume: entry.volume,
                appliedLimit: entry.appliedLimit,
                limitApplied: entry.limitApplied,
                isCapped: entry.isCapped,
                cappedAt: entry.cappedAt,
                numberOfPages: entry.numberOfPages,
                duplicate: entry.duplicate,
                category: entry?.category,
            }));

            const outputPath = './output/log_detail.csv';

            const directory = outputPath.substring(0, outputPath.lastIndexOf('/'));
            if (!fs.existsSync(directory)) {
                fs.mkdirSync(directory, { recursive: true });
            }

            // Define the CSV headers
            const fields = Object.keys(flattenedLog[0]); // Dynamically generate headers from data keys
            const parser = new Parser({ fields });
            const csv = parser.parse(flattenedLog);

            // Write the CSV file
            fs.writeFileSync(outputPath, csv, 'utf8');
            result = outputPath;
        } catch (error) {
            console.error("Error creating CSV file:", error);
        }

        // return log;
    }

    async billingTpp(
        tpp_id: any,
        invoiceDto: any,
    ): Promise<any> {

        const tppData = await this.tppDataModel.findOne({ tpp_id: tpp_id });
        if (!tppData)
            throw new NotFoundException(`TppID ${tpp_id} not found.`);

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

        const globData = await this.globalModel.findOne({
            key: 'serviceFeePercentage',
        })
        const dataServiceFeePercentage = globData?.value || 0;
        const result = await this.logsModel.aggregate(
            [
                {
                    $match: {
                        "raw_api_log_data.tpp_id":
                            tpp_id,
                        chargeable: true,
                        success: true,
                        duplicate: false,
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
                },
                {
                    $addFields: {
                        paymentTypeLabel: {
                            $switch: {
                                branches: [
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
                                                    $eq: [
                                                        "$successfullQuote",
                                                        false
                                                    ]
                                                },
                                                {
                                                    $gt: ["$apiHubVolume", 0]
                                                }
                                            ]
                                        },
                                        then: "Corporate Payment" //-- paymentApiHubFee
                                    },
                                    {
                                        case: {
                                            $and: [
                                                {
                                                    $eq: [
                                                        "$group",
                                                        "payment-non-bulk"
                                                    ]
                                                },
                                                {
                                                    $eq: [
                                                        "$successfullQuote",
                                                        false
                                                    ]
                                                },
                                                {
                                                    $gt: ["$apiHubVolume", 0]
                                                }
                                            ]
                                        },
                                        then: "Payment Initiation" //--paymentApiHubFee
                                    },
                                    {
                                        case: {
                                            $and: [
                                                {
                                                    $eq: [
                                                        "$group",
                                                        "payment-data"
                                                    ]
                                                },
                                                {
                                                    $eq: [
                                                        "$successfullQuote",
                                                        false
                                                    ]
                                                },
                                                {
                                                    $gt: ["$apiHubVolume", 0]
                                                }
                                            ]
                                        },
                                        then: "Payment Data" //--paymentApiHubFee
                                    },
                                    {
                                        case: {
                                            $and: [
                                                {
                                                    $eq: ["$group", "insurance"]
                                                },
                                                {
                                                    $eq: [
                                                        "$api_category",
                                                        "Insurance Data Sharing"
                                                    ]
                                                },
                                                {
                                                    $eq: [
                                                        "$successfullQuote",
                                                        false
                                                    ]
                                                },
                                                {
                                                    $gt: ["$apiHubVolume", 0]
                                                }
                                            ]
                                        },
                                        then: "Insurance Data Sharing" //-- insuranceApiHubFee
                                    },
                                    {
                                        case: {
                                            $and: [
                                                {
                                                    $eq: ["$group", "insurance"]
                                                },
                                                {
                                                    $eq: [
                                                        "$api_category",
                                                        "Insurance Quote Sharing"
                                                    ]
                                                },
                                                {
                                                    $eq: [
                                                        "$successfullQuote",
                                                        false
                                                    ]
                                                },
                                                {
                                                    $gt: ["$apiHubVolume", 0]
                                                }
                                            ]
                                        },
                                        then: "Insurance Quote Sharing" //-- insuranceApiHubFee
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
                                                        "Setup and Consent"
                                                    ]
                                                },
                                                {
                                                    $eq: [
                                                        "$successfullQuote",
                                                        false
                                                    ]
                                                },
                                                {
                                                    $gt: ["$apiHubVolume", 0]
                                                }
                                            ]
                                        },
                                        then: "Setup and Consent" //-- paymentApiHubFee
                                    },
                                    {
                                        case: {
                                            $and: [
                                                {
                                                    $eq: ["$group", "data"]
                                                },
                                                {
                                                    $eq: ["$type", "corporate"]
                                                },
                                                {
                                                    $eq: [
                                                        "$successfullQuote",
                                                        false
                                                    ]
                                                },
                                                {
                                                    $gt: ["$apiHubVolume", 0]
                                                }
                                            ]
                                        },
                                        then: "Corporate Data" //-- paymentApiHubFee
                                    },
                                    {
                                        case: {
                                            $and: [
                                                {
                                                    $eq: ["$group", "data"]
                                                },
                                                {
                                                    $eq: ["$discount_type", "cop"]
                                                },
                                                {
                                                    $eq: [
                                                        "$successfullQuote",
                                                        false
                                                    ]
                                                },
                                                {
                                                    $gt: ["$apiHubVolume", 0]
                                                }
                                            ]
                                        },
                                        then: "Confirmation of Payee(Discounted)" //-- discountApiHubFee
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
                                                },
                                                {
                                                    $eq: [
                                                        "$successfullQuote",
                                                        false
                                                    ]
                                                },
                                                {
                                                    $gt: ["$apiHubVolume", 0]
                                                }
                                            ]
                                        },
                                        then: "Balance(Discounted)" //-- discountApiHubFee
                                    },
                                    {
                                        case: {
                                            $and: [
                                                {
                                                    $eq: ["$group", "data"]
                                                },
                                                {
                                                    $eq: [
                                                        "$successfullQuote",
                                                        false
                                                    ]
                                                },
                                                {
                                                    $gt: ["$apiHubVolume", 0]
                                                }
                                            ]
                                        },
                                        then: "Bank Data Sharing" //--paymentApiHubFee
                                    },
                                    {
                                        case: {
                                            $and: [
                                                {
                                                    $eq: [
                                                        "$successfullQuote",
                                                        true
                                                    ]
                                                },
                                                {
                                                    $eq: [
                                                        "$api_category",
                                                        "Insurance Quote Sharing"
                                                    ]
                                                }
                                            ]
                                        },
                                        then: "Insurance Brokerage Collection"
                                    },
                                    {
                                        case: {
                                            $and: [
                                                {
                                                    $eq: [
                                                        "$successfullQuote",
                                                        true
                                                    ]
                                                },
                                                {
                                                    $eq: [
                                                        "$api_category",
                                                        "FX Quotes"
                                                    ]
                                                }
                                            ]
                                        },
                                        then: "FX Brokerage Collection"
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
                            $switch: {
                                branches: [
                                    {
                                        case: {
                                            $in: [
                                                "$paymentTypeLabel",
                                                [
                                                    "Corporate Payment",
                                                    "Payment Initiation",
                                                    "Payment Data"
                                                ]
                                            ]
                                        },
                                        then: "service_initiation"
                                    },
                                    {
                                        case: {
                                            $in: [
                                                "$paymentTypeLabel",
                                                [
                                                    "Insurance Brokerage Collection",
                                                    "FX Brokerage Collection"
                                                ]
                                            ]
                                        },
                                        then: "service_fee"
                                    }
                                ],
                                default: "data_sharing"
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
                            $sum: {
                                $cond: {
                                    if: {
                                        $in: [
                                            "$paymentTypeLabel",
                                            [
                                                "Insurance Brokerage Collection",
                                                "FX Brokerage Collection"
                                            ]
                                        ]
                                    },
                                    then: "$brokerage_fee",
                                    else: "$apiHubVolume"
                                }
                            }
                        },
                        unit_price: {
                            $first: {
                                $cond: {
                                    if: {
                                        $in: [
                                            "$paymentTypeLabel",
                                            [
                                                "Insurance Brokerage Collection",
                                                "FX Brokerage Collection"
                                            ]
                                        ]
                                    },
                                    then: dataServiceFeePercentage,
                                    else: "$api_hub_fee"
                                }
                            }
                        },
                        total: {
                            $sum: {
                                $cond: {
                                    if: {
                                        $in: [
                                            "$paymentTypeLabel",
                                            [
                                                "Insurance Brokerage Collection",
                                                "FX Brokerage Collection"
                                            ]
                                        ]
                                    },
                                    then: {
                                        $multiply: [
                                            "$brokerage_fee",
                                            dataServiceFeePercentage / 100
                                        ]
                                    },
                                    else: "$applicableApiHubFee"
                                }
                            }
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
                                $round: ["$unit_price", 4]
                            },
                            total: {
                                $round: ["$total", 2]
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
                        items: {
                            $map: {
                                input: "$items",
                                as: "item",
                                in: {
                                    $mergeObjects: [
                                        "$$item",
                                        {
                                            key: {
                                                $switch: {
                                                    branches: [
                                                        {
                                                            case: {
                                                                $eq: [
                                                                    "$$item.description",
                                                                    "Corporate Payment"
                                                                ]
                                                            },
                                                            then: "corporate_payment"
                                                        },
                                                        {
                                                            case: {
                                                                $eq: [
                                                                    "$$item.description",
                                                                    "Payment Initiation"
                                                                ]
                                                            },
                                                            then: "payment_initiation"
                                                        },
                                                        {
                                                            case: {
                                                                $eq: [
                                                                    "$$item.description",
                                                                    "Payment Data"
                                                                ]
                                                            },
                                                            then: "payment_data"
                                                        },
                                                        {
                                                            case: {
                                                                $eq: [
                                                                    "$$item.description",
                                                                    "Insurance Data Sharing"
                                                                ]
                                                            },
                                                            then: "insurance_data_sharing"
                                                        },
                                                        {
                                                            case: {
                                                                $eq: [
                                                                    "$$item.description",
                                                                    "Insurance Quote Sharing"
                                                                ]
                                                            },
                                                            then: "insurance_quote_sharing"
                                                        },
                                                        {
                                                            case: {
                                                                $eq: [
                                                                    "$$item.description",
                                                                    "Setup and Consent"
                                                                ]
                                                            },
                                                            then: "setup_consent"
                                                        },
                                                        {
                                                            case: {
                                                                $eq: [
                                                                    "$$item.description",
                                                                    "Corporate Payment Data"
                                                                ]
                                                            },
                                                            then: "corporate_payment_data"
                                                        },
                                                        {
                                                            case: {
                                                                $eq: [
                                                                    "$$item.description",
                                                                    "Confirmation of Payee(Discounted)"
                                                                ]
                                                            },
                                                            then: "cop_discounted"
                                                        },
                                                        {
                                                            case: {
                                                                $eq: [
                                                                    "$$item.description",
                                                                    "Balance(Discounted)"
                                                                ]
                                                            },
                                                            then: "balance_discounted"
                                                        },
                                                        {
                                                            case: {
                                                                $eq: [
                                                                    "$$item.description",
                                                                    "Bank Data Sharing"
                                                                ]
                                                            },
                                                            then: "bank_data_sharing"
                                                        },
                                                        {
                                                            case: {
                                                                $eq: [
                                                                    "$$item.description",
                                                                    "Insurance Brokerage Collection"
                                                                ]
                                                            },
                                                            then: "insurance_brokerage_collection"
                                                        },
                                                        {
                                                            case: {
                                                                $eq: [
                                                                    "$$item.description",
                                                                    "FX Brokerage Collection"
                                                                ]
                                                            },
                                                            then: "fx_brokerage_collection"
                                                        }
                                                    ],
                                                    default: null
                                                }
                                            }
                                        }
                                    ]
                                }
                            }
                        }
                    }
                },
                {
                    $addFields: {
                        allItems: {
                            $switch: {
                                branches: [
                                    {
                                        case: {
                                            $eq: [
                                                "$_id",
                                                "service_initiation"
                                            ]
                                        },
                                        then: [
                                            "Corporate Payment",
                                            "Payment Initiation",
                                            "Payment Data"
                                        ]
                                    },
                                    {
                                        case: {
                                            $eq: ["$_id", "service_fee"]
                                        },
                                        then: [
                                            "FX Brokerage Collection",
                                            "Insurance Brokerage Collection"
                                        ]
                                    }
                                ],
                                default: [
                                    "Insurance Data Sharing",
                                    "Insurance Quote Sharing",
                                    "Setup and Consent",
                                    "Corporate Data",
                                    "Confirmation of Payee(Discounted)",
                                    "Balance(Discounted)",
                                    "Bank Data Sharing"
                                ]
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
                    $project: {
                        _id: 0,
                        category: "$_id",
                        items: 1,
                        // 'sub_total': 1,
                        // 'vat_amount': 1,
                        category_total: "$sub_total"
                    }
                }
            ]
        );
        const result_of_lfi = await this.logsModel.aggregate(
            [
                {
                    $match: {
                        "raw_api_log_data.tpp_id":
                            tpp_id,
                        success: true,
                        duplicate: false,
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
                                                // {
                                                //     $eq: ["$isCapped", true]
                                                // },
                                                {
                                                    $gt: ["$volume", 0]
                                                },
                                                {
                                                    $eq: [
                                                        "$successfullQuote",
                                                        false
                                                    ]
                                                },
                                                {
                                                    $eq: ["$lfiChargable", true]
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
                                    // {
                                    //     case: {
                                    //         $and: [
                                    //             {
                                    //                 $in: [
                                    //                     "$group",
                                    //                     [
                                    //                         "payment-bulk",
                                    //                         "payment-non-bulk"
                                    //                     ]
                                    //                 ]
                                    //             },
                                    //             {
                                    //                 $eq: ["$type", "merchant"]
                                    //             },
                                    //             {
                                    //                 $eq: ["$isCapped", false]
                                    //             },
                                    //             {
                                    //                 $eq: [
                                    //                     "$successfullQuote",
                                    //                     false
                                    //                 ]
                                    //             },
                                    //             {
                                    //                 $eq: ["$lfiChargable", true]
                                    //             },
                                    //             {
                                    //                 $gt: ["$volume", 0]
                                    //             },
                                    //             {
                                    //                 $ne: [
                                    //                     "$raw_api_log_data.payment_type",
                                    //                     "LargeValueCollection"
                                    //                 ]
                                    //             }
                                    //         ]
                                    //     },
                                    //     then: "Merchant Collection Non-Capped"
                                    // },
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
                                                    $eq: [
                                                        "$successfullQuote",
                                                        false
                                                    ]
                                                },
                                                {
                                                    $eq: ["$lfiChargable", true]
                                                },
                                                {
                                                    $gt: ["$volume", 0]
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
                                                    $eq: [
                                                        "$successfullQuote",
                                                        false
                                                    ]
                                                },
                                                {
                                                    $eq: ["$lfiChargable", true]
                                                },
                                                {
                                                    $gt: ["$volume", 0]
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
                                                },
                                                {
                                                    $eq: [
                                                        "$successfullQuote",
                                                        false
                                                    ]
                                                },
                                                {
                                                    $eq: ["$lfiChargable", true]
                                                },
                                                {
                                                    $gt: ["$volume", 0]
                                                }
                                            ]
                                        },
                                        then: "Large Value Collection"
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
                                                },
                                                {
                                                    $eq: [
                                                        "$successfullQuote",
                                                        false
                                                    ]
                                                },
                                                {
                                                    $eq: ["$lfiChargable", true]
                                                },
                                                {
                                                    $gt: ["$volume", 0]
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
                                                },
                                                {
                                                    $eq: [
                                                        "$successfullQuote",
                                                        false
                                                    ]
                                                },
                                                {
                                                    $eq: ["$lfiChargable", true]
                                                },
                                                {
                                                    $gt: ["$volume", 0]
                                                }
                                            ]
                                        },
                                        then: "Corporate Treasury Data"
                                    },
                                    {
                                        case: {
                                            $and: [
                                                {
                                                    $eq: ["$group", "data"]
                                                },
                                                {
                                                    $eq: [
                                                        "$successfullQuote",
                                                        false
                                                    ]
                                                },
                                                {
                                                    $eq: ["$lfiChargable", true]
                                                },
                                                {
                                                    $gt: ["$volume", 0]
                                                }
                                            ]
                                        },
                                        then: "Customer Data"
                                    },
                                    {
                                        case: {
                                            $and: [
                                                {
                                                    $eq: [
                                                        "$api_category",
                                                        "FX Quotes"
                                                    ]
                                                },
                                                {
                                                    $eq: [
                                                        "$successfullQuote",
                                                        true
                                                    ]
                                                },
                                                {
                                                    $eq: ["$chargeable", true]
                                                }
                                            ]
                                        },
                                        then: "FX Brokerage Collection"
                                    },
                                    {
                                        case: {
                                            $and: [
                                                {
                                                    $eq: [
                                                        "$api_category",
                                                        "Insurance Quote Sharing"
                                                    ]
                                                },
                                                {
                                                    $eq: [
                                                        "$successfullQuote",
                                                        true
                                                    ]
                                                },
                                                {
                                                    $eq: ["$chargeable", true]
                                                }
                                            ]
                                        },
                                        then: "Insurance Brokerage Collection"
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
                        count: {
                            $sum: 1
                        },
                        unit_price: {
                            $first: "$unit_price"
                        },
                        total: {
                            $sum: {
                                $cond: {
                                    if: {
                                        $in: [
                                            "$label",
                                            [
                                                "Insurance Brokerage Collection",
                                                "FX Brokerage Collection"
                                            ]
                                        ]
                                    },
                                    then: "$brokerage_fee",
                                    else: "$applicableFee"
                                }
                            }
                        },
                        capped: {
                            $max: "$isCapped"
                        },
                        cappedAmount: {
                            $first: "$cappedAt"
                        },
                        brokerage_fee: {
                            $first: "$brokerage_fee"
                        },
                        brokerage: {
                            $first: {
                                $cond: {
                                    if: {
                                        $in: [
                                            "$label",
                                            [
                                                "Insurance Brokerage Collection",
                                                "FX Brokerage Collection"
                                            ]
                                        ]
                                    },
                                    then: true,
                                    else: false
                                }
                            }
                        }
                    }
                },
                {
                    $group: {
                        _id: "$_id.lfi_id",
                        labels: {
                            $push: {
                                $cond: [
                                    {
                                        $eq: ["$brokerage", false]
                                    },
                                    // only push when brokerage == true
                                    {
                                        label: "$_id.label",
                                        quantity: "$quantity",
                                        //  {
                                        //     $cond: {
                                        //         if: {
                                        //             $eq: [
                                        //                 "$_id.label",
                                        //                 "Merchant Collection Capped"
                                        //             ]
                                        //         },
                                        //         then: "$count",
                                        //         else: "$quantity"
                                        //     }
                                        // },
                                        unit_price: "$unit_price",
                                        //  {
                                        //     $cond: {
                                        //         if: {
                                        //             $eq: [
                                        //                 "$_id.label",
                                        //                 "Merchant Collection Capped"
                                        //             ]
                                        //         },
                                        //         then: "$cappedAmount",
                                        //         else: {
                                        //             $round: ["$unit_price", 4]
                                        //         }
                                        //     }
                                        // },
                                        total: {
                                            $round: ["$total", 2]
                                        },
                                        capped: "$capped"
                                    },
                                    "$$REMOVE" // don't push anything if brokerage != true
                                ]
                            }
                        },
                        commissions: {
                            $push: {
                                $cond: [
                                    {
                                        $eq: ["$brokerage", true]
                                    },
                                    // only push when brokerage == true
                                    {
                                        label: "$_id.label",
                                        quantity: "$count",
                                        unit_price: "$brokerage_fee",
                                        total: {
                                            $round: ["$total", 2]
                                        },
                                        brokerage: "$brokerage",
                                        key: {
                                            $replaceAll: {
                                                input: {
                                                    $toLower: "$_id.label"
                                                },
                                                find: " ",
                                                replacement: "_"
                                            }
                                        }
                                    },
                                    "$$REMOVE" // don't push anything if brokerage != true
                                ]
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
                {
                    $sort: {
                        lfi_id: 1,
                        label: 1
                    }
                },
                {
                    $addFields: {
                        labels_total: {
                            $sum: "$labels.total"
                        },
                        commissions_total: {
                            $sum: "$commissions.total"
                        }
                    }
                },
                {
                    $addFields: {
                        full_total: {
                            $round: [
                                {
                                    $subtract: [
                                        "$labels_total",
                                        "$commissions_total"
                                    ]
                                },
                                2
                            ]
                        },
                        lfi_name: "$lfi_data.lfi_name"
                    }
                },
                {
                    $addFields: {
                        labels: {
                            $map: {
                                input: "$labels",
                                as: "labelItem",
                                in: {
                                    $mergeObjects: [
                                        "$$labelItem",
                                        {
                                            key: {
                                                $switch: {
                                                    branches: [
                                                        {
                                                            case: {
                                                                $eq: [
                                                                    "$$labelItem.label",
                                                                    "Merchant Collection"
                                                                ]
                                                            },
                                                            then: "merchant_collection"
                                                        },
                                                        // {
                                                        //     case: {
                                                        //         $eq: [
                                                        //             "$$labelItem.label",
                                                        //             "Merchant Collection Non-Capped"
                                                        //         ]
                                                        //     },
                                                        //     then: "merchant_collection_non_capped"
                                                        // },
                                                        {
                                                            case: {
                                                                $eq: [
                                                                    "$$labelItem.label",
                                                                    "Peer-to-Peer"
                                                                ]
                                                            },
                                                            then: "peer_to_peer"
                                                        },
                                                        {
                                                            case: {
                                                                $eq: [
                                                                    "$$labelItem.label",
                                                                    "Me-to-Me Transfer"
                                                                ]
                                                            },
                                                            then: "me_to_me_transfer"
                                                        },
                                                        {
                                                            case: {
                                                                $eq: [
                                                                    "$$labelItem.label",
                                                                    "Large Value Collection"
                                                                ]
                                                            },
                                                            then: "large_value_collection"
                                                        },
                                                        {
                                                            case: {
                                                                $eq: [
                                                                    "$$labelItem.label",
                                                                    "Corporate Payments"
                                                                ]
                                                            },
                                                            then: "corporate_payments"
                                                        },
                                                        {
                                                            case: {
                                                                $eq: [
                                                                    "$$labelItem.label",
                                                                    "Corporate Treasury Data"
                                                                ]
                                                            },
                                                            then: "corporate_treasury_data"
                                                        },
                                                        {
                                                            case: {
                                                                $eq: [
                                                                    "$$labelItem.label",
                                                                    "Customer Data"
                                                                ]
                                                            },
                                                            then: "customer_data"
                                                        }
                                                    ],
                                                    default: null
                                                }
                                            }
                                        }
                                    ]
                                }
                            }
                        }
                    }
                },
                {
                    $lookup: {
                        from: "lfi_data",
                        localField: "_id",
                        foreignField: "lfi_id",
                        as: "lfi_data"
                    }
                },
                {
                    $unwind: {
                        path: "$lfi_data"
                    }
                }
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
    async billingTppCsv(
        tpp_id: any,
        invoiceDto: any,
    ): Promise<any> {

        const timezone: string = moment.tz.guess();
        const tppData = await this.tppDataModel.findOne({ tpp_id: tpp_id });
        if (!tppData)
            throw new NotFoundException(`TppID ${tpp_id} not found.`);

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
        const result_tpp = await this.logsModel.aggregate(
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
                        category: {
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
                                        then: "Large Value Collection"
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
            ]
        )
        const log = [...result_tpp, ...result_of_lfi];

        let result;
        try {
            // Define the CSV headers
            const flattenedLog = log.map(({ _id, ...entry }) => ({
                timestamp: moment
                    .utc(entry.raw_api_log_data.timestamp)   // Parse as UTC
                    .tz(timezone)                            // Convert to local timezone
                    .format('YYYY-MM-DD HH:mm:ss'),
                lfi_id: entry.raw_api_log_data.lfi_id,
                lfi_name: entry.raw_api_log_data.lfi_name,
                tpp_id: entry.raw_api_log_data.tpp_id,
                tpp_name: entry.raw_api_log_data.tpp_name,
                tpp_client_id: entry.raw_api_log_data.tpp_client_id,
                api_set_sub: entry.raw_api_log_data.api_set_sub,
                http_method: entry.raw_api_log_data.http_method,
                url: entry.raw_api_log_data.url,
                tpp_response_code_group: entry.raw_api_log_data.tpp_response_code_group,
                execution_time: entry.raw_api_log_data.execution_time,
                interaction_id: entry.raw_api_log_data.interaction_id,
                resource_name: entry.raw_api_log_data.resource_name,
                lfi_response_code_group: entry.raw_api_log_data.lfi_response_code_group,
                is_attended: entry.raw_api_log_data.is_attended,
                records: entry.raw_api_log_data.records,
                payment_type: entry.raw_api_log_data.payment_type,
                payment_id: entry.raw_api_log_data.payment_id,
                merchant_id: entry.raw_api_log_data.merchant_id,
                psu_id: entry.raw_api_log_data.psu_id,
                is_large_corporate: entry.raw_api_log_data.is_large_corporate,
                user_type: entry.raw_api_log_data.user_type,
                purpose: entry.raw_api_log_data.purpose,
                status: entry.payment_logs.status,
                currency: entry.payment_logs.currency,
                amount: entry.payment_logs.amount,
                payment_consent_type: entry.payment_logs.payment_consent_type,
                transaction_id: entry.payment_logs.transaction_id,
                number_of_successful_transactions: entry.payment_logs.number_of_successful_transactions,
                international_payment: entry.payment_logs.international_payment,
                chargeable: entry.chargeable,
                lfiChargable: entry.lfiChargable,
                success: entry.success,
                group: entry.group,
                type: entry.type,
                discountType: entry.discountType,
                api_category: entry.api_category,
                discounted: entry.discounted,
                api_hub_fee: entry.api_hub_fee,
                applicableApiHubFee: entry.applicableApiHubFee,
                apiHubVolume: entry.apiHubVolume,
                calculatedFee: entry.calculatedFee,
                applicableFee: entry.applicableFee,
                unit_price: entry.unit_price,
                volume: entry.volume,
                appliedLimit: entry.appliedLimit,
                limitApplied: entry.limitApplied,
                isCapped: entry.isCapped,
                cappedAt: entry.cappedAt,
                numberOfPages: entry.numberOfPages,
                duplicate: entry.duplicate,
                category: entry?.category,
            }));

            const outputPath = './output/log_detail.csv';

            const directory = outputPath.substring(0, outputPath.lastIndexOf('/'));
            if (!fs.existsSync(directory)) {
                fs.mkdirSync(directory, { recursive: true });
            }

            // Define the CSV headers
            const fields = Object.keys(flattenedLog[0]); // Dynamically generate headers from data keys
            const parser = new Parser({ fields });
            const csv = parser.parse(flattenedLog);

            // Write the CSV file
            fs.writeFileSync(outputPath, csv, 'utf8');
            result = outputPath;
        } catch (error) {
            console.error("Error creating CSV file:", error);
        }
        // return merged
    }

    async tppBranchCases() {
        return [
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
        ]
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
        if (result.invoice_total != null) {
            result.invoice_total = Number(result.invoice_total.toFixed(3));
        }
        if (result.lfi_total != null) {
            result.lfi_total = Number(result.lfi_total.toFixed(3));
        }
        return result;
    }

    async billingLfiStatement(
        lfi_id: any,
        invoiceDto: any,
    ): Promise<any> {

        const lfiData = await this.lfiDataModel.findOne({ lfi_id: lfi_id }).lean<any>()
        if (!lfiData)
            throw new NotFoundException(`Lfi-ID ${lfi_id} not found.`);

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
                $match: {
                    "raw_api_log_data.lfi_id": lfi_id,
                    success: true,
                    duplicate: false,
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
                                                $eq: ["$isCapped", true]
                                            },
                                            {
                                                $eq: [
                                                    "$successfullQuote",
                                                    false
                                                ]
                                            },
                                            {
                                                $eq: ["$lfiChargable", true]
                                            },
                                            {
                                                $gt: ["$volume", 0]
                                            },
                                            {
                                                $ne: [
                                                    "$raw_api_log_data.payment_type",
                                                    "LargeValueCollection"
                                                ]
                                            }
                                        ]
                                    },
                                    then: "Merchant Collection Capped"
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
                                                $eq: ["$type", "merchant"]
                                            },
                                            {
                                                $eq: ["$isCapped", false]
                                            },
                                            {
                                                $eq: [
                                                    "$successfullQuote",
                                                    false
                                                ]
                                            },
                                            {
                                                $eq: ["$lfiChargable", true]
                                            },
                                            {
                                                $gt: ["$volume", 0]
                                            },
                                            {
                                                $ne: [
                                                    "$raw_api_log_data.payment_type",
                                                    "LargeValueCollection"
                                                ]
                                            }
                                        ]
                                    },
                                    then: "Merchant Collection Non-Capped"
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
                                                $eq: [
                                                    "$successfullQuote",
                                                    false
                                                ]
                                            },
                                            {
                                                $eq: ["$lfiChargable", true]
                                            },
                                            {
                                                $gt: ["$volume", 0]
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
                                                $eq: [
                                                    "$successfullQuote",
                                                    false
                                                ]
                                            },
                                            {
                                                $eq: ["$lfiChargable", true]
                                            },
                                            {
                                                $gt: ["$volume", 0]
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
                                            },
                                            {
                                                $eq: [
                                                    "$successfullQuote",
                                                    false
                                                ]
                                            },
                                            {
                                                $eq: ["$lfiChargable", true]
                                            },
                                            {
                                                $gt: ["$volume", 0]
                                            }
                                        ]
                                    },
                                    then: "Large Value Collection"
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
                                            },
                                            {
                                                $eq: [
                                                    "$successfullQuote",
                                                    false
                                                ]
                                            },
                                            {
                                                $eq: ["$lfiChargable", true]
                                            },
                                            {
                                                $gt: ["$volume", 0]
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
                                            },
                                            {
                                                $eq: [
                                                    "$successfullQuote",
                                                    false
                                                ]
                                            },
                                            {
                                                $eq: ["$lfiChargable", true]
                                            },
                                            {
                                                $gt: ["$volume", 0]
                                            }
                                        ]
                                    },
                                    then: "Corporate Treasury Data"
                                },
                                {
                                    case: {
                                        $and: [
                                            {
                                                $eq: ["$group", "data"]
                                            },
                                            {
                                                $eq: [
                                                    "$successfullQuote",
                                                    false
                                                ]
                                            },
                                            {
                                                $eq: ["$lfiChargable", true]
                                            },
                                            {
                                                $gt: ["$volume", 0]
                                            }
                                        ]
                                    },
                                    then: "Customer Data"
                                },
                                {
                                    case: {
                                        $and: [
                                            {
                                                $eq: [
                                                    "$api_category",
                                                    "FX Quotes"
                                                ]
                                            },
                                            {
                                                $eq: [
                                                    "$successfullQuote",
                                                    true
                                                ]
                                            },
                                            {
                                                $eq: ["$chargeable", true]
                                            }
                                        ]
                                    },
                                    then: "FX Brokerage Collection"
                                },
                                {
                                    case: {
                                        $and: [
                                            {
                                                $eq: [
                                                    "$api_category",
                                                    "Insurance Quote Sharing"
                                                ]
                                            },
                                            {
                                                $eq: [
                                                    "$successfullQuote",
                                                    true
                                                ]
                                            },
                                            {
                                                $eq: ["$chargeable", true]
                                            }
                                        ]
                                    },
                                    then: "Insurance Brokerage Collection"
                                }
                            ],
                            default: null
                        }
                    }
                }
            },
            {
                $match: {
                    label: {
                        $ne: null
                    }
                }
            },
            {
                $group: {
                    _id: {
                        tpp_id: "$raw_api_log_data.tpp_id",
                        label: "$label"
                    },
                    quantity: {
                        $sum: "$volume"
                    },
                    count: {
                        $sum: 1
                    },
                    unit_price: {
                        $first: "$unit_price"
                    },
                    total: {
                        $sum: {
                            $cond: {
                                if: {
                                    $in: [
                                        "$label",
                                        [
                                            "Insurance Brokerage Collection",
                                            "FX Brokerage Collection"
                                        ]
                                    ]
                                },
                                then: "$brokerage_fee",
                                else: "$applicableFee"
                            }
                        }
                    },
                    capped: {
                        $max: "$isCapped"
                    },
                    cappedAmount: {
                        $first: "$cappedAt"
                    },
                    brokerage_fee: {
                        $first: "$brokerage_fee"
                    },
                    brokerage: {
                        $first: {
                            $cond: {
                                if: {
                                    $in: [
                                        "$label",
                                        [
                                            "Insurance Brokerage Collection",
                                            "FX Brokerage Collection"
                                        ]
                                    ]
                                },
                                then: true,
                                else: false
                            }
                        }
                    }
                }
            },
            {
                $group: {
                    _id: "$_id.tpp_id",
                    labels: {
                        $push: {
                            label: "$_id.label",
                            quantity: {
                                $cond: {
                                    if: {
                                        $in: [
                                            "$_id.label",
                                            [
                                                "Merchant Collection Capped",
                                                "Insurance Brokerage Collection",
                                                "FX Brokerage Collection"
                                            ]
                                        ]
                                    },
                                    then: "$count",
                                    else: "$quantity"
                                }
                            },
                            unit_price: {
                                $cond: {
                                    if: {
                                        $eq: [
                                            "$_id.label",
                                            "Merchant Collection Capped"
                                        ]
                                    },
                                    then: "$cappedAmount",
                                    else: {
                                        $cond: {
                                            if: {
                                                $in: [
                                                    "$_id.label",
                                                    [
                                                        "Insurance Brokerage Collection",
                                                        "FX Brokerage Collection"
                                                    ]
                                                ]
                                            },
                                            then: "$brokerage_fee",
                                            else: {
                                                $round: ["$unit_price", 4]
                                            }
                                        }
                                    }
                                }
                            },
                            brokerage: "$brokerage",
                            total: {
                                $round: ["$total", 2]
                            },
                            capped: "$capped"
                        }
                    }
                }
            },
            {
                $sort: {
                    tpp_id: 1,
                    label: 1
                }
            },
            {
                $lookup: {
                    from: "tpp_data",
                    localField: "_id",
                    foreignField: "tpp_id",
                    as: "tpp_details"
                }
            },
            {
                $unwind: {
                    path: "$tpp_details",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $addFields: {
                    labels: {
                        $map: {
                            input: "$labels",
                            as: "labelItem",
                            in: {
                                $mergeObjects: [
                                    "$$labelItem",
                                    {
                                        key: {
                                            $switch: {
                                                branches: [
                                                    {
                                                        case: {
                                                            $eq: [
                                                                "$$labelItem.label",
                                                                "Merchant Collection Capped"
                                                            ]
                                                        },
                                                        then: "merchant_collection_capped"
                                                    },
                                                    {
                                                        case: {
                                                            $eq: [
                                                                "$$labelItem.label",
                                                                "Merchant Collection Non-Capped"
                                                            ]
                                                        },
                                                        then: "merchant_collection_non_capped"
                                                    },
                                                    {
                                                        case: {
                                                            $eq: [
                                                                "$$labelItem.label",
                                                                "FX Brokerage Collection"
                                                            ]
                                                        },
                                                        then: "fx_brokerage_collection"
                                                    },
                                                    {
                                                        case: {
                                                            $eq: [
                                                                "$$labelItem.label",
                                                                "Insurance Brokerage Collection"
                                                            ]
                                                        },
                                                        then: "insurance_brokerage_collection"
                                                    },
                                                    {
                                                        case: {
                                                            $eq: [
                                                                "$$labelItem.label",
                                                                "Peer-to-Peer"
                                                            ]
                                                        },
                                                        then: "peer_to_peer"
                                                    },
                                                    {
                                                        case: {
                                                            $eq: [
                                                                "$$labelItem.label",
                                                                "Me-to-Me Transfer"
                                                            ]
                                                        },
                                                        then: "me_to_me_transfer"
                                                    },
                                                    {
                                                        case: {
                                                            $eq: [
                                                                "$$labelItem.label",
                                                                "Large Value Collection"
                                                            ]
                                                        },
                                                        then: "large_value_collection"
                                                    },
                                                    {
                                                        case: {
                                                            $eq: [
                                                                "$$labelItem.label",
                                                                "Corporate Payments"
                                                            ]
                                                        },
                                                        then: "corporate_payments"
                                                    },
                                                    {
                                                        case: {
                                                            $eq: [
                                                                "$$labelItem.label",
                                                                "Corporate Treasury Data"
                                                            ]
                                                        },
                                                        then: "corporate_treasury_data"
                                                    },
                                                    {
                                                        case: {
                                                            $eq: [
                                                                "$$labelItem.label",
                                                                "Customer Data"
                                                            ]
                                                        },
                                                        then: "customer_data"
                                                    }
                                                ],
                                                default: null
                                            }
                                        }
                                    }
                                ]
                            }
                        }
                    }
                }
            },
            {
                $addFields: {
                    labels: {
                        $sortArray: {
                            input: "$labels",
                            sortBy: { brokerage: 1 }
                        }
                    }
                }
            },
            {
                $addFields: {
                    full_total: {
                        $round: [
                            {
                                $let: {
                                    vars: {
                                        sums: {
                                            $reduce: {
                                                input: "$labels",
                                                initialValue: {
                                                    trueTotal: 0,
                                                    falseTotal: 0
                                                },
                                                in: {
                                                    trueTotal: {
                                                        $cond: [
                                                            "$$this.brokerage",
                                                            {
                                                                $add: [
                                                                    "$$value.trueTotal",
                                                                    "$$this.total"
                                                                ]
                                                            },
                                                            "$$value.trueTotal"
                                                        ]
                                                    },
                                                    falseTotal: {
                                                        $cond: [
                                                            {
                                                                $not: [
                                                                    "$$this.brokerage"
                                                                ]
                                                            },
                                                            {
                                                                $add: [
                                                                    "$$value.falseTotal",
                                                                    "$$this.total"
                                                                ]
                                                            },
                                                            "$$value.falseTotal"
                                                        ]
                                                    }
                                                }
                                            }
                                        }
                                    },
                                    in: {
                                        $subtract: [
                                            "$$sums.falseTotal",
                                            "$$sums.trueTotal"
                                        ]
                                    }
                                }
                            },
                            2
                        ]
                    }
                }
            }
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

    async billingLfiStatementCSV(
        lfi_id: any,
        invoiceDto: any,
    ): Promise<any> {

        const timezone: string = moment.tz.guess();
        const lfiData = await this.lfiDataModel.findOne({ lfi_id: lfi_id }).lean<any>()
        if (!lfiData)
            throw new NotFoundException(`Lfi-ID ${lfi_id} not found.`);

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
                    category: {
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
                                    then: "Large Value Collection"
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
            }
        ]
        const log = await this.logsModel.aggregate(aggregation);

        let result;
        try {
            // Define the CSV headers
            const flattenedLog = log.map(({ _id, ...entry }) => ({
                timestamp: moment
                    .utc(entry.raw_api_log_data.timestamp)   // Parse as UTC
                    .tz(timezone)                            // Convert to local timezone
                    .format('YYYY-MM-DD HH:mm:ss'),
                lfi_id: entry.raw_api_log_data.lfi_id,
                lfi_name: entry.raw_api_log_data.lfi_name,
                tpp_id: entry.raw_api_log_data.tpp_id,
                tpp_name: entry.raw_api_log_data.tpp_name,
                tpp_client_id: entry.raw_api_log_data.tpp_client_id,
                api_set_sub: entry.raw_api_log_data.api_set_sub,
                http_method: entry.raw_api_log_data.http_method,
                url: entry.raw_api_log_data.url,
                tpp_response_code_group: entry.raw_api_log_data.tpp_response_code_group,
                execution_time: entry.raw_api_log_data.execution_time,
                interaction_id: entry.raw_api_log_data.interaction_id,
                resource_name: entry.raw_api_log_data.resource_name,
                lfi_response_code_group: entry.raw_api_log_data.lfi_response_code_group,
                is_attended: entry.raw_api_log_data.is_attended,
                records: entry.raw_api_log_data.records,
                payment_type: entry.raw_api_log_data.payment_type,
                payment_id: entry.raw_api_log_data.payment_id,
                merchant_id: entry.raw_api_log_data.merchant_id,
                psu_id: entry.raw_api_log_data.psu_id,
                is_large_corporate: entry.raw_api_log_data.is_large_corporate,
                user_type: entry.raw_api_log_data.user_type,
                purpose: entry.raw_api_log_data.purpose,
                status: entry.payment_logs.status,
                currency: entry.payment_logs.currency,
                amount: entry.payment_logs.amount,
                payment_consent_type: entry.payment_logs.payment_consent_type,
                transaction_id: entry.payment_logs.transaction_id,
                number_of_successful_transactions: entry.payment_logs.number_of_successful_transactions,
                international_payment: entry.payment_logs.international_payment,
                chargeable: entry.chargeable,
                lfiChargable: entry.lfiChargable,
                success: entry.success,
                group: entry.group,
                type: entry.type,
                discountType: entry.discountType,
                api_category: entry.api_category,
                discounted: entry.discounted,
                api_hub_fee: entry.api_hub_fee,
                applicableApiHubFee: entry.applicableApiHubFee,
                apiHubVolume: entry.apiHubVolume,
                calculatedFee: entry.calculatedFee,
                applicableFee: entry.applicableFee,
                unit_price: entry.unit_price,
                volume: entry.volume,
                appliedLimit: entry.appliedLimit,
                limitApplied: entry.limitApplied,
                isCapped: entry.isCapped,
                cappedAt: entry.cappedAt,
                numberOfPages: entry.numberOfPages,
                duplicate: entry.duplicate,
                category: entry?.category,
            }));

            const outputPath = './output/log_detail.csv';

            const directory = outputPath.substring(0, outputPath.lastIndexOf('/'));
            if (!fs.existsSync(directory)) {
                fs.mkdirSync(directory, { recursive: true });
            }

            // Define the CSV headers
            const fields = Object.keys(flattenedLog[0]); // Dynamically generate headers from data keys
            const parser = new Parser({ fields });
            const csv = parser.parse(flattenedLog);

            // Write the CSV file
            fs.writeFileSync(outputPath, csv, 'utf8');
            result = outputPath;
        } catch (error) {
            console.error("Error creating CSV file:", error);
        }

    }

    async findAllCollectionMemo(PaginationDTO: PaginationDTO): Promise<any> {
        const offset = PaginationDTO.offset
            ? Number(PaginationDTO.offset)
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

    async invoiceCreationSingleDay(tpp): Promise<any> {

        // Get yesterday's start and end timestamps
        // const fromDate = moment().subtract(2, 'day').startOf('day').toDate();
        const fromDate = moment().subtract(100, 'day').startOf('day').toDate();
        const toDate = moment().subtract(2, 'day').endOf('day').toDate();
        const generated_for = moment().subtract(2, 'day').toDate();

        const yesterday = moment().subtract(2, 'day');
        const month = yesterday.month() + 1; // Months are 0-indexed in Moment.js
        const year = yesterday.year();

        console.log(generated_for, fromDate, toDate)

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
        const paymentLargeValueFee = globalConfiData.find(item => item.key === "paymentLargeValueFee")?.value;
        const bulkLargeCorporatefee = globalConfiData.find(item => item.key === "bulkLargeCorporatefee")?.value;
        const dataLargeCorporateMdp = globalConfiData.find(item => item.key === "dataLargeCorporateMdp")?.value;

        const vatPercent = vat?.value ?? 5
        const vatDecimal = vatPercent / 100;
        nonLargeValueMerchantBps = Number(nonLargeValueMerchantBps) / 10000;


        const currentDate = new Date();

        // for (const tpp of tppData) {

        const result = await this.logsModel.aggregate(
            [
                {
                    $match: {
                        "raw_api_log_data.tpp_id": tpp?.tpp_id,
                        "chargeable": true,
                        "success": true,
                        'raw_api_log_data.timestamp': {
                            $gte: fromDate,
                            $lte: toDate
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
                        'raw_api_log_data.timestamp': {
                            $gte: fromDate,
                            $lte: toDate
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
                                        then: "Large Value Collection"  // paymentLargeValueFee
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
                    $match: {
                        total: { $ne: 0 }
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
                                                        { case: { $eq: ["$$expectedLabel", "Large value collection"] }, then: paymentLargeValueFee },
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


        for (const obj of result_of_lfi) {
            console.log(obj)
            const tpp_id = tpp?.tpp_id; // replace with your actual ID
            let collection_memo_data = await this.singleDayCollectionMemoModel.findOne(
                {
                    lfi_id: obj?._id,
                    month: month,
                    year: year
                }
            );

            if (collection_memo_data) {

                const new_tpp_data = {
                    tpp_id: tpp_id,
                    tpp_name: tpp?.tpp_name,
                    collection_memo_subitem: obj.labels,
                    full_total: obj?.full_total,
                    vat_percent: 5,
                    date: new Date()
                };

                const tppExists = collection_memo_data.tpp.some((t: any) => t.tpp_id === tpp_id);
                if (!tppExists) {
                    collection_memo_data.tpp.push(new_tpp_data);
                    await collection_memo_data.save();
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
                        date: new Date()
                    }],

                })
                await coll_memo_tpp.save();
            }
        }

        return 'completed';

    }

    async invoiceCreationMonthlyTpp(tpp): Promise<any> {

        // const startDate = moment().subtract(1, 'months').startOf('month');
        const startDate = moment().startOf('month').toDate();
        const endDate = moment().endOf('month').toDate();

        const futureDate = new Date();
        const currentDate = new Date();
        futureDate.setDate(currentDate.getDate() + 30);

        const day = moment();
        const month = day.month() + 1; // Months are 0-indexed in Moment.js
        const year = day.year();
        console.log(month, year);

        const global_vat = await this.globalModel.findOne({
            key: 'vatPercentageValue',
        });
        const vatPercent = global_vat?.value ?? 5
        const vatDecimal = vatPercent / 100;

        // for (const tpp of tppData) {

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
        // console.log(result_of_tpp[0]?.invoice_items)
        // const total = result_of_tpp[0]?.invoice_items.reduce((sum, item) => sum + item.category_total, 0);


        // const roundedTotal = Math.round(total * 100) / 100; // 0.23
        // const roundedVat = Math.round(vat * 100) / 100;

        //           
        const invoice_total = result_of_tpp[0]?.invoice_items.reduce((sum, item) => sum + item.category_total, 0);
        const vat = invoice_total * vatDecimal;

        const lfi_total = result_of_tpp[0]?.tpp_usage_per_lfi.reduce((sum, item) => sum + item.full_total, 0);

        const total = Number(invoice_total) + Number(lfi_total);
        const roundedTotal = Math.round(total * 100) / 100;
        const roundedVat = Math.round(vat * 100) / 100;

        // const updated_result = await this.ensureCategories(result_of_tpp[0]?.invoice_items);
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
            tpp_usage_per_lfi: result_of_tpp[0]?.tpp_usage_per_lfi,
            invoice_items: result_of_tpp[0]?.invoice_items,
            vat_percent: vatPercent, // Default 5 percent
            vat_total: roundedVat,  // vat percent of invoice total
            total_amount: roundedTotal,  // total of invoice array
            invoice_total: invoice_total,
            lfi_total: lfi_total,
            status: 1,
            notes: 'Invoice Added',
        }
        const invoice = new this.invoiceModel(invoice_data)
        const invoice_save = await invoice.save();
        console.log(invoice_save)
        return invoice_save
        // }

    }

    async invoiceCreationMonthlyLfi(lfi): Promise<any> {

        const startDate = moment().subtract(1, 'months').startOf('month');
        // const endDate = moment().subtract(1, 'months').endOf('month');
        const endDate = moment().endOf('month').toDate();
        // const lfiData = await this.lfiDataModel.find();

        // for (const obj of lfiData) {

        const result_of_collection_memo = await this.singleDayCollectionMemoModel.aggregate(
            [
                {
                    '$match': {
                        'lfi_id': lfi.lfi_id,
                        // 'createdAt': {
                        //     $gte: startDate,
                        //     $lte: endDate
                        // }
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
                        '_id': lfi.lfi_id,
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
        const lfiData = await this.lfiDataModel.findOne({ lfi_id: lfi?.lfi_id });

        const coll_memo_tpp = new this.collectionMemoModel({
            invoice_number: await this.generateCollectionMemoInvNumber(),
            lfi_id: lfi?.lfi_id,
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
        const collectionMemo = await coll_memo_tpp.save();

        // }
        return collectionMemo;
    }
    async invoiceTppAggregation(data: any) {
        let tpp_id = data.tpp_id
        let month = data.month ?? data.invoice_month
        let year = data.year ?? data.invoice_year

        const tppData = await this.tppDataModel.findOne({ tpp_id: data.tpp_id }).lean<any>();
        if (!tppData)
            throw new NotFoundException('Invalid Tpp-ID');
        console.log(tppData)

        const result = await this.invoiceModel.findOne({
            tpp_id: tpp_id,
            invoice_month: month,
            invoice_year: year
        })
        console.log({
            tpp_id: tpp_id,
            invoice_month: month,
            invoice_year: year
        })
        if (result.invoice_total != null) {
            result.invoice_total = Number(result.invoice_total.toFixed(3));
        }
        if (result.lfi_total != null) {
            result.lfi_total = Number(result.lfi_total.toFixed(3));
        }
        return result
    }
    async invoiceLfi_PDF_Aggregation(data: any) {
        let lfi_id = data.lfi_id
        let month = data.month ?? data.invoice_month
        let year = data.year ?? data.invoice_year;

        const lfiData = await this.lfiDataModel.findOne({ lfi_id: lfi_id }).lean<any>();
        if (!lfiData)
            throw new NotFoundException('Invalid Lfi-ID');

        const result = await this.collectionMemoModel.findOne({
            lfi_id: lfi_id,
            invoice_month: month,
            invoice_year: year
        }).lean<any>();

        result.lfi_details = lfiData;

        return result
    }

    async generateInvoicePDFTpp(data: any, mail: boolean = false) {
        if (!fs.existsSync(`./temp`)) {
            fs.mkdirSync(`./temp`)
        }

        const tppData = await this.tppDataModel.findOne({ tpp_id: data.tpp_id }).lean<any>();
        if (!tppData)
            throw new NotFoundException('Invalid Tpp-ID');

        let email = tppData?.email_address ?? 'rahulmanikandan0298@gmail.com'

        const currentDate = new Date();
        const timestamp = currentDate.getTime();
        const invoice_data = await this.invoiceTppAggregation(data)
        let attachment_html = await this.invoiceTemplate(invoice_data)
        const attachmentPath = `./temp/invoice${timestamp}.pdf`
        console.log("LOG!")
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage()
        await page.setContent(attachment_html, {
            waitUntil: 'networkidle0',
        });
        await page.content();

        console.log("PDF")
        // Generate PDF with header and footer
        const pdfBuffer = await page.pdf({
            path: attachmentPath,
            format: 'A4',
            printBackground: true,
            displayHeaderFooter: true,
            headerTemplate: await this.header_template(),
            footerTemplate: await this.footer_template(),
            margin: {
                top: '70px',
                bottom: '100px',
                left: '20px',
                right: '20px'
            }
        });
        await browser.close();
        let result;
        if (mail) {
            try {
                console.log("EMAIL", email)
                if (!Array.isArray(email) || email.length === 0) {
                    throw new NotFoundException('No valid recipient email addresses provided.');
                }
                let tpp = true;
                const mailResponse = await this.mailService.sendInvoiceEmail(attachmentPath, email, invoice_data?.tpp_name, invoice_data?.invoice_number, tpp, invoice_data); // Ensure mailservi.sendmail returns a response
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
                throw error;
            }
        } else {
            result = attachmentPath
        }

        return result;
    }

    async invoiceTemplate(data: any): Promise<any> {
        try {

            let nebras_taxable_amount = data.invoice_items?.reduce((sum, item) => sum + item.sub_total, 0);

            let lfi_list = ''
            let lfi_count = 2;

            let total_due = Number(data.total_amount);

            const monthName = moment().month(data.invoice_month - 1).format('MMMM');
            const firstDay = moment(`${data?.invoice_year}-${data?.invoice_month}`, 'YYYY-M').startOf('month').format('Do MMMM YYYY');
            const lastDay = moment(`${data?.invoice_year}-${data?.invoice_month}`, 'YYYY-M').endOf('month').format('Do MMMM YYYY');

            for (const item of data?.tpp_usage_per_lfi) {
                lfi_list += `<tr>
                        <td class="table-td">00${lfi_count}</td>
                        <td class="table-td">${item?.lfi_data?.lfi_name} - ${item?.lfi_data?.lfi_id} (${item.full_total >= 0 ? 'Debit' : 'Credit'})</td>
                        <td class="table-total">${Math.abs(item.full_total)?.toFixed(2)} </td>
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
                <table class="table-bottom">
                <thead>
                    <tr>
                    <th style="width: 7%">No.</th>
                    <th style="width: 75%">Licensed Financial Institutions</th>
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
                <td class="table-total">${service_items?.quantity ?? 0}</td>
                <td class="table-total">${service_items?.unit_price ?? 0}</td>
                <td class="table-total">${service_items?.total?.toFixed(2) ?? 0.00}</td>
                <td class="table-total">5</td>
                <td class="table-total">${service_items?.vat_amount?.toFixed(2) ?? 0}</td>
                <td class="table-total">${service_items?.full_total?.toFixed(2) ?? 0.00}</td>
            </tr>`;
            }

            const dataSharingItem = data?.invoice_items.find(item => item.category === 'data_sharing') ?? [];
            let data_sharing = ''

            for (const data_items of dataSharingItem?.items) {

                data_sharing += ` <tr>
                <td>${data_items.description}</td>
                <td class="table-total">${data_items?.quantity ?? 0.00}</td>
                <td class="table-total">${data_items?.unit_price ?? 0.00}</td>
                <td class="table-total">${data_items?.total?.toFixed(2) ?? 0.00}</td>
                <td class="table-total">5</td>
                <td class="table-total">${data_items?.vat_amount?.toFixed(2) ?? 0.00}</td>
                <td class="table-total">${data_items?.full_total?.toFixed(2) ?? 0.00}</td>
            </tr>`;
            }


            const serviceFeeItem = data?.invoice_items.find(item => item?.category === 'service_fee') ?? [];
            let service_fee = ''

            if (serviceFeeItem && serviceFeeItem.length != 0) {
                let service_fee_array = ''

                for (const service_fee_items of serviceFeeItem?.items ?? []) {
                    service_fee_array += ` <tr>
                    <td>${service_fee_items.description}</td>
                    <td class="table-total">${service_fee_items?.quantity ?? 0.00}</td>
                    <td class="table-total">${service_fee_items?.unit_price ?? 0.00}</td>
                    <td class="table-total">${service_fee_items?.total?.toFixed(2) ?? 0.00}</td>
                    <td class="table-total">5</td>
                    <td class="table-total">${service_fee_items?.vat_amount ?? 0}</td>
                    <td class="table-total">${service_fee_items?.full_total?.toFixed(2) ?? 0.00}</td>
                </tr>`;
                }

                service_fee +=
                    `<div class="section" style = "padding-bottom:0px !important; margin-bottom:0px !important;">
                        <div class="section-title">
                            <span>Service Fee</span>
                            
                        </div>

                        <table>
                            <thead>
                                <tr>
                                    <th>Description </th>
                                    <th class="table-total">Amount Collected</th>
                                    <th class="table-total">Collection %</th>
                                    <th class="table-total">Taxable Amount </th>
                                    <th class="table-total">VAT % </th>
                                    <th class="table-total">VAT Amount  </th>
                                    <th class="table-total">Gross Amount </th>
                                </tr>
                            </thead>
                            <tbody>
                                ${service_fee_array}
                                <tr class="">
                                    <td class="sub-total-row " colspan="6">SUB TOTAL</td>
                                    <td class="table-total">${serviceFeeItem?.category_total ?? 0.00}</td>
                                </tr>
                            </tbody>
                        </table>
                        
                    </div>`
            }

            let collection_memo = ''
            let displayIndex = 0;
            for (const memo of data?.tpp_usage_per_lfi || []) {
                console.log("MEMO", memo)
                displayIndex++;
                collection_memo += ` 
            <div class="new-page-section">

            <div class="">
                <div class="header">
                    <div>
                        <div class="title">Collection Memo</div>
                        <h3 style="margin-top:7px; margin-bottom:8px;">Nebras Collection Services</h3>
                        <div class="memo-number">Collection Memo 00${displayIndex}</div>
                        <div class="date">${moment(data.generated_at).format('D MMMM YYYY')}</div>
                        <div class="lfi-info">
                            <div>${memo.lfi_name}</div>
                            <div class="lfi-info-space" style="margin-bottom: 0.8rem;">${memo._id}</div>
                            <div class="lfi-info-space">4567 Business Park, Innovation City, IC 12345<br>United Arab
                                Emirates</div>
                        </div>
                    </div>

                </div>

                <div class="collection-summary">
                    <div class="summary-title">${memo.lfi_name} Collection Summary:</div>
                    <div class="billing-period">Billing Period: ${firstDay} to ${lastDay}</div>
                `;

                if (memo?.labels && memo?.labels.length != 0) {
                    collection_memo += ` 
                        <table>
                        <colgroup>
                            <col style="width: 57%">
                            <col style="width: 10%">
                            <col style="width: 18%">
                            <col style="width: 15%">
                        </colgroup>
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
                        <td>${label.label} ${label?.key === 'merchant_collection' ? '**' : ''} </td>
                        <td class="table-total">${label?.quantity ?? 0}</td>
                        <td class="table-total">${label?.unit_price.toFixed(4) ?? 0.000}</td>
                        <td class="table-total">${label?.total?.toFixed(2) ?? 0.00}</td>
                        </tr>
                        `;
                    }
                    collection_memo += `
                        </tbody>
                        </table> 
                    `
                }

                if (memo?.commissions && memo?.commissions.length != 0) {
                    collection_memo += `
                        <div class="summary-title">Commissions</div>
                        <table>
                        <colgroup>
                            <col style="width: 57%">
                            <col style="width: 10%">
                            <col style="width: 18%">
                            <col style="width: 15%">
                        </colgroup>
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

                    for (const label of memo.commissions || []) {

                        collection_memo += `
                            <tr>
                            <td>${label.label} </td>
                            <td class="table-total">${label?.quantity ?? 0}</td>
                            <td class="table-total">${label?.unit_price.toFixed(3) ?? 0.000}</td>
                            <td class="table-total">${label?.total?.toFixed(2) ?? 0.00}</td>
                            </tr>
                    `;
                    }
                    collection_memo += `
                        </tbody>
                        </table> 
                    `
                }

                collection_memo += `
                    <div class="invoice-summary-wrapper">
                        <div class="invoice-total">
                            <span class="invoice-total-label">NET TOTAL (${memo.full_total >= 0 ? 'Debit' : 'Credit'})</span>
                            <span class="invoice-total-amount">AED ${(Math.abs(memo?.full_total)).toFixed(2) ?? 0}</span> 
                        </div>
                        <div class="note">
                            ** - This total is calculated after the application of the per transaction cap for collection fees.
                        </div>
                    </div>
                </div>

                <div class="note" style="margin-top:0px;">
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
            font-size: 12px;
            font-style: italic;
            color: #1b194f;
            white-space: nowrap; /* keep in one line */
            margin-left: 20px;
            margin-top: 20px;
            
        }
       
        .billing-row {
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

        .billing-label-grid {
            display: grid;
            grid-template-columns: 150px 10px 1fr;
            align-items: start;
            font-weight: 500;
            gap: 5px;
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
        .label-text {
            text-align: left;
        }
        .colon {
            text-align: center;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom:10px !important;;
            font-size:14px;
        }

        table-bottom {
            
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
            margin-bottom: 15px;
        }

        .section-title {
            font-weight: bold;
            color: #1b194f;
            margin-bottom: 5px;
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

       .invoice-summary-wrapper {            
            margin-top: 30px;
            margin-bottom: 9px;
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
            margin-top: 12px;
            color: #1b194f;
            font-weight: bold;
        }
        .header h3 {
            font-size: 20px;
            margin: 6;
            color: #000046;
        }


        .collection-summary {
            margin-top: 20px;
            margin-bottom: 0;   
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
            <h3 class="billing-sub-label">Billed To</h3>
            <div class="billing-row">
            <div class="billing-label-grid">
                <div class="billing-label">TPP NAME </div>
                <div class="colon">:</div>
                <div class="billing-sub-label">${data.tpp_name}</div>
            </div>     
            </div>
            <div class="billing-row">
                <div class="billing-label-grid">
                    <div class="billing-label">TPP ID </div>
                    <div class="colon">:</div>
                    <div class="billing-sub-label">${data.tpp_id}</div>
                </div>
            </div>
            <div class="billing-row">
                <div class="billing-label-grid">
                    <div class="billing-label">TPP ADDRESS </div>
                    <div class="colon">:</div>
                    <div class="billing-sub-label">${data.billing_address_line1}<br>${data.billing_address_line2}<br>${data.billing_address_country}</div>
                </div>
            </div>

            <div class="billing-row">
                <div class="billing-label-grid">
                    <div class="billing-label">Invoice Currency </div>
                    <div class="colon">:</div>
                    <div class="billing-sub-label">AED </div>
                </div>
            </div>
            <div class="billing-row">
                <div class="billing-label-grid">
                    <div class="billing-label">TPP TRN </div>
                    <div class="colon">:</div>
                    <div class="billing-sub-label" ></div>
                </div>
            </div>
            <div class="billing-row">
                <div class="billing-label-grid">
                    <div class="billing-label">Nebras TRN </div>
                    <div class="colon">:</div>
                    <div class="billing-sub-label"></div>
                </div>
            </div>
            <div class="billing-row">
                <div class="billing-label-grid">
                    <div class="billing-label">Period</div>
                    <div class="colon">:</div>
                    <div class="billing-sub-label">${firstDay} to ${lastDay}
                </div>
            </div>
        </div>


        <div class="statement-summary">
            <table  class="table-bottom">
                <thead>
                    <tr>
                        <th style="width: 7%">No.</th>
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
                        <td class="table-td table-total">${nebras_taxable_amount?.toFixed(2)}</td>
                        <td class="table-td table-total">${data?.vat_percent}</td>
                        <td class="table-td table-total">${data?.vat_total.toFixed(2)}</td>
                        <td class="table-total">${data?.invoice_total.toFixed(2)}</td>
                    </tr>
                  
                </tbody>
            </table>

            
            ${tableHtml}
                

            <div class="total-row">
                Total due AED <b>${Math.abs(total_due).toFixed(2)}</b> by <b>${moment(data.due_date).format('Do MMMM YYYY')}</b>
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
                        <div class="invoice-number">Invoice <span> ${data.invoice_number}</span></div>
                        <div class="invoice-date">${moment(data.createdAt).format('DD MMMM YYYY')}</div>
                    </div>

                </div>
                <div class="billing-info">
                    <div class="billing-row">
                        <div class="billing-label-grid">
                            <div class="billing-label">Billing Period </div>
                            <div class="colon">:</div>
                            <div class="billing-sub-label">${firstDay} to ${lastDay}</div>
                        </div>
                    </div>
                    <div class="billing-row">
                        <div class="billing-label-grid">
                            <div class="billing-label">Invoice Currency </div>
                            <div class="colon">:</div>
                            <div class="billing-sub-label">AED </div>
                        </div>
                    </div>
                    <div class="billing-row">
                        <div class="billing-label-grid">
                            <div class="billing-label">TPP TRN </div>
                            <div class="colon">:</div>
                            <div class="billing-sub-label" >TPP123456</div>
                        </div>
                    </div>
                  
                    <div class="billing-row">
                        <div class="billing-label-grid">
                            <div class="billing-label">Nebras TRN </div>
                            <div class="colon">:</div>
                            <div class="billing-sub-label"></div>
                        </div>
                    </div>
        
                </div>

                <div class="section">
                    <div class="section-title">
                        <span>Service Initiation</span>
                        
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
                                <td class="table-total">${serviceInitiationItem?.category_total?.toFixed(2) ?? 0.00}</td>
                            </tr>
                        </tbody>
                    </table>
                    
                </div>

                <div class="section">
                    <div class="section-title">
                        <span>Data Sharing</span>
                       
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
                                <td class="table-total">${dataSharingItem?.category_total?.toFixed(2) ?? 0.00}</td>
                            </tr>
                            
                        </tbody>
                    </table>
                </div>

                
                ${service_fee}

                <div class="invoice-total" style = "padding-top:0px !important; margin-top:0px !important;">
                    <span class="invoice-total-label">Invoice Total</span>
                    <span class="invoice-total-amount"> AED ${data?.invoice_total ?? 0.00}</span>
                </div>


            </div>
        </div>

        ${collection_memo}

    </div>
</body>

</html>
        `
        } catch (err) {
            console.log(err)
            // await this.jobLogService.log(tppId, 'INVOICE_GENERATION', 'FAILED', err.message, { stack: err.stack });
        }
    }

    async generateInvoicePDFLfi(data: any, mail: boolean = false) {
        if (!fs.existsSync(`./temp`)) {
            fs.mkdirSync(`./temp`)
        }

        const lfiData = await this.lfiDataModel.findOne({ lfi_id: data.lfi_id }).lean<any>();
        if (!lfiData)
            throw new NotFoundException('Invalid Lfi-ID');

        let email = lfiData?.email_address

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

        let result;
        if (mail) {
            try {
                let tpp = false;
                if (!Array.isArray(email) || email.length === 0) {
                    throw new NotFoundException('No valid recipient email addresses provided.');
                }
                const mailResponse = await this.mailService.sendInvoiceEmail(attachmentPath, email, invoice_data?.lfi_name, invoice_data?.invoice_number, tpp, invoice_data); // Ensure mailservi.sendmail returns a response
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
                throw error;
            }
        } else {
            result = attachmentPath
        }

        return result;
    }

    async header_template() {
        return `

    <div style="font-size:10px; margin:0; padding:0; width:100%; height:0 text-align: right; padding-right: 20px;">
        <img style="position:fixed; top:0; right:0; width:250px; height:auto; margin:0; padding:0;  padding-right: 20px;" src='data:image/png;base64,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'/>   
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

        const firstDay = moment(`${data?.invoice_year}-${data?.invoice_month}`, 'YYYY-M').startOf('month').format('Do MMMM YYYY');
        const lastDay = moment(`${data?.invoice_year}-${data?.invoice_month}`, 'YYYY-M').endOf('month').format('Do MMMM YYYY');
        console.log("DAY", firstDay, lastDay);

        for (const tpp_data of data.tpp || []) {
            revenue_data += `<tr class="tpp-name">
                <td rowspan="${(tpp_data.collection_memo_subitem?.length || 0) + 2}">
                ${tpp_data.tpp_name}
                </td>
            </tr>`;

            for (const item of tpp_data.collection_memo_subitem || []) {
                revenue_data += `
                <tr>
                    <td>${item.label} ${item?.brokerage === true ? ' (Debit)' : ''} ${item?.key === 'merchant_collection' ? '**' : ''}</td>
                    <td class="table-total">${item?.quantity}</td>
                    <td class="table-total">${item?.unit_price?.toFixed(4)}</td>
                    <td class="table-total">${item?.total?.toFixed(2)}</td>
                </tr>`;
            }

            revenue_data += `
                <tr class="sub-total">
                <td colspan="3">Net Total</td>
                <td class="table-total">${Math.abs(tpp_data?.full_total).toFixed(2)}</td>
                </tr>`;
        }


        return `
        <!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LFI Statement of Fees</title>
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
            font-size: 30px;
            margin: 0;
            color: #000046;
        }

        .header h3 {
            font-size: 20px;
            margin: 8;
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
            color: #1b194f;
        }

        th {
            color: #000046;
            font-weight: bold;
            border: 1px solid #000000;
        }

        thead {
            background-color: #c2c1eb !important;
        }

        .table-total {
            text-align: right;

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
            font-weight: 500;
        }
        .date{
            font-weight: 400;  
            color: #1b194f;

        }
        .info-row {
            display: flex;
            gap: 5px;
            color: #1b194f;
            margin: 4px 0;
        }
        .label {    min-width: 130px;   }

        .value {
            flex: 1;
        }

        .note {
            font-size: 12px;
            font-style: italic;
            color: #1b194f;
            white-space: nowrap; /* keep in one line */
            margin-left: 20px;
            margin-top: 20px;
            
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
                <h1>LFI STATEMENT OF FEES</h1>
                <h3>Nebras Collection Services</h3>
                <p style="color: #1b194f;">Fee Statement 001<br>${moment(data.createdAt).format('DD MMMM YYYY')} </p>
                <p class="lif-details"><br>${data.lfi_name}<br>LFI ID:${data.lfi_id}</p>
                <p class="lif-details">${data?.lfi_details?.addressLine_2 || ''}</p>
            </div>

        </div>

        <div class="section">
            <h2>Fee Summary:</h2>
            <div class="info-row date">
                <span class="label">Billing Period: ${firstDay} to ${lastDay}</span>
            </div>
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
                    <td class="table-total">${Math.abs(grand_total)?.toFixed(2)}</td>
                </tr>
            </tbody>
        </table>

        <div class="note">
            ** - This total is calculated after the application of the per transaction cap for collection fees.
        </div>
        <div class="note">
            Note: The Grand Total is Net adjusted amount against commission amount.
        </div>

 

    </div>
</body>

</html>
        `
    }


    async generatePdf(invoice: any, key: string) {
        // Use puppeteer / pdfkit to generate PDF and return file path or buffer
        if (key === 'tpp') {
            await this.generateInvoicePDFTpp(invoice, true);
        } else {
            console.log("LFI-PDF")
            await this.generateInvoicePDFLfi(invoice, true);
        }
    }

    async sendEmail(invoice: any, pdf: Buffer) {
        // await this.mailService.send({
        //     to: invoice.tpp_email,
        //     subject: 'Your Invoice',
        //     text: 'Please find attached.',
        //     attachments: [{ filename: 'invoice.pdf', content: pdf }],
        // });
    }

    // async handleDailyCron() {
    //     const allTPPs = await this.tppDataModel.find();
    //     console.log("CRONE RUNNING");
    //     for (const tpp of allTPPs) {
    //         await this.invoiceQueue.add('daily-crone', { tpp });
    //     }
    // }

    // @Cron('*/5 * * * * *') // Every 5 seconds
    // @Cron('0 0 1 * *') // Every month start
    // @Cron('0 57 14 * * *') // 8:50:00 AM every day
    async handleDailyCron() {
        console.log("CRONEEEE")
        const allTPPs = await this.tppDataModel.find({ tpp_id: "8857656" }).limit(1);
        for (const tpp of allTPPs) {
            console.log("LOOP-ENTER", allTPPs)
            await this.invoiceQueue.add('generate-invoice-daily', { tpp });
        }
    }

    // @Cron('00 57 11 * * *') // 8:50:00 AM every day
    async handleMonthlyCronForTPP() {
        console.log("CRONEEEE")
        const allTPPs = await this.tppDataModel.find({ tpp_id: "8857656" }).limit(1);
        for (const tpp of allTPPs) {
            console.log("LOOP-ENTER", allTPPs)
            await this.invoiceQueue.add('generate-invoice-tpp', { tpp });
        }
    }

    // @Cron('00 53 14 * * *') // 8:50:00 AM every day
    async handleMonthlyCronForLFI() {
        console.log("CRONEEEE")
        const allLfis = await this.lfiDataModel.find({ lfi_id: "12332987" }).limit(1);
        for (const lfi of allLfis) {
            console.log("LOOP-ENTER", allLfis)
            await this.invoiceQueue.add('generate-invoice-lfi', { lfi });
        }
    }



}


