# StockWise Tracking System Setup Guide

This guide describes how to obtain the necessary API credentials to enable automated growth analysis for StockWise.

---

## 1. Google Analytics 4 (GA4) API Setup

To allow the AI Agent to read traffic patterns, we need a **Service Account JSON Key**.

### Step 1.1: Enable the API
1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Select your project (or create a new one named `StockWise-Analytics`).
3.  Navigate to **APIs & Services > Library**.
4.  Search for **"Google Analytics Data API"** and click **Enable**.

### Step 1.2: Create a Service Account
1.  Navigate to **IAM & Admin > Service Accounts**.
2.  Click **+ Create Service Account**.
3.  Name it `stockwise-growth-agent`. Click **Create and Continue**.
4.  (Optional) Assign no roles, just click **Done**.

### Step 1.3: Download JSON Key
1.  In the Service Accounts list, click on the email of the account you just created.
2.  Go to the **Keys** tab.
3.  Click **Add Key > Create new key**.
4.  Select **JSON** and click **Create**.
5.  **Action**: Save the downloaded file to your computer. You will eventually move this to `backend/keys/ga4-service-account.json`.

### Step 1.4: Grant Permission in GA4
1.  Copy the `client_email` from the JSON file (it looks like `...@...iam.gserviceaccount.com`).
2.  Open [Google Analytics](https://analytics.google.com/).
3.  Go to **Admin > Property Access Management**.
4.  Click **+ > Add users**.
5.  Paste the service account email and assign the **Viewer** role.

### Step 1.5: Note the Property ID
1.  In GA4 Admin, go to **Property Settings > Property Details**.
2.  Copy the **Property ID** (a numeric string).

---

## 2. Microsoft Clarity Setup

Microsoft Clarity is primarily used for session recordings and visual insights, but its API can also provide data on "Negativity Signals" (e.g., dead clicks).

### Step 2.1: Verify Project ID
-   Our Project ID is currently set as `w8b3c6w7hs` in the code.
-   You can verify this by going to the [Clarity Dashboard](https://clarity.microsoft.com/) and checking the Settings.

### Step 2.2: Obtain Data Export Token (Optional)
This allows the AI Agent to fetch aggregate metrics like "Dead Click Rate".
1.  In Clarity, go to your Project **Settings**.
2.  Select the **Data Export** tab.
3.  Click **Generate new API token**.
4.  **Action**: Copy the token. You will add this to `.env` as `CLARITY_API_TOKEN`.

---

## 3. Configuration in StockWise

Once you have the credentials:

1.  **JSON Secret**: Move your downloaded JSON file to:
    `/Users/yesun/Code/stockwise/backend/keys/ga4-service-account.json`
2.  **Environment Variables**: Update your `backend/.env` file:
    ```env
    GA4_PROPERTY_ID=123456789 (Replace with your actual ID)
    GA4_CREDENTIALS_PATH=backend/keys/ga4-service-account.json
    ```

---

> [!IMPORTANT]
> **Security Notice**: Your Service Account JSON contains sensitive access. Never share it via public channels or commit it to GitHub. The project's `.gitignore` has been updated to automatically exclude the `backend/keys/` directory.
