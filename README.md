# LLM Analysis Quiz - IITM BS Data Science

This repository contains my implementation for Project 2 - LLM Analysis Quiz.

The server:
- Accepts POST requests from evaluation server
- Validates email + secret
- Loads quiz page using Playwright headless browser
- Scrapes data
- Processes and solves questions
- Submits the answer back within 3 minutes
- Handles next quiz URLs automatically

## Technologies Used
- Node.js
- Express
- Playwright
- dotenv

## How to run

cd ~/llm-analysis-quiz
node server.js


## License
MIT License
