# HealthPulse Frontend (Vercel Deployment Ready)

This is the standalone frontend for the Patient & Doctor Management System, configured to deploy on **Vercel** and connect to your Spring Boot REST API hosted on **Render**.

## How to Deploy on Vercel (Step-by-Step):

1. **Push this `frontend` folder to GitHub**:
   - You can push the entire repository to GitHub and in Vercel choose the `frontend` folder as the Root Directory, OR create a dedicated repository for this `frontend` folder.
2. **Go to [Vercel](https://vercel.com)**:
   - Click **Add New...** > **Project**.
   - Import your GitHub repository.
   - If deploying from the monorepo, set **Root Directory** to `frontend`.
   - Click **Deploy**.
3. **Connect to your Render Backend**:
   - Once deployed, open your live Vercel website (e.g. `https://healthpulse.vercel.app`).
   - Click the **`Backend URL`** button in the top navigation bar.
   - Enter your live Render backend URL:
     ```
     https://<your-render-app-name>.onrender.com
     ```
   - Click OK, and your live frontend will immediately connect to your live Render backend!
