# Resume Tailor
## Development

- Install Dependencies

  ```sh
  npm install
  ```

- Initial setup:

  ```sh
  npm run setup
  ```

- Start dev server:

  ```sh
  npm run dev
  ```

This starts your app in development mode, rebuilding assets on file changes.

The database seed script creates a new user with some data you can use to get
started:

- Username: `kody`
- Password: `kodylovesyou`

### Stripe Development

If you need to test any changes with stripe, you'll need to start the stripe cli

- Start stripe CLI

  ```sh
    npm run stripe listen
  ```
