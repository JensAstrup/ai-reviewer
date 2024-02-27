import OpenAI from 'openai'


const github = require('@actions/github')
const core = require('@actions/core')

const client = new OpenAI({apiKey: process.env.INPUT_OPENAI_API_KEY})


class PullRequestReviewer {
  constructor() {
    const {context = {}} = github
    this.context = context
    this.octokit = github.getOctokit(token)
  }

  async getDiff() {
    console.log('Run function started...')
    const token = core.getInput('GITHUB_TOKEN', {required: true})


    console.log('Getting pull request...')

    const {pull_request} = this.context.payload

    if (!pull_request) {
      core.setFailed('Could not get pull request from context')
      return
    }

    const {data: diff} = await this.octokit.rest.pulls.get({
      owner: this.context.repo.owner,
      repo: this.context.repo.repo,
      pull_number: pull_request.number,
      mediaType: {
        format: 'diff'
      }
    })
    return diff
  }

  async createThread() {
    const messages = [{
      role: 'user',
      content: this.getDiff()
    }]
    return client.beta.threads.create({
        messages: messages
      }
    )
  }

  async runThread() {
    const thread = await this.createThread()
    const run = await client.beta.threads.runs.create(
      thread.id,
      {assistant_id: 'asst_rT9Jf2KyaPezH88ELvs8SfZ9'}
    )
    return {run: run, threadId: thread.id}
  }

  async retrieveThread(runId, threadId) {
    return client.beta.threads.runs.retrieve(threadId, runId)
  }

  async getReview() {
    let {run, threadId} = await this.runThread()
    while (!['cancelled', 'failed', 'completed', 'expired'].includes(run.status)) {
      run = await this.retrieveThread(run.id, threadId)
      await new Promise(resolve => setTimeout(resolve, 3000))
    }
    const messages = await client.beta.threads.messages.list(
      threadId
    )
    return messages.data[0].content[0].text.value
  }

  async commentOnPullRequest(comment) {
    const prNumber = this.context.payload.number
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/')
    await this.octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: comment
    })
  }

  async review() {
    const review = await this.getReview()
    await this.commentOnPullRequest(review)
    return review

  }
}


async function run() {
  try {
    const reviewer = new PullRequestReviewer()
    await reviewer.review()
    console.log('Review comment posted successfully.')

  } catch (error) {
    console.error('Failed to run review:', error)
    process.exit(1)
  }
}

await run()
