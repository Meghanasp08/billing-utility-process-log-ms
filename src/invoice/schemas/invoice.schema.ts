
import * as mongoose from 'mongoose'
import { InvoiceStatus } from 'src/common/constants/constants.enum';

export const InvoiceSchema = new mongoose.Schema(
  {
    invoice_number: String,
    tpp_id: String,
    tpp_name: String,
    tpp_email:String,
    billing_address_line1: String,
    billing_address_line2: String,
    billing_address_city: String,
    billing_address_state: String,
    billing_address_postal_code: String,
    billing_address_country: String,
    billing_period_start: Date,  // Month First
    billing_period_end: Date,   // Month Last
    issued_date: Date,        // Generate Date
    due_date: Date,
    invoice_month: Number,
    invoice_year: Number,
    generated_at: Date,        // Generate Date
    currency: String,         //AED default
    tpp_usage_per_lfi: Array,
    invoice_items: Array,
    subtotal: Number,
    vat_percent: Number, // Default 5 percent
    vat_total: Number,  // vat percent of invoice total
    total_amount: Number,  // total of invoice array
    invoice_total: Number,
    lfi_total: Number,
    status: { type: Number, default: InvoiceStatus.PAID },
    status_description:String,
    notes: String,
  },
  {
    timestamps: true,
    collection: 'invoices'
  }
)