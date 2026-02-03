# Contributing to Designer Feedback

Thank you for your interest in contributing to Designer Feedback! This document provides guidelines for contributing to the project.

## Ways to Contribute

### Reporting Bugs

Before submitting a bug report:

1. Check the [existing issues](https://github.com/pproenca/designer-feedback/issues) to avoid duplicates
2. Try to reproduce the issue in the latest version
3. Gather relevant information (browser version, extension version, steps to reproduce)

When submitting a bug report, include:

- A clear, descriptive title
- Steps to reproduce the issue
- Expected vs actual behavior
- Screenshots if applicable
- Browser and extension version

### Suggesting Features

Feature suggestions are welcome! When proposing a feature:

1. Check existing issues and discussions first
2. Describe the problem your feature would solve
3. Explain your proposed solution
4. Consider alternative approaches

### Contributing Code

1. Fork the repository
2. Create a feature branch from `master`
3. Make your changes
4. Ensure tests pass
5. Submit a pull request

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/designer-feedback.git
cd designer-feedback

# Install dependencies
npm install

# Start development server
npm run dev
```

## Code Style

### Commits

We use [Conventional Commits](https://www.conventionalcommits.org/). Commit messages are validated via lefthook + commitlint.

Format: `<type>(<scope>): <description>`

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:
- `feat(toolbar): add category filter dropdown`
- `fix(export): handle empty annotation list`
- `docs: update installation instructions`

### Code Quality

- **TypeScript**: Strict mode enabled, no unused variables
- **ESLint**: Zero warnings enforced (`npm run lint`)
- **Formatting**: Consistent style via ESLint rules

Run checks before submitting:

```bash
npm run typecheck  # TypeScript checking
npm run lint       # ESLint (zero warnings enforced)
npm run test       # Unit tests
npm run test:e2e   # E2E tests (requires build)
```

## Pull Request Process

1. **Branch naming**: Use descriptive names like `feature/annotation-export` or `fix/marker-positioning`
2. **PR title**: Follow conventional commit format
3. **Description**: Explain what changes you made and why
4. **Tests**: Add tests for new functionality
5. **Review**: Address reviewer feedback

### PR Checklist

- [ ] Code follows the project style guidelines
- [ ] Self-reviewed my own code
- [ ] Added tests for new functionality
- [ ] All tests pass locally
- [ ] Updated documentation if needed

## Project Structure

Key directories:

```
entrypoints/     # Extension entry points (background, content scripts)
components/      # React components
stores/          # Zustand state management
utils/           # Utility functions
types/           # TypeScript definitions
tests/           # E2E tests (Playwright)
```

## Questions?

If you have questions, feel free to open a discussion or reach out via issues.
