const puppeteer = require("puppeteer");

const path = require("path");

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");


// =========================================================
// FIREBASE CONFIGURATION
// =========================================================

const serviceAccount = require("../serviceAccountKey.json");

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();


// =========================================================
// DELTA OHM CONFIGURATION
// =========================================================

const USER_DATA_DIR = path.join(
    __dirname,
    "deltaohm-browser-profile"
);

const DELTA_OHM_URL = "https://deltaohm.cloud/";

const READ_INTERVAL = 60000;


// =========================================================
// FIRESTORE LOCATION
// =========================================================

const DELTA_COLLECTION = "deltaohm";
const DELTA_DOCUMENT = "latest";


// =========================================================
// MAIN
// =========================================================

async function main() {

    console.log("Delta OHM → Firestore Reader");


    // -----------------------------------------------------
    // Start browser
    // -----------------------------------------------------

    const browser = await puppeteer.launch({
        headless: false,
        acceptInsecureCerts: true,
        ignoreHTTPSErrors: true,

        args: [
            "--ignore-certificate-errors",
            "--allow-running-insecure-content"
        ],

        userDataDir: USER_DATA_DIR,

        defaultViewport: {
            width: 1440,
            height: 900
        }
    });


    // -----------------------------------------------------
    // Get browser page
    // -----------------------------------------------------

    const pages = await browser.pages();

    const page =
        pages.length > 0
            ? pages[0]
            : await browser.newPage();


    console.log("[STEP] Opening Delta OHM Cloud...");


    // -----------------------------------------------------
    // Open Delta OHM
    // -----------------------------------------------------

    await page.goto(
        DELTA_OHM_URL,
        {
            waitUntil: "domcontentloaded",
            timeout: 60000
        }
    );


    console.log("[STEP] Browser opened.");
    console.log("[STEP] 1. Login if necessary.");
    console.log("[STEP] 2. Open TAR-UMT visualization.");
    console.log("[STEP] 3. Keep visualization open.");
    console.log(
        `[STEP] Checking sensor values every ${READ_INTERVAL / 1000} seconds...`
    );


    // -----------------------------------------------------
    // Store previous reading
    // -----------------------------------------------------

    let lastSensorValues = null;


    // =====================================================
    // READ DATA
    // =====================================================

    setInterval(async () => {

        try {

            const data = await page.evaluate(() => {

                const text = document.body.innerText;


                // -----------------------------------------
                // Helper
                // -----------------------------------------

                function findValue(label, unit = "") {

                    const escapedLabel =
                        label.replace(
                            /[.*+?^${}()|[\]\\]/g,
                            "\\$&"
                        );


                    const regex =
                        new RegExp(
                            escapedLabel +
                            "\\s*" +
                            "(-?\\d+(?:\\.\\d+)?)" +
                            "\\s*" +
                            unit,
                            "i"
                        );


                    const match =
                        text.match(regex);


                    if (!match) {
                        return null;
                    }


                    const value =
                        parseFloat(match[1]);


                    return Number.isNaN(value)
                        ? null
                        : value;
                }


                // -----------------------------------------
                // Sensor values
                // -----------------------------------------

                return {

                    temperature:
                        findValue(
                            "Temperature PT100",
                            "°?C"
                        ),

                    windSpeed:
                        findValue(
                            "Wind speed",
                            "m\\/s"
                        ),

                    windDirection:
                        findValue(
                            "Wind direction",
                            "deg"
                        ),

                    relativeHumidity:
                        findValue(
                            "Relative Humidity",
                            "%"
                        ),

                    dewPoint:
                        findValue(
                            "Dew point",
                            "°?C"
                        ),

                    solarRadiation:
                        findValue(
                            "Solar radiation",
                            "W\\/m2"
                        ) ??
                        findValue(
                            "Solar radiation",
                            "W\\/m²"
                        ),

                    atmosphericPressure:
                        findValue(
                            "Atmospheric pressure",
                            "mbar"
                        ),

                    maxRainRate:
                        findValue(
                            "Max rain rate",
                            "mm\\/h"
                        ),

                    dailyRain:
                        findValue(
                            "Daily rain",
                            "mm"
                        ),

                    totalRain:
                        findValue(
                            "Total Rain",
                            "mm"
                        ),

                    batteryVoltage:
                        findValue(
                            "Battery voltage",
                            "V"
                        )

                };

            });


            // -------------------------------------------------
            // Check if data exists
            // -------------------------------------------------

            const found =
                Object.values(data)
                    .some(
                        value =>
                            value !== null
                    );


            if (!found) {

                console.log(
                    `[${new Date().toLocaleTimeString()}] Sensor values not found.`
                );

                return;
            }


            // -------------------------------------------------
            // Check whether sensor values changed
            // -------------------------------------------------

            const currentSensorValues =
                JSON.stringify(data);


            if (
                currentSensorValues ===
                lastSensorValues
            ) {

                return;
            }


            // -------------------------------------------------
            // Build Firestore object
            // -------------------------------------------------

            const outputData = {

                updatedAt:
                    new Date().toISOString(),

                ...data

            };


            // -------------------------------------------------
            // Write to Firestore
            // -------------------------------------------------

            await db
                .collection(
                    DELTA_COLLECTION
                )
                .doc(
                    DELTA_DOCUMENT
                )
                .set(
                    outputData
                );


            // Only mark data as successfully written
            // AFTER Firestore succeeds.
            lastSensorValues =
                currentSensorValues;


            // -------------------------------------------------
            // Output
            // -------------------------------------------------

            console.log(
                `[${new Date().toLocaleTimeString()}] Firestore updated — sensor values changed.`
            );


        } catch (error) {

            console.error(
                `[${new Date().toLocaleTimeString()}] ERROR:`,
                error.message
            );

        }

    }, READ_INTERVAL);


    console.log("[STEP] Reader started.");
    console.log("[STEP] Press Ctrl+C to stop.");

}


// =========================================================
// START
// =========================================================

main().catch(error => {

    console.error(
        "Fatal error:",
        error
    );

    process.exit(1);

});