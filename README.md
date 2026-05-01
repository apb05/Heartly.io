# Heartly Dashboard

Heartly is a static browser-based dashboard for reviewing heart and activity inputs and turning them into a plain-language concern assessment.

The interface lets you enter baseline heart rate ranges, current readings, recovery values, activity totals, and symptom flags. Based on those inputs, the dashboard explains whether the pattern looks normal, worth monitoring, cautionary, concerning, or urgent.

## What It Does

- Accepts manual heart and activity inputs in a full-screen dashboard.
- Evaluates the data against a simple rule-based decision flow.
- Explains the result in plain language instead of raw JSON.
- Updates live as values are changed.
- Shows the checks that drove the output.

## Project Structure

- [index.html](/Volumes/Projects/Heartly.io/index.html): Dashboard markup
- [styles.css](/Volumes/Projects/Heartly.io/styles.css): Layout and visual styling
- [script.js](/Volumes/Projects/Heartly.io/script.js): Input handling and evaluation logic

## Run Locally

Because this is a static site, you can serve it with any local HTTP server.

Example:

```bash
python3 -m http.server 4173
```

Then open:

```text
http://127.0.0.1:4173/
```

## Evaluation Logic

The current rules prioritize higher-risk signals first:

1. Missing required data
2. Red-flag symptoms
3. Clinician heart-rate limit exceeded
4. Sudden heart-rate spike or drop
5. Elevated resting heart rate
6. Elevated heart rate during light activity
7. Recovery below expected baseline
8. Multi-day activity decline
9. Normal / stable pattern

Each result includes:

- A concern level
- A short recommendation
- A plain-language explanation
- Whether a caregiver alert should be on
- A suggested next check time

## Notes

- State is stored in `localStorage`, so entered values persist in the browser.
- The current implementation is fully client-side with no backend or API dependency.
- The included PDFs and image assets are reference material and are not required for the dashboard to run.

## Disclaimer

This project is a demo dashboard and not a medical device. Its output should not be used as a substitute for clinical judgment, emergency care, or professional medical advice.
