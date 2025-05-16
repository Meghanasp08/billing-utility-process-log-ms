import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as nodemailer from 'nodemailer';
import { GlobalConfiguration, GlobalConfigurationDocument } from 'src/configuration/schema/global_config.schema';
import { SmtpConfigDto } from './dto/mail.dto';
const fs = require('fs')

@Injectable()
export class MailService {
    constructor(
        @InjectModel(GlobalConfiguration.name) private globalModel: Model<GlobalConfigurationDocument>,
    ) { }

    async sendEmail(data: any) {
        try {

            const credentials = await this.getEmailCredentials();

            const transporter = nodemailer.createTransport({
                host: credentials?.host,
                port: Number(credentials?.port),
                secure: credentials?.secure_flag, // true for 465, false for other ports
                auth: {
                    user: credentials?.username,
                    pass: credentials?.password
                }
            })

            const from = `${credentials?.sender_name} <${credentials?.username}>`
            let event = data?.event;
            let content: any;

            switch (event) {
                case 'WELCOME':
                    content = await this.welcomeMail(data);
                    break;

                default:
                    throw new Error('Invalid Event');
            }

            console.log(data?.to_mail)
            const email = await transporter.sendMail({
                from: from,
                to: data?.to_mail,
                replyTo: credentials?.reply_to,
                subject: content?.subject,
                html: content?.html,
                attachments: content?.attachments
            })
            console.log("EMAIL_SENT_ID", email?.messageId);


            content?.path?.forEach((filePath) => {
                try {
                    fs.unlinkSync(filePath);
                    console.log(`${filePath} was deleted`);
                } catch (err) {
                    console.error(`Error deleting ${filePath}:`, err);
                }
            });

        } catch (error) {
            console.log(error);
            throw error;
        }
    }
    async getEmailCredentials() {
        let options = {
            key: 'email'
        }
        const globalData = await this.globalModel.findOne(options)
        return globalData?.data;
    }

    async welcomeMail(data: any) {
        let subject = 'WELCOME';
        let from = `TradeHub`

        const body_html = `<!DOCTYPE html>
    <html>
    <head>
      <title>Welcome to Our Service</title>
    </head>
    <body>
      <h1>Hi <%= name %>!</h1>
      <p>Thank you for joining us!</p>
      <p>We are excited to have you on board.</p>
    </body>
    </html>`

        return {
            subject: subject,
            from: from,
            path: null,
            html: body_html,
            attachments: null
        }
    }

    async sendInvoiceEmail(attachmentPath: any, email: string, clientName: string, invNumber: string, tpp: boolean) {
        if (!fs.existsSync(attachmentPath)) {
            throw new Error('Attachment file not found');
        }

        const credentials = await this.getEmailCredentials();
        // console.log('MAIL_INFO', data)

        const transporter = nodemailer.createTransport({
            host: credentials?.host,
            port: Number(credentials?.port),
            secure: credentials?.secure_flag, // true for 465, false for other ports
            auth: {
                user: credentials?.username,
                pass: credentials?.password
            }
        })

        // Email options
        const mailOptions = {
            from: `${credentials?.sender_name} <${credentials?.username}>`, // Custom name and email
            to: 'firoskhansha@gmail.com',
            // cc: cc || undefined, // Add CC if provided
            subject: `Invoice and Statement of Account for ${clientName}`,
            text: `Dear ${clientName},
            Reference: ${invNumber}

            Please find attached herewith the following accounting documents. Kindly ensure the payable amounts are duly made to the accounting details shown on the invoice.

            The attachment contains:
            
            ${tpp?`
            - TPP Monthly Billing Summary
            - Tax Invoice
            - Collection Memo for each LFI involved in the statement of account`:
            `- LFI Statement Of Revenue`}

            Thank you for your cooperation.

            Thanks and Regards,
            For Nebras
            Web Admin

            ------------------------------------------------------------------------------------
            This is a computer-generated statement.

            IMPORTANT: The contents of this email and any attachments are confidential. They are intended for the named recipient(s) only. If you have received this email by mistake, please notify the sender immediately and do not disclose the contents to anyone or make copies thereof.`,
            attachments: [
                {
                    filename: 'invoice.pdf',
                    path: attachmentPath,
                },
            ],
        };

        const info = await transporter.sendMail(mailOptions);

        // Optionally delete the attachment after sending
        // fs.unlink(attachmentPath, (err) => {
        //     if (err) {
        //         console.error('Error deleting file:', err);
        //     } else {
        //         console.log(`Deleted attachment: ${attachmentPath}`);
        //     }
        // });

        return info;


    }

    async testSmtp(config: SmtpConfigDto): Promise<any> {
        const transporter = nodemailer.createTransport({
            host: config.host,
            port: Number(config.port),
            secure: config.secure_flag, // true for 465, false for 587
            auth: {
                user: config.username,
                pass: config.password,
            },
        });

        const testEmail = {
            from: `"${config.sender_name}" <${config.username}>`,
            to: config.username, // send to self if test_receiver not given
            subject: 'SMTP Test Email',
            text: 'This is a test email to verify SMTP configuration.',
            replyTo: config.reply_to,
        };

        try {
            const info = await transporter.sendMail(testEmail);
            return { success: true, message: 'Test email sent', info };
        } catch (error) {
            return { success: false, message: 'Failed to send email', error };
        }
    }
}
