import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

@Injectable()
export class DashboardService {

  constructor(
    @InjectModel('Invoices') private readonly invoiceModel: Model<any>,
    @InjectModel('TppData') private readonly tppDataModel: Model<any>,
    @InjectModel('LfiData') private readonly lfiDataModel: Model<any>,
  ) { }

  async findAll() {
    const [
      totalInvoicesResult,
      totalInvoiceAmountResult,
      avgInvoiceAmountResult,
      invoicePaidResult,
      noOfTppsResult,
      noOfLfisResult,
      apiHubFee,
      lfiToTppFee,
      paidUnpaidInvoicesResult
    ] = await Promise.all([
      this.getTotalInvoices(),
      this.getTotalRevenue(),
      this.getAvgInvoiceAmount(),
      this.invoicePaid(),
      this.getNoOfTpps(),
      this.getNoOfLfis(),
      this.getApiHubFee(),
      this.getLfiToTppFee(),
      this.getPaidUnpaidInvoices()
    ]);
  
    return {
      totalInvoices: totalInvoicesResult[0]?.total || 0,
      totalInvoiceAmount: totalInvoiceAmountResult[0]?.total || 0,
      avgInvoiceAmount: avgInvoiceAmountResult[0]?.avg || 0,
      invoicePaid: invoicePaidResult[0]?.totalPaid || 0,
      noOfTpps: noOfTppsResult[0]?.total || 0,
      noOfLfis: noOfLfisResult[0]?.total || 0,
      apiHubFee,
      lfiToTppFee,
      paidUnpaidInvoices: paidUnpaidInvoicesResult[0],
    };
  }

  // async findAll() {

  //   return {
  //     totalInvoices: await this.getTotalInvoices().then(res => res[0]?.total || 0),
  //     totalInvoiceAmount: await this.getTotalRevenue().then(res => res[0]?.total || 0),
  //     avgInvoiceAmount: await this.getAvgInvoiceAmount().then(res => res[0]?.avg || 0),
  //     invoicePaid: await this.invoicePaid().then(res => res[0]?.totalPaid  || 0),
  //     noOfTpps: await this.getNoOfTpps().then(res => res[0]?.total || 0),
  //     noOfLfis: await this.getNoOfLfis().then(res => res[0]?.total || 0),
  //     apiHubFee: await this.getApiHubFee(),
  //     lfiToTppFee: await this.getLfiToTppFee(),
  //     paidUnpaidInvoices: await this.getPaidUnpaidInvoices().then(res => res[0]),
  //   }
  // }

  async getTotalInvoices() {
    return await this.invoiceModel.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
        },
      },
    ]).exec();
  }

  async getTotalRevenue() {
    return await this.invoiceModel.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: '$total_amount' },
        },
      },
    ]).exec();
  }

  async getAvgInvoiceAmount() {
    return await this.invoiceModel.aggregate([
      {
        $group: {
          _id: null,
          avg: { $avg: '$total_amount' },
        },
      },
    ]).exec();
  }

  async getNoOfTpps() {
    return await this.tppDataModel.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
        },
      },
    ]).exec();
  }

  async getNoOfLfis() {
    return await this.lfiDataModel.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
        },
      },
    ]).exec();
  }
  async getApiHubFee() {
    return {
      "Service Initialization": {
        "Payment Initiation": 123.00,
        "Corporate Payment": 126753.00
      },
      "Data Sharing": {
        "Setup and Consent": 123.00,
        "Bank Data Sharing": 123.00,
        "Confirmation of Payee (Discounted)": 123.00,
        "Balance (Discounted)": 123.00,
        "Insurance Data": 123.00,
        "Corporate Data": 123.00
      }
    }
  }

  async getLfiToTppFee() {
    return {
      "Merchant Collection": 58345.00,
      "Peer-to Peer": 3235.00,
      "Me-to-Me Transfer": 653.00,
      "Bulk Payments": 4356.00,
      "Large Value Collections": 456.00,
      "Customer Data": 78354.00,
      "Corporate Data": 234.00
    }
  }

  async getPaidUnpaidInvoices(){
    return this.invoiceModel.aggregate([
      {
        $group: {
          _id: null,
          paid: {
            $sum: {
              $cond: [{ $eq: ['$status', 1] }, 1, 0]
            }
          },
          unpaid: {
            $sum: {
              $cond: [{ $eq: ['$status', 0] }, 1, 0]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          paid: 1,
          unpaid: 1
        }
      }
    ]).exec();  
  }

  async invoicePaid() {
    return await this.invoiceModel.aggregate([
      { $match: { status: 1 } }, 
      { $group: { _id: null, totalPaid: { $sum: "$total_amount" } } }  
    ]).exec()
  }

}

