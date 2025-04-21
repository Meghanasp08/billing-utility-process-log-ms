import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PaginationDTO } from 'src/common/dto/common.dto';
import { PaginationEnum, } from 'src/common/constants/constants.enum';
@Injectable()
export class InvoiceService {
    constructor(
        @InjectModel('Invoices') private readonly invoiceModel: Model<any>,
        @InjectModel('Logs') private readonly logsModel: Model<any>,
        @InjectModel('TppData') private readonly tppDataModel: Model<any>,
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

        const tppData = await this.tppDataModel.findOne({ tpp_id: invoiceDto?.tpp_id });
        if (!tppData)
            throw new Error('Invalid TppID');

        let month = invoiceDto?.month;
        let year = invoiceDto?.year;
        if (month < 1 || month > 12)
            throw new Error('Invalid month (1-12)');

        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        const currentDate = new Date();
        const futureDate = new Date();
        futureDate.setDate(currentDate.getDate() + 30);

        const result = await this.logsModel.aggregate(
            [
                {
                    '$match': {
                        'raw_api_log_data.tpp_id': invoiceDto?.tpp_id,
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
                        'paymentTypeLabel': {
                            '$switch': {
                                'branches': [
                                    {
                                        'case': {
                                            '$eq': [
                                                '$group', 'payment-bulk'
                                            ]
                                        },
                                        'then': 'Corporate Treasury'
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
                                        'then': 'Corporate Treasury Data'
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
                                        'then': 'Confirmation of Payee'
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
                                            'Corporate Treasury', 'Payment Initiation'
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
                                    '$unit_price', 3
                                ]
                            },
                            'total': {
                                '$round': [
                                    '$total', 2
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
                                    'Corporate Treasury', 'Payment Initiation'
                                ],
                                'else': [
                                    'Insurance', 'Setup and Consent', 'Corporate Treasury Data', 'Confirmation of Payee', 'Balance(Discounted)', 'Bank Data Sharing'
                                ]
                            }
                        }
                    }
                }, {
                    '$addFields': {
                        'items': {
                            '$map': {
                                'input': '$allItems',
                                'as': 'desc',
                                'in': {
                                    '$let': {
                                        'vars': {
                                            'matchedItem': {
                                                '$first': {
                                                    '$filter': {
                                                        'input': '$items',
                                                        'as': 'item',
                                                        'cond': {
                                                            '$eq': [
                                                                '$$item.description', '$$desc'
                                                            ]
                                                        }
                                                    }
                                                }
                                            }
                                        },
                                        'in': {
                                            'description': '$$desc',
                                            'quantity': {
                                                '$ifNull': [
                                                    '$$matchedItem.quantity', 0
                                                ]
                                            },
                                            'unit_price': {
                                                '$ifNull': [
                                                    '$$matchedItem.unit_price', 0.25
                                                ]
                                            },
                                            'total': {
                                                '$ifNull': [
                                                    '$$matchedItem.total', 0
                                                ]
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }, {
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
                                }, 3
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
                                }, 3
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
        // const result_of_lfi = await this.logsModel.aggregate()
        const total = result.reduce((sum, item) => sum + item.category_total, 0);
        console.log()
        const vat = total * 0.05;

        const roundedTotal = Math.round(total * 100) / 100; // 0.23
        const roundedVat = Math.round(vat * 100) / 100;

        const updated_result = await this.ensureCategories(result);
        const invoice_data = {
            invoice_number: await this.generateInvoiceNumber(),
            tpp_id: invoiceDto?.tpp_id,
            tpp_name: tppData?.tpp_name,
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
            tpp_usage_per_lfi: [],
            invoice_items: updated_result,
            // subtotal: 0, // vendaaaa
            vat_percent: 5, // Default 5 percent
            vat_total: roundedVat,  // vat percent of invoice total
            total_amount: roundedTotal,  // total of invoice array
            status: 1,
            notes: 'Invoice Added',
        }
        const invoice = new this.invoiceModel(invoice_data)
        return await invoice.save();
    }
    async ensureCategories(inputArray) {
        // Define default values for each category
        const categoryDefaults = {
            data_sharing:{
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
                        "description": "Corporate Treasury Data",
                        "quantity": 0,
                        "unit_price": 0.025,
                        "total": 0
                    },
                    {
                        "description": "Confirmation of Payee",
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
                        "description": "Corporate Treasury",
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
}
