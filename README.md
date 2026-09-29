# Doorbell

This file includes repository specific instructions. Please keep it up to date.

## Development environment setup

### Prerequisites

The following software and tools are required to run the development environment:

- `Node.js` version 24 or higher
- `NPM` version 11 or higher
- `Docker`

Use [NVM](https://github.com/nvm-sh/nvm) to manage Node versions efficiently.

### Installing dependencies:

```shell
npm ci
```

### Starting the development servers

Frontend:

```shell
npm run dev --workspace=doorbell-frontend
```

Backend:

```shell
npm run dev --workspace=doorbell-backend
```

## Building and linting

Run `npm run lint` to lint both workspaces, and `npm run build` to build both workspaces.
