import * as core from '@actions/core';

import { validateStatus, isValidCondition } from './utils';
import { RocketChat, IncomingWebhookDefaultArguments } from './rocketchat';

async function run() {
	try {
		const status: string = validateStatus(core.getInput('type', { required: true }).toLowerCase());
		const jobName: string = core.getInput('job_name', { required: true });
		const url: string = process.env.ROCKETCHAT_WEBHOOK || core.getInput('url');
		const githubUrl: string = process.env.GITHUB_URL || core.getInput('github_url');
		let mention: string = core.getInput('mention');
		let mentionCondition: string = core.getInput('mention_if').toLowerCase();
		const options: IncomingWebhookDefaultArguments = {
			username: core.getInput('username'),
			channel: core.getInput('channel'),
			icon_emoji: core.getInput('icon_emoji')
		};
		const commitFlag: boolean = core.getInput('commit') === 'true';
		const token: string = core.getInput('token');
		const additionalURL: boolean = core.getInput('additional_url') === 'true';
		const additionalURLName: string = core.getInput('additional_url_name');
		const additionalURLValue: string = core.getInput('additional_url_value');

		if (mention && !isValidCondition(mentionCondition)) {
			mention = '';
			mentionCondition = '';
			console.warn(`
				Ignore Rocket.Chat message mention:
				mention_if: ${mentionCondition} is invalid
			`);
		}

		if (url === '') {
			throw new Error(`
				[Error] Missing Rocket.Chat Incoming Webhooks URL.
				Please configure "ROCKETCHAT_WEBHOOK" as environment variable or
				specify the key called "url" in "with" section.
			`);
		}


		const rocketchat = new RocketChat();
		const payload = await rocketchat.generatePayload(jobName, status, mention, mentionCondition, commitFlag, githubUrl, additionalURL, token, additionalURLName, additionalURLValue);
		await rocketchat.notify(url, options, payload);
		console.info('Sent message to Rocket.Chat');
	} catch (err: any) {
		core.setFailed(err.message);
	}
}

run();
