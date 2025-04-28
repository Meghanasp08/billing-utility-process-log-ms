import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PaginationDTO } from 'src/common/dto/common.dto';
import { PaginationEnum, } from 'src/common/constants/constants.enum';
import * as moment from 'moment'
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
            options.$or = [
            ];
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

        const tppData = await this.tppDataModel.find();

        let month = invoiceDto?.month;
        let year = invoiceDto?.year;
        if (month < 1 || month > 12)
            throw new Error('Invalid month (1-12)');

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
                            $expr: {
                                $and: [
                                    {
                                        $eq: [
                                            {
                                                $month: "$createdAt"
                                            },
                                            month
                                        ]
                                    },
                                    {
                                        $eq: [
                                            {
                                                $year: "$createdAt"
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
                                            then: "Corporate Payment"
                                        },
                                        {
                                            case: {
                                                $eq: [
                                                    "$group",
                                                    "payment-non-bulk"
                                                ]
                                            },
                                            then: "Payment Initiation"
                                        },
                                        {
                                            case: {
                                                $eq: ["$group", "insurance"]
                                            },
                                            then: "Insurance"
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
                                            then: "Setup and Consent"
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
                                            then: "Corporate Payment Data"
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
                                            then: "Confirmation of Payee(Discounted)"
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
                                            then: "Balance(Discounted)"
                                        },
                                        {
                                            case: {
                                                $eq: ["$group", "data"]
                                            },
                                            then: "Bank Data Sharing"
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
                                $sum: 1
                            },
                            unit_price: {
                                $first: "$api_hub_fee"
                            },
                            total: {
                                $sum: "$api_hub_fee"
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
                                    $round: ["$total", 4]
                                },
                                vat_amount: {
                                    $multiply: ["$total", 0.05]
                                },
                                full_total: {
                                    $add: [
                                        "$total",
                                        {
                                            $multiply: ["$total", 0.05]
                                        }
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
                    // {
                    //   $addFields: {
                    //     allItems: {
                    //       $cond: {
                    //         if: {
                    //           $eq: ["$_id", "service_initiation"]
                    //         },
                    //         then: [
                    //           "Corporate Treasury",
                    //           "Payment Initiation"
                    //         ],
                    //         else: [
                    //           "Insurance",
                    //           "Setup and Consent",
                    //           "Corporate Treasury Data",
                    //           "Confirmation of Payee",
                    //           "Balance(Discounted)",
                    //           "Bank Data Sharing"
                    //         ]
                    //       }
                    //     }
                    //   }
                    // }
                    // {
                    //   $addFields: {
                    //     items: {
                    //       $map: {
                    //         input: "$allItems",
                    //         as: "desc",
                    //         in: {
                    //           $let: {
                    //             vars: {
                    //               matchedItem: {
                    //                 $first: {
                    //                   $filter: {
                    //                     input: "$items",
                    //                     as: "item",
                    //                     cond: {
                    //                       $eq: [
                    //                         "$$item.description",
                    //                         "$$desc"
                    //                       ]
                    //                     }
                    //                   }
                    //                 }
                    //               }
                    //             },
                    //             in: {
                    //               description: "$$desc",
                    //               quantity: {
                    //                 $ifNull: [
                    //                   "$$matchedItem.quantity",
                    //                   0
                    //                 ]
                    //               },
                    //               unit_price: {
                    //                 $ifNull: [
                    //                   "$$matchedItem.unit_price",
                    //                   0.25
                    //                 ]
                    //               },
                    //               total: {
                    //                 $ifNull: [
                    //                   "$$matchedItem.total",
                    //                   0
                    //                 ]
                    //               }
                    //             }
                    //           }
                    //         }
                    //       }
                    //     }
                    //   }
                    // }
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
                                        $multiply: ["$sub_total", 0.05]
                                    },
                                    4
                                ]
                            },
                            category_total: {
                                $round: [
                                    {
                                        $add: [
                                            "$sub_total",
                                            {
                                                $multiply: ["$sub_total", 0.05]
                                            }
                                        ]
                                    },
                                    4
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
                        '$match': {
                            'raw_api_log_data.tpp_id': tpp?.tpp_id,
                            '$expr': {
                                '$and': [
                                    {
                                        '$eq': [
                                            {
                                                '$month': '$createdAt'
                                            }, month
                                        ]
                                    }, {
                                        '$eq': [
                                            {
                                                '$year': '$createdAt'
                                            }, year
                                        ]
                                    }
                                ]
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
                                            'then': 'Peer-to Peer'
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
                                    },
                                    'vat_amount': {
                                        '$multiply': [
                                            '$total', 0.05
                                        ]
                                    },
                                    'full_total': {
                                        '$add': [
                                            '$total', {
                                                '$multiply': [
                                                    '$total', 0.05
                                                ]
                                            }
                                        ]
                                    }
                                }
                            }
                        }
                    }, {
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
            const total = result.reduce((sum, item) => sum + item.category_total, 0);

            const vat = total * 0.05;

            const roundedTotal = Math.round(total * 100) / 100; // 0.23
            const roundedVat = Math.round(vat * 100) / 100;

            // const updated_result = await this.ensureCategories(result);
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
                tpp_usage_per_lfi: result_of_lfi,
                invoice_items: result,
                // subtotal: 0, // vendaaaa
                vat_percent: 5, // Default 5 percent
                vat_total: roundedVat,  // vat percent of invoice total
                total_amount: roundedTotal,  // total of invoice array
                status: 1,
                notes: 'Invoice Added',
            }
            const invoice = new this.invoiceModel(invoice_data)
            await invoice.save();


            for (const obj of result_of_lfi) {
                console.log(obj)
                const tpp_id = tpp?.tpp_id; // replace with your actual ID
                let collection_memo_data = await this.collectionMemoModel.findOne({ lfi_id: obj?._id });
                if (collection_memo_data) {
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

                    const tppExists = collection_memo_data.tpp.some((t: any) => t.tpp_id === tpp_id);
                    console.log("LOG_ID2")
                    if (!tppExists) {
                        console.log("LOG_ID3")
                        collection_memo_data.tpp.push(new_tpp_data);
                        collection_memo_data.vat_total = collection_memo_data?.vat_total?? 0 + obj?.vat
                        collection_memo_data.total_amount = collection_memo_data?.total_amount?? 0 + obj?.actual_total
                        await collection_memo_data.save();
                    } else {
                        console.log("LOG_ID4")
                    }
                } else {
                    console.log(obj)
                    console.log("LABELS", obj.labels)

                    const memo_total = result.reduce((sum, item) => sum + item.category_total, 0);
                    const memo_vat = total * 0.05;
                    const memo_roundedTotal = Math.round(total * 100) / 100; // 0.23
                    const memo_roundedVat = Math.round(vat * 100) / 100;

                    const lfiData = await this.lfiDataModel.findOne({ lfi_id: obj?._id });
                    const coll_memo_tpp = new this.collectionMemoModel({
                        invoice_number: await this.generateInvoiceNumber(),
                        lfi_id: obj?._id,
                        lfi_name: lfiData.lfi_name,
                        billing_period_start: startDate,  // Month First
                        billing_period_end: endDate,   // Month Last
                        generated_at: new Date(),        // Generate Date
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
                        vat_percent: 5, // Default 5 percent
                        vat_total: obj?.vat,  // vat percent of invoice total
                        total_amount: obj?.actual_total,  // total of invoice array
                        status: 1,
                    })
                    await coll_memo_tpp.save();
                }
            }
        }
    }

    async ensureCategories(inputArray) {
        // Define default values for each category
        const categoryDefaults = {
            data_sharing: {
                "items": [
                    {
                        "description": "Insurance",
                        "quantity": 0,
                        "unit_price": 0.025,
                        "total": 0
                    },
                    {
                        "description": "Setup and Consent",
                        "quantity": 0,
                        "unit_price": 0.25,
                        "total": 0
                    },
                    {
                        "description": "Corporate Payment Data",
                        "quantity": 0,
                        "unit_price": 0.025,
                        "total": 0
                    },
                    {
                        "description": "Confirmation of Payee(Discounted)",
                        "quantity": 0,
                        "unit_price": 0.25,
                        "total": 0
                    },
                    {
                        "description": "Balance(Discounted)",
                        "quantity": 0,
                        "unit_price": 0.25,
                        "total": 0
                    },
                    {
                        "description": "Bank Data Sharing",
                        "quantity": 0,
                        "unit_price": 0.025,
                        "total": 0
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
                        "unit_price": 0.025,
                        "total": 0.0
                    },
                    {
                        "description": "Payment Initiation",
                        "quantity": 0,
                        "unit_price": 0.025,
                        "total": 0.00
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

        const startDate = invoiceDto?.startDate
            ? moment(invoiceDto?.fromdate, 'DD-MM-YYYY').startOf('day').format()
            : null
        const endDate = invoiceDto?.endDate
            ? moment(invoiceDto?.todate, 'DD-MM-YYYY').endOf('day').format()
            : null
        const result = await this.logsModel.aggregate(
            [
                {
                    '$match': {
                        'raw_api_log_data.tpp_id': tpp_id,
                        $and: [
                            startDate && endDate
                                ? {
                                    createdAt: {
                                        $gte: new Date(startDate),
                                        $lte: new Date(endDate)
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
                            '$sum': 1
                        },
                        'unit_price': {
                            '$first': '$api_hub_fee'
                        },
                        'total': {
                            '$sum': '$api_hub_fee'
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
                        $and: [
                            startDate && endDate
                                ? {
                                    createdAt: {
                                        $gte: new Date(startDate),
                                        $lte: new Date(endDate)
                                    }
                                }
                                : {}
                        ]
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
                                        'then': 'Peer-to Peer'
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
                                                        '$group', 'Data'
                                                    ]
                                                }, {
                                                    '$eq': [
                                                        '$type', 'corporate'
                                                    ]
                                                }
                                            ]
                                        },
                                        'then': 'Corporate Data'
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
                                }, 4
                            ]
                        }
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
        const total = result.reduce((sum, item) => sum + item.category_total, 0);

        const vat = total * 0.05;

        const roundedTotal = Math.round(total * 100) / 100; // 0.23
        const roundedVat = Math.round(vat * 100) / 100;
        // let updated_result = []
        // if (result.length != 0) {
        //     updated_result = await this.ensureCategories(result);
        // }

        const invoice_data = {
            tpp_id: tpp_id,
            tpp_name: tppData?.tpp_name,
            tpp_usage_per_lfi: result_of_lfi,
            invoice_items: result,
            // subtotal: 0, // vendaaaa
            // vat_percent: 5, // Default 5 percent
            // vat_total: roundedVat,  // vat percent of invoice total
            total_amount: roundedTotal,  // total of invoice array
        }

        return invoice_data
    }

    async generateInvoiceNumber() {
        const timestamp = Date.now(); // milliseconds since 1970
        const random = Math.floor(1000 + Math.random() * 9000); // 4-digit random number
        return `INV-${timestamp}-${random}`;
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
            ? moment(invoiceDto?.fromdate, 'DD-MM-YYYY').startOf('day').format()
            : null
        const endDate = invoiceDto?.endDate
            ? moment(invoiceDto?.todate, 'DD-MM-YYYY').endOf('day').format()
            : null

        let aggregation: any = [
            {
                '$match': {
                    'raw_api_log_data.lfi_id': lfi_id,
                    $and: [
                        startDate && endDate
                            ? {
                                createdAt: {
                                    $gte: new Date(startDate),
                                    $lte: new Date(endDate)
                                }
                            }
                            : {}
                    ]
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
                                    'then': 'Peer-to Peer'
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
                        'tpp_id': '$raw_api_log_data.tpp_id',
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
                    '_id': '$_id.tpp_id',
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
            }, {
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
                    'from': 'tppdatas',
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
        const result = await this.logsModel.aggregate(aggregation);

        const total = result.reduce((sum, item) => sum + item.actual_total, 0);

        const vat = total * 0.05;

        const roundedTotal = Math.round(total * 100) / 100; // 0.23
        const roundedVat = Math.round(vat * 100) / 100;

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
            vat_percent: 5, // Default 5 percent
            vat_total: roundedVat,  // vat percent of invoice total
            total_amount: roundedTotal,  // total of invoice array
            status: 1,
        }
        return tpp_data;
    }

    async findAllCollectionMemo(PaginationDTO: PaginationDTO): Promise<any> {
        // const offset = PaginationDTO.Offset
        //     ? Number(PaginationDTO.Offset)
        //     : PaginationEnum.OFFSET;
        // const limit = PaginationDTO.limit
        //     ? Number(PaginationDTO.limit)
        //     : PaginationEnum.LIMIT;
        const options: any = {};
        // const status =
        //     PaginationDTO.status != null && PaginationDTO.status != 'all'
        //         ? PaginationDTO.status
        //         : null;
        // Object.assign(options, {
        //     ...(status === null ? { status: { $ne: null } } : { status: status }),
        // });
        // const search = PaginationDTO.search ? PaginationDTO.search.trim() : null;
        // if (search) {
        //     options.$or = [
        //     ];
        // }

        // const count = await this.invoiceModel.find(options).countDocuments();
        const result = await this.collectionMemoModel.find(options).sort({ createdAt: -1 }).lean<any>()

        return result
        // {
        //     result,
        //     pagination: {
        //         offset: offset,
        //         limit: limit,
        //         total: count,
        //     },
        // };
    }
    async findCollectionMemoById(ID:any): Promise<any> {

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
                            createdAt: {
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
                                '$first': '$api_hub_fee'
                            },
                            'total': {
                                '$sum': '$api_hub_fee'
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
                            createdAt: {
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
                                            'then': 'Peer-to Peer'
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
                    //             'Merchant Collection', 'Peer-to Peer', 'Me-to-Me Transfer', 'Large value collection', 'Bulk payments', 'Corporate Treasury Data', 'Customer Data'
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
                invoice_number: await this.generateInvoiceNumber(),
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

}
