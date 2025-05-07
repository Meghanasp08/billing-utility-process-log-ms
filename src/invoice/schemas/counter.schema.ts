
import * as mongoose from 'mongoose'

export const CounterSchema = new mongoose.Schema(
    {
        key:String,  // invoice_counter or collection_memo_counter
        lastInvoiceNumber:Number,
        lastcollectionMemoNumber:Number,
        status: Number,
    },
    {
        timestamps: true,
        collection: 'counters'
    }
)