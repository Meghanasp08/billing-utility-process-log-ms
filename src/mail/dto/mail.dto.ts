export class SmtpConfigDto {
    host: string;
    port: string;
    secure_flag: boolean;
    username: string;
    password: string;
    sender_name: string;
    reply_to: string;
    test_receiver: string; // Optional: email address to receive test
}