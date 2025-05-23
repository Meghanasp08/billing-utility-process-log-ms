import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as nodemailer from 'nodemailer';
import { GlobalConfiguration, GlobalConfigurationDocument } from 'src/configuration/schema/global_config.schema';
import { SmtpConfigDto } from './dto/mail.dto';
const fs = require('fs')
import * as crypto from 'crypto';
import { User, UserDocument } from 'src/profile/schemas/user.schema';
import { JwtService } from '@nestjs/jwt';
@Injectable()
export class MailService {
    constructor(
        @InjectModel(GlobalConfiguration.name) private globalModel: Model<GlobalConfigurationDocument>,
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        private jwtService: JwtService
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
            // let event = data?.event;
            // let content: any;

            // switch (event) {
            //     case 'WELCOME':
            //         content = await this.welcomeMail(data);
            //         break;

            //     default:
            //         throw new Error('Invalid Event');
            // }

            console.log(data?.to_mail)
            const email = await transporter.sendMail({
                from: from,
                to: data?.to_mail,
                replyTo: credentials?.reply_to,
                subject: data?.subject,
                html: data?.html,
                attachments: data?.attachments
            })
            console.log("EMAIL_SENT_ID", email?.messageId);


            data?.path?.forEach((filePath) => {
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
            to: email,
            // cc: cc || undefined, // Add CC if provided
            subject: `Invoice and Statement of Account for ${clientName}`,
            html: `
            <p>Dear ${clientName},</p>
            <p><strong>Reference:</strong> ${invNumber}</p>
            <p>Please find attached herewith the following accounting documents. Kindly ensure the payable amounts are duly made to the accounting details shown on the invoice.</p>
            <p>The attachment contains:</p>
            <ul>
                ${tpp
                    ? `
                    <li>TPP Monthly Billing Summary</li>
                    <li>Tax Invoice</li>
                    <li>Collection Memo for each LFI involved in the statement of account</li>
                    `
                    : `
                    <li>LFI Statement Of Revenue</li>
                    `
                }
            </ul>
            <p>Thank you for your cooperation.</p>
            <br />
            <p>Thanks and Regards,</p>
            <p>For Nebras<br />Web Admin</p>
            <hr />
            <p style="font-size: 0.9em; color: #666;">This is a computer-generated statement.</p>
            <p style="font-size: 0.9em; color: #666;">
                <strong>IMPORTANT:</strong> The contents of this email and any attachments are confidential. They are intended for the named recipient(s) only. If you have received this email by mistake, please notify the sender immediately and do not disclose the contents to anyone or make copies thereof.
            </p>
        `,
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

    async sendActivationEmail(user: any) {
        const token = await this.generateActivationToken(user);
        user.activationToken = token;
        const user_data = await user.save();
        const activationLink = `http://193.123.81.148:8888/email-verify/${token}`;

        const mail_data = {
            to: user.email,
            subject: 'Activate your account',
            html: await this.activation_html(user_data, activationLink),
            to_mail: user.email
        };

        await this.sendEmail(mail_data);
    }

    async activation_html(data, activationLink) {
        return `
  <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f9f9f9;">
    <h2 style="color: #333;">Welcome, ${data?.firstName}!</h2>
    <p style="font-size: 16px; color: #555;">
      Thank you for registering. Please click the button below to activate your account:
    </p>
    <a href="${activationLink}" style="
      display: inline-block;
      padding: 12px 24px;
      margin-top: 20px;
      font-size: 16px;
      color: #ffffff;
      background-color: #007bff;
      border-radius: 4px;
      text-decoration: none;">
      Activate Account
    </a>
    <p style="margin-top: 30px; font-size: 14px; color: #999;">
      If you did not sign up for this account, you can safely ignore this email.
    </p>
  </div>
`

    }

    async generateActivationToken(user: any) {
        return await this.jwtService.sign(
            { email: user.email, userId: user._id },
            {
                secret: process.env.JWT_ACTIVATION_SECRET || 'yourVerySecureActivationSecret',
                expiresIn: '1440m', // token expires in 24 hr
            },
        );
    }

    async activateUser(token: string) {
        
        const user_info = await this.userModel.findOne({ activationToken: token });
        if (!user_info) {
            throw new NotFoundException('Invalid or expired activation link');
        }
         
        let payload:any
        try {
            payload = await this.jwtService.verifyAsync(token, {
                secret: process.env.JWT_ACTIVATION_SECRET || 'yourVerySecureActivationSecret',
            });
            
        } catch (err) {
            throw new NotFoundException(`JWT verification failed: ${err.message}`);
        }

        console.log(payload.userId)
        const user = await this.userModel.findById(payload.userId);
        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (user.status == 1) {
            throw new NotFoundException('Account already activated');
        }

        user.status = 1;
        user.isVerified = true;
        await user.save();

        return { message: 'Account activated successfully' };
       
    }
}
