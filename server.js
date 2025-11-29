const express = require("express");
const bodyParser = require("body-parser");
const fetch = require("node-fetch");
const puppeteer = require("puppeteer");
require("dotenv").config();

const app = express();
app.use(bodyParser.json());

app.post("/quiz-hook", async (req, res) => {
  try {
    const { email, secret, url } = req.body;
    if (!email || !secret || !url)
      return res.status(400).json({ error: "Invalid JSON" });

    if (secret !== process.env.SECRET)
      return res.status(403).json({ error: "Invalid secret" });

    res.json({ received: true, status: "processing" });

    await solveQuiz(url);
  } catch (err) {
    console.error("Quiz handler error:", err);
  }
});

async function solveQuiz(quizUrl) {
  try {
    console.log("Loading:", quizUrl);

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();
    await page.goto(quizUrl, { waitUntil: "networkidle0" });

    // Read everything on screen
    const pageText = await page.evaluate(() => document.body.innerText);
    console.log("Page loaded.");

    // Find submit URL inside page text
    const submitMatch = pageText.match(/https?:\/\/[^\s]+submit[^\s]*/);
    if (!submitMatch) {
      console.log("No submit URL found");
      await browser.close();
      return;
    }
    const submitUrl = submitMatch[0];

    // Your logic - for testing we send answer=123
    const answerPayload = {
      email: process.env.EMAIL,
      secret: process.env.SECRET,
      url: quizUrl,
      answer: 123
    };

    const response = await fetch(submitUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(answerPayload)
    });

    const result = await response.json();
    console.log("Submit response:", result);

    if (result.url) {
      console.log("Next quiz:", result.url);
      await solveQuiz(result.url);
    }

    await browser.close();
  } catch (e) {
    console.error("Solve error:", e);
  }
}

app.listen(process.env.PORT || 3000, () => {
  console.log("Server running on port", process.env.PORT || 3000);
});
