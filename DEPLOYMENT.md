# Deployment Guide

TabTab is a static client-side React application built with Vite. It requires no backend or database and can be hosted on any static web hosting provider (e.g., Vercel, Netlify, GitHub Pages, AWS S3).

## 1. Build the Project

Before deploying, you can build the production-ready static files locally or let CI/CD do it:

\\\ash
npm install
npm run build
\\\

The optimized output will be placed in the dist directory. The project is pre-configured with ase: './' in ite.config.ts, so assets use relative paths and will work seamlessly at the root directory (/) or any subdirectory without additional configuration.

## 2. Environment Variables

This project currently has no backend dependencies and requires no API keys or secrets to operate in its default mode.
A .env.example file is provided in the repository. If you choose to add API integrations in the future (e.g., analytics), define them in your environment variables on your hosting provider.

## 3. Hosting Platforms

### GitHub Pages (Automated via GitHub Actions)
A .github/workflows/deploy.yml workflow is included in the repository.
1. Push your repository to GitHub.
2. In your GitHub repository, go to **Settings** > **Pages**.
3. Under **Build and deployment > Source**, select **GitHub Actions**.
4. Every push to main or master will automatically build and publish the site.

#### Serving at Root on GitHub Pages:
- **User/Org Root Site:** If your repo is named <username>.github.io, it will be served at https://<username>.github.io/ (root).
- **Custom Domain:** If you add a custom domain (e.g., 	hermotables.com) under **Settings > Pages > Custom domain**, it will automatically be served at the root domain (https://thermotables.com/).

### Vercel (Root by default)
1. Sign in to [Vercel](https://vercel.com).
2. Import the Git repository containing this project.
3. The framework preset is automatically detected as **Vite**.
4. Click **Deploy**. Your app will immediately be live at https://your-project.vercel.app/ (root directory).

### Netlify (Root by default)
1. Sign in to [Netlify](https://www.netlify.com).
2. Click **Add new site** -> **Import an existing project**.
3. Connect your Git repository.
4. Set Build command to 
pm run build and Publish directory to dist.
5. Click **Deploy site**.

## 4. Post-Deployment Checks

Once deployed, verify the following:
- Verify that table data loads correctly (bundled with the application).
- Check that the responsive layout works on mobile and desktop devices.
- Confirm that the Jump-to scroll interactions trigger properly without errors.
