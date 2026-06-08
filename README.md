This is a [Next.js](https://nextjs.org/) project powering [davidsouther.com](davidsouther.com). It includes David Souther's public resume & own published works.

## Setup

- This project uses [mise](https://mise.jdx.dev/) to provision Node (>=24) from `mise.toml`. After cloning, run `mise trust && mise install` once so `node` resolves without NVM.
- The package.json scripts are mirrored as mise tasks, so `mise check`, `mise test`, `mise dev`, `mise build`, etc. each run the matching `npm run <script>`.

## Development

- Run the project locally with `npm run dev`
  - Resume content is in [`./src/pages/resume.json`](./src/pages/resume.json)
  - Blog content is in [`./posts`](./posts/)
- Prepare the project for deployment with `npm run export`
  - Updates are deployed via gh-pages pointed at the [`docs`](./docs) folder
