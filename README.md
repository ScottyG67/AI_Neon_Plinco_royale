<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Neon Plinko Royale

A multiplayer Plinko game built with React, Socket.IO, and Matter.js.

View your app in AI Studio: https://ai.studio/apps/drive/1eAUcrZie2c-zFYhDH9UMbR_TPDzcT151

## Prerequisites

- **Node.js** (version 18 or higher)
- **npm** (comes with Node.js)
- **Google Cloud SDK** (for deployment) - [Installation Guide](https://cloud.google.com/sdk/docs/install)

## Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set environment variables (optional):**
   - Create a `.env.local` file if needed
   - Set `GEMINI_API_KEY` if your app uses Gemini API

3. **Run the development server:**
   ```bash
   npm run dev
   ```
   
   The app will start in development mode with Vite hot-reloading. Open your browser to the URL shown in the terminal (typically `http://localhost:3001`).

## Deployment to Google Cloud Run

This application is deployed to **Google Cloud Run** in the `bstw-qa-warehouse` project.

### Quick Deployment

Use the provided deployment script:

```bash
./deploy.sh
```

This script will:
- Authenticate with Google Cloud (if needed)
- Enable required APIs
- Build and push the Docker image
- Deploy to Cloud Run

### Manual Deployment

If you prefer to deploy manually:

1. **Authenticate with Google Cloud:**
   ```bash
   gcloud auth login
   ```

2. **Set the project:**
   ```bash
   gcloud config set project bstw-qa-warehouse
   ```

3. **Enable required APIs:**
   ```bash
   gcloud services enable cloudbuild.googleapis.com
   gcloud services enable run.googleapis.com
   gcloud services enable containerregistry.googleapis.com
   ```

4. **Build and push the Docker image:**
   ```bash
   gcloud builds submit --tag gcr.io/bstw-qa-warehouse/neon-plinko-royale
   ```

5. **Deploy to Cloud Run:**
   ```bash
   gcloud run deploy neon-plinko-royale \
     --image gcr.io/bstw-qa-warehouse/neon-plinko-royale \
     --platform managed \
     --region us-west1 \
     --allow-unauthenticated \
     --port 8080 \
     --memory 512Mi \
     --cpu 1 \
     --min-instances 0 \
     --max-instances 10 \
     --timeout 300 \
     --set-env-vars NODE_ENV=qa
   ```

### Deployment Configuration

- **Project**: `bstw-qa-warehouse`
- **Service Name**: `neon-plinko-royale`
- **Region**: `us-west1`
- **Port**: `8080`
- **Memory**: `512Mi`
- **CPU**: `1`
- **Min Instances**: `0` (scales to zero)
- **Max Instances**: `10`
- **Timeout**: `300 seconds`
- **Environment**: `NODE_ENV=qa`

### View Deployment

After deployment, you can view the service in the [Google Cloud Console](https://console.cloud.google.com/run/detail/us-west1/neon-plinko-royale?project=bstw-qa-warehouse).

The deployment script will also output the service URL after successful deployment.

## Project Structure

```
├── server.js              # Express server with Socket.IO
├── App.tsx                # Main React component
├── components/            # React components
│   ├── Button.tsx
│   ├── GameCanvas.tsx
│   └── WinnerToast.tsx
├── Dockerfile             # Docker configuration for Cloud Run
├── deploy.sh              # Deployment script
├── vite.config.ts         # Vite configuration
└── package.json           # Dependencies and scripts
```

## Environment Modes

- **Development Mode** (Local): Uses Vite middleware for hot-reloading. Activated when `NODE_ENV` is not set.
- **QA/Deployed Mode** (Cloud Run): Serves static files from `dist/` directory. Activated when `NODE_ENV=qa` (set in Dockerfile).

## Building for Production

To build the frontend for production:

```bash
npm run build
```

This creates a `dist/` directory with optimized static files. The Dockerfile automatically runs this during the build process.

## Troubleshooting

### Deployment Issues

- **Authentication Error**: Run `gcloud auth login` to authenticate
- **Permission Denied**: Ensure you have the necessary IAM roles in the GCP project
- **Build Fails**: Check that all dependencies are listed in `package.json`

### Local Development Issues

- **Port Already in Use**: Change the port in `server.js` (default is 3001 for local dev) or kill the process using that port
- **Socket Connection Fails**: Ensure the server is running and accessible

## Scripts

- `npm run dev` - Start development server with Vite
- `npm start` - Start production server (requires built `dist/` folder)
- `npm run build` - Build frontend for production
- `./deploy.sh` - Deploy to Google Cloud Run

## Credits

### Advanced Volume Controls

The advanced volume slider controls (available in Settings > Advanced Mode) are inspired by the [WorstVolumeControl](https://github.com/ZeyuKeithFu/WorstVolumeControl) project by [ZeyuKeithFu](https://github.com/ZeyuKeithFu). The physics-based rotation control and "worst UX" design concept come from this excellent repository.
