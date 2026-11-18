# PhishLens — Phishing Email Detection ML Workbench

PhishLens is an interactive machine learning workbench for detecting phishing emails while minimizing false alarms on legitimate messages. It combines **Multinomial Naive Bayes** (word tokens + UTF-8 byte n-grams) with an **Ensemble Learning** pipeline (**L2 Logistic Regression** + **Decision Forest**) to catch disguised phishing attacks without blocking real security or business notifications.

## Machine Learning Architecture

### 1. Feature Extraction (`src/ml/features.ts`)
Each email is parsed into three complementary feature groups:
- **Word & Bigram Tokens**: Normalized terms from sender name, sender domain, subject, and body.
- **UTF-8 Byte N-Grams (3-byte and 4-byte sequences)**: Captures obfuscated spelling (`p4ypal`, `micros0ft`), non-ASCII homoglyphs, percent-encoded URLs, and risky TLD suffixes.
- **14 Structural & Header Signals**: IPv4 literal URLs, high-risk TLDs, external link density, URL obfuscation, sender vs. `Reply-To` mismatch, SPF/DKIM/DMARC authentication failures, urgency/credential lexicons, uppercase ratio, non-ASCII byte ratio, leetspeak digit substitution, HTML form/script indicators, payload byte entropy, and authenticated domain trust.

### 2. Models & Ensemble Voting (`src/ml/`)
- **Word & Byte Scanner (`src/ml/naiveBayes.ts`)**: Multinomial Naive Bayes with configurable Laplace smoothing ($\alpha$) and byte n-gram weighting. Outputs per-token and per-byte-sequence log-odds contributions.
- **Link & Header Checker (`src/ml/logisticRegression.ts`)**: L2-regularized Logistic Regression trained via batch gradient descent over the 14 structural/lexical features.
- **Rule Trees (`src/ml/decisionForest.ts`)**: Bootstrapped 25-tree Gini-impurity Decision Forest modeling non-linear interactions between urgency phrasing and sender authentication.
- **Combined Model / Soft-Voting Ensemble (`src/ml/ensemble.ts`)**: Blends all three base learners with authentication-verified false-positive dampening and threshold optimization (`findOptimalThresholdForMaxFpr`) to meet low false-positive targets ($\text{FPR} \le 2\%$ or $0\%$).

## Key Features

- **Overview & Accuracy Report (`src/components/OverviewView.tsx`, `src/components/RocChart.tsx`)**: Held-out test metrics, interactive ROC curve comparing the Combined Ensemble against standalone Naive Bayes, model comparison table, and False Alarms Prevented audit.
- **Live Inspector & Explainability (`src/components/InspectorView.tsx`)**: Test sample or custom emails (sender, `Reply-To`, SPF/DKIM/DMARC, subject, body) and inspect the **Explainability** section breaking down top contributing keywords, top byte sequences, sender/link checks, and highlighted spans.
- **Message Queue (`src/components/QueueView.tsx`)**: Searchable and filterable triage table comparing standalone Naive Bayes scores vs. Combined Ensemble verdicts (`False Alarm Saved` tracking).
- **Evaluation Lab (`src/components/EvaluationLabView.tsx`)**: Interactive risk cutoff ($\tau$) slider, low-FPR optimization presets, side-by-side confusion matrices, hyperparameter tuning ($\alpha$, byte weight, test split, ensemble voting weights), and custom training sample expansion.
- **Editable Beige Theme (`src/theme.ts`, `src/components/ThemeEditorModal.tsx`)**: Warm Beige default palette with preset switching (`Warm Beige`, `Soft Cream`, `Classic Light`) and live color customization.
- **Guided Demo Tour (`src/components/DemoTour.tsx`)**: 5-step interactive walkthrough triggered via **Start Demo Tour**.

## Project Structure

```text
src/
├── App.tsx                       # App shell, navigation, theme state, and tour orchestration
├── index.css                     # Tailwind CSS setup and theme CSS variables
├── theme.ts                      # Warm Beige presets and live CSS variable helpers
├── components/
│   ├── DemoTour.tsx              # 5-step guided interactive walkthrough
│   ├── EvaluationLabView.tsx     # Threshold calibration, confusion matrices, and retraining
│   ├── InspectorView.tsx         # Live email checker and Explainability breakdown
│   ├── OverviewView.tsx          # Benchmark KPIs, ROC overview, and FP audit
│   ├── QueueView.tsx             # Filterable email triage queue
│   ├── RocChart.tsx              # Interactive SVG ROC curve
│   └── ThemeEditorModal.tsx      # Live theme preset and color customizer
└── ml/
    ├── dataset.ts                # Curated phishing, byte-obfuscation, and hard-negative corpus
    ├── decisionForest.ts         # 25-tree Gini Decision Forest
    ├── ensemble.ts               # Soft-voting ensemble, ROC/AUC, and threshold optimizer
    ├── features.ts               # Token, UTF-8 byte n-gram, and structural feature extractor
    ├── logisticRegression.ts     # L2-regularized Logistic Regression
    ├── naiveBayes.ts             # Multinomial Naive Bayes with Laplace smoothing
    ├── pipeline.test.ts          # Unit tests (node:test)
    └── types.ts                  # Shared ML interfaces and feature labels
```

## Development & Testing

```bash
# Install dependencies
npm install

# Start development server on port 3000
npm run dev

# Run ML pipeline unit tests
npx --yes tsx --test src/ml/pipeline.test.ts

# Type-check with TypeScript
npm run lint

# Build production bundle
npm run build
```
