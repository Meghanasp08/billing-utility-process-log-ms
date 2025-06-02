import * as mongoose from 'mongoose'

export const PermissionsSchema = new mongoose.Schema(
  {
    name: String,
    code: String,
    type: String,
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false }
  },
  {
    timestamps: true,
    collection: 'permissions'
  }
)
