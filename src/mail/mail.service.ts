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
import * as moment from 'moment';

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

    async sendInvoiceEmail(attachmentPath: any, email: any, clientName: string, invNumber: string, tpp: boolean, data: any) {
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

        let subject = tpp ? `Monthly Billing Statement for Open Finance Services` : `Disbursement of Collected Amounts - Open Finance Services for the Period [${moment(data.billing_period_start).format('D MMMM YYYY')} - ${moment(data.billing_period_end).format('Do MMMM YYYY')}] `
        // Email options
        const mailOptions = {
            from: `${credentials?.sender_name} <${credentials?.username}>`, // Custom name and email
            to: email,
            // cc: cc || undefined, // Add CC if provided
            subject: subject,
            html: tpp ? await this.tppStatement_html(data) : await this.lfiStatement_html(data),
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
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Account Activation</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f4f6f9; margin: 0; padding: 0;">
  <table width="100%" cellspacing="0" cellpadding="0" style="padding: 30px;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.1); padding: 30px;">
          <tr>
            <td align="left">
              <h2 style="color: #2b2d42;">Welcome to the Billing Utility System</h2>
              <p style="font-size: 16px; color: #555;">
                Dear <strong>${data?.firstName}</strong>,
              </p>
              <p style="font-size: 16px; color: #555;">
               Your account for the Billing Utility system has been successfully created.
              </p> 

              <p style="font-size: 16px; color: #555;">
               To complete your registration and activate your access, please click the button below:
              </p> 
              

              <p style="text-align: center; margin: 30px 0;">
                <a href="${activationLink}" style="background-color: #007bff; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                  Activate Account
                </a>
              </p>

              <p style="font-size: 16px; color: #555;">
                Please find below the access credentials to log into the Billing Utility system:
              </p>
              <ul style="font-size: 16px; color: #555;">
                <li><strong>Access Portal:</strong> <a href="http://193.123.81.148:8888/" style="color: #007bff;">http://193.123.81.148:8888/</a></li>
                <li><strong>Username:</strong> ${data.email}</li>
              </ul>

              <p style="font-size: 16px; color: #555;">
                If you have any questions or require assistance,  please contact us at
                <a href="mailto:billing@nebrasopenfinance.ae" style="color: #007bff;">billing@nebrasopenfinance.ae</a>.
              </p>

              <p style="font-size: 16px; color: #555; margin-top: 40px;">
                Best regards,<br/>
                <strong>The Nebras Open Finance Team</strong>
              </p>
            </td>
          </tr>
        </table>
        
      </td>
    </tr>
  </table>
</body>
</html>

`

    }
    async tppStatement_html(data) {
        
        return `
        <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Monthly Billing Statement</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f4f6f9; margin: 0; padding: 0;">
  <table width="100%" cellspacing="0" cellpadding="0" style="padding: 15px;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.1); padding: 30px;">
          <tr>
            <td align="left">
              <p style="font-size: 16px; color: #555;">Dear <strong>${data.tpp_name}</strong>,</p>

              <p style="font-size: 16px; color: #555;">
                We hope this message finds you well.
              </p>

              <p style="font-size: 16px; color: #555;">
                Please be informed that the monthly billing statement for your organization’s use of Open Finance services during the period of <strong>${moment(data.billing_period_start).format('D MMMM YYYY')} to ${moment(data.billing_period_end).format('Do MMMM YYYY')}</strong> has been issued in accordance with the prevailing regulatory fee framework.
              </p>

              <p style="font-size: 16px; color: #555;">
                The billing statement, comprising the <strong>Tax Invoice</strong> and <strong>Collection Memos</strong>, is attached for your kind review and necessary action.
              </p>

              <p style="font-size: 16px; color: #555;">
                Kindly note that the fees outlined in the collection memos reflect amounts collected on behalf of the respective Licensed Financial Institutions (LFIs) for services availed through the Open Finance ecosystem. These memos are included within the billing statement for your reference.
              </p>

              <h3 style="color: #2b2d42; border-bottom: 1px solid #e0e0e0; padding-bottom: 6px;">Invoice Summary</h3>
              <table cellpadding="8" cellspacing="0" width="100%" style="font-size: 15px; color: #555;">
                <tr>
                  <td width="35%"><strong>Invoice Number:</strong></td>
                  <td>${data?.invoice_number}</td>
                </tr>
                <tr>
                  <td><strong>Invoice Date:</strong></td>
                  <td>${moment(data.createdAt).format('DD MMMM YYYY')}</td>
                </tr>
                <tr>
                  <td><strong>Due Date:</strong></td>
                  <td>${moment(data.due_date).format('DD MMMM YYYY')}</td>
                </tr>
                <tr>
                  <td><strong>Total Amount Due:</strong></td>
                  <td><strong>${data?.currency} ${data?.total_amount}</strong></td>
                </tr>
              </table>

              <p style="font-size: 16px; color: #555; margin-top: 20px;">
                We respectfully request that the total amount be remitted by the due date indicated above to ensure continued alignment with the regulatory obligations governing Open Finance operations.
              </p>

              <p style="font-size: 16px; color: #555;">
                Should you require any clarification or supporting documentation, please do not hesitate to contact us at
                <a href="mailto:billing@nebrasopenfinance.ae" style="color: #007bff;">billing@nebrasopenfinance.ae</a>, and a member of our team will be pleased to assist you.
              </p>

              <p style="font-size: 16px; color: #555; margin-top: 30px;">
                We sincerely appreciate your continued cooperation and commitment to advancing Open Finance in the UAE.
              </p>

              <p style="font-size: 16px; color: #555;">
                Best regards,<br/>
                <strong>The Nebras Open Finance Team</strong>
              </p>
            </td>
          </tr>
        </table>
        <p style="color: #aaa; font-size: 12px; margin-top: 20px;">
          © 2025 Nebras Open Finance. All rights reserved.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>

        `
    }
    async lfiStatement_html(data) {
        
        return `
        <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Disbursement Notification</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f4f6f9; margin: 0; padding: 0;">
  <table width="100%" cellspacing="0" cellpadding="0" style="padding: 30px;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.1); padding: 30px;">
          <tr>
            <td align="left">
              <p style="font-size: 16px; color: #555;">Dear <strong>${data.lfi_name}</strong>,</p>

              <p style="font-size: 16px; color: #555;">
                We trust this correspondence finds you in good order.
              </p>

              <p style="font-size: 16px; color: #555;">
                Please be advised that the disbursement of funds collected by Nebras Open Finance on behalf of your institution, pertaining to Third-Party Provider (TPP) usage of Open Finance services during the period <strong>${moment(data.billing_period_start).format('D MMMM YYYY')} to ${moment(data.billing_period_end).format('Do MMMM YYYY')}</strong>, has been processed in line with the prevailing regulatory fee framework.
              </p>

              <p style="font-size: 16px; color: #555;">
                In accordance with the obligations outlined under the Open Finance operational guidelines and the terms of engagement between Nebras and participating Licensed Financial Institutions (LFIs), the total amount due for disbursement has been calculated based on API consumption by TPPs across the ecosystem.
              </p>

              <h3 style="color: #2b2d42; border-bottom: 1px solid #e0e0e0; padding-bottom: 6px;">Disbursement Details</h3>
              <table cellpadding="8" cellspacing="0" width="100%" style="font-size: 15px; color: #555;">
                <tr>
                  <td width="40%"><strong>Period:</strong></td>
                  <td>${moment(data.billing_period_start).format('D MMMM YYYY')} - ${moment(data.billing_period_end).format('Do MMMM YYYY')}</td>
                </tr>
                <tr>
                  <td><strong>Reference Number:</strong></td>
                  <td>${data.invoice_number}</td>
                </tr>
                <tr>
                  <td><strong>Total Amount for Disbursement:</strong></td>
                  <td><strong>${data.currency} ${data.total_amount}</strong></td>
                </tr>
                <tr>
                  <td><strong>Disbursement Date:</strong></td>
                  <td>${moment(data.due_date).format('DD MMMM YYYY')}</td>
                </tr>
                <tr>
                  <td><strong>Settlement Method:</strong></td>
                  <td>Credited to LFI account on file</td>
                </tr>
              </table>

              <p style="font-size: 16px; color: #555; margin-top: 20px;">
                A comprehensive collection statement is enclosed, outlining the breakdown of API usage by each TPP, the applicable fees for the respective services consumed, and the corresponding amounts allocated.
              </p>

              <p style="font-size: 16px; color: #555;">
                Should you require any clarification, supporting documentation, or reconciliation assistance, you are encouraged to contact the Billing and Settlements Unit at 
                <a href="mailto:billing@nebrasopenfinance.ae" style="color: #007bff;">billing@nebrasopenfinance.ae</a>.
              </p>

              <p style="font-size: 16px; color: #555; margin-top: 30px;">
                We appreciate your continued cooperation and commitment to upholding the standards of the Open Finance framework in the United Arab Emirates.
              </p>

              <p style="font-size: 16px; color: #555;">
                Best regards,<br/>
                <strong>The Nebras Open Finance Team</strong>
              </p>
            </td>
          </tr>
        </table>
        <p style="color: #aaa; font-size: 12px; margin-top: 20px;">
          © 2025 Nebras Open Finance. All rights reserved.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>

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

        let payload: any
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

        if (user.isVerified == true) {
            throw new NotFoundException('Account already activated');
        }

        user.status = 1;
        await user.save();

        return { message: 'Account activated successfully' };

    }
}
