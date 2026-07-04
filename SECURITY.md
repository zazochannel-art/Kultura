# Security Policy

## Reporting Security Vulnerabilities

If you discover a security vulnerability in Kultura, please send an email to `support@kultura.app` instead of using the issue tracker.

## Sensitive Information Guidelines

### API Keys

1. **Never commit API keys** to the repository
2. Store API keys in `local.properties` (already in `.gitignore`)
3. Example `local.properties` format:
   ```properties
   gemini.api.key=YOUR_API_KEY_HERE
   supabase.url=YOUR_SUPABASE_URL
   supabase.anon.key=YOUR_SUPABASE_KEY
   ```

4. For CI/CD (GitHub Actions), use **Secrets**:
   - Go to repository Settings → Secrets and variables → Actions
   - Add secrets for `GEMINI_API_KEY`, `SUPABASE_URL`, etc.
   - Reference in workflows: `${{ secrets.GEMINI_API_KEY }}`

### Backup Files

- Backup files (`.backup`, `.bak`) are ignored by Git
- Do not store backups in version control
- Use cloud storage or encrypted local backups instead

### IDE Configuration

- `.idea/` folder is ignored
- It may contain sensitive run configurations
- Each developer should configure their own IDE settings locally

## Build Configuration

- `local.properties` contains machine-specific and sensitive settings
- It is ignored by Git and not committed
- Each developer must create their own `local.properties` file

## Supabase Auth

- Email confirmation links are handled via `confirmed.html` deep links
- The `kultura://login` scheme is registered in `AndroidManifest.xml`
- Ensure deep link verification is enabled (see `android:autoVerify="true"`)

## Dependencies

- Review dependency updates regularly
- Keep Kotlin, Compose, and Android libraries up to date
- Run `./gradlew dependencyUpdates` to check for available updates

## Best Practices

1. Use environment variables for sensitive data in local development
2. Enable commit signing (GPG keys)
3. Use branch protection rules on `main`
4. Require code reviews before merging
5. Scan dependencies for vulnerabilities (e.g., `./gradlew dependencyCheckAnalyze`)

## Contact

For security questions or concerns, reach out to `support@kultura.app`.
