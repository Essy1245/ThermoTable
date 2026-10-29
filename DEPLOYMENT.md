# Deployment Guide

TabTab is a static client-side React application built with Vite. It requires no backend or database and can be hosted on any static web hosting provider (e.g., Vercel, Netlify, GitHub Pages, Cloudflare Pages, AWS S3).

## 1. Build the Project

Before deploying, build the production-ready static assets locally or configure your CI/CD pipeline:

```bash
npm install
npm run build
```

The optimized output will be placed in the `dist` directory. The project is pre-configured with `base: './'` in `vite.config.ts`, so assets use relative paths and will work seamlessly at the root directory (`/`) or any subdirectory without additional configuration.

## 2. Environment Variables

This project has no backend dependencies and requires no API keys or secrets to operate in its default mode.
A `.env.example` file is provided in the repository for optional future analytics or instrumentation.

## 3. Hosting Platforms

### GitHub Pages (Automated via GitHub Actions)
A `.github/workflows/deploy.yml` workflow is included in the repository.
1. Push your repository to GitHub.
2. In your GitHub repository, go to **Settings** > **Pages**.
3. Under **Build and deployment > Source**, select **GitHub Actions**.
4. Every push to `main` will automatically build and publish the site.

#### Serving on GitHub Pages:
- **User/Org Root Site:** If your repo is named `<username>.github.io`, it will be served at `https://<username>.github.io/`.
- **Project Site:** If your repo is named `tabtab`, it will be served at `https://<username>.github.io/tabtab/` (relative assets automatically resolve).
- **Custom Domain:** If you add a custom domain under **Settings > Pages > Custom domain**, it will automatically be served at your root domain.

### Vercel
1. Sign in to [Vercel](https://vercel.com).
2. Import the Git repository.
3. The framework preset is automatically detected as **Vite**.
4. Click **Deploy**. Your app will immediately be live.

### Netlify
1. Sign in to [Netlify](https://www.netlify.com).
2. Click **Add new site** -> **Import an existing project**.
3. Connect your Git repository.
4. Set Build command to `npm run build` and Publish directory to `dist`.
5. Click **Deploy site**.

## 4. Post-Deployment Checks

Once deployed, verify the following:
- Verify that table data loads correctly.
- Check that the responsive layout works on mobile and desktop devices.
- Confirm that the Jump-to scroll interactions trigger properly without errors.
- Confirm snippet generator creates and copies images to the clipboard.
