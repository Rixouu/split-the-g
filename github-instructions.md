# GitHub Repository Setup Instructions

## 1. Create a new GitHub repository

1. Go to [GitHub Create Repository page](https://github.com/new)
2. Name your repository `split-the-g`
3. Make it Public or Private as desired
4. Do NOT initialize with README, license, or .gitignore
5. Click "Create repository"

## 2. Push your local code to GitHub

After creating the repository, run these commands in your terminal:

```bash
# Make sure your remote is set correctly to your repository
git remote set-url origin https://github.com/YOUR_USERNAME/split-the-g.git

# Replace YOUR_USERNAME with your actual GitHub username, e.g.:
# git remote set-url origin https://github.com/Rixouu/split-the-g.git

# Push your code
git push -u origin main
```

## 3. Authentication

When prompted for authentication:
- For username: Enter your GitHub username
- For password: Use your Personal Access Token (NOT your GitHub password)

## 4. Create a Personal Access Token (if needed)

If you don't have a Personal Access Token:

1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token" → "Generate new token (classic)"
3. Give it a name like "Push to repositories"
4. Select the "repo" scope to allow pushing to repositories
5. Click "Generate token" and copy the token immediately (you won't be able to see it again)

## 5. Alternative: Use SSH instead of HTTPS

If you prefer SSH authentication:

```bash
# Remove the current origin
git remote remove origin

# Add your repository using SSH
git remote add origin git@github.com:YOUR_USERNAME/split-the-g.git

# Push your code
git push -u origin main
```

For SSH setup, you'll need to add your SSH key to your GitHub account: [GitHub SSH setup guide](https://docs.github.com/en/authentication/connecting-to-github-with-ssh) 