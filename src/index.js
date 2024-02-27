import OpenAI from 'openai'


const github = require('@actions/github')
const core = require('@actions/core')

console.log('Running review script...')
const client = new OpenAI({apiKey: process.env.INPUT_OPENAI_API_KEY})

class PullRequestReviewer {
  constructor(diffText) {
    this.diffText = diffText
  }

  async createThread() {
    const messages = [{
      role: 'user',
      content: this.diffText
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

  async review() {
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

}


async function run() {
  try {
    console.log('Run function started...')
    const token = core.getInput('GITHUB_TOKEN', {required: true})
    const octokit = github.getOctokit(token)

    console.log('Getting pull request...')
    const {context = {}} = github
    console.log('Context:', context)
    const {pull_request} = context.payload

    if (!pull_request) {
      core.setFailed('Could not get pull request from context')
      return
    }

    const {data: diff} = await octokit.rest.pulls.get({
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: pull_request.number,
      mediaType: {
        format: 'diff'
      }
    });


    console.log('Running review script...')

    const reviewer = new PullRequestReviewer(diff)
    const output = await reviewer.review()

    console.log('Review generated successfully.')
    const prNumber = context.payload.number
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/')
    console.log('Owner:', owner)
    console.log('Repo:', repo)
    // Post comment to PR
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: output
    })

    console.log('Review comment posted successfully.')

  } catch (error) {
    console.error('Failed to run review:', error)
    process.exit(1)
  }
}

await run()
