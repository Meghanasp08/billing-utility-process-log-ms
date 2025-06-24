import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class DashboardService {

  constructor(
    @InjectModel('Invoices') private readonly invoiceModel: Model<any>,
    @InjectModel('TppData') private readonly tppDataModel: Model<any>,
    @InjectModel('LfiData') private readonly lfiDataModel: Model<any>,
    @InjectModel('Logs') private readonly logsModel: Model<any>,
  ) { }

  async findAll(data: any) {

    // return await this.revenueTrendLine();
    const [
      totalInvoicesResult,
      totalInvoiceAmountResult,
      avgInvoiceAmountResult,
      invoicePaidResult,
      noOfTppsResult,
      noOfLfisResult,
      apiHubFee,
      lfiToTppFee,
      paidUnpaidInvoicesResult,
      invoicePaidCount,
      invoiceUnPaidCount,
      totalRevenue,
      percentageOfRevenueFromPreviousMonth,
      revenueTrendLine
    ] = await Promise.all([
      this.getTotalInvoices(),
      this.getTotalRevenue(),
      this.getAvgInvoiceAmount(),
      this.invoicePaid(),
      this.getNoOfTpps(),
      this.getNoOfLfis(),
      this.getApiHubFee(),
      this.getLfiToTppFee(),
      this.getPaidUnpaidInvoices(),
      this.invoicePaidCount(data),
      this.invoiceUnPaidCount(data),
      this.totalRevenue(data),
      this.percentageOfRevenueFromPreviousMonth(),
      this.revenueTrendLine()
    ]);

    return {
      totalInvoices: totalInvoicesResult[0]?.total || 0,
      totalInvoiceAmount: parseFloat((totalInvoiceAmountResult[0]?.total || 0).toFixed(2)),
      avgInvoiceAmount: parseFloat((avgInvoiceAmountResult[0]?.avg || 0).toFixed(2)),
      invoicePaid: parseFloat((invoicePaidResult[0]?.totalPaid || 0).toFixed(2)),
      noOfTpps: noOfTppsResult[0]?.total || 0,
      noOfLfis: noOfLfisResult[0]?.total || 0,
      apiHubFee,
      lfiToTppFee,
      paidUnpaidInvoices: paidUnpaidInvoicesResult[0],
      invoicePaidCount: invoicePaidCount[0]?.total || 0,
      invoiceUnPaidCount: invoiceUnPaidCount[0]?.total || 0,
      totalRevenue: totalRevenue[0]?.totalApplicableApiHubFee || 0,
      percentageOfRevenueFromPreviousMonth: percentageOfRevenueFromPreviousMonth || 0,
      revenueTrendLine:revenueTrendLine
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

  async getPaidUnpaidInvoices() {
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

  async invoicePaidCount(data) {
    const now = new Date();
    const selectedMonth = data?.month ?? now.getMonth() + 1; // JavaScript months are 1-based here
    const selectedYear = data?.year ?? now.getFullYear();
    return await this.invoiceModel.aggregate([
      {
        $match: {
          status: 1,
          month: selectedMonth,
          year: selectedYear
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
        },
      },
    ]).exec();
  }

  async invoiceUnPaidCount(data: any) {
    const now = new Date();
    const selectedMonth = data?.month ?? now.getMonth() + 1; // JavaScript months are 1-based here
    const selectedYear = data?.year ?? now.getFullYear();
    return await this.invoiceModel.aggregate([
      {
        $match: {
          status: 2,
          month: selectedMonth,
          year: selectedYear
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
        },
      },
    ]).exec();
  }

  async totalRevenue(data: any) {
    const now = new Date();

    const selectedYear = data?.year ?? now.getFullYear();
    const selectedMonth = (data?.month ?? now.getMonth() + 1) - 2; // JS months are 0-based
    console.log(selectedYear, selectedMonth)
    const start = new Date(selectedYear, selectedMonth, 1);
    const end = new Date(selectedYear, selectedMonth + 1, 1);

    return await this.logsModel.aggregate([
      {
        $match: {
          'raw_api_log_data.timestamp': { $gte: start, $lt: end }
        }
      },
      {
        $group: {
          _id: null,
          totalApplicableApiHubFee: { $sum: "$applicableApiHubFee" }
        }
      },
      {
        $project: {
          _id: 0,
          totalApplicableApiHubFee: 1
        }
      }
    ])
  }

  async percentageOfRevenueFromPreviousMonth() {
    const now = new Date();
    const selectedYear = now.getFullYear();
    const selectedcurrentMonth = now.getMonth() + 1; // JS months are 0-based
    const selectedpreviousMonth = now.getMonth(); // JS months are 0-based

    let current_month_revenue = await this.totalRevenue({
      month: selectedcurrentMonth,
      year: selectedYear,
    })
    current_month_revenue = current_month_revenue[0]?.totalApplicableApiHubFee || 0;

    let previous_month_revenue = await this.totalRevenue({
      month: selectedpreviousMonth,
      year: selectedYear,
    })
    previous_month_revenue = previous_month_revenue[0]?.totalApplicableApiHubFee || 0;

    console.log(current_month_revenue, previous_month_revenue)
    if (!previous_month_revenue || Number(previous_month_revenue) === 0) {
      return 0; // or null, or handle as special case
    }

    const percentage = ((Number(current_month_revenue) - Number(previous_month_revenue)) / Number(previous_month_revenue)) * 100;
    return Number(percentage.toFixed(2));
  }

  async revenueTrendLine() {
    const now = new Date();
    const oneMonthAgo = new Date(now);
    oneMonthAgo.setDate(now.getDate() - 30);

    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(now.getMonth() - 5);
    sixMonthsAgo.setDate(1); // from beginning of the 6th month ago

    const [oneMonthTrend, sixMonthTrend] = await Promise.all([
      // --- 1M: Group by Day ---
      this.logsModel.aggregate([
        {
          $match: {
            'raw_api_log_data.timestamp': { $gte: oneMonthAgo, $lte: now }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: "$raw_api_log_data.timestamp" },
              month: { $month: "$raw_api_log_data.timestampt" },
              day: { $dayOfMonth: "$raw_api_log_data.timestamp" }
            },
            revenue: { $sum: "$applicableApiHubFee" }
          }
        },
        {
          $project: {
            _id: 0,
            date: {
              $dateFromParts: {
                year: "$_id.year",
                month: "$_id.month",
                day: "$_id.day"
              }
            },
            revenue: 1
          }
        },
        { $sort: { date: 1 } }
      ]),

      // --- 6M: Group by Month ---
      this.logsModel.aggregate([
        {
          $match: {
            'raw_api_log_data.timestamp': { $gte: sixMonthsAgo, $lte: now }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: "$raw_api_log_data.timestamp" },
              month: { $month: "$raw_api_log_data.timestamp" }
            },
            revenue: { $sum: "$applicableApiHubFee" }
          }
        },
        {
          $project: {
            _id: 0,
            date: {
              $dateFromParts: {
                year: "$_id.year",
                month: "$_id.month",
                day: 1
              }
            },
            revenue: 1
          }
        },
        { $sort: { date: 1 } }
      ])
    ]);

    // Final response formatting:
    return {
      revenueTrend: {
        "1M": oneMonthTrend.map(entry => ({
          date: entry.date.toISOString().split('T')[0],
          revenue: entry.revenue
        })),
        "6M": sixMonthTrend.map(entry => ({
          date: entry.date.toISOString().split('T')[0],
          revenue: entry.revenue
        }))
      }
    };

  }

}

