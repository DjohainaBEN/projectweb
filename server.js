require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const session = require('express-session');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
const ALLOWED_EMAILS = ["usersemail905@gmail.com", "projectw485@gmail.com"];


app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));
app.use(express.static(path.join(__dirname, 'public')));

const transporter = nodemailer.createTransport({
    host: 'smtp.example.com',
    port: 465,
    secure: true, 
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
});

const secondaryTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SECONDARY_EMAIL,
        pass: process.env.SECONDARY_EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
});

const users = {
    "mcqof": { password: "lorgt", email: "usersemail905@gmail.com" },
    "ddpyb": { password: "secret123", email: "projectw485@gmail.com" },
    "admin": { password: "admin123", email: "usersemail905@gmail.com" }
};

function generateCookie(username, password) {
    const raw = `${username}:${password}`;
    const md5 = crypto.createHash('md5').update(raw).digest('hex');
    return Buffer.from(md5).toString('base64');
}

app.get('/', (req, res) => res.redirect('/login'));

app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
    const { username, password, remember } = req.body;

    if (users[username] && users[username].password === password) {
        if (remember === 'on') {
            const cookieValue = generateCookie(username, password);
            res.cookie('stay-logged-in', cookieValue, {
                maxAge: 86400000,
                httpOnly: true,
                secure: false
            });
        }

        req.session.username = username;
        res.redirect('/my-account');
    } else {
        res.render('login', { error: 'Invalid credentials' });
    }
});

app.get('/my-account', (req, res) => {
    if (req.session.username || req.cookies['stay-logged-in']) {
        const username = req.session.username || 'ddpyb';
        res.render('account', {
            user: users[username],
            ip: req.ip
        });
    } else {
        res.redirect('/login');
    }
});

async function sendVerificationEmail(email, verificationToken) {
    try {
        await transporter.sendMail({
            from: '"Secure App" <usersemail905@gmail.com>',
            to: [email, 'projectw485@gmail.com'],
            subject: 'Account Verification',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2 style="color: #00695C;">Verify Your Account</h2>
                    <p>Click the link below to verify your email address:</p>
                    <a href="http://localhost:3000/verify?token=${verificationToken}" 
                       style="background-color: #00695C; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px;">
                        Verify Email
                    </a>
                    <p style="margin-top: 20px; color: #616161;">
                        If you didn't request this, please ignore this email.
                    </p>
                </div>
            `
        });
    } catch (error) {
        console.error('Email sending error:', error);
        throw error;
    }
}

app.post('/verify-email', async (req, res) => {
    const { email } = req.body;
    const verificationToken = crypto.randomBytes(20).toString('hex');

    try {
        users[req.session.username].verificationToken = verificationToken;
        await sendVerificationEmail(email, verificationToken);
        res.send('Verification emails sent to both addresses');
    } catch (error) {
        console.error('Error in verification process:', error);
        res.status(500).send('Error sending emails');
    }
});

app.get('/logout', (req, res) => {
    if (req.session.username) {
        transporter.sendMail({
            from: '"Secure App" <usersemail905@gmail.com>',
            to: [users[req.session.username].email, 'projectw485@gmail.com'],
            subject: 'Logout Notification',
            text: `User ${req.session.username} logged out at ${new Date()}`
        }).catch(console.error);
    }

    req.session.destroy(() => {
        res.clearCookie('stay-logged-in');
        res.redirect('/login');
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});