
import * as mongoose from 'mongoose'

export const CollectionMemoSchema = new mongoose.Schema(
    {
        invoice_number: String,
        lfi_id: String,
        lfi_name: String,
        billing_period_start: Date,  // Month First
        billing_period_end: Date,   // Month Last
        invoice_month:Number,
        invoice_year:Number,
        generated_at: Date,        // Generate Date
        currency: String,         //AED default
        tpp: Array,
        due_date: Date,
        subtotal: Number,
        vat_percent: Number, // Default 5 percent
        vat_total: Number,  // vat percent of invoice total
        total_amount: Number,  // total of invoice array
        status: Number,
    },
    {
        timestamps: true,
        collection: 'collection_memo'
    }
)