import * as github from '@actions/github';
import * as core from '@actions/core';
import { Context } from '@actions/github/lib/context';
import axios from 'axios';
import { OctokitOptions } from '@octokit/core/dist-types/types';
import { Committer } from './utils';

export interface IncomingWebhookDefaultArguments {
	username: string;
	channel: string;
	icon_emoji: string;
}

interface Accessory {
	color: string;
	result: string;
}

class Helper {
	readonly context: Context = github.context;

	public get success(): Accessory {
		return {
			color: '#2cbe4e',
			result: 'Succeeded'
		};
	}

	public get failure(): Accessory {
		return {
			color: '#cb2431',
			result: 'Failed'
		};
	}

	public get cancelled(): Accessory {
		return {
			color: '#ffc107',
			result: 'Cancelled'
		};
	}

	public get isPullRequest(): boolean {
		const { eventName } = this.context;
		return eventName === 'pull_request';
	}

	public get getBranch(): string {
		return this.context.payload.workflow_run.head_branch;
	}

	public get baseFields(): any[] {
		const { sha, eventName } = this.context;
		const { owner, repo } = this.context.repo;
		const { number } = this.context.issue;

		const githubUrl: string = process.env.GITHUB_URL || core.getInput('github_url') || 'https://github.com';
		const repoUrl: string = `${githubUrl}/${owner}/${repo}`;
		const branch = this.getBranch;
		let actionUrl: string = repoUrl;
		let eventUrl: string = eventName;

		if (this.isPullRequest) {
			eventUrl = `[${eventName}](${repoUrl}/pull/${number})`;
			actionUrl += `/pull/${number}/checks`;
		} else {
			actionUrl += `/commit/${sha}/checks`;
		}

		const failedJobsTitle = this.context.payload.workflow_run.name;
		const failedJobsUrl = this.context.payload.workflow_run.html_url;
		const commitsUrl = `${repoUrl}/commits/${branch}`;

		return [
			{
				short: true,
				title: 'ran branch',
				value: branch
			},
			{
				short: true,
				title: 'event name',
				value: eventUrl
			},
			{
				short: true,
				title: 'failed workflow',
				value: `[${failedJobsTitle}](${failedJobsUrl})`
			},
			{
				short: true,
				title: 'last commits',
				value: `[Commits](${commitsUrl})`
			},
			{
				short: false,
				title: 'repository',
				value: `[${owner}/${repo}](${repoUrl})`
			}
		];
	}

	private async getFirstFailedWorkflowAfterSuccess(octokit, owner: string, repo: string, branch: string): Promise<any> {
		const workflows = await octokit.rest.actions.listWorkflowRunsForRepo({ owner, repo });
		const workflowRuns = workflows.data.workflow_runs.filter(run =>
			run.name !== this.context.workflow
		);

		let lastWorkflow = null;
		for (const workflow of workflowRuns) {
			if (workflow.head_branch === branch && workflow.status === "completed") {
				if (workflow.conclusion === "success") {
					break;
				} else if (workflow.conclusion === "failure") {
					lastWorkflow = workflow;
				}

			}
		}

		if (lastWorkflow === null) {
			lastWorkflow = workflowRuns.last();
		}
		return lastWorkflow;
	}

	private async getCommitsSinceWorkflow(octokit, owner: string, repo: string, workflow: any): Promise<any[]> {
		let latestRunTimestamp = workflow.run_started_at;

		if (!latestRunTimestamp) {
			console.error("No completed runs found for the specified workflow.");
			return [];
		}
		const commits = await octokit.rest.repos.listCommits({ owner, repo });
		return commits.data;
	}



	private async getCommitters(commits: any[]): Promise<Committer[]> {
		const uniqueCommitters: { [url: string]: Committer } = {};

		for (const commit of commits) {
			const commiter = commit.author;
			if (uniqueCommitters[commiter.html_url]) {
				continue;
			}

			uniqueCommitters[commiter.html_url] = { name: commiter.login || "", url: commiter.html_url };
		}

		return Object.values(uniqueCommitters);
	}


	public async getPossibleGuiltiesCommitter(token: string, branch: string) {
		let result = [];
		let options: OctokitOptions = {
			log: {
				debug: console.debug,
				info: console.info,
				warn: console.warn,
				error: console.error
			}
		};
		const { owner, repo } = this.context.repo;
		const octokit = github.getOctokit(token, options);

		const workflow = await this.getFirstFailedWorkflowAfterSuccess(octokit, owner, repo, branch);
		if (!workflow) { return result; }
		const commits = await this.getCommitsSinceWorkflow(octokit, owner, repo, workflow);
		if (!commits || commits.length <= 0) { return result; }
		const committers = await this.getCommitters(commits);

		const commitersString: string = committers.map((committer) => `[${committer.name}](${committer.url})`).join("\n");
		return [{
			short: true,
			title: 'Last Commiters',
			value: commitersString
		}];
	}

	public async getAdditionalURLFields(additionalURLName: string, additionalURLValue: string) {
		return [
			{
				short: true,
				title: additionalURLName,
				value: `[Link](${additionalURLValue})`
			}

		];
	}
}

export class RocketChat {
	private isMention(condition: string, status: string): boolean {
		return condition === 'always' || condition === status;
	}

	public async generatePayload(jobName: string, status: string, mention: string, mentionCondition: string, commitFlag: boolean, githubUrl: string, additionalURL: boolean, token?: string, additionalURLName?: string, additionalURLValue?: string): Promise<any> {
		const helper = new Helper();
		const notificationType: Accessory = helper[status];
		const tmpText: string = `${jobName} ${notificationType.result}`;
		const text = mention && this.isMention(mentionCondition, status) ? `@${mention} ${tmpText}` : tmpText;

		const fields = helper.baseFields;

		if (commitFlag && token) {
			const commitsInfo = await helper.getPossibleGuiltiesCommitter(token, helper.getBranch);
			if (commitsInfo.length > 0) {
				Array.prototype.push.apply(fields, commitsInfo);
			}
		}

		if (additionalURL && additionalURLName && additionalURLValue) {
			const additionalURLFields = await helper.getAdditionalURLFields(additionalURLName, additionalURLValue);
			Array.prototype.push.apply(fields, additionalURLFields);
		}

		const attachments = {
			color: notificationType.color,
			fields
		};

		const payload = {
			text,
			attachments: [attachments]
		};

		return payload;
	}

	public async notify(url: string, options: IncomingWebhookDefaultArguments, payload: any): Promise<void> {
		const data = {
			...options,
			...payload
		};

		console.info(`
			Generated payload for Rocket.Chat:
			${JSON.stringify(data, null, 2)}
		`);

		const response = await axios.post(url, data);

		console.info(`
			Response:
			${response.data}
		`);

		if (response.status !== 200) {
			throw new Error(`
				Failed to send notification to Rocket.Chat
				Response: ${response.data}
			`);
		}
	}
}
