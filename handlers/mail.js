//Interface with smtp, or any number of different "transports" and it will do the sending of the email for you.
const nodemailer = require('nodemailer');
const pug = require('pug');
//You give 'juice' html with style tags, and it will take those style tags and it will inline them in every single paragraph. If css is not inlined, it will not apply/show in many emial clients.
const juice = require('juice');
//This will convert html to text (for text email readers).
const htmlToText = require('html-to-text');
const promisify = require('es6-promisify');

//A transport is a way to interface with different ways of sending email (smtp being the most common).
const transport = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: process.env.MAIL_PORT,
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
    }
});

//This function is const and not exports because it is not needed anywhere outside of this file.
const generateHtml = (filename, options = {}) => {
    //Whenever you pass a function reference to something on your disk, you don't actuially know where you are in the folder system. For this we can use __dirname variable which is available to us in any file of the application. __dirname will be equal to the current directory that we are running this file from.
    //pug.renderFile
    const html = pug.renderFile(`${__dirname}/../views/email/${filename}.pug`, options); //options will contain data like the users email, and the reset url.
    const inlined = juice(html);
    return inlined;
};

exports.send = async (options) => {
    const html = generateHtml(options.filename, options);
    const text = htmlToText.fromString(html);

    const mailOptions = {
        from: 'Will <winback07@gmail.com>',
        to: options.user.email,
        subject: options.subject,
        html,
        text
    };
    const sendMail = promisify(transport.sendMail, transport);
    return sendMail(mailOptions);
};
