import express from "express";
import dotenv from "dotenv";
import Stripe from "stripe";
import fetch from "node-fetch";
import path from "path";
import expressLayouts from "express-ejs-layouts";
import { fileURLToPath } from "url";
import i18n from "i18n";
import cookieParser from "cookie-parser";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5000;

// ✅ Setup EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(cookieParser());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ✅ Telebirr settings (you’ll fill these from your credentials)
const TELEBIRR_API_URL = "https://api.telebirr.com/payment/initiate";
const TELEBIRR_APP_ID = process.env.TELEBIRR_APP_ID;
const TELEBIRR_SHORT_CODE = process.env.TELEBIRR_SHORT_CODE;
const TELEBIRR_NOTIFY_URL = "https://yourdomain.com/api/telebirr/callback";

// ✅ Setup i18n (internationalization)
i18n.configure({
    locales: ["en", "am"], // supported languages
    directory: path.join(__dirname, "locales"), // where translation files live
    defaultLocale: "en",
    queryParameter: "lang", // allows ?lang=am
    cookie: "lang",
    autoReload: true,
    objectNotation: true,
});

// Middleware for i18n
app.use(i18n.init);


// ✅ Make currentPath available to all views
app.use((req, res, next) => {
    res.locals.currentPath = req.path;
    next();
});


// ✅ Success page
app.get("/success", (req, res) => {
    res.render("success");
});

// 🏠 Homepage
app.get("/", (req, res) => {
    res.render("index", {
        priceUsd: 1960, // $1,960 in cents
        priceEtb: 300000 // 300,000 in cents
    });
});

app.get("/start-now", (req, res) => {
    res.render("start-now");
});



// ✅ Route to switch language
app.get("/lang/:locale", (req, res) => {
    const locale = req.params.locale;
    res.setLocale(locale);
    res.cookie("lang", locale);

    app.get("/booking", (req, res) => {
        res.render("booking", {
            priceUsd: 17,
            priceEtb: Math.round(17 * 155)
        });
    });

    app.post("/booking/submit", (req, res) => {
        const { name, email, phone, date, guests, notes } = req.body;

        console.log("Booking Submitted:", req.body);

        // For now: redirect to Stripe payment
        res.redirect("/checkout/stripe");
    });



    app.get("/checkout/stripe", (req, res) => {
        res.redirect("/");
    });


    app.post("/booking/submit", (req, res) => {
        const { name, email, phone, date, guests, notes } = req.body;

        console.log("Booking Received:", req.body);

        // Redirect to payment
        res.redirect("/checkout/stripe");
    });




    // ✅ Redirect back to previous page or to home if none
    const backURL = req.get("Referer") || "/";
    if (backURL.includes("/lang/")) {
        res.redirect("/");
    } else {
        res.redirect(backURL);
    }
});



app.get("/about", (req, res) => {
    res.render("about", { title: "About Ferfam" });
});

app.get("/contact", (req, res) => {
    res.render("contact", { title: "Contact Ferfam" });
});

app.get("/housetour", (req, res) => {
    res.render("house-tour", {
        priceUsd: 100,
        priceEtb: 5500
    });
});

app.get("/booking", (req, res) => {
    res.render("booking", {
        priceUsd: 100,
        priceEtb: 5500
    });
});



// ❌ Cancel page
app.get("/cancel", (req, res) => {
    res.render("cancel");
});


// ✅ Success
app.get("/success", (req, res) => {
    res.render("success", { title: "Success", currentPath: req.path });
});

// ❌ Cancel
app.get("/cancel", (req, res) => {
    res.render("cancel", { title: "Cancelled", currentPath: req.path });
});

// ℹ️ About
app.get("/about", (req, res) => {
    res.render("about", { title: "About Ferfam", currentPath: req.path });
});

// 📞 Contact
app.get("/contact", (req, res) => {
    res.render("contact", { title: "Contact Ferfam", currentPath: req.path });
});




// 💳 Stripe Checkout
app.post("/checkout/stripe", async (req, res) => {
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items: [
                {
                    price_data: {
                        currency: "usd",
                        product_data: { name: "Ferfam Family Service" },
                        unit_amount: 196000, // $1,960 in cents
                    },
                    quantity: 1,
                },
            ],
            mode: "payment",
            success_url: "http://localhost:5000/success",
            cancel_url: "http://localhost:5000/cancel",
        });
        res.redirect(303, session.url);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.post("/checkout/stripe", async (req, res) => {
    const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        line_items: [
            {
                price_data: {
                    currency: "usd",
                    product_data: { name: "House Rental Payment" },
                    unit_amount: 10000, // $100 x 100
                },
                quantity: 1,
            }
        ],
        success_url: "http://localhost:5000/success",
        cancel_url: "http://localhost:5000/cancel"
    });

    res.redirect(303, session.url);
});


// 🇪🇹 Telebirr Checkout
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
            totalAmount: "300,000.00", // ETB
            priceETB: 30000, // ETB 300,000 in cents
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

// ✅ Success page
app.get("/success", (req, res) => {
    res.send("<h2>✅ Payment Successful! Thank you for choosing Ferfam.</h2>");
});

app.listen(PORT, () =>
    console.log(`✅ Server running at http://localhost:${PORT}`)
);
