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
cd doorbell-frontend/
npm ci
```

Introducing NPM workspaces for both frontend and backend allows to manage dependencies later in the project root.

### Starting the frontend development server
```shell
cd doorbell-frontend/
npm run 
```
