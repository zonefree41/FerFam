// =======================================
//              IMPORTS
// =======================================
import express from "express";
import dotenv from "dotenv";
import Stripe from "stripe";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";
import i18n from "i18n";
import cookieParser from "cookie-parser";
import session from "express-session";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// =======================================
//           MIDDLEWARE SETUP
// =======================================
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Sessions for admin authentication
app.use(
    session({
        secret: "ferfam-secure-key",
        resave: false,
        saveUninitialized: false,
        cookie: { secure: false }
    })
);

// =======================================
//                i18n
// =======================================
i18n.configure({
    locales: ["en", "am"],
    directory: path.join(__dirname, "locales"),
    defaultLocale: "en",
    cookie: "lang"
});

app.use(i18n.init);

// Inject current path into all views
app.use((req, res, next) => {
    res.locals.currentPath = req.path;
    next();
});

// =======================================
//               MAIN PAGES
// =======================================
app.get("/", (req, res) => {
    res.render("index", {
        priceUsd: 903,
        priceEtb: Math.round(903 * 155), // Adjust ETB rate here
    });
});

// =======================================
//         FIX CHROME CSP WARNING
// =======================================
app.get("/.well-known/appspecific/com.chrome.devtools.json", (req, res) => {
    res.status(204).send(); // Silences Chrome request
});

// =======================================
//            LANGUAGE ROUTE
// =======================================
app.get("/lang/:locale", (req, res) => {
    res.cookie("lang", req.params.locale);
    res.setLocale(req.params.locale);
    res.redirect(req.get("Referer") || "/");
});


// =======================================
//               ADMIN SYSTEM
// =======================================

// Middleware to protect admin routes
function requireAdmin(req, res, next) {
    if (!req.session.admin) return res.redirect("/admin/login");
    next();
}

// Admin login page
app.get("/admin/login", (req, res) => {
    res.render("admin-login", { error: null });
});

// Admin authentication
app.post("/admin/login", (req, res) => {
    const { email, password } = req.body;

    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
        req.session.admin = true;
        return res.redirect("/admin/dashboard");
    }

    res.render("admin-login", { error: "Invalid email or password" });
});

// Admin Dashboard
app.get("/admin/dashboard", requireAdmin, (req, res) => {
    res.render("admin-dashboard");
});

// Admin Logout
app.get("/admin/logout", requireAdmin, (req, res) => {
    req.session.destroy(() => res.redirect("/admin/login"));
});

// =======================================
//              PUBLIC ROUTES
// =======================================
// (Home is already defined above, do not duplicate)



app.get("/about", (req, res) => res.render("about"));
app.get("/contact", (req, res) => res.render("contact"));
app.get("/start-now", (req, res) => res.render("start-now"));

app.get("/housetour", (req, res) => {
    res.render("house-tour", {
        priceUsd: 903 * 100,        
        priceEtb: Math.round(903 * 155),
    });
});

// =======================================
//             BOOKING SYSTEM
// =======================================
app.get("/booking", (req, res) => {
    res.render("booking", {
        priceUsd: 17,
        priceEtb: Math.round(17 * 155),
    });
});

app.post("/booking/submit", (req, res) => {
    const { name, amount } = req.body;

    const payer = name || "Ferwoine Asg";

    // Forward to Stripe dynamic route
    res.redirect(307, `/checkout/stripe?amount=${amount}&payer=${encodeURIComponent(payer)}`);
});

// =======================================
//              STRIPE CHECKOUT
// =======================================
app.post("/checkout/stripe", async (req, res) => {
    const amount = Number(req.body.amount || req.query.amount);
    const payer = req.body.payer || req.query.payer || "Ferwoine Asg";

    if (!amount || isNaN(amount)) {
        return res.status(400).send("Payment amount missing or invalid.");
    }

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            mode: "payment",
            line_items: [
                {
                    price_data: {
                        currency: "usd",
                        product_data: { name: `Rent Payment – ${payer}` },
                        unit_amount: Math.round(amount * 100)
                    },
                    quantity: 1
                }
            ],
            success_url: `${req.protocol}://${req.get("host")}/success`,
            cancel_url: `${req.protocol}://${req.get("host")}/cancel`,
        });

        res.redirect(303, session.url);

    } catch (error) {
        console.error("Stripe Error:", error.message);
        res.status(500).send("Stripe Checkout Error: " + error.message);
    }
});

// =======================================
//             TELEBIRR (COMING SOON)
// =======================================
app.post("/checkout/telebirr", (req, res) => {
    res.send("Telebirr integration is coming soon.");
});

// =======================================
//             SUCCESS / CANCEL
// =======================================
app.get("/success", (req, res) => res.render("success"));
app.get("/cancel", (req, res) => res.render("cancel"));

// =======================================
//             START SERVER
// =======================================
app.listen(PORT, () =>
    console.log(`🚀 Server running at http://localhost:${PORT}`)
);
