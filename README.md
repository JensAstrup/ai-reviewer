# AI Reviewer

## Description
AI Reviewer utilizes OpenAI's GPT-4 to generate a review of Pull Requests. 
It is designed to help developers and code reviewers to save time and effort in reviewing code 
changes and is especially helpful for developers working on solo projects.

## Configuration
AI Reviewer is a GitHub Action that can be configured to run on Pull Requests. Example workflow configuration:

```yaml
name: Pull Request Reviews

on:
  pull_request:
    types: [ opened, synchronize ]


jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - name: Review Pull Request
        uses: "JensAstrup/ai-reviewer@v1.0.1"
        with:
          OPENAI_API_KEY: ${{ secrets.OPENAI_TOKEN }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```
