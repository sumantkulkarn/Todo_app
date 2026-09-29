# Daymark

A calm, responsive todo planner built as a dependency-free Progressive Web App.

## Features

- Add, edit, complete, and remove tasks with due dates, priorities, and project labels.
- Filter by Today, Upcoming, All tasks, Completed, or project; search by task name.
- See daily completion progress and a week-at-a-glance activity chart.
- Install on mobile and continue using the app offline after its first visit.
- Tasks are saved in this browser on this device; they are not synced between devices.

## Run locally

From the project directory, start a static web server:

```sh
python3 -m http.server 4173
```

Open <http://localhost:4173>. To install on a phone, open the published HTTPS site in its browser and use that browser's install or Add to Home Screen action.

## Deploy to GitHub Pages

The workflow in `.github/workflows/deploy.yml` deploys the site when changes are pushed to `main`. For the first deployment, open the repository's **Settings → Pages**, set **Build and deployment → Source** to **GitHub Actions**, then run **Deploy Daymark to GitHub Pages** from the Actions tab. The site will be available at `https://sumantkulkarn.github.io/Todo_app/` after the workflow succeeds.
