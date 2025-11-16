import express from "express";
import dotenv from "dotenv";
import Stripe from "stripe";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";
import i18n from "i18n";
import cookieParser from "cookie-parser";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5000;

// =============== EJS SETUP ===============
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =============== STRIPE SETUP ===============
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// =============== TELEBIRR SETTINGS ===============
const TELEBIRR_API_URL = "https://api.telebirr.com/payment/initiate";
const TELEBIRR_APP_ID = process.env.TELEBIRR_APP_ID;
const TELEBIRR_SHORT_CODE = process.env.TELEBIRR_SHORT_CODE;
const TELEBIRR_NOTIFY_URL = "https://yourdomain.com/api/telebirr/callback";

// =============== I18N ===============
i18n.configure({
    locales: ["en", "am"],
    directory: path.join(__dirname, "locales"),
    defaultLocale: "en",
    queryParameter: "lang",
    cookie: "lang",
    autoReload: true,
    objectNotation: true,
});
app.use(i18n.init);

// =============== CURRENT PATH HANDLER ===============
app.use((req, res, next) => {
    res.locals.currentPath = req.path;
    next();
});

// =============== BASIC PAGES ===============
app.get("/", (req, res) => {
    res.render("index", {
        priceUsd: 1960,
        priceEtb: 300000
    });
});

app.get("/start-now", (req, res) => {
    res.render("start-now");
});

app.get("/about", (req, res) => {
    res.render("about");
});

app.get("/contact", (req, res) => {
    res.render("contact");
});

app.get("/housetour", (req, res) => {
    res.render("house-tour");
});

// =============== LANGUAGE SWITCH ===============
app.get("/lang/:locale", (req, res) => {
    const locale = req.params.locale;
    res.setLocale(locale);
    res.cookie("lang", locale);

    const backURL = req.get("Referer") || "/";
    if (backURL.includes("/lang/")) {
        res.redirect("/");
    } else {
        res.redirect(backURL);
    }
});

// =============== BOOKING ===============
app.get("/booking", (req, res) => {
    res.render("booking", {
        priceUsd: 17,
        priceEtb: Math.round(17 * 155)
    });
});

app.post("/booking/submit", (req, res) => {
    const { name, amount } = req.body;

    // Set payer as the person booking
    const payer = name || "Booking Customer";

    // Redirect to stripe WITH amount & payer
    res.redirect(307, `/checkout/stripe?amount=${amount}&payer=${encodeURIComponent(payer)}`);
});


// 💳 UNIVERSAL STRIPE PAYMENT ROUTE (DYNAMIC)
app.post("/checkout/stripe", async (req, res) => {

    const amount = Number(req.body.amount || req.query.amount);
    const payer = req.body.payer || req.query.payer || "Ferfam Customer";

    if (!amount || isNaN(amount)) {
        return res.status(400).send("Payment amount missing or invalid.");
    }

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items: [
                {
                    price_data: {
                        currency: "usd",
                        product_data: { name: `Rent Payment – ${payer}` },
                        unit_amount: Math.round(amount * 100),
                    },
                    quantity: 1,
                },
            ],
            mode: "payment",
            success_url: `${req.protocol}://${req.get("host")}/success`,
            cancel_url: `${req.protocol}://${req.get("host")}/cancel`,
        });

        res.redirect(303, session.url);
    } catch (err) {
        console.error("Stripe Error:", err.message);
        res.status(500).send("Stripe Checkout Error: " + err.message);
    }
});




// =============== TELEBIRR PAYMENT ===============
app.post("/checkout/telebirr", async (req, res) => {
    try {
        const body = {
            appId: TELEBIRR_APP_ID,
            nonce: Math.random().toString(36).substring(2, 15),
            notifyUrl: TELEBIRR_NOTIFY_URL,
            outTradeNo: "TXN_" + Date.now(),
            receiveName: "Ferfam",
            shortCode: TELEBIRR_SHORT_CODE,
            subject: "Ferfam Family Service",
            timeoutExpress: "30",
            totalAmount: "300,000.00",
            priceETB: 300000,
        };

        const response = await fetch(TELEBIRR_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        const data = await response.json();
        if (data.redirectUrl) {
            res.redirect(data.redirectUrl);
        } else {
            res.send("Telebirr payment initiated — confirm on your phone!");
        }
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// =============== SUCCESS / CANCEL ===============
app.get("/success", (req, res) => {
    res.render("success");
});

app.get("/cancel", (req, res) => {
    res.render("cancel");
});

// =============== START SERVER ===============
app.listen(PORT, () =>
    console.log(`✅ Server running at http://localhost:${PORT}`)
);
