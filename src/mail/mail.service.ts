import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
const fs = require('fs')

@Injectable()
export class MailService {

    async sendEmail(data: any) {
        try {
            // const aggregation = [
            //     {
            //         $match: {
            //             name: 'notifications'
            //         }
            //     },
            //     {
            //         $unwind: {
            //             path: '$values'
            //         }
            //     },
            //     {
            //         $match: {
            //             'values.type': 'EMAIL'
            //         }
            //     }
            // ]
            // let email_creds = await this.appSettingsModel.aggregate(aggregation);
            // const credentials = email_creds[0]?.values?.credentials

            const credentials = {
                "host": "mail.trade-hub.ae",
                "password": "Tradehub1202$",
                "username": "ops@trade-hub.ae",
                "reply_to": "ops@trade-hub.ae",
                "sender_name": "TradeHub",
                "port": "465",
                "secure_flag": true
            }
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

    async sendInvoiceEmail(data: any) {
        console.log('iam data', data)

    }
}
