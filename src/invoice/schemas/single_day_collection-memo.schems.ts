
import * as mongoose from 'mongoose'

export const SingleDayCollectionMemoSchema = new mongoose.Schema(
    {
        lfi_id: String,
        lfi_name: String,
        generated_at: Date,        // Generate Date
        generated_for: Date,  
        tpp: Array,
        invoice_month:Number,
        invoice_year:Number,
    },
    {
        timestamps: true,
        collection: 'single_day_collection_memo'
    }
)