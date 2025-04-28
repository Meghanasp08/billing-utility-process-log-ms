
import * as mongoose from 'mongoose'

export const SingleDayTppInvoiceSchema = new mongoose.Schema(
  {
    invoice_number: String,
    tpp_id: String,
    tpp_name: String,
    generated_for: Date,        // Generate Date
    tpp_usage_per_lfi: Array,
    invoice_items: Array,
    invoice_month:Number,
    invoice_year:Number,
  },
  {
    timestamps: true,
    collection: 'single_day_tpp_invoice'
  }
)